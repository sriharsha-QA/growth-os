import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

/**
 * Plot-ready progress series (v3.1 R2). Charts consume views, never raw rows.
 * Query: ?challengeId=…&from=YYYY-MM-DD&to=YYYY-MM-DD
 */
export async function GET(request: Request) {
  const supabase = await createSupabaseServer();

  const url = new URL(request.url);
  const challengeId = url.searchParams.get("challengeId");
  if (!challengeId) return NextResponse.json({ error: "challengeId required" }, { status: 400 });

  let q = supabase
    .from("v_daily_progress")
    .select("trackable_id, name, unit, direction, local_date, day_index, value, pace_target, velocity_7d, required_velocity")
    .eq("challenge_id", challengeId)
    .order("local_date");

  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (from) q = q.gte("local_date", from);
  if (to) q = q.lte("local_date", to);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // group into per-trackable series
  const series = new Map<string, { trackableId: string; name: string; unit: string; direction: string; points: unknown[] }>();
  for (const r of data ?? []) {
    if (!series.has(r.trackable_id)) {
      series.set(r.trackable_id, {
        trackableId: r.trackable_id, name: r.name, unit: r.unit, direction: r.direction, points: [],
      });
    }
    series.get(r.trackable_id)!.points.push({
      date: r.local_date, day: r.day_index, value: Number(r.value),
      pace: Number(r.pace_target), velocity7d: r.velocity_7d, requiredVelocity: r.required_velocity,
    });
  }
  return NextResponse.json({ series: [...series.values()] });
}
