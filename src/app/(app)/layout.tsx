import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { signOut } from "@/actions/challenge";
import { MobileTabBar, NavLinks } from "@/components/shell/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServer();

  return (
    <div className="min-h-dvh pb-20 md:pb-0">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link href="/dashboard" className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            Growth OS
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            <NavLinks />
          </nav>
          <form action={signOut}>
            <button className="text-xs text-muted hover:text-ink" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      <MobileTabBar />
    </div>
  );
}
