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
