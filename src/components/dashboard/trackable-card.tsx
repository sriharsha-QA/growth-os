"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { classifyPace, type DailyProgressRow, type Trackable } from "@/lib/domain/types";
import { fmtDelta, fmtNumber } from "@/lib/domain/format";

const PACE = {
  ahead:       { accent: "var(--accent)",  label: "Ahead of pace",  glyph: "↑" },
  on_track:    { accent: "var(--info)",    label: "On track",        glyph: "→" },
  recoverable: { accent: "var(--warn)",    label: "Recoverable",     glyph: "↘" },
  recalibrate: { accent: "var(--danger)",  label: "Off track",       glyph: "↓" },
} as const;

function ProgressRing({
  pct, accent, size = 64,
}: {
  pct: number; accent: string; size?: number;
}) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(1, pct)) * circ;
  const display = Math.round(pct * 100);

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg
        width={size} height={size} viewBox={`0 0 ${size} ${size}`}
        role="img" aria-label={`${display}% to goal`}
        style={{ transform: "rotate(-90deg)" }}
      >
        {/* Track */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="var(--border)" strokeWidth="3.5"
        />
        {/* Fill */}
        <motion.circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={accent} strokeWidth="3.5"
          strokeLinecap="round"
          initial={{ strokeDasharray: `0 ${circ}` }}
          animate={{ strokeDasharray: `${filled} ${circ}` }}
          transition={{ duration: 0.9, ease: "easeOut", delay: 0.15 }}
        />
      </svg>
      {/* Centre label */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        lineHeight: 1,
      }}>
        <span style={{
          fontSize: size > 56 ? "13px" : "10px",
          fontFamily: "var(--font-mono)", fontWeight: 700,
          color: "var(--text)",
        }}>
          {display}%
        </span>
        <span style={{ fontSize: "9px", color: "var(--text3)", marginTop: "1px" }}>
          of goal
        </span>
      </div>
    </div>
  );
}

