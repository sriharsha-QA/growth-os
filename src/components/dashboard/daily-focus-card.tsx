import Link from "next/link";
import { fmtDelta, fmtNumber } from "@/lib/domain/format";
import type { FocusSummary } from "@/lib/domain/forecast";

export function DailyFocusCard({ focus, loggedToday }: { focus: FocusSummary; loggedToday: boolean }) {
  const { mostAtRisk, aheadCount, behindCount } = focus;

  // If everything is ahead/on-track, show a clean positive state
  if (!mostAtRisk) {
    return (
      <div style={{
        background: "var(--accent-bg)",
        border: `0.5px solid var(--accent)`,
        borderRadius: "14px",
        padding: "16px 18px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
      }}>
        <div>
          <div style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent)", marginBottom: "4px" }}>
            Daily focus
          </div>
          <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--accent-t)" }}>
            All metrics on pace ✓
          </div>
          <div style={{ fontSize: "12px", color: "var(--text2)", marginTop: "3px" }}>
            {aheadCount} ahead · {behindCount} behind · keep the streak alive
          </div>
        </div>
        {!loggedToday && (
          <Link href="/log" style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "8px 14px",
            background: "var(--accent)",
            color: "#fff",
            borderRadius: "8px",
            fontSize: "12px",
            fontWeight: 600,
            textDecoration: "none",
            flexShrink: 0,
          }}>
            Log today
          </Link>
        )}
      </div>
    );
  }

  const isRed = mostAtRisk.paceState === "recalibrate";
  const borderColor = isRed ? "var(--danger)" : "var(--warn)";
  const labelColor  = isRed ? "var(--danger)" : "var(--warn)";
  const bgColor     = isRed ? "var(--danger-bg)" : "var(--warn-bg)";

  const vel = mostAtRisk.velocity7d;
  const req = mostAtRisk.requiredVelocity;
  const velGap = (vel !== null && req !== null) ? vel - req : null;

  return (
    <div style={{
      background: "var(--surface)",
      border: `0.5px solid var(--border)`,
      borderLeft: `3px solid ${borderColor}`,
      borderRadius: "14px",
      overflow: "hidden",
    }}>
      {/* Header bar */}
      <div style={{
        background: bgColor,
        padding: "10px 18px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: labelColor }}>
            Today&apos;s focus
          </span>
          <span style={{
            fontSize: "10px",
            background: bgColor,
            color: labelColor,
            border: `0.5px solid ${borderColor}`,
            borderRadius: "100px",
            padding: "1px 7px",
            fontWeight: 600,
          }}>
            {mostAtRisk.paceState === "recalibrate" ? "Off track" : "Recoverable"}
          </span>
        </div>
        <div style={{ fontSize: "11px", color: "var(--text3)" }}>
          {aheadCount} ahead · {behindCount} need work
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "14px 18px" }}>
        <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text)", marginBottom: "6px" }}>
          {mostAtRisk.name}
        </div>

        {/* Velocity comparison */}
        <div style={{ display: "flex", gap: "8px", alignItems: "stretch", marginBottom: "12px" }}>
          {/* Current velocity */}
          <div style={{
            flex: 1,
            background: "var(--bg2)",
            borderRadius: "8px",
            padding: "10px 12px",
          }}>
            <div style={{ fontSize: "10px", color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>
              Your pace (7d avg)
            </div>
            <div style={{
              fontSize: "20px",
              fontFamily: "var(--font-mono)",
              fontWeight: 700,
              color: velGap !== null && velGap < 0 ? labelColor : "var(--text)",
            }}>
              {vel !== null ? fmtDelta(vel) : "—"}
            </div>
            <div style={{ fontSize: "10px", color: "var(--text3)", marginTop: "2px" }}>per day</div>
          </div>

          {/* Divider arrow */}
          <div style={{ display: "flex", alignItems: "center", color: "var(--text3)", fontSize: "16px", flexShrink: 0 }}>
            →
          </div>

          {/* Required velocity */}
          <div style={{
            flex: 1,
            background: bgColor,
            borderRadius: "8px",
            padding: "10px 12px",
          }}>
            <div style={{ fontSize: "10px", color: labelColor, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>
              Required pace
            </div>
            <div style={{
              fontSize: "20px",
              fontFamily: "var(--font-mono)",
              fontWeight: 700,
              color: labelColor,
            }}>
              {req !== null ? fmtDelta(req) : "—"}
            </div>
            <div style={{ fontSize: "10px", color: "var(--text3)", marginTop: "2px" }}>per day</div>
          </div>
        </div>

        {/* Gap call-out */}
        {velGap !== null && (
          <div style={{
            fontSize: "13px",
            color: velGap < 0 ? labelColor : "var(--accent)",
            fontFamily: "var(--font-mono)",
            fontWeight: 600,
            marginBottom: "12px",
          }}>
            {velGap < 0
              ? `${fmtDelta(velGap)}/day short of what you need`
              : `+${fmtNumber(velGap)}/day ahead of requirement`}
          </div>
        )}

        {/* What to do */}
        <div style={{
          fontSize: "12px",
          color: "var(--text3)",
          lineHeight: 1.5,
          marginBottom: "12px",
        }}>
          Gap vs pace target:{" "}
          <span style={{
            fontFamily: "var(--font-mono)",
            color: mostAtRisk.gapGood ? "var(--accent)" : labelColor,
            fontWeight: 600,
          }}>
            {mostAtRisk.gapGood ? "+" : ""}{fmtNumber(mostAtRisk.gap)} {mostAtRisk.unit}
          </span>
          {!mostAtRisk.gapGood && req !== null && (
            <> · {Math.abs(Math.round(mostAtRisk.gap))} to close, then need {fmtDelta(req)}/day to finish</>
          )}
        </div>

        {/* CTA */}
        {!loggedToday && (
          <Link href="/log" style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "9px 16px",
            background: borderColor,
            color: "#fff",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 600,
            textDecoration: "none",
          }}>
            Log today&apos;s numbers →
          </Link>
        )}
      </div>
    </div>
  );
}
