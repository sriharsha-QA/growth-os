import type { Metadata, Viewport } from "next";
import "./globals.css";

// Fonts load at runtime via <link> (build environments may be offline;
// next/font/google fetches at build time and would couple CI to Google).
const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap";

export const metadata: Metadata = {
  title: "Growth OS",
  description: "Daily operating system for your 90-day growth challenge.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Growth OS" },
};

export const viewport: Viewport = {
  themeColor: "#fafaf7",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={FONTS_HREF} />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
