import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

/** Neutralize spreadsheet formula injection in user-authored text. */
function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (/^[=+\-@\t]/.test(s)) s = "'" + s;
  if (/[",\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

const TABLES = [
  "profiles", "user_settings", "challenges", "trackables", "target_history",
  "metric_snapshots", "snapshot_audit", "daily_activities", "check_ins",
  "annotations", "weekly_reviews", "insights", "content_pillars", "content_items",
  "content_metrics", "weekly_targets", "leads", "monetization_events",
] as const;

/**
 * Full-fidelity export (v3.1 P0-13): the anti-lock-in contract.
 * JSON = everything; CSV = the snapshot fact table.
 * RLS scopes every query to the caller — no service role here.
 */
export async function GET(request: Request) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const format = new URL(request.url).searchParams.get("format") ?? "json";
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "csv") {
    const { data, error } = await supabase
      .from("metric_snapshots")
      .select("trackable_id, local_date, metric_type, value, source, created_at, updated_at")
      .order("local_date");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const header = "trackable_id,local_date,metric_type,value,source,created_at,updated_at";
    const lines = (data ?? []).map((r) =>
      [r.trackable_id, r.local_date, r.metric_type, r.value, r.source, r.created_at, r.updated_at]
        .map(csvCell).join(",")
    );
    return new NextResponse([header, ...lines].join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="growth-os-snapshots-${stamp}.csv"`,
      },
    });
  }

  const dump: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    schema_version: "2026-06-11",
  };
  for (const table of TABLES) {
    const { data, error } = await supabase.from(table).select("*");
    dump[table] = error ? { _error: error.message } : data;
  }
  return new NextResponse(JSON.stringify(dump, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="growth-os-export-${stamp}.json"`,
    },
  });
}
