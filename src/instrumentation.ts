/**
 * Next runs this once per server process.
 *
 * A self-hosted install is a single long-running server, so it can host the
 * sync scheduler itself and needs no second process. Cloud is replicated
 * and/or serverless, where an in-process loop would run once per instance and
 * fight over the queue — there the worker runs standalone (`npm run worker`)
 * or on a cron hitting /api/internal/sync.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { isSelfHosted } = await import("./lib/edition");
  const disabled = process.env.BUSSOLA_DISABLE_INLINE_SYNC === "1";

  if (!isSelfHosted || disabled) return;

  const { startScheduler } = await import("./lib/sync/scheduler");
  startScheduler();
}
