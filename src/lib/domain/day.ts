import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "./types";

/**
 * Today's challenge-day date for this user. Day math is CANONICAL IN POSTGRES
 * (fn_local_date) — this wrapper calls it and never reimplements it (v3.0 T1/T4).
 */
export async function getLocalToday(
  supabase: SupabaseClient,
  profile: Pick<Profile, "timezone" | "day_rollover_hour">
): Promise<string> {
  const { data, error } = await supabase.rpc("fn_local_date", {
    ts: new Date().toISOString(),
    tz: profile.timezone,
    rollover: profile.day_rollover_hour,
  });
  if (error || !data) throw new Error(`fn_local_date failed: ${error?.message}`);
  return data as string;
}
