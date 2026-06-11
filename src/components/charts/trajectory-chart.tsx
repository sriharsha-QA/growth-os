"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DailyProgressRow } from "@/lib/domain/types";

// Suppress unused import — Area/AreaChart imported for the fill, LineChart for pace overlay
void Area; void AreaChart;

interface Props {
  rows: DailyProgressRow[];
  trackables: { id: string; name: string }[];
  annotations: { local_date: string; label: string; kind: string }[];
  durationDays: number;
}

// Custom tooltip that reads CSS vars (works in dark mode)
function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { day: number; date: string }; value: number; dataKey: string }> }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div style={{
      background: "var(--surface)",
      border: "0.5px solid var(--border2)",
      borderRadius: "10px",
      padding: "10px 14px",
      fontSize: "12px",
      fontFamily: "var(--font-mono)",
      boxShadow: "0 2px 12px color-mix(in srgb, var(--text) 8%, transparent)",
    }}>
      <div style={{ color: "var(--text3)", marginBottom: "6px", fontFamily: "var(--font-sans)" }}>
        Day {p.day} · {p.date}
      </div>
      {payload.map((entry) => entry.value != null && (
        <div key={entry.dataKey} style={{
          display: "flex", alignItems: "center", gap: "8px",
          color: entry.dataKey === "actual" ? "var(--accent)" : "var(--text3)",
          marginBottom: "2px",
        }}>
          <span style={{
            display: "inline-block", width: "6px", height: "6px", borderRadius: "50%",
            background: entry.dataKey === "actual" ? "var(--accent)" : "var(--text3)",
          }} />
          <span style={{ color: "var(--text)", letterSpacing: "-0.01em" }}>
            {Math.round(entry.value).toLocaleString("en-IN")}
          </span>
          <span style={{ color: "var(--text3)" }}>
            {entry.dataKey === "actual" ? "actual" : "pace"}
          </span>
        </div>
      ))}
    </div>
  );
}

