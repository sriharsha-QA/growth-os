"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { fmtNumber } from "@/lib/domain/format";
import type { ForecastSummary } from "@/lib/domain/forecast";

const CONF = {
  will_exceed: { label: "Will exceed",  color: "var(--accent)",  bg: "var(--accent-bg)",  glyph: "↑" },
  on_track:    { label: "On track",     color: "var(--info)",    bg: "var(--info-bg)",    glyph: "→" },
  at_risk:     { label: "At risk",      color: "var(--warn)",    bg: "var(--warn-bg)",    glyph: "↘" },
  off_track:   { label: "Off track",    color: "var(--danger)",  bg: "var(--danger-bg)",  glyph: "↓" },
} as const;

export function ForecastCard({
  forecast, dayIndex, durationDays,
}: {
  forecast: ForecastSummary; dayIndex: number; durationDays: number;
}) {
  const conf = CONF[forecast.overallConfidence];
  const daysRemaining = Math.max(0, durationDays - dayIndex);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.1, ease: "easeOut" }}
      style={{
        background: "var(--surface)",
        border: "0.5px solid var(--border)",
        borderRadius: "18px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Confidence header */}
      <div style={{
        background: conf.bg,
        padding: "16px 18px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "12px",
        borderBottom: "0.5px solid var(--border)",
      }}>
        <div>
          <div style={{
            fontSize: "10px", fontWeight: 600, letterSpacing: "0.12em",
            textTransform: "uppercase", color: conf.color, marginBottom: "4px",
          }}>
            Day 90 forecast
          </div>
          <div style={{
            fontSize: "20px", fontWeight: 800, color: conf.color,
            display: "flex", alignItems: "center", gap: "6px",
          }}>
            <span>{conf.glyph}</span>
            <span>{conf.label}</span>
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{
            fontSize: "24px", fontFamily: "var(--font-mono)", fontWeight: 800,
            color: conf.color, lineHeight: 1,
          }}>
            {daysRemaining}
          </div>
          <div style={{ fontSize: "10px", color: "var(--text3)", marginTop: "3px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            days left
          </div>
        </div>
      </div>

      {/* Per-trackable rows */}
      <div style={{ flex: 1 }}>
        {forecast.trackables.map((f, i) => {
          const good = f.surplus >= 0;
          const pct  = Math.min(100, Math.max(0, (f.projected / f.target) * 100));

          return (
            <div
              key={f.trackableId}
              style={{
                padding: "12px 18px",
                borderBottom: i < forecast.trackables.length - 1
                  ? "0.5px solid var(--border)" : "none",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text)", marginBottom: "2px" }}>
                    {f.name}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text3)" }}>
                    Goal:{" "}
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--text2)" }}>
                      {fmtNumber(f.target)}
                    </span>
                    {!f.hasVelocity && (
                      <span style={{ color: "var(--text3)", marginLeft: "4px" }}>· needs more data</span>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{
                    fontSize: "16px", fontWeight: 700, fontFamily: "var(--font-mono)",
                    color: "var(--text)", lineHeight: 1, marginBottom: "2px",
                  }}>
                    {fmtNumber(f.projected)}
                  </div>
                  <div style={{
                    fontSize: "11px", fontFamily: "var(--font-mono)",
                    color: good ? "var(--accent)" : "var(--danger)",
                  }}>
                    {good ? "+" : ""}{fmtNumber(f.surplus)} {good ? "surplus" : "deficit"}
                  </div>
                </div>
              </div>

              {/* Projected vs goal bar */}
              <div style={{ position: "relative", height: "3px", background: "var(--border)", borderRadius: "2px", overflow: "hidden" }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 + i * 0.05 }}
                  style={{
                    height: "100%", borderRadius: "2px",
                    background: good ? "var(--accent)" : "var(--danger)",
                  }}
                />
                {/* Goal marker at 100% */}
                <div style={{
                  position: "absolute", right: 0, top: "-2px", bottom: "-2px",
                  width: "1.5px", background: "var(--text3)", borderRadius: "1px",
                }} />
              </div>
            </div>
          );
        })}
      </div>

      {!forecast.trackables.every((f) => f.hasVelocity) && (
        <div style={{
          padding: "10px 18px",
          borderTop: "0.5px solid var(--border)",
          fontSize: "11px", color: "var(--text3)",
        }}>
          Accuracy improves after 7 logged days.{" "}
          <Link href="/log" className="inline-link" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}>
            Log today →
          </Link>
        </div>
      )}
    </motion.div>
  );
}
