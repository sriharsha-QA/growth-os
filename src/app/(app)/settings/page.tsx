import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { SettingsForm } from "@/components/shell/settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, timezone, day_rollover_hour")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/login");

  const { data: challenge } = await supabase
    .from("challenges")
    .select("id")
    .eq("status", "active")
    .maybeSingle();

  const { data: trackables } = challenge
    ? await supabase
        .from("trackables")
        .select("id, name, unit, direction, baseline_value, target_value")
        .eq("challenge_id", challenge.id)
        .order("sort_order")
    : { data: [] };

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-display text-2xl font-semibold tracking-tight">Settings</h1>
      <div className="mt-6">
        <SettingsForm
          displayName={profile.display_name ?? ""}
          timezone={profile.timezone}
          dayRolloverHour={profile.day_rollover_hour.slice(0, 5)}
          trackables={(trackables ?? []).map((t) => ({
            id: t.id,
            name: t.name,
            unit: t.unit,
            direction: t.direction,
            baseline: Number(t.baseline_value),
            target: Number(t.target_value),
          }))}
        />
      </div>
    </div>
  );
}
