import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. BYPASSES RLS.
 * Import is lint-fenced to src/lib/server and src/app/api/cron — see eslint config.
 * Used only by: nightly cron, export pipeline.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
