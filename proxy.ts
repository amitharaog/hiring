import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// The hiring tool holds candidates' personal details, so when DASHBOARD_PASSWORD is set
// every /hiring page and /api/hiring route asks for it (HTTP Basic auth: any username).
export function proxy(req: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return NextResponse.next();

  const header = req.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    try {
      const given = atob(header.slice(6)).split(":").slice(1).join(":");
      if (given === password) return NextResponse.next();
    } catch {}
  }
  return new NextResponse("Password required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Kargo hiring", charset="UTF-8"' },
  });
}

export const config = { matcher: ["/hiring/:path*", "/api/hiring/:path*"] };
