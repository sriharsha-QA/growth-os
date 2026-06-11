"use client";

import { useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  Line,
  CartesianGrid,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DailyProgressRow } from "@/lib/domain/types";

interface Props {
  rows: DailyProgressRow[];
  trackables: { id: string; name: string }[];
  annotations: { local_date: string; label: string; kind: string }[];
  durationDays: number;
}

function ChartTooltip({
  active, payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { day: number; date: string }; value: number; dataKey: string }>;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div style={{
      background: "var(--surface)",
      border: "0.5px solid var(--border2)",
      borderRadius: "10px",
      padding: "10px 14px",
      fontSize: "12px",
      boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
    }}>
      <div style={{ color: "var(--text3)", marginBottom: "7px", fontSize: "11px" }}>
        Day {p.day} · {p.date}
      </div>
      {payload.map((entry) =>
        entry.value != null ? (
          <div key={entry.dataKey} style={{
            display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px",
          }}>
            <span style={{
              width: "6px", height: "6px", borderRadius: "50%", flexShrink: 0,
              background: entry.dataKey === "actual" ? "var(--accent)" : "var(--text3)",
            }} />
            <span style={{
              fontFamily: "var(--font-mono)", fontWeight: 600,
              color: "var(--text)", letterSpacing: "-0.01em",
            }}>
              {Math.round(entry.value).toLocaleString("en-IN")}
            </span>
            <span style={{ color: "var(--text3)", fontSize: "11px" }}>
              {entry.dataKey === "actual" ? "actual" : "pace target"}
            </span>
          </div>
        ) : null
      )}
    </div>
  );
}

