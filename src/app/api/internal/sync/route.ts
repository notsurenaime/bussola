import { jsonError, jsonOk } from "@/lib/api";
import { runDueSyncs } from "@/lib/sync/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron entry point for the sync worker, for platforms that schedule an HTTP
 * request rather than run a process (Vercel Cron, Railway cron, GitHub
 * Actions).
 *
 * Guarded by a shared secret rather than a user session: there is no user
 * here. Without BUSSOLA_SYNC_SECRET set, the endpoint stays closed — an open
 * one would let anyone force provider traffic on every tenant at once.
 */
function authorized(request: Request): boolean {
  const expected = process.env.BUSSOLA_SYNC_SECRET;
  if (!expected) return false;

  const header =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    request.headers.get("x-sync-secret");

  return Boolean(header) && header === expected;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return jsonError("Unauthorized", 401);
  }

  const report = await runDueSyncs();
  return jsonOk({
    claimed: report.claimed,
    succeeded: report.succeeded,
    failed: report.failed,
    disabled: report.disabled,
  });
}
