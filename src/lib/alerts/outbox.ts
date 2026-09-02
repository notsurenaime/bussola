import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  alertDeliveries,
  alertEvents,
  notificationChannels,
} from "@/lib/db/schema";
import { decryptSecret } from "@/lib/crypto/vault";
import { createId } from "@/lib/id";
import { deliver, type AlertNotification, type Delivery } from "./deliver";

/**
 * The queue between "an alert fired" and "someone was told".
 *
 * Delivery used to run inside `syncConnection`. That put someone else's
 * latency on the critical path of a sync: a Slack webhook hanging for its full
 * ten-second timeout delayed the connection's next schedule and held its lease
 * the whole time. Evaluation is cheap and stays inline — it needs the snapshot
 * that was just written — but sending is queued here and drained separately.
 *
 * Not an in-process queue. The codebase already learned this once with the
 * read-through cache: an un-awaited background task is free to be frozen by a
 * serverless runtime the moment the response is sent, so the work silently
 * never happens. A row in Postgres survives the process that wrote it.
 */

/** Attempts before a delivery is abandoned. */
const MAX_ATTEMPTS = 5;

/** Deliveries claimed per drain. Bounded so one tick cannot run forever. */
const DRAIN_BATCH = 20;

/** How long a claimed row stays claimed if the worker dies mid-send. */
const CLAIM_LEASE_SECONDS = 120;

export type DrainReport = {
  attempted: number;
  sent: number;
  failed: number;
  abandoned: number;
};

const EMPTY: DrainReport = { attempted: 0, sent: 0, failed: 0, abandoned: 0 };

/**
 * Backoff between attempts: 30s, 2m, 8m, 32m.
 *
 * A webhook is usually either fine or gone. Retrying fast twice catches a
 * blip; stretching out after that stops a deleted webhook being retried every
 * tick for an hour.
 */
function backoffSeconds(attempts: number): number {
  return 30 * 4 ** Math.min(attempts - 1, 3);
}

export async function enqueueDeliveries(input: {
  organizationId: string;
  eventId: string;
  channelIds: string[];
  notification: AlertNotification;
}): Promise<number> {
  if (input.channelIds.length === 0) return 0;

  const db = await getDb();
  // Rendered once, at queue time, so a channel edited between queueing and
  // sending cannot rewrite what the alert said.
  const payloadJson = JSON.stringify(input.notification);

  await db.insert(alertDeliveries).values(
    input.channelIds.map((channelId) => ({
      id: createId("dlv"),
      organizationId: input.organizationId,
      eventId: input.eventId,
      channelId,
      payloadJson,
    })),
  );

  return input.channelIds.length;
}

/**
 * Claim due deliveries by pushing their next attempt forward.
 *
 * The same claim-by-timestamp pattern the sync worker uses: `FOR UPDATE SKIP
 * LOCKED` gives concurrent drainers disjoint rows, and a drainer that dies
 * mid-send simply leaves its rows to become due again.
 */
async function claimDue(limit: number) {
  const db = await getDb();
  const now = new Date();

  const due = db
    .select({ id: alertDeliveries.id })
    .from(alertDeliveries)
    .where(
      and(
        eq(alertDeliveries.status, "pending"),
        lte(alertDeliveries.nextAttemptAt, now),
      ),
    )
    .orderBy(asc(alertDeliveries.nextAttemptAt))
    .limit(limit)
    .for("update", { skipLocked: true });

  return db
    .update(alertDeliveries)
    .set({
      nextAttemptAt: new Date(now.getTime() + CLAIM_LEASE_SECONDS * 1000),
      attempts: sql`${alertDeliveries.attempts} + 1`,
    })
    .where(inArray(alertDeliveries.id, due))
    .returning({
      id: alertDeliveries.id,
      eventId: alertDeliveries.eventId,
      channelId: alertDeliveries.channelId,
      payloadJson: alertDeliveries.payloadJson,
      attempts: alertDeliveries.attempts,
    });
}

/**
 * Send whatever is due.
 *
 * Never throws: this runs from the scheduler tick, and a delivery problem must
 * not take the tick — and therefore syncing — down with it.
 */
