import { NextResponse } from "next/server";
import { requireTenant, UnauthorizedError } from "@/lib/auth/tenant";
import type { TenantRepos } from "@/lib/db/tenant";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function unauthorized() {
  return jsonError("Unauthorized", 401);
}

/**
 * Wrap a handler so it can only ever run with a resolved tenant.
 *
 * The handler receives repositories already bound to the caller's
 * organization; there is no code path that reaches tenant data without one.
 */
export async function withTenant(
  handler: (repos: TenantRepos) => Promise<Response>,
): Promise<Response> {
  let repos: TenantRepos;
  try {
    repos = await requireTenant();
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    throw error;
  }
  return handler(repos);
}
