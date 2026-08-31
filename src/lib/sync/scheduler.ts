import { TICK_INTERVAL_SECONDS } from "./config";
import { runDueSyncs } from "./runner";

/**
 * A tick loop around `runDueSyncs`.
 *
 * Ticks never overlap: if a run is still going when the timer fires, the tick
 * is skipped rather than queued, so a slow provider cannot pile up runs. The
 * loop is deliberately dumb — the schedule lives in the database, so restarting
 * the process loses nothing.
 */
export type Scheduler = { stop: () => void };

let running: Scheduler | null = null;

export function startScheduler(
  { intervalSeconds = TICK_INTERVAL_SECONDS, onReport = defaultReport } = {} as {
    intervalSeconds?: number;
    onReport?: (report: Awaited<ReturnType<typeof runDueSyncs>>) => void;
  },
): Scheduler {
  if (running) return running;

  let inFlight = false;
  let stopped = false;

  const tick = async () => {
    if (inFlight || stopped) return;
    inFlight = true;
    try {
      const report = await runDueSyncs();
      if (report.claimed > 0) onReport(report);
    } catch (error) {
      console.error("[sync] tick failed:", error);
    } finally {
      inFlight = false;
    }
  };

  const timer = setInterval(tick, intervalSeconds * 1000);
  // Never hold the process open just for the scheduler.
  timer.unref?.();

  // Log on start, not only when there is work: an operator needs to be able to
  // tell "nothing was due" apart from "the scheduler never came up".
  console.log(`[sync] scheduler started · tick=${intervalSeconds}s`);
  void tick();

  running = {
    stop: () => {
      stopped = true;
      clearInterval(timer);
      running = null;
    },
  };
  return running;
}

function defaultReport(report: Awaited<ReturnType<typeof runDueSyncs>>) {
  const parts = [
    `claimed=${report.claimed}`,
    `ok=${report.succeeded}`,
    `failed=${report.failed}`,
  ];
  if (report.disabled > 0) parts.push(`disabled=${report.disabled}`);
  console.log(`[sync] ${parts.join(" ")}`);
}
