/**
 * forecast.ts — derives Forecast and Focus data from v_daily_progress rows.
 *
 * ALL business logic preserved:
 * - velocity_7d comes from v_daily_progress (Postgres window fn)
 * - required_velocity comes from v_daily_progress (Postgres calculation)
 * - classifyPace is unchanged
 * - No DB calls — pure computation from already-fetched rows
 */

import { classifyPace, type DailyProgressRow, type Trackable } from "./types.ts";

// ─── Forecast ────────────────────────────────────────────────────────────────

export type ForecastConfidence =
  | "will_exceed"   // projected > target by >5%
  | "on_track"      // projected within ±5% of target
  | "at_risk"       // projected 5–20% below target
  | "off_track";    // projected >20% below target

export interface TrackableForecast {
  trackableId: string;
  name: string;
  unit: string;
  direction: "increase" | "decrease";
  target: number;
  projected: number;     // value at day 90 if current 7d velocity continues
  surplus: number;       // positive = good (ahead), negative = bad (behind)
  confidence: ForecastConfidence;
  daysRemaining: number;
  hasVelocity: boolean;  // false if fewer than 7 days of data
}

export interface ForecastSummary {
  trackables: TrackableForecast[];
  overallConfidence: ForecastConfidence;
  aheadCount: number;
  onTrackCount: number;
  atRiskCount: number;
  offTrackCount: number;
}

export function computeForecast(
  latest: Map<string, DailyProgressRow>,
  trackables: Trackable[],
  dayIndex: number,
  durationDays: number
): ForecastSummary {
  const daysRemaining = Math.max(0, durationDays - dayIndex);

  const forecasts: TrackableForecast[] = trackables.map((t) => {
    const row = latest.get(t.id);

    if (!row) {
      // No data — project as if staying at baseline
      const surplus = t.direction === "increase"
        ? t.baseline_value - t.target_value   // negative = behind
        : t.target_value - t.baseline_value;  // for decrease, target < baseline

      return {
        trackableId: t.id,
        name: t.name,
        unit: t.unit,
        direction: t.direction,
        target: t.target_value,
        projected: t.baseline_value,
        surplus,
        confidence: "off_track" as ForecastConfidence,
        daysRemaining,
        hasVelocity: false,
      };
    }

    const velocity = row.velocity_7d;
    const hasVelocity = velocity !== null;

    // Projection: current value + (velocity × days remaining)
    // Falls back to required_velocity when 7d velocity unavailable
    const effectiveVelocity = velocity ?? row.required_velocity ?? 0;
    const projected = row.value + effectiveVelocity * daysRemaining;

    // Surplus: direction-normalised distance from target
    // positive = good (over-target for increase, under-target for decrease)
    const surplus = t.direction === "increase"
      ? projected - t.target_value
      : t.target_value - projected;

    const span = Math.abs(t.target_value - t.baseline_value);
    const surplusPct = span > 0 ? Math.abs(surplus) / span : 0;

    let confidence: ForecastConfidence;
    if (surplus > 0 && surplusPct > 0.05) confidence = "will_exceed";
    else if (surplus >= 0 || surplusPct <= 0.05) confidence = "on_track";
    else if (surplusPct <= 0.20) confidence = "at_risk";
    else confidence = "off_track";

    return {
      trackableId: t.id,
      name: t.name,
      unit: t.unit,
      direction: t.direction,
      target: t.target_value,
      projected: Math.round(projected),
      surplus: Math.round(surplus),
      confidence,
      daysRemaining,
      hasVelocity,
    };
  });

  // Overall: worst confidence wins
  const rank: Record<ForecastConfidence, number> = {
    will_exceed: 0, on_track: 1, at_risk: 2, off_track: 3,
  };
  const worst = forecasts.reduce<ForecastConfidence>(
    (acc, f) => rank[f.confidence] > rank[acc] ? f.confidence : acc,
    "will_exceed"
  );

  return {
    trackables: forecasts,
    overallConfidence: worst,
    aheadCount:    forecasts.filter((f) => f.confidence === "will_exceed").length,
    onTrackCount:  forecasts.filter((f) => f.confidence === "on_track").length,
    atRiskCount:   forecasts.filter((f) => f.confidence === "at_risk").length,
    offTrackCount: forecasts.filter((f) => f.confidence === "off_track").length,
  };
}

