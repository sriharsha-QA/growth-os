import Link from "next/link";
import { fmtNumber } from "@/lib/domain/format";
import type { ForecastSummary } from "@/lib/domain/forecast";

const CONF = {
  will_exceed: { label: "Will exceed goal", color: "var(--accent)",  bg: "var(--accent-bg)",  icon: "↑" },
  on_track:    { label: "On track",          color: "var(--info)",    bg: "var(--info-bg)",    icon: "→" },
  at_risk:     { label: "At risk",           color: "var(--warn)",    bg: "var(--warn-bg)",    icon: "↓" },
  off_track:   { label: "Off track",         color: "var(--danger)",  bg: "var(--danger-bg)",  icon: "↓↓" },
} as const;

export function ForecastCard({
  forecast,
  dayIndex,
  durationDays,
}: {
  forecast: ForecastSummary;
  dayIndex: number;
  durationDays: number;
}) {
  const conf = CONF[forecast.overallConfidence];
  const daysRemaining = Math.max(0, durationDays - dayIndex);

  return (
    <div style={{
      background: "var(--surface)",
      border: `0.5px solid var(--border)`,
      borderRadius: "14px",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        background: conf.bg,
        padding: "14px 18px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
      }}>
        <div>
          <div style={{
            fontSize: "10px",
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: conf.color,
            marginBottom: "2px",
          }}>
            Day 90 Forecast
          </div>
          <div style={{
            fontSize: "18px",
            fontWeight: 700,
            color: conf.color,
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}>
            <span>{conf.icon}</span>
            <span>{conf.label}</span>
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: "22px", fontWeight: 700, fontFamily: "var(--font-mono)", color: conf.color }}>
            {daysRemaining}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text3)" }}>days left</div>
        </div>
      </div>

      {/* Tally row */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        borderBottom: `0.5px solid var(--border)`,
      }}>
        {[
          { count: forecast.aheadCount,    label: "Exceeding", color: "var(--accent)" },
          { count: forecast.onTrackCount,  label: "On track",  color: "var(--info)"   },
          { count: forecast.atRiskCount,   label: "At risk",   color: "var(--warn)"   },
          { count: forecast.offTrackCount, label: "Off track", color: "var(--danger)"  },
        ].map(({ count, label, color }) => (
          <div key={label} style={{
            padding: "10px 0",
            textAlign: "center",
            borderRight: `0.5px solid var(--border)`,
          }}>
            <div style={{ fontSize: "20px", fontWeight: 700, fontFamily: "var(--font-mono)", color: count > 0 ? color : "var(--text3)" }}>
              {count}
            </div>
            <div style={{ fontSize: "10px", color: "var(--text3)", marginTop: "2px" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Per-trackable forecasts */}
      <div>
        {forecast.trackables.map((f, i) => {
          const surplusGood = f.surplus >= 0;
          return (
            <div key={f.trackableId} style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "11px 18px",
              borderBottom: i < forecast.trackables.length - 1 ? `0.5px solid var(--border)` : "none",
              gap: "12px",
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--text)", marginBottom: "2px" }}>
                  {f.name}
                </div>
                <div style={{ fontSize: "11px", color: "var(--text3)" }}>
                  Target{" "}
                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--text2)" }}>
                    {fmtNumber(f.target)}
                  </span>
                  {" · "}
                  {f.hasVelocity ? "based on 7d velocity" : "based on pace"}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{
                  fontSize: "15px",
                  fontWeight: 700,
                  fontFamily: "var(--font-mono)",
                  color: "var(--text)",
                }}>
                  {fmtNumber(f.projected)}
                </div>
                <div style={{
                  fontSize: "11px",
                  fontFamily: "var(--font-mono)",
                  color: surplusGood ? "var(--accent)" : "var(--danger)",
                  marginTop: "1px",
                }}>
                  {surplusGood ? "+" : ""}{fmtNumber(f.surplus)} {surplusGood ? "surplus" : "deficit"}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      {!forecast.trackables.every((f) => f.hasVelocity) && (
        <div style={{
          padding: "10px 18px",
          borderTop: `0.5px solid var(--border)`,
          fontSize: "11px",
          color: "var(--text3)",
        }}>
          Forecast improves after 7 days of logged data.{" "}
          <Link href="/log" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}>
            Log today →
          </Link>
        </div>
      )}
    </div>
  );
}