export function TrackableCard({
  trackable, latest, index = 0,
}: {
  trackable: Trackable;
  latest: DailyProgressRow | null;
  index?: number;
}) {
  if (!latest) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: index * 0.07, ease: "easeOut" }}
        style={{
          background: "var(--surface)",
          border: "0.5px solid var(--border)",
          borderRadius: "18px",
          padding: "20px",
          display: "flex", flexDirection: "column", gap: "14px",
        }}
      >
        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text2)" }}>
          {trackable.name}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: "10px", color: "var(--text3)", marginBottom: "3px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Starting
            </div>
            <div style={{ fontSize: "28px", fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--text3)" }}>
              {fmtNumber(trackable.baseline_value)}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "10px", color: "var(--text3)", marginBottom: "3px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Goal
            </div>
            <div style={{ fontSize: "28px", fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--accent)" }}>
              {fmtNumber(trackable.target_value)}
            </div>
          </div>
        </div>
        <Link href="/log" style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "11px", background: "var(--accent)", color: "#000",
          borderRadius: "10px", fontSize: "13px", fontWeight: 700,
          textDecoration: "none",
        }}>
          Log your first number →
        </Link>
      </motion.div>
    );
  }

  const state  = classifyPace(latest);
  const pace   = PACE[state];
  const dec    = trackable.direction === "decrease";
  const rawGap = latest.value - latest.pace_target;
  const gapGood = dec ? rawGap <= 0 : rawGap >= 0;

  const span  = Math.abs(trackable.target_value - trackable.baseline_value);
  const moved = Math.abs(latest.value - trackable.baseline_value);
  const pct   = span > 0 ? moved / span : 0;

  const barColor =
    state === "recalibrate" ? "var(--danger)" :
    state === "recoverable" ? "var(--warn)"   : "var(--accent)";

  const deltaOk  = (dec ? -1 : 1) * (latest.delta ?? 0) >= 0;
  const vel      = latest.velocity_7d;
  const req      = latest.required_velocity;
  const velOk    = vel !== null && req !== null && vel >= req;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.07, ease: "easeOut" }}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      style={{
        background: "var(--surface)",
        border: "0.5px solid var(--border)",
        /* Accent glow left edge via box-shadow — preserves border-radius */
        boxShadow: `inset 3px 0 0 ${pace.accent}`,
        borderRadius: "18px",
        overflow: "hidden",
        display: "flex", flexDirection: "column",
        cursor: "default",
      }}
    >
      {/* ── Top ── */}
      <div style={{ padding: "18px 18px 0" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)" }}>
                {trackable.name}
              </span>
              <span style={{
                fontSize: "10px", fontWeight: 600,
                color: pace.accent,
                padding: "2px 7px", borderRadius: "100px",
                background: `color-mix(in srgb, ${pace.accent} 12%, transparent)`,
                textTransform: "uppercase", letterSpacing: "0.04em",
                flexShrink: 0,
              }}>
                {pace.glyph} {pace.label}
              </span>
            </div>

            {/* Primary value */}
            <motion.div
              key={latest.value}
              initial={{ opacity: 0.6, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25 }}
              style={{ display: "flex", alignItems: "baseline", gap: "5px" }}
            >
              <span style={{
                fontSize: "38px", fontFamily: "var(--font-mono)", fontWeight: 800,
                color: "var(--text)", lineHeight: 1, letterSpacing: "-0.03em",
              }}>
                {fmtNumber(latest.value)}
              </span>
              <span style={{ fontSize: "12px", color: "var(--text3)", paddingBottom: "4px" }}>
                {trackable.unit}
              </span>
            </motion.div>

            {/* Today delta */}
            {latest.delta !== null && (
              <div style={{
                marginTop: "2px", fontSize: "12px", fontFamily: "var(--font-mono)",
                color: deltaOk ? "var(--accent)" : "var(--danger)",
              }}>
                {fmtDelta(latest.delta)} today
              </div>
            )}
          </div>

          {/* Progress ring */}
          <ProgressRing pct={pct} accent={pace.accent} size={64} />
        </div>

        {/* Progress bar: baseline → target */}
        <div style={{ margin: "14px 0 0" }}>
          <div style={{
            height: "3px", background: "var(--border)", borderRadius: "2px", overflow: "hidden",
          }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, pct * 100)}%` }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
              style={{ height: "100%", background: barColor, borderRadius: "2px" }}
            />
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

      {/* ── Stats grid ── */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
        borderTop: "0.5px solid var(--border)",
        margin: "14px 0 0",
      }}>
        {/* Gap vs pace */}
        <div style={{ textAlign: "center", padding: "10px 4px" }}>
          <div style={{
            fontSize: "14px", fontFamily: "var(--font-mono)", fontWeight: 700,
            color: gapGood ? "var(--accent)" : "var(--warn)", lineHeight: 1,
          }}>
            {gapGood ? "+" : ""}{fmtNumber(rawGap)}
          </div>
          <div style={{ fontSize: "10px", color: "var(--text3)", marginTop: "4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            vs pace
          </div>
        </div>

        {/* 7d velocity */}
        <div style={{
          textAlign: "center", padding: "10px 4px",
          borderLeft: "0.5px solid var(--border)",
          borderRight: "0.5px solid var(--border)",
        }}>
          <div style={{
            fontSize: "14px", fontFamily: "var(--font-mono)", fontWeight: 700,
            color: velOk ? "var(--accent)" : "var(--text2)", lineHeight: 1,
          }}>
            {vel !== null ? `${fmtDelta(vel)}` : "—"}
          </div>
          <div style={{ fontSize: "10px", color: "var(--text3)", marginTop: "4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            7d avg
          </div>
        </div>

        {/* Required velocity */}
        <div style={{ textAlign: "center", padding: "10px 4px" }}>
          <div style={{
            fontSize: "14px", fontFamily: "var(--font-mono)", fontWeight: 700,
            color: "var(--text2)", lineHeight: 1,
          }}>
            {req !== null ? fmtDelta(req) : "—"}
          </div>
          <div style={{ fontSize: "10px", color: "var(--text3)", marginTop: "4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            need/day
          </div>
        </div>
      </div>
    </motion.div>
  );
}