// ─── Focus ───────────────────────────────────────────────────────────────────

export interface FocusItem {
  trackableId: string;
  name: string;
  unit: string;
  paceState: ReturnType<typeof classifyPace>;
  velocity7d: number | null;
  requiredVelocity: number | null;
  gap: number;           // actual − pace_target (direction-normalised sign)
  gapGood: boolean;
}

export interface FocusSummary {
  mostAtRisk: FocusItem | null;   // single worst-off metric
  aheadCount: number;
  behindCount: number;
  items: FocusItem[];             // all, ranked worst-first
}

export function computeFocus(
  latest: Map<string, DailyProgressRow>,
  trackables: Trackable[]
): FocusSummary {
  const items: FocusItem[] = [];

  for (const t of trackables) {
    const row = latest.get(t.id);
    if (!row) continue;

    const paceState = classifyPace(row);
    const dec = t.direction === "decrease";
    const raw = row.value - row.pace_target;
    const gap = dec ? -raw : raw;      // positive = good
    const gapGood = gap >= 0;

    items.push({
      trackableId: t.id,
      name: t.name,
      unit: t.unit,
      paceState,
      velocity7d: row.velocity_7d,
      requiredVelocity: row.required_velocity,
      gap: Math.round(raw),
      gapGood,
    });
  }

  // Rank by severity: recalibrate > recoverable > on_track > ahead
  const rank: Record<string, number> = {
    recalibrate: 3, recoverable: 2, on_track: 1, ahead: 0,
  };
  items.sort((a, b) => rank[b.paceState] - rank[a.paceState]);

  const mostAtRisk =
    items.find((i) => i.paceState === "recalibrate" || i.paceState === "recoverable") ??
    null;

  return {
    mostAtRisk,
    aheadCount:  items.filter((i) => i.gapGood).length,
    behindCount: items.filter((i) => !i.gapGood).length,
    items,
  };
}

// ─── Recovery calculator ─────────────────────────────────────────────────────
// Answers: "what does closing the gap actually require?"
// The "behind by N" number is a cumulative debt. This translates it into
// a daily adjustment — the number the user can actually act on.

export interface RecoveryPlan {
  trackableId: string;
  name: string;
  unit: string;
  /** True when already ahead or on_track — no recovery needed. */
  onTrack: boolean;
  /** Current 7-day velocity (null if < 7 days of data). */
  currentVelocity: number | null;
  /** Required velocity from v_daily_progress (already computed by Postgres). */
  requiredVelocity: number | null;
  /** requiredVelocity − currentVelocity: the daily deficit to close. */
  dailyAdjustment: number | null;
  daysRemaining: number;
  /** Cumulative gap to pace target (signed, direction-normalised: negative = behind). */
  gapToPace: number;
}

export function computeRecovery(
  latest: Map<string, DailyProgressRow>,
  trackables: Trackable[],
  daysRemaining: number
): RecoveryPlan[] {
  return trackables.map((t) => {
    const row = latest.get(t.id);
    if (!row) {
      return {
        trackableId: t.id,
        name: t.name,
        unit: t.unit,
        onTrack: false,
        currentVelocity: null,
        requiredVelocity: null,
        dailyAdjustment: null,
        daysRemaining,
        gapToPace: 0,
      };
    }

    const pace = classifyPace(row);
    const onTrack = pace === "ahead" || pace === "on_track";

    const dec = t.direction === "decrease";
    const rawGap = row.value - row.pace_target;
    const gapToPace = dec ? -rawGap : rawGap; // positive = ahead, negative = behind

    const dailyAdjustment =
      row.velocity_7d !== null && row.required_velocity !== null
        ? Math.round((row.required_velocity - row.velocity_7d) * 10) / 10
        : null;

    return {
      trackableId: t.id,
      name: t.name,
      unit: t.unit,
      onTrack,
      currentVelocity: row.velocity_7d,
      requiredVelocity: row.required_velocity,
      dailyAdjustment,
      daysRemaining,
      gapToPace: Math.round(gapToPace),
    };
  });
}

