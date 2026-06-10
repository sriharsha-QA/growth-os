export function fmtNumber(n: number | null | undefined, unit?: string): string {
  if (n === null || n === undefined) return "—";
  const v = Math.abs(n) >= 10000 ? Intl.NumberFormat("en-IN").format(Math.round(n)) : `${Math.round(n * 10) / 10}`;
  return unit === "kg" || unit === "₹" ? `${v} ${unit ?? ""}`.trim() : v;
}

export function fmtDelta(n: number | null | undefined): string {
  if (n === null || n === undefined) return "";
  const r = Math.round(n * 10) / 10;
  return r >= 0 ? `+${r}` : `${r}`;
}

export function fmtPct(p: number | null | undefined): string {
  if (p === null || p === undefined) return "—";
  return `${Math.round(p * 100)}%`;
}
