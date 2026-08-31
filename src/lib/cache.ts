import { eq, lt } from "drizzle-orm";
import { createId } from "@/lib/id";
import { getDb } from "@/lib/db";
import { connectionCache } from "@/lib/db/schema";

const SWEEP_INTERVAL_MS = 60_000;
let lastSweep = 0;

/** Drop expired rows at most once per minute, off the read hot path. */
function sweepExpired() {
  const now = Date.now();
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  getDb()
    .delete(connectionCache)
    .where(lt(connectionCache.expiresAt, new Date(now)))
    .run();
}

function readRow<T>(
  cacheKey: string,
): { payload: T; expired: boolean } | null {
  const row = getDb()
    .select()
    .from(connectionCache)
    .where(eq(connectionCache.cacheKey, cacheKey))
    .get();
  if (!row) return null;
  return {
    payload: JSON.parse(row.payloadJson) as T,
    expired: row.expiresAt < new Date(),
  };
}

export function getCached<T>(cacheKey: string): T | null {
  sweepExpired();
  const row = readRow<T>(cacheKey);
  return row && !row.expired ? row.payload : null;
}

export function setCache(cacheKey: string, payload: unknown, ttlSeconds: number) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
  const payloadJson = JSON.stringify(payload);

  getDb()
    .insert(connectionCache)
    .values({
      id: createId("cch"),
      cacheKey,
      payloadJson,
      expiresAt,
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: connectionCache.cacheKey,
      set: { payloadJson, expiresAt },
    })
    .run();
}

/**
 * Stale-while-revalidate: a fresh hit is returned as-is; an expired hit is
 * returned immediately while a refresh runs in the background (so widgets never
 * flash a spinner on a TTL boundary); a miss awaits the fetch.
 */
export async function cachedFetch<T>(
  cacheKey: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<{ data: T; cached: boolean }> {
  sweepExpired();
  const row = readRow<T>(cacheKey);

  if (row && !row.expired) {
    return { data: row.payload, cached: true };
  }

  if (row?.expired) {
    void Promise.resolve()
      .then(fetcher)
      .then((data) => setCache(cacheKey, data, ttlSeconds))
      .catch(() => {
        /* keep serving stale until the next attempt succeeds */
      });
    return { data: row.payload, cached: true };
  }

  const data = await fetcher();
  setCache(cacheKey, data, ttlSeconds);
  return { data, cached: false };
}
