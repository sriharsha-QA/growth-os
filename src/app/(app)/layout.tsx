import Link from "next/link";
import { signOut } from "@/actions/challenge";
import { MobileTabBar, NavLinks } from "@/components/shell/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100dvh" }}>
      <header style={{
        position: "sticky", top: 0, zIndex: 20,
        borderBottom: "0.5px solid var(--border)",
        background: "var(--bg)",
        backdropFilter: "saturate(180%) blur(12px)",
        WebkitBackdropFilter: "saturate(180%) blur(12px)",
      }}>
        <div style={{
          maxWidth: "960px", margin: "0 auto",
          padding: "0 16px", height: "52px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <Link href="/dashboard" style={{
            fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 700,
            letterSpacing: "0.18em", textTransform: "uppercase",
            color: "var(--accent)", textDecoration: "none",
          }}>
            Growth OS
          </Link>
          <nav className="desktop-nav" style={{ display: "flex", gap: "4px" }}>
            <NavLinks />
          </nav>
          <form action={signOut}>
            <button type="submit" style={{
              fontSize: "12px", color: "var(--text3)",
              background: "none", border: "none", cursor: "pointer",
            }}>
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main style={{ maxWidth: "960px", margin: "0 auto", padding: "20px 16px 96px" }}>
        {children}
      </main>

      <MobileTabBar />

      <style>{`
        @media (min-width: 768px) { main { padding-bottom: 32px !important; } }
        @media (max-width: 767px) { .desktop-nav { display: none !important; } }
      `}</style>
    </div>
  );
}