export function TrajectoryChart({ rows, trackables, annotations, durationDays }: Props) {
  const withData = useMemo(
    () => trackables.filter((t) => rows.some((r) => r.trackable_id === t.id)),
    [rows, trackables]
  );
  const [activeId, setActiveId]   = useState<string>(withData[0]?.id ?? "");
  const [rangeDays, setRangeDays] = useState<30 | 90>(90);

  const { data, annotationPoints, todayDay } = useMemo(() => {
    let series = rows.filter((r) => r.trackable_id === activeId);
    if (rangeDays === 30 && series.length > 0) {
      const cutoff = new Date(series[series.length - 1].local_date + "T00:00:00Z");
      cutoff.setUTCDate(cutoff.getUTCDate() - 29);
      const cutKey = cutoff.toISOString().slice(0, 10);
      series = series.filter((r) => r.local_date >= cutKey);
    }
    if (series.length === 0) return { data: [], annotationPoints: [], todayDay: null };

    const byDate = new Map(series.map((r) => [r.local_date, r]));
    const first  = series[0].local_date;
    const last   = series[series.length - 1].local_date;
    const out: { date: string; day: number; actual: number | null; pace: number | null }[] = [];
    const cur = new Date(first + "T00:00:00Z");
    const end = new Date(last  + "T00:00:00Z");

    while (cur <= end) {
      const key = cur.toISOString().slice(0, 10);
      const row = byDate.get(key);
      out.push({
        date:   key,
        day:    row?.day_index ?? (out.length > 0 ? out[out.length - 1].day + 1 : 1),
        actual: row ? Number(row.value) : null,
        pace:   row ? Number(row.pace_target) : null,
      });
      cur.setUTCDate(cur.getUTCDate() + 1);
    }

    const annPoints = annotations
      .filter((a) => byDate.has(a.local_date))
      .map((a) => ({
        date: a.local_date,
        y:    Number(byDate.get(a.local_date)!.value),
        label: a.label,
      }));

    const lastRow  = series[series.length - 1];
    const todayDay = lastRow?.day_index ?? null;

    return { data: out, annotationPoints: annPoints, todayDay };
  }, [rows, activeId, annotations, rangeDays]);

  // Extend pace to Day 90 even when series ends earlier
  const extendedData = useMemo(() => {
    if (rangeDays !== 90 || data.length === 0) return data;
    const lastDay = data[data.length - 1].day;
    if (lastDay >= durationDays) return data;

    // Find the pace slope from last 2 pace values
    const paceRows = data.filter((d) => d.pace !== null);
    if (paceRows.length < 2) return data;
    const p1 = paceRows[paceRows.length - 2];
    const p2 = paceRows[paceRows.length - 1];
    const slope = (p2.pace! - p1.pace!) / (p2.day - p1.day);

    const extra: { date: string; day: number; actual: number | null; pace: number | null }[] = [];
    for (let d = lastDay + 1; d <= durationDays; d++) {
      extra.push({
        date:   "",
        day:    d,
        actual: null,
        pace:   Math.round(p2.pace! + slope * (d - p2.day)),
      });
    }
    return [...data, ...extra];
  }, [data, rangeDays, durationDays]);

  if (withData.length === 0) return null;

  return (
    <div>
      {/* ── Controls ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: "5px", flexWrap: "wrap", flex: 1 }}>
          {withData.map((t) => {
            const active = activeId === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveId(t.id)}
                className="badge"
                style={{
                  padding: "5px 12px",
                  borderRadius: "100px",
                  fontSize: "12px",
                  fontWeight: active ? 600 : 400,
                  border: `0.5px solid ${active ? "var(--accent)" : "var(--border)"}`,
                  background: active ? "var(--accent-bg)" : "transparent",
                  color: active ? "var(--accent)" : "var(--text3)",
                  cursor: "pointer",
                  minHeight: "unset",
                }}
              >
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
            <button
              key={d}
              onClick={() => setRangeDays(d)}
              className="badge"
              style={{
                padding: "5px 11px",
                fontSize: "11px",
                fontWeight: rangeDays === d ? 600 : 400,
                background: rangeDays === d ? "var(--bg3)" : "transparent",
                color: rangeDays === d ? "var(--text)" : "var(--text3)",
                border: "none",
                cursor: "pointer",
                borderRight: d === 30 ? "0.5px solid var(--border)" : "none",
                minHeight: "unset",
              }}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* ── Legend ── */}
      <div style={{ display: "flex", gap: "16px", marginBottom: "12px", fontSize: "11px", color: "var(--text3)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <span style={{ width: "16px", height: "2px", background: "var(--accent)", display: "inline-block", borderRadius: "1px" }} />
          Actual
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <span style={{ width: "16px", height: "0", borderTop: "1.5px dashed var(--text3)", display: "inline-block" }} />
          Pace target
        </span>
        {annotationPoints.length > 0 && (
          <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--info)", display: "inline-block" }} />
            Published
          </span>
        )}
        <span style={{ marginLeft: "auto", fontSize: "10px" }}>
          gaps = missed days
        </span>
      </div>

      {/* ── Chart ──
          AreaChart renders the area fill correctly.
          We layer: area fill → pace line → actual line → annotations.
          connectNulls=false on actual keeps gaps visible (missed days).
          connectNulls=true on pace so the target always shows.
      ── */}
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={extendedData} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
          <defs>
            <linearGradient id="actualFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="var(--accent)" stopOpacity={0.20} />
              <stop offset="85%"  stopColor="var(--accent)" stopOpacity={0.03} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0}    />
            </linearGradient>
          </defs>

          <CartesianGrid
            stroke="var(--border)"
            strokeDasharray="2 4"
            vertical={false}
            strokeOpacity={0.7}
          />

          <XAxis
            dataKey="day"
            tick={{ fontSize: 10, fill: "var(--text3)" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `D${v}`}
            interval="preserveStartEnd"
          />

          <YAxis
            tick={{ fontSize: 10, fill: "var(--text3)", fontFamily: "var(--font-mono)" }}
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(v: number) =>
              v >= 10000 ? `${(v / 1000).toFixed(0)}k`
              : v >= 1000 ? `${(v / 1000).toFixed(1)}k`
              : String(Math.round(v))
            }
          />

          <Tooltip
            content={<ChartTooltip />}
            cursor={{ stroke: "var(--border2)", strokeWidth: 1 }}
          />

          {/* Today marker */}
          {todayDay !== null && (
            <ReferenceLine
              x={todayDay}
              stroke="var(--text3)"
              strokeWidth={1}
              strokeDasharray="2 3"
              strokeOpacity={0.5}
            />
          )}

          {/* Area fill — actual only, gaps break fill correctly */}
          <Area
            type="monotone"
            dataKey="actual"
            stroke="none"
            fill="url(#actualFill)"
            connectNulls={false}
            isAnimationActive={false}
            dot={false}
          />

          {/* Pace line — dashed, connects through any gaps */}
          <Line
            type="monotone"
            dataKey="pace"
            stroke="var(--text3)"
            strokeDasharray="4 4"
            strokeWidth={1.5}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />

          {/* Actual line — solid, gaps visible */}
          <Line
            type="monotone"
            dataKey="actual"
            stroke="var(--accent)"
            strokeWidth={2.5}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Annotation dots */}
          {annotationPoints.map((a) => {
            const dayVal = extendedData.find((dd) => dd.date === a.date)?.day;
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
        </AreaChart>
      </ResponsiveContainer>

      <div style={{ marginTop: "8px", fontSize: "10px", color: "var(--text3)" }}>
        <a href="/log" className="link-inline" style={{ color: "var(--accent)", textDecoration: "none" }}>
          Backfill a missed day →
        </a>
      </div>
    </div>
  );
}
