import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = new Set(["/login", "/signup"]);

/** Paths under these prefixes carry their own credential and need no session. */
const PUBLIC_PREFIXES = ["/invite/"];

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
  // the cron entry point (shared secret), Stripe's webhook (signature), the
  // MCP server (bearer token), and share links (the token in the path).
  // None of these has a session behind it, and each checks its own credential
  // on every request rather than relying on having been routed here.
  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/internal/") ||
    pathname.startsWith("/api/share/") ||
    pathname.startsWith("/share/") ||
    pathname === "/api/mcp" ||
    pathname === "/api/billing/webhook" ||
    pathname === "/api/status"
  ) {
    return NextResponse.next();
  }

  const hasSession = Boolean(getSessionCookie(request));
  const isPublic =
    PUBLIC_PATHS.has(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));

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

  /*
   * Deliberately no "already signed in, bounce to /dashboards" here.
   *
   * This gate only knows whether a cookie exists, not whether the session
   * behind it is still valid. Redirecting on cookie presence alone traps
   * anyone holding a stale one — an expired or revoked session, or a reset
   * database — in a loop: /login sends them to /dashboards, which finds no
   * valid session and sends them back, with no way to sign in again.
   *
   * /login and /signup make that call themselves with a real session lookup,
   * which is the only check that can tell the two apart.
   */
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};
