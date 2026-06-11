"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getLocalToday } from "@/lib/domain/day";
import { quickLogInput, type ActionResult } from "@/lib/domain/schemas";

/**
 * The hot path (v3.1 P1-2). Upserts N snapshots + activities + the daily
 * check-in for one local_date. Server-side outlier re-check; audit rows are
 * written by the DB trigger on any correction. Idempotent for offline replay.
 */
export async function saveQuickLog(raw: unknown): Promise<ActionResult<{ localDate: string }>> {
  const parsed = quickLogInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input", code: "invalid" };
  }
  const input = parsed.data;

  const supabase = await createSupabaseServer();
  const userId = "f67c40ae-4dad-4a61-bb16-f2e721dd29f5";

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone, day_rollover_hour")
    .eq("id", userId)
    .single();
  if (!profile) return { ok: false, error: "Profile missing", code: "no_profile" };

  // Validate the target date: today by default; backfill must be within the window.
  const today = await getLocalToday(supabase, profile);
  const localDate = input.localDate ?? today;
  if (localDate > today) return { ok: false, error: "Can't log a future day", code: "future_date" };

  const { data: challenge } = await supabase
    .from("challenges")
    .select("id, start_date")
    .eq("id", input.challengeId)
    .single();
  if (!challenge) return { ok: false, error: "Challenge not found", code: "not_found" };
  if (localDate < challenge.start_date) {
    return { ok: false, error: "Date is before the challenge started", code: "before_start" };
  }

  // Server-side outlier re-check (U6/F3): >10× the last known value, or an
  // absolute jump > 5,000, needs explicit confirmation.
  if (!input.outlierConfirmed) {
    const ids = input.snapshots.map((s) => s.trackableId);
    const { data: lastRows } = await supabase
      .from("metric_snapshots")
      .select("trackable_id, metric_type, value, local_date")
      .in("trackable_id", ids)
      .lt("local_date", localDate)
      .order("local_date", { ascending: false });

    for (const s of input.snapshots) {
      const last = lastRows?.find(
        (r) => r.trackable_id === s.trackableId && r.metric_type === s.metricType
      );
      if (!last) continue;
      const prev = Number(last.value);
      const jump = Math.abs(s.value - prev);
      if ((prev > 0 && s.value > prev * 10) || jump > 5000) {
        return {
          ok: false,
          code: "outlier_confirm",
          error: `That's a change of ${jump.toLocaleString()} since ${last.local_date}. Save anyway?`,
        };
      }
    }
  }

  // Upserts. supabase-js has no multi-statement transaction; each upsert is
  // individually idempotent (DB uniques), so replays converge — acceptable
  // per v3.1 T7 scope. A failure mid-way leaves a re-runnable state.
  const snapshotRows = input.snapshots.map((s) => ({
    user_id: userId,
    trackable_id: s.trackableId,
    local_date: localDate,
    metric_type: s.metricType,
    value: s.value,
    source: "manual" as const,
  }));
  const { error: snapErr } = await supabase
    .from("metric_snapshots")
    .upsert(snapshotRows, { onConflict: "trackable_id,local_date,metric_type" });
  if (snapErr) return { ok: false, error: snapErr.message, code: "db" };

  if (input.activities.length > 0) {
    const activityRows = input.activities.map((a) => ({
      user_id: userId,
      trackable_id: a.trackableId,
      local_date: localDate,
      activity_key: a.activityKey,
      count: a.count,
    }));
    const { error: actErr } = await supabase
      .from("daily_activities")
      .upsert(activityRows, { onConflict: "trackable_id,local_date,activity_key" });
    if (actErr) return { ok: false, error: actErr.message, code: "db" };
  }

  const { error: ciErr } = await supabase
    .from("check_ins")
    .upsert(
      { user_id: userId, challenge_id: input.challengeId, local_date: localDate, type: "daily_log" },
      { onConflict: "challenge_id,local_date,type", ignoreDuplicates: true }
    );
  if (ciErr) return { ok: false, error: ciErr.message, code: "db" };

  revalidatePath("/dashboard");
  revalidatePath("/log");
  return { ok: true, data: { localDate } };
}
