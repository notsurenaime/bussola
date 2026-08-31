import { cookies } from "next/headers";
import { and, eq, lt } from "drizzle-orm";
import { createId } from "@/lib/id";
import { getDb } from "@/lib/db";
import { memberships, sessions, users } from "@/lib/db/schema";
import type { TenantContext } from "@/lib/db/tenant";

const SESSION_COOKIE = "bussola_session";
const SESSION_DAYS = 30;

/** True once at least one account exists. Self-hosted setup gate. */
export async function hasUser(): Promise<boolean> {
  const db = await getDb();
  const rows = await db.select({ id: users.id }).from(users).limit(1);
  return rows.length > 0;
}

export async function createSession(
  userId: string,
  organizationId: string,
): Promise<string> {
  const db = await getDb();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const id = createId("ses");

  await db.insert(sessions).values({ id, userId, organizationId, expiresAt });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  return id;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.delete(sessions).where(eq(sessions.id, token));
  }
  jar.delete(SESSION_COOKIE);
}

/** Invalidate every session for a user — used after a password change. */
export async function destroyAllSessionsFor(userId: string): Promise<void> {
  const db = await getDb();
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

/**
 * Resolve the cookie to a verified tenant context.
 *
 * The organization is re-checked against a live membership on every request, so
 * revoking a member takes effect immediately instead of waiting for their
 * session to expire.
 */
export async function getSessionUser(): Promise<TenantContext | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const db = await getDb();
  const now = new Date();
  await db.delete(sessions).where(lt(sessions.expiresAt, now));

  const [row] = await db
    .select({
      userId: sessions.userId,
      organizationId: sessions.organizationId,
      expiresAt: sessions.expiresAt,
      membershipId: memberships.id,
    })
    .from(sessions)
    .innerJoin(
      memberships,
      and(
        eq(memberships.userId, sessions.userId),
        eq(memberships.organizationId, sessions.organizationId),
      ),
    )
    .where(eq(sessions.id, token))
    .limit(1);

  if (!row || row.expiresAt < now) {
    jar.delete(SESSION_COOKIE);
    return null;
  }

  return { userId: row.userId, organizationId: row.organizationId };
}
