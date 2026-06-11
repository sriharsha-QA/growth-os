import { NextResponse } from "next/server";

/**
 * Nightly pipeline. Called by Vercel Cron (vercel.json: 0 21 * * * UTC = 02:30 IST).
 * Auth: CRON_SECRET header. Returns 401 without it.
 *
 * Phase 1: triggers Reddit karma sync if configured.
 * Phase 2+: insight generation, reminder fan-out (not yet built).
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, unknown> = {};

  // Reddit karma auto-sync
  const functionsUrl = process.env.SUPABASE_FUNCTIONS_URL;
  const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (functionsUrl && serviceKey) {
    try {
      const res = await fetch(`${functionsUrl}/reddit-sync`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
      });
      results.reddit = await res.json();
    } catch (err) {
      results.reddit = { ok: false, error: String(err) };
    }
  } else {
    results.reddit = { ok: false, error: "SUPABASE_FUNCTIONS_URL or SUPABASE_SERVICE_ROLE_KEY not set" };
  }

  return NextResponse.json({
    ok: true,
    ran: "nightly",
    at: new Date().toISOString(),
    results,
  });
}
