"use client";

import { classifyPace, type DailyProgressRow, type Trackable } from "@/lib/domain/types";
import { fmtDelta, fmtNumber } from "@/lib/domain/format";
import Link from "next/link";

const PACE_CONFIG = {
  ahead:       { border: "var(--accent)",  label: "Ahead",      textColor: "var(--accent)"  },
  on_track:    { border: "var(--info)",    label: "On track",   textColor: "var(--info)"    },
  recoverable: { border: "var(--warn)",    label: "Recoverable",textColor: "var(--warn)"    },
  recalibrate: { border: "var(--danger)",  label: "Off track",  textColor: "var(--danger)"  },
} as const;

function ProgressRing({ pct }: { pct: number }) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const fill = Math.max(0, Math.min(1, pct)) * circ;
  const display = Math.round(pct * 100);
  return (
    <svg
      width="56" height="56" viewBox="0 0 56 56"
      role="img"
      aria-label={`${display}% to goal`}
    >
      {/* track */}
      <circle cx="28" cy="28" r={r} fill="none" stroke="var(--border)" strokeWidth="4" />
      {/* fill */}
      <circle
        cx="28" cy="28" r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={`${fill} ${circ}`}
        strokeDashoffset="0"
        transform="rotate(-90 28 28)"
        style={{ transition: "stroke-dasharray 0.6s ease" }}
      />
      <text
        x="28" y="28"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="10"
        fontWeight="600"
        fontFamily="var(--font-mono)"
        fill="var(--text)"
      >
        {display}%
      </text>
    </svg>
  );
}

function TrendArrow({ velocity7d, required }: { velocity7d: number | null; required: number | null }) {
  if (velocity7d === null || required === null) return null;
  const dec = velocity7d - required;
  const good = dec >= 0;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "2px",
        fontSize: "11px",
        fontFamily: "var(--font-mono)",
        color: good ? "var(--accent)" : "var(--warn)",
      }}
    >
      {good ? "↑" : "↓"} {fmtDelta(velocity7d)}/day
    </span>
  );
}