export async function drainDeliveries(
  limit = DRAIN_BATCH,
): Promise<DrainReport> {
  try {
    return await run(limit);
  } catch (error) {
    console.warn(
      "[alerts] drain failed:",
      error instanceof Error ? error.message : error,
    );
    return EMPTY;
  }
}

async function run(limit: number): Promise<DrainReport> {
  const claimed = await claimDue(limit);
  if (claimed.length === 0) return EMPTY;

  const db = await getDb();
  const report = { ...EMPTY, attempted: claimed.length };

  const outcomes = await Promise.all(
    claimed.map(async (row) => {
      const [channel] = await db
        .select()
        .from(notificationChannels)
        .where(eq(notificationChannels.id, row.channelId))
        .limit(1);

      if (!channel || !channel.enabled) {
        return {
          row,
          delivery: {
            channelId: row.channelId,
            kind: channel?.kind ?? "email",
            ok: false,
            error: channel ? "Channel is disabled." : "Channel was removed.",
          } as Delivery,
          // No point retrying something that is gone or switched off.
          terminal: true,
        };
      }

      let target: string;
      try {
        target = decryptSecret(channel.targetEncrypted);
      } catch {
        // Almost always a rotated BUSSOLA_ENCRYPTION_KEY. Retrying will not
        // help, and the message names the fix.
        return {
          row,
          delivery: {
            channelId: row.channelId,
            kind: channel.kind,
            ok: false,
            error: "Could not decrypt this channel — re-enter its destination.",
          } as Delivery,
          terminal: true,
        };
      }

      const notification = JSON.parse(row.payloadJson) as AlertNotification;
      const delivery = await deliver(
        {
          id: channel.id,
          kind: channel.kind,
          label: channel.label,
          target,
        },
        notification,
      );

      return { row, delivery, terminal: false };
    }),
  );

  const now = new Date();

  for (const { row, delivery, terminal } of outcomes) {
    const exhausted = terminal || row.attempts >= MAX_ATTEMPTS;

    if (delivery.ok) report.sent += 1;
    else if (exhausted) report.abandoned += 1;
    else report.failed += 1;

    await db
      .update(alertDeliveries)
      .set(
        delivery.ok
          ? { status: "sent", deliveredAt: now, lastError: null }
          : exhausted
            ? { status: "failed", lastError: delivery.error ?? "Delivery failed" }
            : {
                status: "pending",
                lastError: delivery.error ?? "Delivery failed",
                nextAttemptAt: new Date(
                  now.getTime() + backoffSeconds(row.attempts) * 1000,
                ),
              },
      )
      .where(eq(alertDeliveries.id, row.id));

    await db
      .update(notificationChannels)
      .set(
        delivery.ok
          ? { lastDeliveredAt: now, lastError: null }
          : { lastError: delivery.error ?? "Delivery failed" },
      )
      .where(eq(notificationChannels.id, delivery.channelId));
  }

  // The event carries the summary the alert feed renders, so it is refreshed
  // once per drained event rather than left showing "queued" forever.
  const eventIds = [...new Set(outcomes.map(({ row }) => row.eventId))];
  for (const eventId of eventIds) {
    await refreshEventSummary(eventId);
  }

  return report;
}

/** Fold an event's delivery rows back into the summary the UI reads. */
async function refreshEventSummary(eventId: string): Promise<void> {
  const db = await getDb();
  const rows = await db
    .select({
      channelId: alertDeliveries.channelId,
      status: alertDeliveries.status,
      lastError: alertDeliveries.lastError,
      kind: notificationChannels.kind,
    })
    .from(alertDeliveries)
    .leftJoin(
      notificationChannels,
      eq(alertDeliveries.channelId, notificationChannels.id),
    )
    .where(eq(alertDeliveries.eventId, eventId));

  const summary = rows.map((row) => ({
    channelId: row.channelId,
    kind: row.kind ?? "email",
    ok: row.status === "sent",
    ...(row.status === "sent" ? {} : { error: row.lastError ?? "Queued" }),
  }));

  await db
    .update(alertEvents)
    .set({ deliveriesJson: JSON.stringify(summary) })
    .where(eq(alertEvents.id, eventId));
}
