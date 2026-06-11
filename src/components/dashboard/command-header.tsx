"use client";

import Link from "next/link";
import { motion } from "framer-motion";

interface Props {
  challengeName: string;
  dayIndex: number;
  durationDays: number;
  daysRemaining: number;
  pctDone: number;
  streak: number;
  nextMilestone: number;
  loggedToday: boolean;
}

export function CommandHeader({
  challengeName,
  dayIndex,
  durationDays,
  daysRemaining,
  pctDone,
  streak,
  nextMilestone,
  loggedToday,
}: Props) {
  const streakColor = streak >= 14 ? "var(--accent)" : streak >= 7 ? "var(--warn)" : "var(--text2)";

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      style={{
        background: "var(--surface)",
        border: "0.5px solid var(--border)",
        borderRadius: "20px",
        padding: "20px 22px",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Subtle accent glow in dark mode */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: "1px",
        background: loggedToday
          ? "linear-gradient(90deg, transparent, var(--accent), transparent)"
          : "transparent",
        opacity: 0.6,
        transition: "background 0.5s ease",
      }} />

      {/* Top row */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: "16px",
        flexWrap: "wrap",
      }}>
        {/* Left: day counter */}
        <div>
          <div style={{
            fontSize: "10px", fontWeight: 600, letterSpacing: "0.14em",
            textTransform: "uppercase", color: "var(--text3)", marginBottom: "6px",
          }}>
            {challengeName}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "3px", lineHeight: 1 }}>
            <motion.span
              key={dayIndex}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              style={{
                fontSize: "44px", fontFamily: "var(--font-mono)", fontWeight: 800,
                color: "var(--text)", letterSpacing: "-0.03em",
              }}
            >
              {String(Math.min(dayIndex, durationDays)).padStart(2, "0")}
            </motion.span>
            <span style={{
              fontSize: "20px", fontFamily: "var(--font-mono)",
              color: "var(--text3)", letterSpacing: "-0.02em",
            }}>
              /{durationDays}
            </span>
          </div>
          <div style={{ fontSize: "12px", color: "var(--text3)", marginTop: "5px" }}>
            <span style={{ fontFamily: "var(--font-mono)", color: "var(--text2)" }}>
              {daysRemaining}
            </span>
            {" days remaining"}
          </div>
        </div>

        {/* Right: streak + CTA */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          {/* Streak */}
          <div style={{ textAlign: "right" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "5px", justifyContent: "flex-end" }}>
              <motion.span
                key={streak}
                initial={{ scale: 1.3, opacity: 0.6 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                style={{
                  fontSize: "30px", fontFamily: "var(--font-mono)", fontWeight: 800,
                  color: streakColor, lineHeight: 1,
                }}
              >
                {streak}
              </motion.span>
              <span style={{ fontSize: "22px", lineHeight: 1 }}>🔥</span>
            </div>
            <div style={{ fontSize: "10px", color: "var(--text3)", marginTop: "3px", letterSpacing: "0.04em" }}>
              DAY STREAK
            </div>
            {streak > 0 && nextMilestone > streak && (
              <div style={{ fontSize: "10px", color: "var(--text3)", marginTop: "2px" }}>
                next: {nextMilestone}
              </div>
            )}
          </div>

          {/* Log CTA */}
          {!loggedToday ? (
            <motion.div
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <Link href="/log" style={{
                display: "inline-flex", alignItems: "center", gap: "6px",
                padding: "11px 20px",
                background: "var(--accent)", color: "#000",
                borderRadius: "12px", fontSize: "13px", fontWeight: 700,
                textDecoration: "none", letterSpacing: "0.01em",
                boxShadow: "var(--glow)",
                flexShrink: 0,
              }}>
                Log today →
              </Link>
            </motion.div>
          ) : (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: "6px",
              padding: "11px 18px",
              background: "var(--accent-bg)",
              borderRadius: "12px", fontSize: "13px", fontWeight: 600,
              color: "var(--accent)", flexShrink: 0,
            }}>
              ✓ Logged
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ marginTop: "18px" }}>
        <div style={{
          height: "4px", background: "var(--border)", borderRadius: "2px",
          overflow: "hidden", position: "relative",
        }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pctDone}%` }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
            style={{
              height: "100%",
              background: loggedToday
                ? "linear-gradient(90deg, var(--accent-dim), var(--accent))"
                : "var(--border2)",
              borderRadius: "2px",
            }}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "5px" }}>
          <span style={{ fontSize: "10px", color: "var(--text3)", fontFamily: "var(--font-mono)" }}>
            Day 1
          </span>
          <span style={{ fontSize: "10px", color: "var(--text3)", fontFamily: "var(--font-mono)" }}>
            {pctDone}% · Day {durationDays}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
