import { eq, lt } from "drizzle-orm";
import { createId } from "@/lib/id";
import { getDb } from "@/lib/db";
import { connectionCache } from "@/lib/db/schema";

export function getCached<T>(cacheKey: string): T | null {
  const db = getDb();
  const now = new Date();
  db.delete(connectionCache).where(lt(connectionCache.expiresAt, now)).run();

  const row = db
    .select()
    .from(connectionCache)
    .where(eq(connectionCache.cacheKey, cacheKey))
    .get();

  if (!row || row.expiresAt < now) return null;
  return JSON.parse(row.payloadJson) as T;
}

export function setCache(cacheKey: string, payload: unknown, ttlSeconds: number) {
  const db = getDb();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
  const existing = db
    .select()
    .from(connectionCache)
    .where(eq(connectionCache.cacheKey, cacheKey))
    .get();

  const payloadJson = JSON.stringify(payload);

  if (existing) {
    db.update(connectionCache)
      .set({ payloadJson, expiresAt })
      .where(eq(connectionCache.id, existing.id))
      .run();
    return;
  }

  db.insert(connectionCache)
    .values({
      id: createId("cch"),
      cacheKey,
      payloadJson,
      expiresAt,
      createdAt: now,
    })
    .run();
}

export async function cachedFetch<T>(
  cacheKey: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<{ data: T; cached: boolean }> {
  const hit = getCached<T>(cacheKey);
  if (hit !== null) {
    return { data: hit, cached: true };
  }
  const data = await fetcher();
  setCache(cacheKey, data, ttlSeconds);
  return { data, cached: false };
}
