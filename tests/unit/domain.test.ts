// Unit tests for the pure TS domain layer (v3.1 §10 verify job).
// Runs on Node's built-in runner with native type-stripping — zero new deps:
//   node --test tests/unit/
// SQL math (fn_local_date / fn_pace_target) is tested in supabase/tests; these
// cover the TS *callers*: validation, parsing, streaks, pace classification.

import { test } from "node:test";
import assert from "node:assert/strict";

import { parseMetricInput, quickLogInput, createChallengeInput } from "../../src/lib/domain/schemas.ts";
import { classifyPace, computeStreak, type DailyProgressRow } from "../../src/lib/domain/types.ts";

// ---------- parseMetricInput ----------
test("parseMetricInput: plain, comma, k/m suffixes, garbage", () => {
  assert.equal(parseMetricInput("1247"), 1247);
  assert.equal(parseMetricInput("1,247"), 1247);
  assert.equal(parseMetricInput(" 1.2k "), 1200);
  assert.equal(parseMetricInput("3.4m"), 3_400_000);
  assert.equal(parseMetricInput("12K"), 12000);
  assert.equal(parseMetricInput(""), null);
  assert.equal(parseMetricInput("abc"), null);
  assert.equal(parseMetricInput("-5"), null); // negatives rejected at parse
  assert.equal(parseMetricInput("1.2.3"), null);
});

// ---------- zod boundaries ----------
test("quickLogInput: rejects negative value and bad enum (P0-14 acceptance)", () => {
  const base = {
    challengeId: "9f8b3c1e-0000-4000-8000-000000000001",
    snapshots: [
      { trackableId: "9f8b3c1e-0000-4000-8000-000000000002", metricType: "followers", value: 100 },
    ],
  };
  assert.equal(quickLogInput.safeParse(base).success, true);

  const negative = structuredClone(base);
  negative.snapshots[0].value = -1;
  assert.equal(quickLogInput.safeParse(negative).success, false);

  const badEnum = structuredClone(base) as Record<string, unknown>;
  (badEnum.snapshots as Array<Record<string, unknown>>)[0].metricType = "vibes";
  assert.equal(quickLogInput.safeParse(badEnum).success, false);

  const badDate = { ...base, localDate: "11-06-2026" };
  assert.equal(quickLogInput.safeParse(badDate).success, false);
});

test("createChallengeInput: direction-aware target refinement", () => {
  const mk = (direction: "increase" | "decrease", baseline: number, target: number) => ({
    name: "Sprint",
    startDate: "2026-06-11",
    clientToken: "9f8b3c1e-0000-4000-8000-000000000099",  // required by D01 fix (M13)
    trackables: [
      {
        name: "X",
        unit: "u",
        primaryMetric: "value",
        direction,
        kind: "custom",
        baseline,
        target,
      },
    ],
  });
  assert.equal(createChallengeInput.safeParse(mk("increase", 100, 5000)).success, true);
  assert.equal(createChallengeInput.safeParse(mk("increase", 5000, 100)).success, false);
  assert.equal(createChallengeInput.safeParse(mk("decrease", 84, 78)).success, true);
  assert.equal(createChallengeInput.safeParse(mk("decrease", 78, 84)).success, false);
});

// ---------- streaks (P1-5 fixture table) ----------
test("computeStreak: fixture table", () => {
  const today = "2026-06-11";
  // empty
  assert.equal(computeStreak([], today), 0);
  // logged today + 2 prior days = 3
  assert.equal(computeStreak(["2026-06-11", "2026-06-10", "2026-06-09"], today), 3);
  // not yet logged today; streak anchors on yesterday
  assert.equal(computeStreak(["2026-06-10", "2026-06-09"], today), 2);
  // gap two days ago breaks it
  assert.equal(computeStreak(["2026-06-11", "2026-06-09"], today), 1);
  // last log 3 days ago = dead streak
  assert.equal(computeStreak(["2026-06-08"], today), 0);
  // unordered input still works (Set-based)
  assert.equal(computeStreak(["2026-06-09", "2026-06-11", "2026-06-10"], today), 3);
});

// ---------- pace classification (presentation thresholds, direction-aware) ----------
function row(partial: Partial<DailyProgressRow>): DailyProgressRow {
  return {
    user_id: "u",
    challenge_id: "c",
    trackable_id: "t",
    name: "X",
    unit: "u",
    direction: "increase",
    baseline_value: 100,
    target_value: 1000,
    local_date: "2026-06-11",
    day_index: 45,
    value: 550,
    delta: 10,
    pace_target: 550,
    pct_of_target: 0.5,
    velocity_7d: 10,
    required_velocity: 10,
    ...partial,
  };
}

test("classifyPace: increase thresholds", () => {
  assert.equal(classifyPace(row({ value: 600, pace_target: 550 })), "ahead"); // ratio ≈1.11
  assert.equal(classifyPace(row({ value: 550, pace_target: 550 })), "on_track");
  assert.equal(classifyPace(row({ value: 400, pace_target: 550 })), "recoverable"); // ratio ≈0.67
  assert.equal(classifyPace(row({ value: 200, pace_target: 550 })), "recalibrate"); // ratio ≈0.22
});

test("createChallengeInput: clientToken is required and must be a UUID (D01)", () => {
  const base = {
    name: "Sprint",
    startDate: "2026-06-11",
    trackables: [{ name: "X", unit: "u", primaryMetric: "value", direction: "increase", kind: "custom", baseline: 0, target: 100 }],
  };
  // missing clientToken → invalid
  assert.equal(createChallengeInput.safeParse(base).success, false);
  // non-UUID string → invalid
  assert.equal(createChallengeInput.safeParse({ ...base, clientToken: "not-a-uuid" }).success, false);
  // valid UUID → valid
  assert.equal(createChallengeInput.safeParse({ ...base, clientToken: "9f8b3c1e-0000-4000-8000-000000000001" }).success, true);
});

test("classifyPace: decrease direction normalizes (8-kg test)", () => {
  const dec = (value: number, pace: number) =>
    classifyPace(
      row({
        direction: "decrease",
        baseline_value: 84,
        target_value: 78,
        value,
        pace_target: pace,
      })
    );
  // pace says 81 (3kg down of 6); actual 80.5 = more progress = ahead
  assert.equal(dec(80.5, 81), "ahead");
  assert.equal(dec(81, 81), "on_track");
  assert.equal(dec(82.5, 81), "recoverable"); // 1.5 of expected 3 = 0.5
  assert.equal(dec(83.8, 81), "recalibrate");
});
