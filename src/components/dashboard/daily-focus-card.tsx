"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { fmtDelta, fmtNumber } from "@/lib/domain/format";
import type { FocusSummary } from "@/lib/domain/forecast";

export function DailyFocusCard({
  focus, loggedToday,
}: {
  focus: FocusSummary; loggedToday: boolean;
}) {
  const { mostAtRisk, aheadCount, behindCount } = focus;

  if (!mostAtRisk) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        style={{
          background: "var(--surface)",
          border: "0.5px solid var(--border)",
          boxShadow: "inset 3px 0 0 var(--accent)",
          borderRadius: "18px",
          padding: "18px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          gap: "12px",
        }}
      >
        <div>
          <div style={{
            fontSize: "10px", fontWeight: 600, letterSpacing: "0.12em",
            textTransform: "uppercase", color: "var(--accent)", marginBottom: "8px",
          }}>
            Today&apos;s focus
          </div>
          <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--accent)", marginBottom: "4px" }}>
            All metrics on pace ✓
          </div>
          <div style={{ fontSize: "12px", color: "var(--text3)" }}>
            {aheadCount} ahead · {behindCount} need work · keep the streak going
          </div>
        </div>
        {!loggedToday && (
          <Link href="/log" style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "10px", background: "var(--accent)", color: "#000",
            borderRadius: "10px", fontSize: "13px", fontWeight: 700,
            textDecoration: "none",
          }}>
            Log today →
          </Link>
        )}
      </motion.div>
    );
  }

  const isRed     = mostAtRisk.paceState === "recalibrate";
  const accentCol = isRed ? "var(--danger)" : "var(--warn)";
  const bgCol     = isRed ? "var(--danger-bg)" : "var(--warn-bg)";

  const vel = mostAtRisk.velocity7d;
  const req = mostAtRisk.requiredVelocity;
  const velGap = vel !== null && req !== null ? vel - req : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      style={{
        background: "var(--surface)",
        border: "0.5px solid var(--border)",
        boxShadow: `inset 3px 0 0 ${accentCol}`,
        borderRadius: "18px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div style={{
        background: bgCol,
        padding: "12px 16px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "8px",
      }}>
        <div>
          <div style={{
            fontSize: "10px", fontWeight: 600, letterSpacing: "0.12em",
            textTransform: "uppercase", color: accentCol, marginBottom: "2px",
          }}>
            Today&apos;s focus
          </div>
          <div style={{ fontSize: "14px", fontWeight: 700, color: accentCol }}>
            {mostAtRisk.name}
            <span style={{
              marginLeft: "8px", fontSize: "10px", fontWeight: 600,
              background: `color-mix(in srgb, ${accentCol} 15%, transparent)`,
              color: accentCol, padding: "2px 7px", borderRadius: "100px",
              textTransform: "uppercase", letterSpacing: "0.04em",
            }}>
              {isRed ? "Off track" : "Recoverable"}
            </span>
          </div>
        </div>
        <div style={{ fontSize: "11px", color: "var(--text3)", flexShrink: 0, textAlign: "right" }}>
          {aheadCount} ahead<br />{behindCount} behind
        </div>
      </div>

      {/* Velocity comparison */}
      <div style={{ padding: "14px 16px", flex: 1 }}>
        <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
          <div style={{
            flex: 1, background: "var(--bg2)", borderRadius: "10px", padding: "10px 12px",
          }}>
            <div style={{ fontSize: "10px", color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>
              Your pace
            </div>
            <div style={{
              fontSize: "22px", fontFamily: "var(--font-mono)", fontWeight: 800,
              color: velGap !== null && velGap < 0 ? accentCol : "var(--text)", lineHeight: 1,
            }}>
              {vel !== null ? fmtDelta(vel) : "—"}
            </div>
            <div style={{ fontSize: "10px", color: "var(--text3)", marginTop: "3px" }}>per day (7d avg)</div>
          </div>

          <div style={{ display: "flex", alignItems: "center", color: "var(--text3)", fontSize: "16px", flexShrink: 0 }}>
            →
          </div>

          <div style={{
            flex: 1, background: bgCol, borderRadius: "10px", padding: "10px 12px",
          }}>
            <div style={{ fontSize: "10px", color: accentCol, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>
              Need
            </div>
            <div style={{
              fontSize: "22px", fontFamily: "var(--font-mono)", fontWeight: 800,
              color: accentCol, lineHeight: 1,
            }}>
              {req !== null ? fmtDelta(req) : "—"}
            </div>
            <div style={{ fontSize: "10px", color: "var(--text3)", marginTop: "3px" }}>per day to close</div>
          </div>
        </div>

        {/* Gap summary */}
        {velGap !== null && (
          <div style={{
            fontSize: "12px", fontFamily: "var(--font-mono)", fontWeight: 600, marginBottom: "10px",
            color: velGap < 0 ? accentCol : "var(--accent)",
          }}>
            {velGap < 0
              ? `${fmtDelta(velGap)}/day short`
              : `+${fmtNumber(velGap)}/day ahead of requirement`}
          </div>
        )}

        <div style={{ fontSize: "12px", color: "var(--text3)", marginBottom: "12px" }}>
          Gap vs pace target:{" "}
          <span style={{
            fontFamily: "var(--font-mono)", fontWeight: 600,
            color: mostAtRisk.gapGood ? "var(--accent)" : accentCol,
          }}>
            {mostAtRisk.gapGood ? "+" : ""}{fmtNumber(mostAtRisk.gap)} {mostAtRisk.unit}
          </span>
        </div>

        {!loggedToday && (
          <Link href="/log" style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "10px 14px", background: accentCol, color: "#fff",
            borderRadius: "10px", fontSize: "13px", fontWeight: 700,
            textDecoration: "none",
          }}>
            Log today&apos;s numbers →
          </Link>
        )}
      </div>
    </motion.div>
  );
}
