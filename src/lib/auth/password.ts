import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { createId } from "@/lib/id";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { createSession, hasUser } from "./session";

const SALT_ROUNDS = 12;

export async function setupAdmin(password: string): Promise<void> {
  if (await hasUser()) {
    throw new Error("Admin already configured");
  }
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  const now = new Date();
  const id = createId("usr");
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  getDb()
    .insert(users)
    .values({
      id,
      passwordHash,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  await createSession(id);
}

export async function login(password: string): Promise<boolean> {
  const user = getDb().select().from(users).limit(1).get();
  if (!user) return false;

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return false;

  await createSession(user.id);
  return true;
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = getDb().select().from(users).limit(1).get();
  if (!user) throw new Error("No user configured");

  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) throw new Error("Current password is incorrect");
  if (newPassword.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  getDb()
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, user.id))
    .run();
}
