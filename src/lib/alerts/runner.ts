import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  alertEvents,
  alertRules,
  connectionSnapshots,
  connections,
  notificationChannels,
  type AlertState,
  type NotificationChannelKind,
} from "@/lib/db/schema";
import { entitlementsFor } from "@/lib/billing/entitlements";
import { createId } from "@/lib/id";
import { DASHBOARD_KIND } from "@/lib/sync/config";
import type { AlertNotification } from "./deliver";
import { evaluateRule } from "./evaluate";
import { getMetric } from "./metrics";
import { enqueueDeliveries } from "./outbox";

/**
 * Evaluating a connection's alert rules, right after its snapshot is written.
 *
 * Hooked into the sync worker rather than run on a schedule of its own,
 * because the only thing that can change a metric is a new snapshot — a
 * separate timer would either re-read unchanged data or lag behind it. It also
 * means an alert fires as soon as the data arrives, at whatever interval that
 * source is synced at, with no extra upstream traffic.
 *
 * Evaluation only. Sending is queued to the outbox and drained by the
 * scheduler, so a webhook that hangs for ten seconds cannot delay the sync
 * that triggered it — everything below this comment is database work with no
 * third party in it.
 *
 * Nothing in here throws into the sync path. A rule that cannot be evaluated,
 * a channel that has gone missing — all of it is recorded and moved past.
 * Alerting must never be able to break syncing.
 */

export type AlertRunReport = {
  evaluated: number;
  breached: number;
  recovered: number;
  notified: number;
  /** Notifications handed to the outbox, not yet sent. */
  queued: number;
};

const EMPTY: AlertRunReport = {
  evaluated: 0,
  breached: 0,
  recovered: 0,
  notified: 0,
  queued: 0,
};

export async function evaluateAlertsForConnection(input: {
  connectionId: string;
  organizationId: string;
}): Promise<AlertRunReport> {
  try {
    return await run(input);
  } catch (error) {
    console.warn(
      `[alerts] evaluation failed for ${input.connectionId}:`,
      error instanceof Error ? error.message : error,
    );
    return EMPTY;
  }
}

async function run({
  connectionId,
  organizationId,
}: {
  connectionId: string;
  organizationId: string;
}): Promise<AlertRunReport> {
  const db = await getDb();

  const rules = await db
    .select()
    .from(alertRules)
    .where(
      and(
        eq(alertRules.connectionId, connectionId),
        eq(alertRules.organizationId, organizationId),
        eq(alertRules.enabled, true),
      ),
    );

  if (rules.length === 0) return EMPTY;

  const [snapshot] = await db
    .select({
      payloadJson: connectionSnapshots.payloadJson,
      provider: connections.provider,
      label: connections.label,
    })
    .from(connectionSnapshots)
    .innerJoin(connections, eq(connectionSnapshots.connectionId, connections.id))
    .where(
      and(
        eq(connectionSnapshots.connectionId, connectionId),
        eq(connectionSnapshots.kind, DASHBOARD_KIND),
        eq(connectionSnapshots.organizationId, organizationId),
      ),
    )
    .limit(1);

  if (!snapshot) return EMPTY;

  let payload: Record<string, unknown> | null = null;
  try {
    payload = JSON.parse(snapshot.payloadJson) as Record<string, unknown>;
  } catch {
    // A snapshot we cannot parse is the same as no snapshot: every rule skips
    // with "no_value" rather than firing on a guess.
    payload = null;
  }

  const now = new Date();
  const report = { ...EMPTY };

  // Loaded once per connection rather than per rule: most organizations have
  // a handful of channels and every rule reads from the same set.
  const channels = await loadChannels(organizationId);
  const entitlements = await entitlementsFor(organizationId);

  for (const rule of rules) {
    const result = evaluateRule(
      {
        metric: rule.metric,
        comparator: rule.comparator,
        threshold: rule.threshold,
        enabled: rule.enabled,
        cooldownMinutes: rule.cooldownMinutes,
        lastState: rule.lastState,
        lastNotifiedAt: rule.lastNotifiedAt,
        mutedUntil: rule.mutedUntil,
      },
      payload,
      now,
    );

    if (result.kind === "skipped") {
      // Still stamped, so the UI can say "checked, nothing to read" rather
      // than leaving a rule looking as though it never ran.
      await db
        .update(alertRules)
        .set({ lastEvaluatedAt: now })
        .where(eq(alertRules.id, rule.id));
      continue;
    }

    report.evaluated += 1;
    if (result.state === "breached") report.breached += 1;
    else if (rule.lastState === "breached") report.recovered += 1;

    const source = `${snapshot.label} · ${
      getMetric(rule.metric)?.label ?? rule.metric
    }`;

    if (result.notify) {
      report.notified += 1;

      const notification: AlertNotification = {
        state: result.state,
        source,
        message: result.message,
      };

      // The in-app feed is written first and unconditionally, so a broken
      // webhook loses the notification, never the alert.
      const eventId = createId("aev");
      await db.insert(alertEvents).values({
        id: eventId,
        organizationId,
        ruleId: rule.id,
        state: result.state,
        value: String(result.value),
        message: result.message,
        deliveriesJson: "[]",
        createdAt: now,
      });

      report.queued += await enqueueDeliveries({
        organizationId,
        eventId,
        channelIds: targetChannelIds({
          rule,
          channels,
          allowedChannels: new Set(entitlements.features.alertChannels),
        }),
        notification,
      });
    }

    await db
      .update(alertRules)
      .set({
        lastState: result.state satisfies AlertState,
        lastValue: String(result.value),
        lastEvaluatedAt: now,
        ...(result.notify ? { lastNotifiedAt: now } : {}),
        updatedAt: now,
      })
      .where(eq(alertRules.id, rule.id));
  }

  return report;
}

type ChannelRow = {
  id: string;
  kind: NotificationChannelKind;
  label: string;
  enabled: boolean;
};

/**
 * The channels this organization has, minus their destinations.
 *
 * The encrypted target is deliberately not selected: nothing on the evaluation
 * path sends anything, so it has no use for a credential it would only be able
 * to leak into a log.
 */
async function loadChannels(organizationId: string): Promise<ChannelRow[]> {
  const db = await getDb();
  return db
    .select({
      id: notificationChannels.id,
      kind: notificationChannels.kind,
      label: notificationChannels.label,
      enabled: notificationChannels.enabled,
    })
    .from(notificationChannels)
    .where(eq(notificationChannels.organizationId, organizationId));
}

/**
 * Which of a rule's channels should actually receive this alert.
 *
 * Pure, and checked against the plan at queue time as well as when the rule
 * was saved: a downgrade must stop Slack alerts going out, not merely stop new
 * ones being configured.
 */
function targetChannelIds({
  rule,
  channels,
  allowedChannels,
}: {
  rule: { channelIdsJson: string };
  channels: ChannelRow[];
  allowedChannels: Set<string>;
}): string[] {
  let wanted: string[] = [];
  try {
    const parsed = JSON.parse(rule.channelIdsJson);
    if (Array.isArray(parsed)) {
      wanted = parsed.filter((id) => typeof id === "string");
    }
  } catch {
    wanted = [];
  }

  return channels
    .filter(
      (channel) =>
        wanted.includes(channel.id) &&
        channel.enabled &&
        allowedChannels.has(channel.kind),
    )
    .map((channel) => channel.id);
}
