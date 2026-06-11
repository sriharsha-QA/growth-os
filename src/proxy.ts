import { NextResponse, type NextRequest } from "next/server";

// Auth removed — single user app, no login required.
export async function proxy(request: NextRequest) {
  return NextResponse.next({ request });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest|icons|api/cron).*)"],
};
