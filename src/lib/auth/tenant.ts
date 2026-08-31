import { forTenant, type TenantContext, type TenantRepos } from "@/lib/db/tenant";
import { getSessionUser } from "./session";

export class UnauthorizedError extends Error {
  constructor() {
    super("UNAUTHORIZED");
    this.name = "UnauthorizedError";
  }
}

/**
 * The single entry point from a request to tenant data.
 *
 * Identical in both editions: self-hosted resolves to the one organization
 * created at setup, cloud to whichever organization the session is acting in.
 * Route handlers never see an organization id they did not get from here.
 */
export async function getTenant(): Promise<TenantRepos | null> {
  const ctx = await getSessionUser();
  return ctx ? forTenant(ctx) : null;
}

export async function requireTenant(): Promise<TenantRepos> {
  const repos = await getTenant();
  if (!repos) throw new UnauthorizedError();
  return repos;
}

export type { TenantContext, TenantRepos };
