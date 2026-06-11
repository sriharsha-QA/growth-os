import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getLocalToday } from "@/lib/domain/day";
import { OnboardingWizard } from "@/components/log/onboarding-wizard";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const supabase = await createSupabaseServer();

  const { data: existing } = await supabase
    .from("challenges")
    .select("id")
    .eq("status", "active")
    .maybeSingle();
  if (existing) redirect("/dashboard");

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone, day_rollover_hour")
    .eq("id", "f67c40ae-4dad-4a61-bb16-f2e721dd29f5")
    .single();

  const today = profile ? await getLocalToday(supabase, profile) : new Date().toISOString().slice(0, 10);

  return <OnboardingWizard defaultStartDate={today} />;
}
