/**
 * Reddit karma auto-sync — Supabase Edge Function.
 *
 * Called by:
 *   - Vercel cron (nightly, via /api/cron/nightly → fetch this function)
 *   - Manual trigger from settings page
 *
 * What it does:
 *   1. Fetches Reddit OAuth2 credentials from Supabase secrets
 *      (REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_REFRESH_TOKEN)
 *   2. Exchanges refresh token for access token (no user interaction needed)
 *   3. Calls GET /api/v1/me — returns link_karma + comment_karma
 *   4. Upserts a metric_snapshot for the trackable with platform=reddit
 *      and source=api_sync for today's local_date
 *   5. Returns the synced values and timestamp
 *
 * Why Reddit first:
 *   - OAuth2 with refresh tokens — no browser redirect needed after initial setup
 *   - /api/v1/me is a single call, returns karma immediately
 *   - Rate limits are generous (60 requests/minute for OAuth apps)
 *   - Medium/Substack have no public API; LinkedIn requires OAuth flow
 *
 * Setup (one-time):
 *   1. Create a Reddit app at https://www.reddit.com/prefs/apps
 *      Type: script (not web app — script type allows refresh tokens)
 *   2. supabase secrets set REDDIT_CLIENT_ID=xxx REDDIT_CLIENT_SECRET=xxx
 *   3. Get your refresh token (see README in this directory)
 *   4. supabase secrets set REDDIT_REFRESH_TOKEN=xxx REDDIT_USERNAME=xxx
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const clientId     = Deno.env.get("REDDIT_CLIENT_ID");
    const clientSecret = Deno.env.get("REDDIT_CLIENT_SECRET");
    const refreshToken = Deno.env.get("REDDIT_REFRESH_TOKEN");
    const username     = Deno.env.get("REDDIT_USERNAME");

    if (!clientId || !clientSecret || !refreshToken || !username) {
      return new Response(
        JSON.stringify({ ok: false, error: "Reddit credentials not configured. Set REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_REFRESH_TOKEN, REDDIT_USERNAME in Supabase secrets." }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    // 1. Exchange refresh token for access token
    const tokenRes = await fetch("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": `growth-os/1.0 by ${username}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    if (!tokenRes.ok) {
      const txt = await tokenRes.text();
      return new Response(
        JSON.stringify({ ok: false, error: `Reddit token exchange failed: ${tokenRes.status} ${txt}` }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    const { access_token } = await tokenRes.json() as { access_token: string };

    // 2. Fetch karma
    const meRes = await fetch("https://oauth.reddit.com/api/v1/me", {
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "User-Agent": `growth-os/1.0 by ${username}`,
      },
    });

    if (!meRes.ok) {
      const txt = await meRes.text();
      return new Response(
        JSON.stringify({ ok: false, error: `Reddit /me failed: ${meRes.status} ${txt}` }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    const me = await meRes.json() as { link_karma: number; comment_karma: number; total_karma: number };
    const { link_karma, comment_karma } = me;

    // 3. Find active reddit trackable(s)
    const { data: trackables, error: tErr } = await supabase
      .from("trackables")
      .select("id, primary_metric, challenge_id")
      .contains("config", { platform: "reddit" })
      .eq("sync_enabled", true);

    if (tErr) {
      return new Response(
        JSON.stringify({ ok: false, error: tErr.message }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    if (!trackables || trackables.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, message: "No Reddit trackables with sync_enabled=true found.", synced: 0 }),
        { headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    // 4. Get today's local_date via fn_local_date
    const USER_ID = "00000000-0000-0000-0000-000000000001";
    const { data: profile } = await supabase
      .from("profiles")
      .select("timezone, day_rollover_hour")
      .eq("id", USER_ID)
      .single();

    const tz       = profile?.timezone ?? "Asia/Kolkata";
    const rollover = profile?.day_rollover_hour ?? "04:00";
    const { data: todayDate } = await supabase.rpc("fn_local_date", {
      ts: new Date().toISOString(), tz, rollover,
    });
    const localDate = String(todayDate);

    // 5. Upsert snapshots
    const synced: string[] = [];
    for (const t of trackables) {
      const value = t.primary_metric === "karma"
        ? link_karma + comment_karma
        : t.primary_metric === "post_karma"
        ? link_karma
        : t.primary_metric === "comment_karma"
        ? comment_karma
        : link_karma + comment_karma; // default to total

      const { error: upErr } = await supabase
        .from("metric_snapshots")
        .upsert({
          user_id:      USER_ID,
          trackable_id: t.id,
          local_date:   localDate,
          metric_type:  t.primary_metric,
          value,
          source: "api_sync",
        }, { onConflict: "trackable_id,local_date,metric_type" });

      if (!upErr) {
        synced.push(t.id);
        // Log to sync_runs
        await supabase.from("sync_runs").insert({
          user_id:     USER_ID,
          provider:    "reddit",
          finished_at: new Date().toISOString(),
          status:      "ok",
          summary:     { link_karma, comment_karma, local_date: localDate, trackable_id: t.id },
        });
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        synced: synced.length,
        local_date: localDate,
        link_karma,
        comment_karma,
        total_karma: link_karma + comment_karma,
      }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }
});
