import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getLocalToday } from "@/lib/domain/day";
import { computeStreak, type DailyProgressRow, type Trackable } from "@/lib/domain/types";
import { computeWeeklySummaries, computeForecast } from "@/lib/domain/forecast";
import { fmtNumber, fmtDelta } from "@/lib/domain/format";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const supabase = await createSupabaseServer();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, timezone, day_rollover_hour")
    .eq("id", "f67c40ae-4dad-4a61-bb16-f2e721dd29f5")
    .single();
  if (!profile) redirect("/login");

  const { data: challenge } = await supabase
    .from("challenges")
    .select("id, name, start_date, duration_days, pacing_model")
    .eq("status", "active")
    .maybeSingle();
  if (!challenge) redirect("/onboarding");

  const today = await getLocalToday(supabase, profile);

  const [
    { data: dayIndexData },
    { data: trackables },
    { data: progress },
    { data: checkins },
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
      .limit(200),
  ]);

  const dayIndex      = (dayIndexData as number) ?? 0;
  const rows          = (progress ?? []) as DailyProgressRow[];
  const allTrackables = (trackables ?? []) as Trackable[];
  const checkinDates  = new Set((checkins ?? []).map((c) => c.local_date as string));
  const streak        = computeStreak(Array.from(checkinDates), today);
  const daysRemaining = Math.max(0, challenge.duration_days - dayIndex);

  const latestByTrackable = new Map<string, DailyProgressRow>();
  for (const r of rows) latestByTrackable.set(r.trackable_id, r);

  const weeks    = computeWeeklySummaries(rows, allTrackables, checkinDates, challenge.start_date, dayIndex, challenge.duration_days);
  const forecast = computeForecast(latestByTrackable, allTrackables, dayIndex, challenge.duration_days);

  // Only show weeks that have started
  const pastAndCurrentWeeks = weeks.filter((w) => w.startDay <= dayIndex);
  const CONF_COLOUR = {
    will_exceed: "var(--accent)",
    on_track:    "var(--info)",
    at_risk:     "var(--warn)",
    off_track:   "var(--danger)",
  } as const;

  return (
    <div style={{ maxWidth: "640px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px", paddingBottom: "32px" }}>

      {/* Header */}
      <div>
        <Link href="/dashboard" style={{ fontSize: "12px", color: "var(--text3)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px", marginBottom: "12px" }}>
          ← Dashboard
        </Link>
        <div style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text3)", marginBottom: "4px" }}>
          {challenge.name}
        </div>
        <h1 style={{ fontSize: "26px", fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em" }}>
          Weekly review
        </h1>
        <div style={{ fontSize: "13px", color: "var(--text3)", marginTop: "4px" }}>
          Day {dayIndex} · {streak} day streak · {daysRemaining} days remaining
        </div>
      </div>

      {/* Forecast summary */}
      <div style={{
        background: "var(--surface)",
        border: "0.5px solid var(--border)",
        borderLeft: `3px solid ${CONF_COLOUR[forecast.overallConfidence]}`,
        borderRadius: "14px",
        padding: "16px 18px",
      }}>
        <div style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: CONF_COLOUR[forecast.overallConfidence], marginBottom: "10px" }}>
          Day {challenge.duration_days} projection
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {forecast.trackables.map((f) => (
            <div key={f.trackableId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)" }}>{f.name}</div>
                <div style={{ fontSize: "11px", color: "var(--text3)", marginTop: "2px" }}>
                  Target: <span style={{ fontFamily: "var(--font-mono)", color: "var(--text2)" }}>{fmtNumber(f.target)}</span>
                  {" · "}
                  {f.hasVelocity ? "7d velocity" : "pace estimate"}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "17px", fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--text)" }}>
                  {fmtNumber(f.projected)}
                </div>
                <div style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: f.surplus >= 0 ? "var(--accent)" : "var(--danger)", marginTop: "1px" }}>
                  {f.surplus >= 0 ? "+" : ""}{fmtNumber(f.surplus)} {f.surplus >= 0 ? "surplus" : "deficit"}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Week cards — most recent first */}
      {[...pastAndCurrentWeeks].reverse().map((week) => {
        const hasData = week.trackables.some((t) => t.delta !== null);
        const consistencyPct = week.startDay <= dayIndex
          ? Math.round((week.checkInCount / Math.min(7, dayIndex - week.startDay + 1)) * 100)
          : 0;

        return (
          <div
            key={week.weekNumber}
            style={{
              background: "var(--surface)",
              border: `0.5px solid ${week.isCurrentWeek ? "var(--accent)" : "var(--border)"}`,
              borderRadius: "14px",
              overflow: "hidden",
            }}
          >
            {/* Week header */}
            <div style={{
              padding: "13px 18px",
              background: week.isCurrentWeek ? "var(--accent-bg)" : "var(--bg2)",
              borderBottom: "0.5px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <div>
                <div style={{ fontSize: "12px", fontWeight: 700, color: week.isCurrentWeek ? "var(--accent)" : "var(--text)" }}>
                  Week {week.weekNumber}
                  {week.isCurrentWeek && (
                    <span style={{ marginLeft: "8px", fontSize: "10px", fontWeight: 500, color: "var(--accent)" }}>
                      current
                    </span>
                  )}
                </div>
                <div style={{ fontSize: "11px", color: "var(--text3)", marginTop: "2px" }}>
                  Days {week.startDay}–{week.endDay} · {week.startDate.slice(5)} → {week.endDate.slice(5)}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "13px", fontWeight: 700, fontFamily: "var(--font-mono)", color: consistencyPct === 100 ? "var(--accent)" : consistencyPct >= 70 ? "var(--text2)" : "var(--danger)" }}>
                  {week.checkInCount}/{Math.min(7, dayIndex - week.startDay + 1)}
                </div>
                <div style={{ fontSize: "10px", color: "var(--text3)", marginTop: "1px" }}>
                  days logged
                </div>
              </div>
            </div>

            {/* Per-trackable deltas */}
            {hasData ? (
              <div>
                {week.trackables.map((t, i) => (
                  <div
                    key={t.trackableId}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "11px 18px",
                      borderBottom: i < week.trackables.length - 1 ? "0.5px solid var(--border)" : "none",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--text)" }}>
                        {t.name}
                        {t.isBestWeek && (
                          <span style={{
                            marginLeft: "8px", fontSize: "10px", fontWeight: 600,
                            color: "var(--accent)", background: "var(--accent-bg)",
                            padding: "1px 7px", borderRadius: "100px",
                          }}>
                            best week
                          </span>
                        )}
                      </div>
                      {t.startValue !== null && (
                        <div style={{ fontSize: "11px", color: "var(--text3)", fontFamily: "var(--font-mono)", marginTop: "2px" }}>
                          {fmtNumber(t.startValue)} → {t.endValue !== null ? fmtNumber(t.endValue) : "—"}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      {t.delta !== null ? (
                        <div style={{
                          fontSize: "16px", fontFamily: "var(--font-mono)", fontWeight: 700,
                          color: t.delta > 0 ? "var(--accent)" : t.delta < 0 ? "var(--danger)" : "var(--text3)",
                        }}>
                          {fmtDelta(t.delta)}
                        </div>
                      ) : (
                        <div style={{ fontSize: "13px", color: "var(--text3)" }}>no data</div>
                      )}
                      <div style={{ fontSize: "10px", color: "var(--text3)", marginTop: "1px" }}>{t.unit}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: "16px 18px", fontSize: "13px", color: "var(--text3)" }}>
                No entries logged this week.
                {week.isCurrentWeek && (
                  <Link href="/log" style={{ marginLeft: "6px", color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}>
                    Log today →
                  </Link>
                )}
              </div>
            )}
          </div>
        );
      })}

      {pastAndCurrentWeeks.length === 0 && (
        <div style={{
          background: "var(--surface)", border: "0.5px solid var(--border)",
          borderRadius: "14px", padding: "32px 20px", textAlign: "center",
        }}>
          <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)", marginBottom: "6px" }}>
            Week 1 in progress
          </div>
          <div style={{ fontSize: "13px", color: "var(--text3)" }}>
            Weekly summaries appear after your first 7 days.
          </div>
        </div>
      )}

    </div>
  );
}