// ─── Milestone system ────────────────────────────────────────────────────────
// Milestones at 10%, 25%, 50%, 75%, 100% of span + every 1000 round number.
// A milestone is "crossed" when the latest value has passed the threshold
// and the previous value (baseline) had not.

export interface Milestone {
  trackableId: string;
  trackableName: string;
  unit: string;
  value: number;        // the threshold value
  label: string;        // e.g. "2,500 followers" or "50% of goal"
  pct: number;          // 0–1 fraction of span
  crossed: boolean;     // true if current value has passed this threshold
  crossedRecently: boolean; // true if crossed within the last 7 days
  crossedDate: string | null;
}

export function computeMilestones(
  rows: DailyProgressRow[],
  trackables: Trackable[],
  latest: Map<string, DailyProgressRow>
): Milestone[] {
  const results: Milestone[] = [];

  for (const t of trackables) {
    const row = latest.get(t.id);
    if (!row) continue;

    const span = Math.abs(t.target_value - t.baseline_value);
    if (span === 0) continue;

    const pcts = [0.1, 0.25, 0.5, 0.75, 1.0];
    const thresholds = new Set<number>();

    // Percentage thresholds
    for (const p of pcts) {
      const v = t.direction === "increase"
        ? Math.round(t.baseline_value + span * p)
        : Math.round(t.baseline_value - span * p);
      thresholds.add(v);
    }

    // Round-number thresholds within range (every 500 or 1000 depending on span)
    const step = span >= 10000 ? 1000 : span >= 2000 ? 500 : span >= 500 ? 100 : 0;
    if (step > 0) {
      const lo = Math.min(t.baseline_value, t.target_value);
      const hi = Math.max(t.baseline_value, t.target_value);
      for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) {
        thresholds.add(v);
      }
    }

    // Sort by direction
    const sorted = Array.from(thresholds).sort((a, b) =>
      t.direction === "increase" ? a - b : b - a
    );

    // Get series for this trackable to find when thresholds were crossed
    const series = rows
      .filter((r) => r.trackable_id === t.id)
      .sort((a, b) => a.local_date.localeCompare(b.local_date));

    const sevenDaysAgo = series.length > 0
      ? (() => {
          const d = new Date(series[series.length - 1].local_date + "T00:00:00Z");
          d.setUTCDate(d.getUTCDate() - 7);
          return d.toISOString().slice(0, 10);
        })()
      : "";

    for (const v of sorted) {
      const pct = Math.abs(v - t.baseline_value) / span;
      const pctLabel = pcts.find((p) => Math.abs(pct - p) < 0.01);
      const label = pctLabel
        ? `${Math.round(pctLabel * 100)}% of goal · ${v.toLocaleString("en-IN")} ${t.unit}`
        : `${v.toLocaleString("en-IN")} ${t.unit}`;

      // Find crossing date
      let crossedDate: string | null = null;
      for (const r of series) {
        const passed = t.direction === "increase" ? r.value >= v : r.value <= v;
        if (passed) { crossedDate = r.local_date; break; }
      }

      const crossed = crossedDate !== null;
      const crossedRecently = crossed && !!sevenDaysAgo && crossedDate! >= sevenDaysAgo;

      results.push({
        trackableId: t.id,
        trackableName: t.name,
        unit: t.unit,
        value: v,
        label,
        pct,
        crossed,
        crossedRecently,
        crossedDate,
      });
    }
  }

  return results;
}

// ─── Weekly summary ──────────────────────────────────────────────────────────
// Groups progress rows into 7-day windows (week 1 = days 1–7, etc.)
// and computes per-week delta, best week, and projected Day 90 finish.

export interface WeekSummary {
  weekNumber: number;       // 1-based
  startDay: number;
  endDay: number;
  startDate: string;
  endDate: string;
  isCurrentWeek: boolean;
  isComplete: boolean;      // all 7 days have a check-in
  checkInCount: number;     // 0–7
  trackables: {
    trackableId: string;
    name: string;
    unit: string;
    startValue: number | null;
    endValue: number | null;
    delta: number | null;   // end − start (direction-aware sign)
    isBestWeek: boolean;    // highest delta across all weeks
  }[];
}

