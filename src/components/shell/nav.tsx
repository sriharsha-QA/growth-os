"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, PenLine, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/log", label: "Log", icon: PenLine },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <>
      {links.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm transition-colors",
            pathname.startsWith(href) ? "bg-ink/5 font-medium" : "text-muted hover:text-ink"
          )}
        >
          {label}
        </Link>
      ))}
    </>
  );
}

export function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/95 backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-md items-stretch justify-around">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px]",
              pathname.startsWith(href) ? "text-accent" : "text-muted"
            )}
          >
            <Icon className="h-5 w-5" aria-hidden />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
