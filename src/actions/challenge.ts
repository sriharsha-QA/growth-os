"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  createChallengeInput,
  updateProfileInput,
  updateTargetInput,
  type ActionResult,
} from "@/lib/domain/schemas";

/**
 * Challenge wizard commit (v3.1 P1-1): challenge + trackables + pillars.
 * Re-entry safe: an existing active challenge short-circuits to the dashboard;
 * a partial failure deletes the challenge row, cascading children.
 */
export async function createChallenge(raw: unknown): Promise<ActionResult> {
  const parsed = createChallengeInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input", code: "invalid" };
  }
  const input = parsed.data;

  const supabase = await createSupabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Not signed in", code: "unauthenticated" };
  const userId = auth.user.id;

  const { data: existing } = await supabase
    .from("challenges")
    .select("id")
    .eq("status", "active")
    .maybeSingle();
  if (existing) redirect("/dashboard");

  const { data: challenge, error: cErr } = await supabase
    .from("challenges")
    .insert({
      user_id: userId,
      name: input.name,
      start_date: input.startDate,
      duration_days: input.durationDays,
      pacing_model: input.pacingModel,
    })
    .select("id")
    .single();
  if (cErr || !challenge) return { ok: false, error: cErr?.message ?? "Insert failed", code: "db" };

  const trackableRows = input.trackables.map((t, i) => ({
    user_id: userId,
    challenge_id: challenge.id,
    name: t.name,
    kind: t.kind,
    direction: t.direction,
    unit: t.unit,
    primary_metric: t.primaryMetric,
    baseline_value: t.baseline,
    target_value: t.target,
    config: t.platform ? { platform: t.platform } : {},
    sort_order: i + 1,
  }));
  const { error: tErr } = await supabase.from("trackables").insert(trackableRows);

  if (!tErr && input.pillars.length > 0) {
    await supabase.from("content_pillars").insert(
      input.pillars.map((name) => ({ user_id: userId, challenge_id: challenge.id, name }))
    );
  }

  if (!tErr && input.weeklyPostTarget !== undefined) {
    await supabase.from("weekly_targets").insert({
      user_id: userId,
      challenge_id: challenge.id,
      target_count: input.weeklyPostTarget,
    });
  }

  if (tErr) {
    // compensating cleanup: cascade removes any partial children
    await supabase.from("challenges").delete().eq("id", challenge.id);
    return { ok: false, error: tErr.message, code: "db" };
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

/**
 * Basic recalibration (v3.1 §8, P1 scope): direction-aware target edit.
 * The DB trigger mirrors every change into target_history; if a reason is
 * given, it's attached to the newest history row. Guided recalibration is P3.
 */
export async function updateTarget(raw: unknown): Promise<ActionResult> {
  const parsed = updateTargetInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input", code: "invalid" };
  }
  const supabase = await createSupabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Not signed in", code: "unauthenticated" };

  const { data: t } = await supabase
    .from("trackables")
    .select("id, direction, baseline_value, target_value")
    .eq("id", parsed.data.trackableId)
    .single();
  if (!t) return { ok: false, error: "Trackable not found", code: "not_found" };

  const ok =
    t.direction === "increase"
      ? parsed.data.target >= Number(t.baseline_value)
      : parsed.data.target <= Number(t.baseline_value);
  if (!ok) {
    return {
      ok: false,
      code: "invalid",
      error:
        t.direction === "increase"
          ? "Target must be at or above the baseline"
          : "Target must be at or below the baseline",
    };
  }

  const { error } = await supabase
    .from("trackables")
    .update({ target_value: parsed.data.target })
    .eq("id", t.id);
  if (error) return { ok: false, error: error.message, code: "db" };

  if (parsed.data.reason) {
    const { data: hist } = await supabase
      .from("target_history")
      .select("id")
      .eq("trackable_id", t.id)
      .order("changed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (hist) {
      await supabase.from("target_history").update({ reason: parsed.data.reason }).eq("id", hist.id);
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/settings");
  return { ok: true };
}

export async function updateProfile(raw: unknown): Promise<ActionResult> {
  const parsed = updateProfileInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input", code: "invalid" };
  }
  const supabase = await createSupabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Not signed in", code: "unauthenticated" };

  const patch: Record<string, string> = {};
  if (parsed.data.displayName !== undefined) patch.display_name = parsed.data.displayName;
  if (parsed.data.timezone !== undefined) patch.timezone = parsed.data.timezone;
  // Forward-only by design: historic local_dates are not rewritten (v3.1 ratified).
  if (parsed.data.dayRolloverHour !== undefined) patch.day_rollover_hour = parsed.data.dayRolloverHour;

  const { error } = await supabase.from("profiles").update(patch).eq("id", auth.user.id);
  if (error) return { ok: false, error: error.message, code: "db" };
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}
