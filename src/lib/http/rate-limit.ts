/**
 * A sliding-window rate limiter for the endpoints that answer without a
 * session: share links and the MCP server.
 *
 * In memory, deliberately. A self-hosted install is one process, so this is
 * exact there — which is the deployment that has no CDN, no WAF and no
 * platform limiter in front of it, and therefore needs this most. A replicated
 * cloud deployment gets one window per instance, so the effective ceiling is
 * `limit × instances`: weaker than a shared counter, and still the difference
 * between a bounded endpoint and an unbounded one. A Redis-backed
 * implementation can replace this behind the same function.
 *
 * Deliberately not in the database. A limiter that writes a row per request
 * turns "too many requests" into "too many writes", which is the failure it
 * exists to prevent.
 */

type Window = {
  /** Request timestamps inside the current window, oldest first. */
  hits: number[];
  /** When this bucket may be swept, refreshed on every touch. */
  seenAt: number;
};

export type RateLimitRule = {
  /** Requests allowed per window. */
  limit: number;
  windowMs: number;
};

export type RateLimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the caller may retry. Zero when allowed. */
  retryAfter: number;
};

/** Windows live at module scope so they survive between requests. */
const buckets = new Map<string, Window>();

/**
 * Idle buckets are swept lazily rather than on a timer: a timer would keep a
 * serverless instance alive, and the map only grows while requests arrive.
 */
const SWEEP_INTERVAL_MS = 60_000;
const BUCKET_TTL_MS = 10 * 60_000;
/** A ceiling on distinct keys, so a flood of unique tokens cannot exhaust memory. */
const MAX_BUCKETS = 20_000;

let lastSweep = 0;

function sweep(now: number): void {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, window] of buckets) {
    if (now - window.seenAt > BUCKET_TTL_MS) buckets.delete(key);
  }
}

export function rateLimit(key: string, rule: RateLimitRule): RateLimitResult {
  const now = Date.now();
  sweep(now);

  /*
   * At the ceiling, refuse rather than evict. Evicting the oldest bucket would
   * let an attacker cycling through keys reset an honest caller's window,
   * which turns the limiter into the amplifier.
   */
  let window = buckets.get(key);
  if (!window) {
    if (buckets.size >= MAX_BUCKETS) {
      return { ok: false, limit: rule.limit, remaining: 0, retryAfter: 60 };
    }
    window = { hits: [], seenAt: now };
    buckets.set(key, window);
  }

  const cutoff = now - rule.windowMs;
  // Hits are appended in order, so dropping the expired prefix is a scan from
  // the front rather than a filter over the whole array.
  let expired = 0;
  while (expired < window.hits.length && window.hits[expired]! <= cutoff) {
    expired += 1;
  }
  if (expired > 0) window.hits.splice(0, expired);

  window.seenAt = now;

  if (window.hits.length >= rule.limit) {
    const oldest = window.hits[0]!;
    return {
      ok: false,
      limit: rule.limit,
      remaining: 0,
      retryAfter: Math.max(1, Math.ceil((oldest + rule.windowMs - now) / 1000)),
    };
  }

  window.hits.push(now);
  return {
    ok: true,
    limit: rule.limit,
    remaining: rule.limit - window.hits.length,
    retryAfter: 0,
  };
}

/**
 * The caller's address, as far as it can be trusted.
 *
 * `x-forwarded-for` is client-settable unless a proxy overwrites it, so this is
 * only ever used to spread load between honest callers — never as the sole key
 * for anything that matters. Where a real credential exists (a share token, an
 * API token) that is the key instead, because it cannot be spoofed.
 */
export function callerAddress(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

/** Headers that tell a well-behaved client what it just ran into. */
export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  const headers: Record<string, string> = {
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(result.remaining),
  };
  if (!result.ok) headers["Retry-After"] = String(result.retryAfter);
  return headers;
}

/** Exposed for tests, which must not inherit another test's windows. */
export function resetRateLimits(): void {
  buckets.clear();
  lastSweep = 0;
}

/**
 * The rules, in one place so they can be read against each other.
 *
 * Share limits are per token, not per address: a link passed around a company
 * is many people behind one NAT, and one person on a phone is several
 * addresses. The token is what was actually shared, so it is what is metered.
 */
export const LIMITS = {
  /** A shared page loads once and then polls its widgets every 60s. */
  sharePage: { limit: 60, windowMs: 60_000 },
  /** Several widgets on one canvas poll in parallel; leave generous headroom. */
  shareData: { limit: 240, windowMs: 60_000 },
  /** An agent doing real work makes bursts of tool calls, not a stream. */
  mcp: { limit: 120, windowMs: 60_000 },
  /** Unauthenticated MCP attempts, keyed by address: this is credential guessing. */
  mcpAnonymous: { limit: 20, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitRule>;
