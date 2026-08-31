import type { Provider } from "@/lib/providers";

/** The only snapshot each connection currently produces. */
export const DASHBOARD_KIND = "dashboard";

/**
 * How often the worker refreshes each provider, in seconds.
 *
 * These are decoupled from what a browser polls: widgets read whatever snapshot
 * exists, so a longer interval costs freshness, never latency. Qonto is a bank
 * API with strict limits and its dashboard fans out across several paginated
 * calls, so it is deliberately the slowest.
 */
export const SYNC_INTERVAL_SECONDS: Record<Provider, number> = {
  railway: 60,
  netlify: 60,
  supabase: 120,
  qonto: 180,
  stripe: 180,
  polar: 180,
  attio: 300,
  vercel: 60,
  webtraffic: 300,
};

/** Ceiling for exponential backoff on a failing connection. */
export const MAX_BACKOFF_SECONDS = 60 * 60;

/**
 * After this many consecutive failures the connection stops being synced and
 * the UI asks the owner to reconnect. Without it, a revoked token would be
 * retried against the provider forever.
 */
export const MAX_CONSECUTIVE_FAILURES = 10;

/**
 * How long a claimed connection stays claimed. A worker that dies mid-fetch
 * leaves its claim behind; the lease is what lets the next worker pick it up
 * instead of the row being stuck forever.
 */
export const CLAIM_LEASE_SECONDS = 5 * 60;

/** Connections claimed per tick. */
export const BATCH_SIZE = Number(process.env.BUSSOLA_SYNC_BATCH || 25);

/** How often the scheduler looks for due connections. */
export const TICK_INTERVAL_SECONDS = Number(
  process.env.BUSSOLA_SYNC_TICK_SECONDS || 15,
);

/**
 * Delay before the next run of a connection.
 *
 * On success that is simply the provider's interval. On failure it doubles per
 * consecutive failure so a broken token backs off to hourly instead of
 * hammering the provider — and counting toward the rate limit of every other
 * tenant sharing our egress IP.
 */
export function nextDelaySeconds(
  provider: Provider,
  consecutiveFailures: number,
): number {
  const base = SYNC_INTERVAL_SECONDS[provider] ?? 120;
  if (consecutiveFailures <= 0) return base;
  const backoff = base * 2 ** Math.min(consecutiveFailures, 16);
  return Math.min(backoff, MAX_BACKOFF_SECONDS);
}
