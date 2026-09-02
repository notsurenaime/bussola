import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "./proxy";

/**
 * The edge gate only knows whether a session cookie exists, never whether the
 * session behind it is valid. Everything here is about not over-trusting that.
 */
const COOKIE = "better-auth.session_token";

function request(path: string, { cookie }: { cookie?: boolean } = {}) {
  const req = new NextRequest(`http://localhost:3000${path}`);
  if (cookie) req.cookies.set(COOKIE, "stale.value");
  return req;
}

function location(response: Response): string | null {
  return response.headers.get("location");
}

describe("anonymous requests", () => {
  it("sends a page to the login screen and remembers where they were going", () => {
    const response = proxy(request("/dashboards"));
    expect(response.status).toBe(307);
    expect(location(response)).toContain("/login?next=%2Fdashboards");
  });

  it("answers 401 for an API route rather than redirecting", () => {
    const response = proxy(request("/api/dashboards"));
    expect(response.status).toBe(401);
  });

  it("lets the auth screens through", () => {
    expect(location(proxy(request("/login")))).toBeNull();
    expect(location(proxy(request("/signup")))).toBeNull();
  });
});

describe("routes that authenticate themselves", () => {
  it.each([
    "/api/auth/sign-in/email",
    "/api/status",
    "/api/internal/sync",
    "/api/billing/webhook",
    // Bearer token in the Authorization header.
    "/api/mcp",
    // Token in the path; the route resolves it on every request.
    "/share/shr_abc123",
    "/api/share/shr_abc123/data",
    // Better Auth verifies the invitation id before it grants anything.
    "/invite/inv_abc123",
  ])("lets %s through without a session cookie", (path) => {
    const response = proxy(request(path));
    expect(response.status).not.toBe(401);
    expect(location(response)).toBeNull();
  });

  it("still gates the dashboard a share link points at", () => {
    // The share page is public; the real canvas behind it is not.
    const response = proxy(request("/dashboards/dash_abc123"));
    expect(location(response)).toContain("/login");
  });
});

describe("a session cookie that is present but stale", () => {
  /*
   * The regression this file exists for. Bouncing anyone holding a cookie away
   * from /login trapped expired, revoked and reset-database sessions in a loop
   * — /login sent them to /dashboards, which found no valid session and sent
   * them back, with no way to sign in again.
   */
  it("still lets them reach the login screen", () => {
    const response = proxy(request("/login", { cookie: true }));
    expect(response.status).toBe(200);
    expect(location(response)).toBeNull();
  });

  it("still lets them reach the signup screen", () => {
    expect(location(proxy(request("/signup", { cookie: true })))).toBeNull();
  });

  it("lets protected pages through, for the page itself to decide", () => {
    // Validity needs a database lookup, which this gate deliberately avoids.
    const response = proxy(request("/dashboards", { cookie: true }));
    expect(response.status).toBe(200);
    expect(location(response)).toBeNull();
  });
});