export function TrajectoryChart({ rows, trackables, annotations }: Props) {
  const withData = useMemo(
    () => trackables.filter((t) => rows.some((r) => r.trackable_id === t.id)),
    [rows, trackables]
  );
  const [activeId, setActiveId]     = useState<string>(withData[0]?.id ?? "");
  const [rangeDays, setRangeDays]   = useState<30 | 90>(90);

  const { data, annotationPoints, todayDay } = useMemo(() => {
    let series = rows.filter((r) => r.trackable_id === activeId);
    if (rangeDays === 30 && series.length > 0) {
      const cutoff = new Date(series[series.length - 1].local_date + "T00:00:00Z");
      cutoff.setUTCDate(cutoff.getUTCDate() - 29);
      const cutoffKey = cutoff.toISOString().slice(0, 10);
      series = series.filter((r) => r.local_date >= cutoffKey);
    }
    if (series.length === 0) return { data: [], annotationPoints: [], todayDay: null };

    const byDate = new Map(series.map((r) => [r.local_date, r]));
    const first  = series[0].local_date;
    const last   = series[series.length - 1].local_date;
    const out: { date: string; day: number; actual: number | null; pace: number | null }[] = [];
    const d   = new Date(first + "T00:00:00Z");
    const end = new Date(last  + "T00:00:00Z");

    while (d <= end) {
      const key = d.toISOString().slice(0, 10);
      const row = byDate.get(key);
      out.push({
        date:   key,
        day:    row?.day_index ?? (out.length > 0 ? out[out.length - 1].day + 1 : 1),
        actual: row ? Number(row.value) : null,
        pace:   row ? Number(row.pace_target) : null,
      });
      d.setUTCDate(d.getUTCDate() + 1);
    }

    const annPoints = annotations
      .filter((a) => byDate.has(a.local_date))
      .map((a) => ({
        date:  a.local_date,
        y:     Number(byDate.get(a.local_date)!.value),
        label: a.label,
      }));

    const lastRow = series[series.length - 1];
    const todayDay = lastRow ? lastRow.day_index : null;

    return { data: out, annotationPoints: annPoints, todayDay };
  }, [rows, activeId, annotations, rangeDays]);

  if (withData.length === 0) return null;

  // Colours that respond to CSS vars — recharts needs static values so we
  // read from computed style once. The chart is client-only so document exists.
  const accent  = "var(--accent)";
  const muted   = "var(--text3)";
  const border  = "var(--border)";
  const text3   = "var(--text3)";

  return (
    <div>
      {/* Controls */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        marginBottom: "16px",
        flexWrap: "wrap",
      }}>
        {/* Trackable tabs */}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", flex: 1 }}>
          {withData.map((t) => {
            const active = activeId === t.id;
            return (
              <button key={t.id} onClick={() => setActiveId(t.id)} style={{
                padding: "4px 12px",
                borderRadius: "100px",
                fontSize: "12px",
                fontWeight: active ? 600 : 400,
                border: `0.5px solid ${active ? "var(--accent)" : "var(--border)"}`,
                background: active ? "var(--accent-bg)" : "transparent",
                color: active ? "var(--accent)" : "var(--text3)",
                cursor: "pointer",
                transition: "all 0.12s",
              }}>
                {t.name}
              </button>
            );
          })}
        </div>

        {/* Range toggle */}
        <div style={{
          display: "flex",
          border: "0.5px solid var(--border)",
          borderRadius: "8px",
          overflow: "hidden",
          flexShrink: 0,
        }}>
          {([30, 90] as const).map((d) => (
            <button key={d} onClick={() => setRangeDays(d)} style={{
              padding: "4px 10px",
              fontSize: "11px",
              fontWeight: rangeDays === d ? 600 : 400,
              background: rangeDays === d ? "var(--bg3)" : "transparent",
              color: rangeDays === d ? "var(--text)" : "var(--text3)",
              border: "none",
              cursor: "pointer",
              borderRight: d === 30 ? "0.5px solid var(--border)" : "none",
            }}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{
        display: "flex", gap: "16px", marginBottom: "12px",
        fontSize: "11px", color: "var(--text3)",
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <span style={{ width: "16px", height: "2px", background: "var(--accent)", display: "inline-block", borderRadius: "1px" }} />
          Actual
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <span style={{ width: "16px", height: "0", borderTop: "2px dashed var(--text3)", display: "inline-block" }} />
          Pace target
        </span>
        {annotationPoints.length > 0 && (
          <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--info)", display: "inline-block" }} />
            Published
          </span>
        )}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
          <defs>
            <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="var(--accent)" stopOpacity={0.18} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0}    />
            </linearGradient>
          </defs>

          <CartesianGrid
            stroke={border}
            strokeDasharray="2 4"
            vertical={false}
            strokeOpacity={0.6}
          />

          <XAxis
            dataKey="day"
            tick={{ fontSize: 10, fill: text3 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `D${v}`}
            interval="preserveStartEnd"
          />

          <YAxis
            tick={{ fontSize: 10, fill: text3, fontFamily: "var(--font-mono)" }}
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(v: number) =>
              v >= 10000
                ? `${(v / 1000).toFixed(0)}k`
                : v >= 1000
                ? `${(v / 1000).toFixed(1)}k`
                : String(Math.round(v))
            }
          />

          <Tooltip content={<ChartTooltip />} cursor={{ stroke: border, strokeWidth: 1 }} />

          {/* Today marker */}
          {todayDay !== null && (
            <ReferenceLine
              x={todayDay}
              stroke={muted}
              strokeWidth={1}
              strokeDasharray="2 3"
              strokeOpacity={0.5}
            />
          )}

          {/* Area fill under actual line */}
          <Area
            type="monotone"
            dataKey="actual"
            stroke="transparent"
            fill="url(#areaFill)"
            connectNulls={false}
            isAnimationActive={false}
          />

          {/* Pace line */}
          <Line
            type="monotone"
            dataKey="pace"
            stroke={muted}
            strokeDasharray="4 4"
            strokeWidth={1.5}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />

          {/* Actual line */}
          <Line
            type="monotone"
            dataKey="actual"
            stroke={accent}
            strokeWidth={2.5}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Annotation dots */}
          {annotationPoints.map((a) => {
            const dayVal = data.find((dd) => dd.date === a.date)?.day;
            return dayVal !== undefined ? (
              <ReferenceDot
                key={`${a.date}-${a.label}`}
                x={dayVal} y={a.y}
                r={4}
                fill="var(--info)"
                stroke="var(--surface)"
                strokeWidth={2}
              />
            ) : null;
          })}
        </LineChart>
      </ResponsiveContainer>

      {/* Gap note */}
      <div style={{ marginTop: "8px", fontSize: "10px", color: "var(--text3)" }}>
        Gaps in the line = missed logging days.{" "}
        <a href="/log" style={{ color: "var(--accent)", textDecoration: "none" }}>Backfill →</a>
      </div>
    </div>
  );
}
