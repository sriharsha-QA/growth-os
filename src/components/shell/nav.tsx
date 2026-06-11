"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, PenLine, Settings } from "lucide-react";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/log",       label: "Log",       icon: PenLine         },
  { href: "/settings",  label: "Settings",  icon: Settings        },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <>
      {links.map(({ href, label }) => {
        const active = pathname.startsWith(href);
        return (
          <Link key={href} href={href} style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "5px 12px",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: active ? 500 : 400,
            color: active ? "var(--text)" : "var(--text3)",
            background: active ? "var(--bg3)" : "transparent",
            textDecoration: "none",
            transition: "background 0.12s, color 0.12s",
          }}>
            {label}
          </Link>
        );
      })}
    </>
  );
}

export function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav style={{
      position: "fixed",
      inset: "auto 0 0 0",
      zIndex: 20,
      borderTop: "0.5px solid var(--border)",
      background: "color-mix(in srgb, var(--bg) 94%, transparent)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      paddingBottom: "env(safe-area-inset-bottom, 0px)",
    }} className="mobile-tab-bar">
      <div style={{
        maxWidth: "420px",
        margin: "0 auto",
        display: "flex",
        alignItems: "stretch",
      }}>
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link key={href} href={href} style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "3px",
              padding: "10px 0 8px",
              fontSize: "10px",
              fontWeight: active ? 500 : 400,
              color: active ? "var(--accent)" : "var(--text3)",
              textDecoration: "none",
              letterSpacing: "0.02em",
            }}>
              <Icon size={20} aria-hidden strokeWidth={active ? 2.25 : 1.75} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
