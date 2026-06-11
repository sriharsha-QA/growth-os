"use client";

import Link from "next/link";

interface Props {
  checkinDates: Set<string>;
  challengeStartDate: string;
  durationDays: number;
  today: string;
}

export function ConsistencyHeatmap({
  checkinDates,
  challengeStartDate,
  durationDays,
  today,
}: Props) {
  const cells: { date: string; day: number; state: "logged" | "missed" | "future" | "today" }[] = [];

  for (let i = 0; i < durationDays; i++) {
    const d = new Date(challengeStartDate + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + i);
    const date = d.toISOString().slice(0, 10);
    const dayN = i + 1;

    let state: "logged" | "missed" | "future" | "today";
    if (date > today) state = "future";
    else if (date === today) state = checkinDates.has(date) ? "logged" : "today";
    else state = checkinDates.has(date) ? "logged" : "missed";

    cells.push({ date, day: dayN, state });
  }

  const logged  = cells.filter((c) => c.state === "logged").length;
  const missed  = cells.filter((c) => c.state === "missed").length;
  const past    = cells.filter((c) => c.state !== "future").length;
  const pct     = past > 0 ? Math.round((logged / past) * 100) : 0;

  // Colour per state
  const COLOUR = {
    logged:  "var(--accent)",
    today:   "var(--warn)",
    missed:  "var(--danger-bg)",
    future:  "var(--border)",
  } as const;

  // Arrange in rows of 7 (weeks)
  const weeks: (typeof cells[number])[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return (
    <div style={{
      background: "var(--surface)",
      border: "0.5px solid var(--border)",
      borderRadius: "16px",
      padding: "18px 20px",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "14px" }}>
        <div>
          <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text)" }}>
            Consistency
          </div>
          <div style={{ fontSize: "11px", color: "var(--text3)", marginTop: "2px" }}>
            {logged} logged · {missed} missed · {pct}% consistency
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "10px", color: "var(--text3)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "2px", background: "var(--accent)", display: "inline-block" }} />
            Logged
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "2px", background: "var(--danger-bg)", border: "0.5px solid var(--danger)", display: "inline-block" }} />
            Missed
          </span>
        </div>
      </div>

      {/* Week labels */}
      <div style={{ display: "flex", gap: "3px", marginBottom: "4px", paddingLeft: "0px" }}>
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <div key={i} style={{
            flex: 1, textAlign: "center",
            fontSize: "9px", color: "var(--text3)",
            letterSpacing: "0.04em",
          }}>
            {d}
          </div>
        ))}
      </div>

      {/* Grid — row per week */}
      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: "flex", gap: "3px" }}>
            {week.map((cell) => {
              const isClickable = cell.state === "missed" && cell.date >= challengeStartDate;
              const el = (
                <div
                  key={cell.date}
                  title={`Day ${cell.day} · ${cell.date} · ${cell.state}`}
                  style={{
                    flex: 1,
                    aspectRatio: "1",
                    borderRadius: "3px",
                    background: COLOUR[cell.state],
                    border: cell.state === "missed"
                      ? "0.5px solid color-mix(in srgb, var(--danger) 35%, transparent)"
                      : cell.state === "today"
                      ? "0.5px solid var(--warn)"
                      : "none",
                    cursor: isClickable ? "pointer" : "default",
                    transition: "opacity 0.1s",
                    minWidth: 0,
                  }}
                />
              );
              return isClickable ? (
                <Link
                  key={cell.date}
                  href={`/log?date=${cell.date}`}
                  title={`Backfill Day ${cell.day} · ${cell.date}`}
                  style={{ flex: 1, display: "block", minWidth: 0 }}
                >
                  {el}
                </Link>
              ) : (
                <div key={cell.date} style={{ flex: 1, minWidth: 0 }}>
                  {el}
                </div>
              );
            })}
            {/* Pad incomplete last week */}
            {week.length < 7 && Array.from({ length: 7 - week.length }).map((_, i) => (
              <div key={`pad-${i}`} style={{ flex: 1 }} />
            ))}
          </div>
        ))}
      </div>

      {/* Footer: current streak context */}
      {missed > 0 && (
        <div style={{ marginTop: "10px", fontSize: "11px", color: "var(--text3)" }}>
          {missed === 1
            ? "1 missed day — "
            : `${missed} missed days — `}
          <Link href={`/log?date=${cells.find((c) => c.state === "missed")?.date ?? ""}`}
            style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}>
            backfill the most recent →
          </Link>
        </div>
      )}
    </div>
  );
}
