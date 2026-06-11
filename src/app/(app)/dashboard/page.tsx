import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getLocalToday } from "@/lib/domain/day";
import { computeStreak, type DailyProgressRow, type Trackable } from "@/lib/domain/types";
import { computeForecast, computeFocus } from "@/lib/domain/forecast";
import { CommandHeader } from "@/components/dashboard/command-header";
import { TrackableCard } from "@/components/dashboard/trackable-card";
import { ForecastCard } from "@/components/dashboard/forecast-card";
import { DailyFocusCard } from "@/components/dashboard/daily-focus-card";
import { TrajectoryChart } from "@/components/charts/trajectory-chart";

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

  const [
    { data: dayIndexData },
    { data: trackables },
    { data: progress },
    { data: checkins },
    { data: annotations },
  ] = await Promise.all([
    supabase.rpc("fn_day_index", { p_challenge_id: challenge.id }),
    supabase.from("trackables").select("*").eq("challenge_id", challenge.id).order("sort_order"),
    supabase.from("v_daily_progress").select("*").eq("challenge_id", challenge.id).order("local_date"),
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

  const dayIndex       = (dayIndexData as number) ?? 0;
  const rows           = (progress ?? []) as DailyProgressRow[];
  const allTrackables  = (trackables ?? []) as Trackable[];

  const latestByTrackable = new Map<string, DailyProgressRow>();
  for (const r of rows) latestByTrackable.set(r.trackable_id, r);

  const checkinDates  = (checkins ?? []).map((c) => c.local_date as string);
  const streak        = computeStreak(checkinDates, today);
  const loggedToday   = checkinDates.includes(today);

  const yesterday     = new Date(today + "T00:00:00Z");
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayKey  = yesterday.toISOString().slice(0, 10);
  const missedYesterday = yesterdayKey >= challenge.start_date && !checkinDates.includes(yesterdayKey);

  const forecast       = computeForecast(latestByTrackable, allTrackables, dayIndex, challenge.duration_days);
  const focus          = computeFocus(latestByTrackable, allTrackables);

  const pctDone        = Math.round((Math.min(dayIndex, challenge.duration_days) / challenge.duration_days) * 100);
  const daysRemaining  = Math.max(0, challenge.duration_days - dayIndex);
  const nextMilestone  = streak < 7 ? 7 : streak < 14 ? 14 : streak < 21 ? 21 : streak < 30 ? 30 : Math.ceil(streak / 7) * 7 + 7;

  return (
    <>
      <style>{`
        .intel-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .cards-grid  { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
        @media (max-width: 640px) {
          .intel-grid { grid-template-columns: 1fr; }
          .cards-grid  { grid-template-columns: 1fr; }
        }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px", paddingBottom: "24px" }}>

        {/* ─── Q1: Did I log today? ─────────────────────────────────── */}
        <CommandHeader
          challengeName={challenge.name}
          dayIndex={dayIndex}
          durationDays={challenge.duration_days}
          daysRemaining={daysRemaining}
          pctDone={pctDone}
          streak={streak}
          nextMilestone={nextMilestone}
          loggedToday={loggedToday}
        />

        {/* Streak milestone */}
        {streak > 0 && streak % 7 === 0 && loggedToday && (
          <div style={{
            background: "var(--accent-bg)",
            border: "0.5px solid var(--accent)",
            borderRadius: "14px",
            padding: "14px 18px",
          }}>
            <span style={{ fontSize: "13px", fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--accent)" }}>
              {streak} days straight.
            </span>
            <span style={{ fontSize: "13px", color: "var(--text2)", marginLeft: "6px" }}>
              {streak / 7} {streak === 7 ? "full week" : "full weeks"} of showing up. That&apos;s the whole game.
            </span>
          </div>
        )}

        {/* Log banner */}
        {!loggedToday && (
          <div style={{
            background: "var(--accent-bg)",
            border: "0.5px solid color-mix(in srgb, var(--accent) 40%, transparent)",
            borderRadius: "14px",
            padding: "13px 18px",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
          }}>
            <span style={{ fontSize: "13px", color: "var(--accent-t)" }}>
              Today&apos;s numbers aren&apos;t in — two minutes, a few fields.
            </span>
            <Link href="/log" className="inline-link" style={{
              fontSize: "13px", fontWeight: 700, color: "var(--accent)", textDecoration: "none", flexShrink: 0,
            }}>
              Log now →
            </Link>
          </div>
        )}

        {/* Backfill banner */}
        {missedYesterday && (
          <div style={{
            background: "var(--surface)",
            border: "0.5px solid var(--border)",
            borderRadius: "14px",
            padding: "12px 18px",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
          }}>
            <span style={{ fontSize: "13px", color: "var(--text3)" }}>
              {yesterdayKey} has no entry — gaps show on the chart.
            </span>
            <Link href={`/log?date=${yesterdayKey}`} className="inline-link" style={{
              fontSize: "13px", fontWeight: 700, color: "var(--accent)", textDecoration: "none", flexShrink: 0,
            }}>
              Backfill {yesterdayKey.slice(5)} →
            </Link>
          </div>
        )}

        {/* ─── Q2 + Q3: On track? What needs attention? ────────────── */}
        {allTrackables.length > 0 && (
          <div className="intel-grid">
            <DailyFocusCard focus={focus} loggedToday={loggedToday} />
            <ForecastCard forecast={forecast} dayIndex={dayIndex} durationDays={challenge.duration_days} />
          </div>
        )}

        {/* Metric cards */}
        <div className="cards-grid">
          {allTrackables.map((t, i) => (
            <TrackableCard
              key={t.id}
              trackable={t}
              latest={latestByTrackable.get(t.id) ?? null}
              index={i}
            />
          ))}
        </div>

        {/* Trajectory chart */}
        {rows.length >= 2 ? (
          <div style={{
            background: "var(--surface)",
            border: "0.5px solid var(--border)",
            borderRadius: "18px",
            padding: "20px",
          }}>
            <TrajectoryChart
              rows={rows}
              trackables={allTrackables.map((t) => ({ id: t.id, name: t.name }))}
              annotations={(annotations ?? []) as { local_date: string; label: string; kind: string }[]}
              durationDays={challenge.duration_days}
            />
          </div>
        ) : (
          <div style={{
            background: "var(--surface)",
            border: "0.5px solid var(--border)",
            borderRadius: "18px",
            padding: "36px 20px",
            textAlign: "center",
          }}>
            <div style={{ fontSize: "32px", marginBottom: "10px" }}>📈</div>
            <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text)", marginBottom: "6px" }}>
              Your trajectory starts here
            </div>
            <div style={{ fontSize: "13px", color: "var(--text3)", marginBottom: "18px", maxWidth: "280px", margin: "0 auto 18px" }}>
              Log 2 days to see your actual vs pace chart. Every line starts as a single point.
            </div>
            {!loggedToday && (
              <Link href="/log" style={{
                display: "inline-flex", padding: "10px 20px",
                background: "var(--accent)", color: "#000",
                borderRadius: "10px", fontSize: "13px", fontWeight: 700,
                textDecoration: "none",
              }}>
                Log today →
              </Link>
            )}
          </div>
        )}

      </div>
    </>
  );
}
