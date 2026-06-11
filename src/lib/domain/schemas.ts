import { z } from "zod";

// Boundary validation (v3.1 X6). Shared by client forms and server actions.

export const metricTypeEnum = z.enum([
  "followers", "karma", "value",
  "impressions", "profile_views", "connection_requests",
  "views", "reads", "read_ratio", "claps",
  "post_karma", "comment_karma", "subscribers",
]);

/** Paste-tolerant numeric parsing: "1,247" / "1247" / "1.2k" / "3.4m". */
export function parseMetricInput(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(/,/g, "");
  if (s === "") return null;
  const m = s.match(/^(\d+(?:\.\d+)?)([km])?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const mult = m[2] === "k" ? 1_000 : m[2] === "m" ? 1_000_000 : 1;
  return Math.round(n * mult);
}

export const snapshotInput = z.object({
  trackableId: z.string().uuid(),
  metricType: metricTypeEnum,
  value: z.number().finite().min(0).max(1_000_000_000),
});

export const activityInput = z.object({
  trackableId: z.string().uuid(),
  activityKey: z.string().regex(/^[a-z][a-z0-9_]{1,49}$/),
  count: z.number().int().min(0).max(100_000),
});

export const quickLogInput = z.object({
  challengeId: z.string().uuid(),
  /** Backfill target; omitted = today (server derives via fn_local_date). */
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  snapshots: z.array(snapshotInput).min(1).max(40),
  activities: z.array(activityInput).max(20).default([]),
  /** User confirmed an outlier delta client-side; server still re-checks shape. */
  outlierConfirmed: z.boolean().default(false),
  /** Idempotency token for offline-queue replay. */
  clientToken: z.string().uuid().optional(),
});
export type QuickLogInput = z.infer<typeof quickLogInput>;

export const trackablePreset = z.object({
  name: z.string().min(1).max(60),
  unit: z.string().min(1).max(20),
  primaryMetric: metricTypeEnum,
  direction: z.enum(["increase", "decrease"]).default("increase"),
  kind: z.enum(["platform_account", "custom"]).default("platform_account"),
  platform: z.enum(["linkedin", "medium", "reddit", "newsletter", "other"]).optional(),
  baseline: z.number().finite().min(0),
  target: z.number().finite().min(0),
});

export const createChallengeInput = z.object({
  name: z.string().min(1).max(120),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  durationDays: z.number().int().min(7).max(365).default(90),
  pacingModel: z.enum(["linear", "compounding"]).default("compounding"),
  trackables: z.array(trackablePreset).min(1).max(12),
  pillars: z.array(z.string().min(1).max(40)).max(8).default([]),
  /** Challenge-level publishing target (weekly_targets row, trackable/format null). */
  weeklyPostTarget: z.number().int().min(0).max(100).optional(),
  /**
   * Client-generated UUID for idempotency (D01 fix).
   * The wizard generates this once on mount; duplicate tab submits or network
   * retries with the same token return the existing challenge instead of
   * creating a second one. Backed by UNIQUE on challenges.client_token (M13).
   */
  clientToken: z.string().uuid(),
}).superRefine((v, ctx) => {
  v.trackables.forEach((t, i) => {
    const ok = t.direction === "increase" ? t.target >= t.baseline : t.target <= t.baseline;
    if (!ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["trackables", i, "target"],
        message: t.direction === "increase"
          ? "Target must be at or above the baseline"
          : "Target must be at or below the baseline",
      });
    }
  });
});
export type CreateChallengeInput = z.infer<typeof createChallengeInput>;

export const updateTargetInput = z.object({
  trackableId: z.string().uuid(),
  target: z.number().finite().min(0).max(1_000_000_000),
  reason: z.string().max(200).optional(),
});

export const updateProfileInput = z.object({
  displayName: z.string().max(80).optional(),
  timezone: z.string().min(1).max(60).optional(),
  dayRolloverHour: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
});

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string; code?: string };
