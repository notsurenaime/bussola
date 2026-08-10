import { cookies } from "next/headers";
import { eq, lt } from "drizzle-orm";
import { createId } from "@/lib/id";
import { getDb } from "@/lib/db";
import { sessions, users } from "@/lib/db/schema";

const SESSION_COOKIE = "bussola_session";
const SESSION_DAYS = 30;

export async function hasUser(): Promise<boolean> {
  const db = getDb();
  const row = db.select().from(users).limit(1).all();
  return row.length > 0;
}

export async function createSession(userId: string): Promise<string> {
  const db = getDb();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const id = createId("ses");

  db.insert(sessions)
    .values({
      id,
      userId,
      expiresAt,
      createdAt: now,
    })
    .run();

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
    getDb().delete(sessions).where(eq(sessions.id, token)).run();
  }
  jar.delete(SESSION_COOKIE);
}

export async function getSessionUser(): Promise<{ id: string } | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const db = getDb();
  const now = new Date();
  db.delete(sessions).where(lt(sessions.expiresAt, now)).run();

  const row = db
    .select({
      sessionId: sessions.id,
      userId: sessions.userId,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .where(eq(sessions.id, token))
    .get();

  if (!row || row.expiresAt < now) {
    jar.delete(SESSION_COOKIE);
    return null;
  }

  return { id: row.userId };
}

export async function requireUser(): Promise<{ id: string }> {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}