export function TrackableCard({
  trackable,
  latest,
}: {
  trackable: Trackable;
  latest: DailyProgressRow | null;
}) {
  if (!latest) {
    return (
      <div style={{
        background: "var(--surface)",
        border: `0.5px solid var(--border)`,
        borderRadius: "14px",
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}>
        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)" }}>{trackable.name}</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: "11px", color: "var(--text3)", marginBottom: "4px" }}>Starting point</div>
            <div style={{ fontSize: "24px", fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--text)" }}>
              {fmtNumber(trackable.baseline_value)}
            </div>
            <div style={{ fontSize: "11px", color: "var(--text3)", marginTop: "2px" }}>{trackable.unit}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "11px", color: "var(--text3)", marginBottom: "4px" }}>90-day target</div>
            <div style={{ fontSize: "20px", fontFamily: "var(--font-mono)", fontWeight: 500, color: "var(--accent)" }}>
              {fmtNumber(trackable.target_value)}
            </div>
          </div>
        </div>
        <Link
          href="/log"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "8px 14px",
            background: "var(--accent-bg)",
            color: "var(--accent)",
            borderRadius: "8px",
            fontSize: "12px",
            fontWeight: 500,
            textDecoration: "none",
            marginTop: "4px",
          }}
        >
          Log your first number →
        </Link>
      </div>
    );
  }

  const state = classifyPace(latest);
  const config = PACE_CONFIG[state];
  const dec = trackable.direction === "decrease";
  const gap = latest.value - latest.pace_target;
  const gapGood = dec ? gap <= 0 : gap >= 0;

  const totalSpan = Math.abs(trackable.target_value - trackable.baseline_value);
  const actualProgress = Math.abs(latest.value - trackable.baseline_value);
  const pctToGoal = totalSpan > 0 ? actualProgress / totalSpan : 0;

  const gapColor = gapGood ? "var(--accent)" : "var(--warn)";

  return (
    <div style={{
      background: "var(--surface)",
      border: `0.5px solid var(--border)`,
      borderLeft: `3px solid ${config.border}`,
      borderRadius: "14px",
      padding: "18px 20px",
      transition: "box-shadow 0.15s ease",
      position: "relative",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)" }}>{trackable.name}</span>
            <span style={{
              fontSize: "10px",
              fontWeight: 600,
              color: config.textColor,
              background: `color-mix(in srgb, ${config.border} 12%, transparent)`,
              padding: "2px 7px",
              borderRadius: "100px",
              letterSpacing: "0.02em",
              textTransform: "uppercase",
            }}>
              {config.label}
            </span>
          </div>

          {/* Primary metric */}
          <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
            <span style={{
              fontSize: "32px",
              fontFamily: "var(--font-mono)",
              fontWeight: 700,
              color: "var(--text)",
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
            }}>
              {fmtNumber(latest.value)}
            </span>
            <span style={{ fontSize: "12px", color: "var(--text3)", fontWeight: 400 }}>{trackable.unit}</span>
          </div>

          {/* Today's delta */}
          {latest.delta !== null && (
            <div style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: (dec ? -1 : 1) * latest.delta >= 0 ? "var(--accent)" : "var(--warn)", marginTop: "2px" }}>
              {fmtDelta(latest.delta)} today
            </div>
          )}
        </div>

        {/* Progress ring */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", flexShrink: 0 }}>
          <ProgressRing pct={pctToGoal} />
          <span style={{ fontSize: "10px", color: "var(--text3)" }}>to goal</span>
        </div>
      </div>

      {/* Progress bar: value toward target */}
      <div style={{ marginBottom: "12px" }}>
        <div style={{
          height: "4px",
          background: "var(--border)",
          borderRadius: "2px",
          overflow: "hidden",
        }}>
          <div style={{
            height: "100%",
            width: `${Math.min(100, pctToGoal * 100)}%`,
            background: state === "recalibrate" ? "var(--danger)" : state === "recoverable" ? "var(--warn)" : "var(--accent)",
            borderRadius: "2px",
            transition: "width 0.6s ease",
          }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "3px" }}>
          <span style={{ fontSize: "10px", color: "var(--text3)", fontFamily: "var(--font-mono)" }}>
            {fmtNumber(trackable.baseline_value)}
          </span>
          <span style={{ fontSize: "10px", color: "var(--text3)", fontFamily: "var(--font-mono)" }}>
            {fmtNumber(trackable.target_value)}
          </span>
        </div>
      </div>

      {/* Key stats row */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: "4px",
        padding: "10px 0 0",
        borderTop: `0.5px solid var(--border)`,
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "13px", fontFamily: "var(--font-mono)", fontWeight: 600, color: gapColor }}>
            {gapGood ? "+" : ""}{fmtNumber(gap)}
          </div>
          <div style={{ fontSize: "10px", color: "var(--text3)", marginTop: "2px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            vs pace
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "13px", fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--text2)" }}>
            {latest.velocity_7d !== null ? fmtDelta(latest.velocity_7d) : "—"}
          </div>
          <div style={{ fontSize: "10px", color: "var(--text3)", marginTop: "2px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            7d avg
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "13px", fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--text2)" }}>
            {latest.required_velocity !== null ? fmtDelta(latest.required_velocity) : "—"}
          </div>
          <div style={{ fontSize: "10px", color: "var(--text3)", marginTop: "2px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            need/day
          </div>
        </div>
      </div>

      {/* Trend vs required */}
      {latest.velocity_7d !== null && latest.required_velocity !== null && (
        <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: `0.5px solid var(--border)`, display: "flex", alignItems: "center", gap: "6px" }}>
          <TrendArrow velocity7d={latest.velocity_7d} required={latest.required_velocity} />
          <span style={{ fontSize: "11px", color: "var(--text3)" }}>
            · needs {fmtDelta(latest.required_velocity)}/day to close
          </span>
        </div>
      )}
    </div>
  );
}
