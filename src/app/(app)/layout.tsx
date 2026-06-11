import Link from "next/link";
import { signOut } from "@/actions/challenge";
import { MobileTabBar, NavLinks } from "@/components/shell/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100dvh", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      {/* Top nav */}
      <header style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        borderBottom: "0.5px solid var(--border)",
        background: "color-mix(in srgb, var(--bg) 92%, transparent)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}>
        <div style={{
          maxWidth: "960px",
          margin: "0 auto",
          padding: "0 16px",
          height: "52px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
        }}>
          <Link href="/dashboard" style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--accent)",
            textDecoration: "none",
          }}>
            Growth OS
          </Link>

          {/* Desktop nav */}
          <nav style={{ display: "flex", alignItems: "center", gap: "4px" }} className="desktop-nav">
            <NavLinks />
          </nav>

          <form action={signOut}>
            <button type="submit" style={{
              fontSize: "12px",
              color: "var(--text3)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px 0",
            }}>
              Sign out
            </button>
          </form>
        </div>
      </header>

      {/* Page content */}
      <main style={{
        maxWidth: "960px",
        margin: "0 auto",
        padding: "20px 16px 88px",
      }}>
        {children}
      </main>

      <MobileTabBar />

      <style>{`
        @media (min-width: 768px) {
          main { padding-bottom: 32px !important; }
        }
        @media (max-width: 767px) {
          .desktop-nav { display: none !important; }
        }
      `}</style>
    </div>
  );
}