export function computeWeeklySummaries(
  rows: DailyProgressRow[],
  trackables: Trackable[],
  checkinDates: Set<string>,
  challengeStartDate: string,
  dayIndex: number,
  durationDays: number
): WeekSummary[] {
  const totalWeeks = Math.ceil(durationDays / 7);
  const summaries: WeekSummary[] = [];

  // Build per-trackable value series (date → value)
  const series = new Map<string, Map<string, number>>();
  for (const r of rows) {
    if (!series.has(r.trackable_id)) series.set(r.trackable_id, new Map());
    series.get(r.trackable_id)!.set(r.local_date, r.value);
  }

  // Find best delta per trackable across all weeks (for isBestWeek)
  const bestDelta = new Map<string, number>();

  // First pass — compute raw deltas
  const rawWeeks: { wn: number; tId: string; delta: number | null }[] = [];

  for (let wn = 1; wn <= totalWeeks; wn++) {
    const startDay = (wn - 1) * 7 + 1;
    const endDay   = Math.min(wn * 7, durationDays);

    const weekStartDate = (() => {
      const d = new Date(challengeStartDate + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + startDay - 1);
      return d.toISOString().slice(0, 10);
    })();
    const weekEndDate = (() => {
      const d = new Date(challengeStartDate + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + endDay - 1);
      return d.toISOString().slice(0, 10);
    })();

    for (const t of trackables) {
      const tSeries = series.get(t.id);
      if (!tSeries) { rawWeeks.push({ wn, tId: t.id, delta: null }); continue; }

      // Start value: last known on or before weekStartDate
      let startVal: number | null = null;
      for (const [date, val] of tSeries) {
        if (date <= weekStartDate) startVal = val;
      }

      // End value: last known on or before weekEndDate
      let endVal: number | null = null;
      for (const [date, val] of tSeries) {
        if (date <= weekEndDate) endVal = val;
      }

      const delta = startVal !== null && endVal !== null
        ? (t.direction === "increase" ? endVal - startVal : startVal - endVal)
        : null;

      rawWeeks.push({ wn, tId: t.id, delta });

      if (delta !== null) {
        const prev = bestDelta.get(t.id) ?? -Infinity;
        if (delta > prev) bestDelta.set(t.id, delta);
      }
    }
  }

  // Second pass — build summary objects
  for (let wn = 1; wn <= totalWeeks; wn++) {
    const startDay = (wn - 1) * 7 + 1;
    const endDay   = Math.min(wn * 7, durationDays);

    const weekStartDate = (() => {
      const d = new Date(challengeStartDate + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + startDay - 1);
      return d.toISOString().slice(0, 10);
    })();
    const weekEndDate = (() => {
      const d = new Date(challengeStartDate + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + endDay - 1);
      return d.toISOString().slice(0, 10);
    })();

    const isCurrentWeek = dayIndex >= startDay && dayIndex <= endDay;
    const isComplete = endDay < dayIndex; // past week

    let checkInCount = 0;
    for (const d of checkinDates) {
      if (d >= weekStartDate && d <= weekEndDate) checkInCount++;
    }

    const tRows = trackables.map((t) => {
      const tSeries = series.get(t.id);
      const raw = rawWeeks.find((r) => r.wn === wn && r.tId === t.id);

      let startVal: number | null = null;
      let endVal: number | null = null;
      if (tSeries) {
        for (const [date, val] of tSeries) {
          if (date <= weekStartDate) startVal = val;
        }
        for (const [date, val] of tSeries) {
          if (date <= weekEndDate) endVal = val;
        }
      }

      const delta = raw?.delta ?? null;
      const best  = bestDelta.get(t.id) ?? null;
      const isBestWeek = delta !== null && best !== null && delta === best && delta > 0;

      return {
        trackableId: t.id,
        name: t.name,
        unit: t.unit,
        startValue: startVal,
        endValue: endVal,
        delta,
        isBestWeek,
      };
    });

    summaries.push({
      weekNumber: wn,
      startDay,
      endDay,
      startDate: weekStartDate,
      endDate: weekEndDate,
      isCurrentWeek,
      isComplete,
      checkInCount,
      trackables: tRows,
    });
  }

  return summaries;
}
