import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { createId } from "@/lib/id";
import { getDb } from "@/lib/db";
import { memberships, organizations, users } from "@/lib/db/schema";
import { isCloud } from "@/lib/edition";
import { createSession, destroyAllSessionsFor, hasUser } from "./session";

const SALT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;

export const DEFAULT_ORG_NAME = "Personal";
export const DEFAULT_ORG_SLUG = "personal";

function assertPasswordStrength(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    );
  }
}

/**
 * Self-hosted first-run: create the single organization, its owner, and the
 * membership that binds them, then sign in.
 *
 * Cloud signup (Phase 1) will call the same three inserts with a real email and
 * a per-customer organization — the shape below is already multi-tenant, it
 * simply happens to be called once.
 */
export async function setupAdmin(password: string): Promise<void> {
  if (isCloud) {
    throw new Error("Setup is disabled in the hosted edition; sign up instead");
  }
  if (await hasUser()) {
    throw new Error("Admin already configured");
  }
  assertPasswordStrength(password);

  const db = await getDb();
  const userId = createId("usr");
  const organizationId = createId("org");
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  await db.transaction(async (tx) => {
    await tx.insert(organizations).values({
      id: organizationId,
      name: DEFAULT_ORG_NAME,
      slug: DEFAULT_ORG_SLUG,
    });
    await tx.insert(users).values({ id: userId, passwordHash });
    await tx.insert(memberships).values({
      id: createId("mem"),
      organizationId,
      userId,
      role: "owner",
    });
  });

  await createSession(userId, organizationId);
}

export async function login(password: string): Promise<boolean> {
  const db = await getDb();
  const [row] = await db
    .select({
      userId: users.id,
      passwordHash: users.passwordHash,
      organizationId: memberships.organizationId,
    })
    .from(users)
    .innerJoin(memberships, eq(memberships.userId, users.id))
    .limit(1);

  if (!row) return false;

  const ok = await bcrypt.compare(password, row.passwordHash);
  if (!ok) return false;

  await createSession(row.userId, row.organizationId);
  return true;
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const db = await getDb();
  const [user] = await db.select().from(users).limit(1);
  if (!user) throw new Error("No user configured");

  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) throw new Error("Current password is incorrect");
  assertPasswordStrength(newPassword);

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  // A password change revokes every existing session, including this one.
  await destroyAllSessionsFor(user.id);
}
