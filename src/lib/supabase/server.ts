import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** User-scoped server client (RSCs, Server Actions, route handlers). RLS enforced. */
export async function createSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // RSC render path: cookie writes are a no-op; middleware refreshes tokens.
          }
        },
      },
    }
  );
}
