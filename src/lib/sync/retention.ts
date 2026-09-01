import { startOfHour } from "date-fns";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { connectionHistory } from "@/lib/db/schema";
import { entitlementsFor } from "@/lib/billing/entitlements";
import { isCloud } from "@/lib/edition";
import { createId } from "@/lib/id";

/**
 * Append a history sample, at most one per connection per hour.
 *
 * The sync interval is measured in seconds, but nobody plots a deploy count at
 * one-minute resolution; keeping every sync would cost tens of thousands of
 * rows per connection per month for no extra information. The unique index on
 * (connection, kind, hour) is what enforces the sampling — a later sync in the
 * same hour overwrites the earlier one rather than adding a row.
 */
export async function recordHistory(input: {
  organizationId: string;
  connectionId: string;
  kind: string;
  payload: unknown;
}): Promise<void> {
  const db = await getDb();
  const now = new Date();
  const payloadJson = JSON.stringify(input.payload);

  await db
    .insert(connectionHistory)
    .values({
      id: createId("hst"),
      organizationId: input.organizationId,
      connectionId: input.connectionId,
      kind: input.kind,
      payloadJson,
      bucket: startOfHour(now),
      fetchedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        connectionHistory.connectionId,
        connectionHistory.kind,
        connectionHistory.bucket,
      ],
      set: { payloadJson, fetchedAt: now },
    });
}

export type PruneReport = {
  organizations: number;
  deleted: number;
};

/**
 * Drop history past each organization's plan retention.
 *
 * Self-hosted keeps everything — there is no plan to enforce and it is the
 * owner's own disk. In cloud this is what makes "30 days" and "12 months"
 * true rather than marketing copy.
 */
export async function pruneHistory(): Promise<PruneReport> {
  if (!isCloud) return { organizations: 0, deleted: 0 };

  const db = await getDb();

  const organizations = await db
    .selectDistinct({ organizationId: connectionHistory.organizationId })
    .from(connectionHistory);

  let deleted = 0;
  for (const { organizationId } of organizations) {
    const { limits } = await entitlementsFor(organizationId);
    if (!Number.isFinite(limits.historyDays)) continue;

    const cutoff = new Date(
      Date.now() - limits.historyDays * 24 * 60 * 60 * 1000,
    );
    const rows = await db
      .delete(connectionHistory)
      .where(
        and(
          eq(connectionHistory.organizationId, organizationId),
          lt(connectionHistory.bucket, cutoff),
        ),
      )
      .returning({ id: connectionHistory.id });
    deleted += rows.length;
  }

  return { organizations: organizations.length, deleted };
}

/**
 * History samples for a connection, oldest first, bounded by the plan's
 * retention as well as the requested window.
 */
export async function readHistory(input: {
  organizationId: string;
  connectionIds: string[];
  kind: string;
  since: Date;
}) {
  if (input.connectionIds.length === 0) return [];
  const db = await getDb();

  return db
    .select({
      connectionId: connectionHistory.connectionId,
      bucket: connectionHistory.bucket,
      payloadJson: connectionHistory.payloadJson,
    })
    .from(connectionHistory)
    .where(
      and(
        eq(connectionHistory.organizationId, input.organizationId),
        inArray(connectionHistory.connectionId, input.connectionIds),
        eq(connectionHistory.kind, input.kind),
        sql`${connectionHistory.bucket} >= ${input.since}`,
      ),
    )
    .orderBy(connectionHistory.bucket);
}
