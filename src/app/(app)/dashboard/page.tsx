import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getLocalToday } from "@/lib/domain/day";
import { computeStreak, type DailyProgressRow, type Trackable } from "@/lib/domain/types";
import { TrackableCard } from "@/components/dashboard/trackable-card";
import { TrajectoryChart } from "@/components/charts/trajectory-chart";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createSupabaseServer();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, timezone, day_rollover_hour")
    .eq("id", "00000000-0000-0000-0000-000000000001")
    .single();
  if (!profile) redirect("/login");

  const { data: challenge } = await supabase
    .from("challenges")
    .select("id, name, start_date, duration_days, pacing_model, status, user_id")
    .eq("status", "active")
    .maybeSingle();
  if (!challenge) redirect("/onboarding");

  const today = await getLocalToday(supabase, profile);

  const [{ data: dayIndexData }, { data: trackables }, { data: progress }, { data: checkins }, { data: annotations }] =
    await Promise.all([
      supabase.rpc("fn_day_index", { p_challenge_id: challenge.id }),
      supabase
        .from("trackables")
        .select("*")
        .eq("challenge_id", challenge.id)
        .order("sort_order"),
      supabase
        .from("v_daily_progress")
        .select("*")
        .eq("challenge_id", challenge.id)
        .order("local_date"),
      supabase
        .from("check_ins")
        .select("local_date")
        .eq("challenge_id", challenge.id)
        .eq("type", "daily_log")
        .order("local_date", { ascending: false })
        .limit(120),
      supabase
        .from("annotations")
        .select("local_date, label, kind")
        .eq("challenge_id", challenge.id)
        .order("local_date", { ascending: true })
        .limit(200),
    ]);

  const dayIndex = (dayIndexData as number) ?? 0;
  const rows = (progress ?? []) as DailyProgressRow[];
  const allTrackables = (trackables ?? []) as Trackable[];

  const latestByTrackable = new Map<string, DailyProgressRow>();
  for (const r of rows) latestByTrackable.set(r.trackable_id, r); // rows sorted asc → last wins

  const checkinDates = (checkins ?? []).map((c) => c.local_date as string);
  const streak = computeStreak(checkinDates, today);
  const loggedToday = checkinDates.includes(today);

  const yesterday = new Date(today + "T00:00:00Z");
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayKey = yesterday.toISOString().slice(0, 10);
  const missedYesterday =
    yesterdayKey >= challenge.start_date && !checkinDates.includes(yesterdayKey);

  const firstName = profile.display_name?.split(" ")[0] ?? "there";

  return (
    <div className="space-y-6">
      {/* Signature: the instrument strip */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">{challenge.name}</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
            <span className="font-mono tabular-nums">
              DAY {String(Math.min(dayIndex, challenge.duration_days)).padStart(2, "0")}
            </span>
            <span className="text-muted"> / {challenge.duration_days}</span>
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="font-mono text-xl tabular-nums">{streak}🔥</p>
            <p className="text-[11px] text-muted">day streak</p>
          </div>
          {!loggedToday && (
            <Link
              href="/log"
              className="inline-flex h-12 items-center justify-center rounded-lg bg-accent px-6 text-base font-medium text-white transition-colors hover:bg-accent/90"
            >
              Log today
            </Link>
          )}
        </div>
      </div>

      {!loggedToday && (
        <Card className="border-accent/30 bg-accent/5">
          <CardContent className="flex items-center justify-between gap-3 py-3">
            <p className="text-sm">
              Hey {firstName} — today&apos;s numbers aren&apos;t in yet. Two minutes, four fields.
            </p>
            <Link href="/log" className="shrink-0 text-sm font-medium text-accent hover:underline">
              Log now →
            </Link>
          </CardContent>
        </Card>
      )}

      {missedYesterday && (
        <Card>
          <CardContent className="flex items-center justify-between gap-3 py-3">
            <p className="text-sm text-muted">
              {yesterdayKey} has no entry — gaps stay visible on the chart unless you fill them.
            </p>
            <Link
              href={`/log?date=${yesterdayKey}`}
              className="shrink-0 text-sm font-medium text-accent hover:underline"
            >
              Backfill {yesterdayKey.slice(5)} →
            </Link>
          </CardContent>
        </Card>
      )}

      {streak > 0 && streak % 7 === 0 && loggedToday && (
        <Card className="border-accent/40 bg-accent/5">
          <CardContent className="py-3 text-sm">
            <span className="font-mono font-medium tabular-nums">{streak} days straight.</span>{" "}
            {streak / 7} {streak === 7 ? "full week" : "full weeks"} of showing up — that&apos;s the
            whole game.
          </CardContent>
        </Card>
      )}

      {/* Trackable cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {allTrackables.map((t) => (
          <TrackableCard key={t.id} trackable={t} latest={latestByTrackable.get(t.id) ?? null} />
        ))}
      </div>

      {/* Trajectory */}
      {rows.length >= 2 ? (
        <Card>
          <CardContent className="pt-4">
            <TrajectoryChart
              rows={rows}
              trackables={allTrackables.map((t) => ({ id: t.id, name: t.name }))}
              annotations={(annotations ?? []) as { local_date: string; label: string; kind: string }[]}
              durationDays={challenge.duration_days}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted">
            Your trajectory appears after a couple of days of logging. Day {Math.max(dayIndex, 1)} of{" "}
            {challenge.duration_days} — the line starts here.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
