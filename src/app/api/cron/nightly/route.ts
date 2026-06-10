import { NextResponse } from "next/server";

/**
 * Nightly pipeline (Phase 2): snapshot integrity checks, insight generation,
 * reminder fan-out. Stubbed in Phase 0/1 — authenticated and observable, no-op.
 * This route lives in the privileged zone: it MAY import lib/server/admin.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, ran: "noop", at: new Date().toISOString() });
}
