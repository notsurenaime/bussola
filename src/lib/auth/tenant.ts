import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { forTenant, type TenantContext, type TenantRepos } from "@/lib/db/tenant";
import { getAuth } from ".";

export class UnauthorizedError extends Error {
  constructor() {
    super("UNAUTHORIZED");
    this.name = "UnauthorizedError";
  }
}

export type SessionUser = {
  id: string;
  email: string;
  name: string;
};

/**
 * The verified identity behind the current request, or null.
 *
 * The organization comes from the session's active organization; if a session
 * predates its organization (or the active one was left), we fall back to the
 * user's membership so a signed-in account always has a tenant to act in.
 */
export async function getSession(): Promise<{
  user: SessionUser;
  organizationId: string;
} | null> {
  const auth = await getAuth();
  const result = await auth.api.getSession({ headers: await headers() });
  if (!result) return null;

  let organizationId = result.session.activeOrganizationId ?? null;

  if (!organizationId) {
    // A session opened during sign-up is created before the account's
    // organization exists, so it starts with no active organization. Resolve it
    // from the membership and write it back, so this costs one extra query once
    // per session rather than on every request.
    const db = await getDb();
    const [membership] = await db
      .select({ organizationId: schema.member.organizationId })
      .from(schema.member)
      .where(eq(schema.member.userId, result.user.id))
      .limit(1);

    organizationId = membership?.organizationId ?? null;

    if (organizationId) {
      await db
        .update(schema.session)
        .set({ activeOrganizationId: organizationId })
        .where(eq(schema.session.id, result.session.id));
    }
  }

  if (!organizationId) return null;

  return {
    user: {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
    },
    organizationId,
  };
}

/**
 * The single entry point from a request to tenant data.
 *
 * Identical in both editions: self-hosted resolves to the one organization
 * created when the instance was claimed, cloud to whichever organization the
 * session is acting in. Route handlers never see an organization id they did
 * not get from here.
 */
export async function getTenant(): Promise<TenantRepos | null> {
  const session = await getSession();
  if (!session) return null;
  return forTenant({
    organizationId: session.organizationId,
    userId: session.user.id,
  });
}

/**
 * For route handlers: throws, so `withTenant` can answer 401.
 */
export async function requireTenant(): Promise<TenantRepos> {
  const repos = await getTenant();
  if (!repos) throw new UnauthorizedError();
  return repos;
}

/**
 * For pages: redirects to the login screen instead of throwing.
 *
 * A page and its layout render in parallel, so a page that throws races the
 * layout's own redirect and logs an unhandled error on every anonymous request
 * even though the user ends up in the right place. Redirecting from both is
 * quiet and has the same outcome.
 */
export async function requirePageTenant(): Promise<TenantRepos> {
  const repos = await getTenant();
  if (!repos) redirect("/login");
  return repos;
}

/** True once this instance has been claimed. Self-hosted setup gate. */
export async function hasAccount(): Promise<boolean> {
  const db = await getDb();
  const rows = await db.select({ id: schema.user.id }).from(schema.user).limit(1);
  return rows.length > 0;
}

export type { TenantContext, TenantRepos };
