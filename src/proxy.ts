import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = new Set(["/login", "/signup"]);

/**
 * A cheap, edge-safe gate: it only checks that a session cookie is present, so
 * it never touches the database. Whether that cookie is *valid* is decided by
 * `getSession()` in the layout and by `withTenant()` on every API route — this
 * exists to avoid rendering an authenticated shell for anonymous visitors.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Routes that authenticate themselves and must stay reachable without a
  // session cookie: Better Auth's own endpoints, the pre-login status probe,
  // the cron entry point (shared secret), and Stripe's webhook (signature).
  // None of these ever has a user behind it.
  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/internal/") ||
    pathname === "/api/billing/webhook" ||
    pathname === "/api/status"
  ) {
    return NextResponse.next();
  }

  const hasSession = Boolean(getSessionCookie(request));
  const isPublic = PUBLIC_PATHS.has(pathname);

  if (!hasSession && !isPublic) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    if (pathname !== "/") {
      url.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(url);
  }

  if (hasSession && isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboards";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};
