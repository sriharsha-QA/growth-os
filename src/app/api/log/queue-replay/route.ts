import { NextResponse } from "next/server";
import { saveQuickLog } from "@/actions/metrics";

/** Replay endpoint for the offline queue. Same validation path as the action. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  // Replays are user-confirmed entries; outliers were either confirmed at entry
  // time or will converge via upsert — don't re-prompt a background sync.
  const res = await saveQuickLog({ ...(body as object), outlierConfirmed: true });
  if (!res.ok) {
    const status = res.code === "unauthenticated" ? 401 : res.code === "invalid" ? 400 : 422;
    return NextResponse.json(res, { status });
  }
  return NextResponse.json(res);
}
