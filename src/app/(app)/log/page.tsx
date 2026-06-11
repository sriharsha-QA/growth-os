import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getLocalToday } from "@/lib/domain/day";
import type { Trackable } from "@/lib/domain/types";
import { QuickLogForm } from "@/components/log/quick-log-form";

export const dynamic = "force-dynamic";

export default async function LogPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: requestedDate } = await searchParams;
  const supabase = await createSupabaseServer();

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone, day_rollover_hour")
    .eq("id", "f67c40ae-4dad-4a61-bb16-f2e721dd29f5")
    .single();
  if (!profile) redirect("/login");

  const { data: challenge } = await supabase
    .from("challenges")
    .select("id, name, start_date, duration_days")
    .eq("status", "active")
    .maybeSingle();
  if (!challenge) redirect("/onboarding");

  const today = await getLocalToday(supabase, profile);

  // Backfill (P1-11): a past date within the challenge window may be logged;
  // future dates and pre-start dates fall back to today.
  let logDate = today;
  if (
    requestedDate &&
    /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) &&
    requestedDate < today &&
    requestedDate >= challenge.start_date
  ) {
    logDate = requestedDate;
  }
  const isBackfill = logDate !== today;

  const { data: trackables } = await supabase
    .from("trackables")
    .select("*")
    .eq("challenge_id", challenge.id)
    .order("sort_order");

  const ids = (trackables ?? []).map((t) => t.id);

  // today's values (edit mode) + most recent prior values (prefill/outlier hints)
  const [{ data: todayRows }, { data: priorRows }, { data: todayActs }] = await Promise.all([
    supabase
      .from("metric_snapshots")
      .select("trackable_id, metric_type, value")
      .in("trackable_id", ids)
      .eq("local_date", logDate),
    supabase
      .from("metric_snapshots")
      .select("trackable_id, metric_type, value, local_date")
      .in("trackable_id", ids)
      .lt("local_date", logDate)
      .order("local_date", { ascending: false })
      .limit(200),
    supabase
      .from("daily_activities")
      .select("trackable_id, activity_key, count")
      .in("trackable_id", ids)
      .eq("local_date", logDate),
  ]);

  const lastKnown: Record<string, { value: number; date: string }> = {};
  for (const r of priorRows ?? []) {
    const key = `${r.trackable_id}:${r.metric_type}`;
    if (!(key in lastKnown)) lastKnown[key] = { value: Number(r.value), date: r.local_date };
  }

  return (
    <div className="mx-auto max-w-xl">
      <div style={{ marginBottom: "4px" }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "11px", letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text3)" }}>
          {isBackfill ? `Backfill · ${logDate}` : logDate}
        </p>
        <h1 style={{ fontSize: "22px", fontWeight: 700, color: "var(--text)", marginTop: "4px", letterSpacing: "-0.01em" }}>
          {isBackfill ? "Fill a missed day" : "Log today"}
        </h1>
        {isBackfill && (
          <p style={{ fontSize: "13px", color: "var(--text3)", marginTop: "4px" }}>
            Pace and streak recalculate automatically once saved.
          </p>
        )}
      </div>
      <div className="mt-6">
        <QuickLogForm
          challengeId={challenge.id}
          today={logDate}
          trackables={(trackables ?? []) as Trackable[]}
          todayValues={(todayRows ?? []).map((r) => ({
            trackableId: r.trackable_id,
            metricType: r.metric_type,
            value: Number(r.value),
          }))}
          lastKnown={lastKnown}
          todayActivities={(todayActs ?? []).map((a) => ({
            trackableId: a.trackable_id,
            activityKey: a.activity_key,
            count: a.count,
          }))}
        />
      </div>
    </div>
  );
}
