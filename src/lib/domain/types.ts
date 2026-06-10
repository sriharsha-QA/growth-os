// Domain types — mirrors supabase/migrations. Canonical math lives in Postgres
// (fn_local_date, fn_pace_target); these types only describe shapes.

export type Direction = "increase" | "decrease";
export type PacingModel = "linear" | "compounding";
export type TrackableKind = "platform_account" | "custom";
export type MetricType =
  | "followers" | "karma" | "value"
  | "impressions" | "profile_views" | "connection_requests"
  | "views" | "reads" | "read_ratio" | "claps"
  | "post_karma" | "comment_karma" | "subscribers";
export type SnapshotSource = "manual" | "api_sync" | "csv_import";
export type CheckinType = "daily_log" | "weekly_review";

export interface Profile {
  id: string;
  display_name: string | null;
  timezone: string;
  day_rollover_hour: string; // "04:00:00"
  reminder_time: string | null;
}

export interface Challenge {
  id: string;
  user_id: string;
  name: string;
  start_date: string; // date
  duration_days: number;
  pacing_model: PacingModel;
  status: "active" | "completed" | "abandoned";
}

export interface Trackable {
  id: string;
  challenge_id: string;
  name: string;
  kind: TrackableKind;
  direction: Direction;
  unit: string;
  primary_metric: MetricType;
  baseline_value: number;
  target_value: number;
  config: Record<string, unknown>;
  sync_enabled: boolean;
  sort_order: number;
}

/** Row shape of v_daily_progress (the read-model contract). */
export interface DailyProgressRow {
  user_id: string;
  challenge_id: string;
  trackable_id: string;
  name: string;
  unit: string;
  direction: Direction;
  baseline_value: number;
  target_value: number;
  local_date: string;
  day_index: number;
  value: number;
  delta: number | null;
  pace_target: number;
  pct_of_target: number;
  velocity_7d: number | null;
  required_velocity: number | null;
}

export type PaceState = "ahead" | "on_track" | "recoverable" | "recalibrate";

/**
 * Pace-state classification (presentation logic, not math — the numbers come
 * from the view). Direction-aware. "Recoverable" always carries a number; the
 * UI never renders a dead-red state (v2.0 U2).
 */
export function classifyPace(row: DailyProgressRow): PaceState {
  const span = row.target_value - row.baseline_value;
  if (span === 0) return "on_track";
  const progress = (row.value - row.baseline_value) / span; // direction-normalized
  const expected = (row.pace_target - row.baseline_value) / span;
  if (expected <= 0) return "on_track";
  const ratio = progress / expected;
  if (ratio >= 1.05) return "ahead";
  if (ratio >= 0.9) return "on_track";
  if (ratio >= 0.5) return "recoverable";
  return "recalibrate";
}

/** Streak of consecutive daily check-ins ending today or yesterday. */
export function computeStreak(checkinDatesDesc: string[], today: string): number {
  if (checkinDatesDesc.length === 0) return 0;
  const dates = new Set(checkinDatesDesc);
  const start = new Date(today + "T00:00:00Z");
  // streak may anchor on today (already logged) or yesterday (not yet logged today)
  let anchor = dates.has(today)
    ? start
    : new Date(start.getTime() - 86400000);
  let streak = 0;
  for (;;) {
    const key = anchor.toISOString().slice(0, 10);
    if (!dates.has(key)) break;
    streak += 1;
    anchor = new Date(anchor.getTime() - 86400000);
  }
  return streak;
}
