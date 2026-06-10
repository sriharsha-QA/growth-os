"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DailyProgressRow } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

interface Props {
  rows: DailyProgressRow[];
  trackables: { id: string; name: string }[];
  annotations: { local_date: string; label: string; kind: string }[];
  durationDays: number;
}

/**
 * Actual-vs-pace trajectory for one trackable at a time.
 * Gaps stay gaps (connectNulls=false) — missed days are visible, not painted over.
 */
export function TrajectoryChart({ rows, trackables, annotations }: Props) {
  const withData = useMemo(
    () => trackables.filter((t) => rows.some((r) => r.trackable_id === t.id)),
    [rows, trackables]
  );
  const [activeId, setActiveId] = useState<string>(withData[0]?.id ?? "");
  const [rangeDays, setRangeDays] = useState<30 | 90>(90);

  const { data, annotationPoints } = useMemo(() => {
    let series = rows.filter((r) => r.trackable_id === activeId);
    if (rangeDays === 30 && series.length > 0) {
      const cutoff = new Date(series[series.length - 1].local_date + "T00:00:00Z");
      cutoff.setUTCDate(cutoff.getUTCDate() - 29);
      const cutoffKey = cutoff.toISOString().slice(0, 10);
      series = series.filter((r) => r.local_date >= cutoffKey);
    }
    if (series.length === 0) return { data: [], annotationPoints: [] };

    // continuous date axis so missed days appear as gaps
    const byDate = new Map(series.map((r) => [r.local_date, r]));
    const first = series[0].local_date;
    const last = series[series.length - 1].local_date;
    const out: { date: string; day: number; actual: number | null; pace: number | null }[] = [];
    const d = new Date(first + "T00:00:00Z");
    const end = new Date(last + "T00:00:00Z");
    while (d <= end) {
      const key = d.toISOString().slice(0, 10);
      const row = byDate.get(key);
      out.push({
        date: key,
        day: row?.day_index ?? (out.length > 0 ? out[out.length - 1].day + 1 : 1),
        actual: row ? Number(row.value) : null,
        pace: row ? Number(row.pace_target) : null,
      });
      d.setUTCDate(d.getUTCDate() + 1);
    }

    const annPoints = annotations
      .filter((a) => byDate.has(a.local_date))
      .map((a) => ({
        date: a.local_date,
        y: Number(byDate.get(a.local_date)!.value),
        label: a.label,
      }));

    return { data: out, annotationPoints: annPoints };
  }, [rows, activeId, annotations, rangeDays]);

  if (withData.length === 0) return null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {withData.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveId(t.id)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              activeId === t.id
                ? "border-accent bg-accent/10 font-medium text-accent"
                : "border-line text-muted hover:text-ink"
            )}
          >
            {t.name}
          </button>
        ))}
        <span className="ml-2 inline-flex overflow-hidden rounded-full border border-line text-[11px]">
          {([30, 90] as const).map((d) => (
            <button
              key={d}
              onClick={() => setRangeDays(d)}
              className={cn("px-2.5 py-1", rangeDays === d ? "bg-ink/5 font-medium" : "text-muted hover:text-ink")}
            >
              {d}d
            </button>
          ))}
        </span>
        <span className="ml-auto hidden text-[11px] text-muted sm:block">
          <span className="text-accent">●</span> actual · <span className="text-muted">●</span> pace · gaps = missed days
        </span>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
          <CartesianGrid stroke="#e5e5e0" strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 11, fill: "#6b7280" }}
            tickLine={false}
            axisLine={{ stroke: "#e5e5e0" }}
            tickFormatter={(v) => `D${v}`}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#6b7280", fontFamily: "JetBrains Mono, monospace" }}
            tickLine={false}
            axisLine={false}
            width={52}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 10,
              border: "1px solid #e5e5e0",
              fontSize: 12,
              background: "#ffffff",
            }}
            labelFormatter={(_, payload) => {
              const p = payload?.[0]?.payload;
              return p ? `Day ${p.day} · ${p.date}` : "";
            }}
            formatter={(value, name) => [
              Math.round(Number(value)).toLocaleString("en-IN"),
              name === "actual" ? "Actual" : "Pace",
            ]}
          />
          <Line
            type="monotone"
            dataKey="pace"
            stroke="#9ca3af"
            strokeDasharray="4 4"
            strokeWidth={1.5}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="actual"
            stroke="#0f7b5f"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
          {annotationPoints.map((a) => (
            <ReferenceDot
              key={`${a.date}-${a.label}`}
              x={data.find((d) => d.date === a.date)?.day}
              y={a.y}
              r={4}
              fill="#2563eb"
              stroke="#ffffff"
              strokeWidth={1.5}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
