"use client";

import Link from "next/link";
import { classifyPace, type DailyProgressRow, type Trackable } from "@/lib/domain/types";
import { fmtDelta, fmtNumber } from "@/lib/domain/format";

// ── Pace state config ─────────────────────────────────────────────────────────
const PACE = {
  ahead:       { accent: "var(--accent)",  bg: "var(--accent-bg)",  label: "Ahead"      },
  on_track:    { accent: "var(--info)",    bg: "var(--info-bg)",    label: "On track"   },
  recoverable: { accent: "var(--warn)",    bg: "var(--warn-bg)",    label: "Recoverable"},
  recalibrate: { accent: "var(--danger)",  bg: "var(--danger-bg)",  label: "Off track"  },
} as const;

// ── Progress ring ─────────────────────────────────────────────────────────────
function Ring({ pct, accent }: { pct: number; accent: string }) {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(1, pct)) * circ;
  const display = Math.round(pct * 100);
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" role="img" aria-label={`${display}% to goal`}>
      <circle cx="26" cy="26" r={r} fill="none" stroke="var(--border)" strokeWidth="3.5" />
      <circle
        cx="26" cy="26" r={r} fill="none"
        stroke={accent} strokeWidth="3.5" strokeLinecap="round"
        strokeDasharray={`${filled} ${circ}`}
        transform="rotate(-90 26 26)"
      />
      <text
        x="26" y="26" textAnchor="middle" dominantBaseline="central"
        fontSize="9.5" fontWeight="600" fontFamily="var(--font-mono)" fill="var(--text)"
      >
        {display}%
      </text>
    </svg>
  );
}

// ── Stat cell ─────────────────────────────────────────────────────────────────
function Stat({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <div style={{ textAlign: "center", padding: "8px 4px" }}>
      <div style={{
        fontSize: "14px", fontFamily: "var(--font-mono)", fontWeight: 600,
        color: color ?? "var(--text2)", lineHeight: 1.2,
      }}>
        {value}
      </div>
      <div style={{
        fontSize: "10px", color: "var(--text3)", marginTop: "3px",
        textTransform: "uppercase", letterSpacing: "0.06em",
      }}>
        {label}
      </div>
    </div>
  );
}

// ── Empty state card ──────────────────────────────────────────────────────────
function EmptyCard({ trackable }: { trackable: Trackable }) {
  return (
    <div style={{
      background: "var(--surface)", border: "0.5px solid var(--border)",
      borderRadius: "16px", padding: "20px",
      display: "flex", flexDirection: "column", gap: "14px",
    }}>
      <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)" }}>
        {trackable.name}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ fontSize: "10px", color: "var(--text3)", marginBottom: "3px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Starting</div>
          <div style={{ fontSize: "26px", fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--text)", lineHeight: 1 }}>
            {fmtNumber(trackable.baseline_value)}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text3)", marginTop: "2px" }}>{trackable.unit}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "10px", color: "var(--text3)", marginBottom: "3px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Target</div>
          <div style={{ fontSize: "22px", fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--accent)", lineHeight: 1 }}>
            {fmtNumber(trackable.target_value)}
          </div>
        </div>
      </div>
      <Link href="/log" style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "10px", background: "var(--accent-bg)", color: "var(--accent)",
        borderRadius: "10px", fontSize: "13px", fontWeight: 500,
        textDecoration: "none", marginTop: "2px",
      }}>
        Log your first number →
      </Link>
    </div>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────────
export function TrackableCard({ trackable, latest }: { trackable: Trackable; latest: DailyProgressRow | null }) {
  if (!latest) return <EmptyCard trackable={trackable} />;

  const state   = classifyPace(latest);
  const pace    = PACE[state];
  const dec     = trackable.direction === "decrease";
  const rawGap  = latest.value - latest.pace_target;
  const gapGood = dec ? rawGap <= 0 : rawGap >= 0;

  const span    = Math.abs(trackable.target_value - trackable.baseline_value);
  const moved   = Math.abs(latest.value - trackable.baseline_value);
  const pct     = span > 0 ? moved / span : 0;

  const barColor =
    state === "recalibrate" ? "var(--danger)" :
    state === "recoverable" ? "var(--warn)"   : "var(--accent)";

  const deltaOk = (dec ? -1 : 1) * (latest.delta ?? 0) >= 0;

  // Velocity trend label
  const vel = latest.velocity_7d;
  const req = latest.required_velocity;
  const velLabel = vel !== null
    ? `${fmtDelta(vel)}/day ${vel >= 0 ? "↑" : "↓"}`
    : "—";
  const velColor = (vel !== null && req !== null)
    ? (vel >= req ? "var(--accent)" : "var(--warn)")
    : "var(--text2)";

  return (
    <div style={{
      background: "var(--surface)",
      border: "0.5px solid var(--border)",
      borderLeft: `3px solid ${pace.accent}`,
      borderRadius: "16px",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* ── Top section ── */}
      <div style={{ padding: "18px 18px 0" }}>
        {/* Header row: name + badge + ring */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)" }}>
                {trackable.name}
              </span>
              <span style={{
                fontSize: "10px", fontWeight: 600,
                color: pace.accent, background: pace.bg,
                padding: "2px 8px", borderRadius: "100px",
                textTransform: "uppercase", letterSpacing: "0.04em",
                flexShrink: 0,
              }}>
                {pace.label}
              </span>
            </div>

            {/* Primary value */}
            <div style={{ display: "flex", alignItems: "baseline", gap: "5px" }}>
              <span style={{
                fontSize: "34px", fontFamily: "var(--font-mono)", fontWeight: 700,
                color: "var(--text)", lineHeight: 1, letterSpacing: "-0.025em",
              }}>
                {fmtNumber(latest.value)}
              </span>
              <span style={{ fontSize: "12px", color: "var(--text3)", paddingBottom: "3px" }}>
                {trackable.unit}
              </span>
            </div>

            {/* Delta */}
            {latest.delta !== null && (
              <div style={{
                marginTop: "3px", fontSize: "12px",
                fontFamily: "var(--font-mono)",
                color: deltaOk ? "var(--accent)" : "var(--warn)",
              }}>
                {fmtDelta(latest.delta)} today
              </div>
            )}
          </div>

          {/* Progress ring */}
          <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
            <Ring pct={pct} accent={pace.accent} />
            <span style={{ fontSize: "10px", color: "var(--text3)" }}>of goal</span>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ margin: "14px 0 0" }}>
          <div style={{ height: "3px", background: "var(--border)", borderRadius: "2px", overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${Math.min(100, pct * 100)}%`,
              background: barColor, borderRadius: "2px",
            }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
            <span style={{ fontSize: "10px", color: "var(--text3)", fontFamily: "var(--font-mono)" }}>
              {fmtNumber(trackable.baseline_value)}
            </span>
            <span style={{ fontSize: "10px", color: "var(--text3)", fontFamily: "var(--font-mono)" }}>
              {fmtNumber(trackable.target_value)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
        borderTop: "0.5px solid var(--border)",
        margin: "14px 0 0",
      }}>
        <Stat
          value={`${gapGood ? "+" : ""}${fmtNumber(rawGap)}`}
          label="vs pace"
          color={gapGood ? "var(--accent)" : "var(--warn)"}
        />
        <div style={{ borderLeft: "0.5px solid var(--border)", borderRight: "0.5px solid var(--border)" }}>
          <Stat value={velLabel} label="7d avg" color={velColor} />
        </div>
        <Stat
          value={req !== null ? fmtDelta(req) : "—"}
          label="need/day"
        />
      </div>
    </div>
  );
}
