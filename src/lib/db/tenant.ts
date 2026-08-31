import { and, asc, desc, eq, lt } from "drizzle-orm";
import { createId } from "@/lib/id";
import { getDb } from ".";
import {
  connectionCache,
  connectionSnapshots,
  connections,
  dashboardWidgets,
  dashboards,
  type ConnectionStatus,
  type Provider,
} from "./schema";

/**
 * Who the current request is acting as. Produced only by `lib/auth/tenant.ts`
 * from a verified session — never from user input.
 */
export type TenantContext = {
  organizationId: string;
  userId: string;
};

/**
 * Every query against tenant-owned data goes through here, and every one of
 * them is filtered by `organization_id` before it touches a row. Route handlers
 * are barred from importing `lib/db` or `lib/db/schema` directly (enforced by
 * `no-restricted-imports` in eslint.config.mjs), so this file is the only place
 * where forgetting the tenant filter is even possible.
 */
export function forTenant(ctx: TenantContext) {
  const org = ctx.organizationId;

  /** Reused by every dashboard query so the scope cannot be omitted. */
  const ownDashboard = (id: string) =>
    and(eq(dashboards.id, id), eq(dashboards.organizationId, org));

  const ownWidget = (dashboardId: string, widgetId: string) =>
    and(
      eq(dashboardWidgets.id, widgetId),
      eq(dashboardWidgets.dashboardId, dashboardId),
      eq(dashboardWidgets.organizationId, org),
    );

  const ownConnection = (id: string) =>
    and(eq(connections.id, id), eq(connections.organizationId, org));

  return {
    ctx,

    dashboards: {
      async list() {
        const db = await getDb();
        return db
          .select()
          .from(dashboards)
          .where(eq(dashboards.organizationId, org))
          .orderBy(desc(dashboards.updatedAt));
      },

      async get(id: string) {
        const db = await getDb();
        const [row] = await db
          .select()
          .from(dashboards)
          .where(ownDashboard(id))
          .limit(1);
        return row ?? null;
      },

      async create(name: string) {
        const db = await getDb();
        const [row] = await db
          .insert(dashboards)
          .values({ id: createId("dash"), organizationId: org, name })
          .returning();
        return row;
      },

      async rename(id: string, name: string) {
        const db = await getDb();
        const [row] = await db
          .update(dashboards)
          .set({ name, updatedAt: new Date() })
          .where(ownDashboard(id))
          .returning();
        return row ?? null;
      },

      async remove(id: string) {
        const db = await getDb();
        const rows = await db
          .delete(dashboards)
          .where(ownDashboard(id))
          .returning({ id: dashboards.id });
        return rows.length > 0;
      },
    },

    widgets: {
      async listFor(dashboardId: string) {
        const db = await getDb();
        return db
          .select()
          .from(dashboardWidgets)
          .where(
            and(
              eq(dashboardWidgets.dashboardId, dashboardId),
              eq(dashboardWidgets.organizationId, org),
            ),
          )
          .orderBy(
            asc(dashboardWidgets.layoutY),
            asc(dashboardWidgets.layoutX),
          );
      },

      /** Next free row on the canvas, so a new widget never lands on top. */
      async nextY(dashboardId: string) {
        const rows = await this.listFor(dashboardId);
        return rows.reduce(
          (acc, w) => Math.max(acc, w.layoutY + w.layoutH),
          0,
        );
      },

      async add(input: {
        dashboardId: string;
        widgetType: string;
        title: string;
        configJson: string;
        layoutY: number;
        layoutW: number;
        layoutH: number;
      }) {
        const db = await getDb();
        const [row] = await db
          .insert(dashboardWidgets)
          .values({
            id: createId("wdg"),
            organizationId: org,
            dashboardId: input.dashboardId,
            widgetType: input.widgetType,
            title: input.title,
            configJson: input.configJson,
            layoutX: 0,
            layoutY: input.layoutY,
            layoutW: input.layoutW,
            layoutH: input.layoutH,
          })
          .returning();
        return row;
      },

      /**
       * Layout writes are filtered by dashboard *and* organization, so a widget
       * id belonging to another dashboard (or another tenant) silently matches
       * nothing instead of being moved.
       */
      async saveLayouts(
        dashboardId: string,
        layouts: Array<{ i: string; x: number; y: number; w: number; h: number }>,
      ) {
        const db = await getDb();
        const now = new Date();
        let updated = 0;
        for (const item of layouts) {
          const rows = await db
            .update(dashboardWidgets)
            .set({
              layoutX: item.x,
              layoutY: item.y,
              layoutW: item.w,
              layoutH: item.h,
              updatedAt: now,
            })
            .where(ownWidget(dashboardId, item.i))
            .returning({ id: dashboardWidgets.id });
          updated += rows.length;
        }
        return updated;
      },

      async remove(dashboardId: string, widgetId: string) {
        const db = await getDb();
        const rows = await db
          .delete(dashboardWidgets)
          .where(ownWidget(dashboardId, widgetId))
          .returning({ id: dashboardWidgets.id });
        return rows.length > 0;
      },
    },

    connections: {
      async list() {
        const db = await getDb();
        return db
          .select()
          .from(connections)
          .where(eq(connections.organizationId, org))
          .orderBy(desc(connections.updatedAt));
      },

      async get(id: string) {
        const db = await getDb();
        const [row] = await db
          .select()
          .from(connections)
          .where(ownConnection(id))
          .limit(1);
        return row ?? null;
      },

      /**
       * The connection this tenant uses for a provider. Previously this read
       * the first matching row in the entire database, which in a multi-tenant
       * deployment would hand one customer another customer's credentials.
       */
      async byProvider(provider: Provider) {
        const db = await getDb();
        const [row] = await db
          .select()
          .from(connections)
          .where(
            and(
              eq(connections.provider, provider),
              eq(connections.organizationId, org),
            ),
          )
          .orderBy(asc(connections.createdAt))
          .limit(1);
        return row ?? null;
      },

      async create(input: {
        provider: Provider;
        label: string;
        credentialsEncrypted: string;
      }) {
        const db = await getDb();
        const [row] = await db
          .insert(connections)
          .values({
            id: createId("con"),
            organizationId: org,
            provider: input.provider,
            label: input.label,
            credentialsEncrypted: input.credentialsEncrypted,
            status: "unknown",
          })
          .returning();
        return row;
      },

      /**
       * Replacing credentials revives a connection whose sync had been
       * disabled after repeated failures: the whole point of pasting a new
       * token is that the old one was the problem.
       */
      async update(
        id: string,
        input: { label: string; credentialsEncrypted: string },
      ) {
        const db = await getDb();
        const [row] = await db
          .update(connections)
          .set({
            label: input.label,
            credentialsEncrypted: input.credentialsEncrypted,
            status: "unknown",
            lastError: null,
            syncEnabled: true,
            consecutiveFailures: 0,
            nextSyncAt: new Date(),
            updatedAt: new Date(),
          })
          .where(ownConnection(id))
          .returning();
        return row ?? null;
      },

      async recordTest(
        id: string,
        result: { status: ConnectionStatus; error: string | null },
      ) {
        const db = await getDb();
        await db
          .update(connections)
          .set({
            status: result.status,
            lastError: result.error,
            lastCheckedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(ownConnection(id));
      },

      async remove(id: string) {
        const db = await getDb();
        const rows = await db
          .delete(connections)
          .where(ownConnection(id))
          .returning({ id: connections.id });
        return rows.length > 0;
      },
    },

    snapshots: {
      /**
       * The most recent payload the sync worker stored for this tenant's
       * connection to a provider, with everything the UI needs to say how
       * fresh it is and whether syncing has given up.
       */
      async forProvider(provider: Provider) {
        const db = await getDb();
        const [row] = await db
          .select({
            payloadJson: connectionSnapshots.payloadJson,
            fetchedAt: connectionSnapshots.fetchedAt,
            connectionId: connections.id,
            syncEnabled: connections.syncEnabled,
            lastError: connections.lastError,
            consecutiveFailures: connections.consecutiveFailures,
          })
          .from(connections)
          .leftJoin(
            connectionSnapshots,
            and(
              eq(connectionSnapshots.connectionId, connections.id),
              eq(connectionSnapshots.kind, "dashboard"),
            ),
          )
          .where(
            and(
              eq(connections.provider, provider),
              eq(connections.organizationId, org),
            ),
          )
          .orderBy(asc(connections.createdAt))
          .limit(1);

        if (!row) return null;

        return {
          connectionId: row.connectionId,
          payload: row.payloadJson
            ? (JSON.parse(row.payloadJson) as Record<string, unknown>)
            : null,
          fetchedAt: row.fetchedAt,
          syncEnabled: row.syncEnabled,
          lastError: row.lastError,
          consecutiveFailures: row.consecutiveFailures,
        };
      },
    },

    cache: cacheRepo(org),
  };
}

export type TenantRepos = ReturnType<typeof forTenant>;

const SWEEP_INTERVAL_MS = 60_000;
let lastSweep = 0;

/** Drop expired rows at most once per minute, off the read hot path. */
async function sweepExpired() {
  const now = Date.now();
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  const db = await getDb();
  await db
    .delete(connectionCache)
    .where(lt(connectionCache.expiresAt, new Date(now)));
}

function cacheRepo(org: string) {
  async function readRow<T>(cacheKey: string) {
    const db = await getDb();
    const [row] = await db
      .select()
      .from(connectionCache)
      .where(
        and(
          eq(connectionCache.cacheKey, cacheKey),
          eq(connectionCache.organizationId, org),
        ),
      )
      .limit(1);
    if (!row) return null;
    return {
      payload: JSON.parse(row.payloadJson) as T,
      expired: row.expiresAt < new Date(),
    };
  }

  async function set(cacheKey: string, payload: unknown, ttlSeconds: number) {
    const db = await getDb();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
    const payloadJson = JSON.stringify(payload);

    await db
      .insert(connectionCache)
      .values({
        id: createId("cch"),
        organizationId: org,
        cacheKey,
        payloadJson,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: [connectionCache.organizationId, connectionCache.cacheKey],
        set: { payloadJson, expiresAt },
      });
  }

  return {
    set,

    async get<T>(cacheKey: string): Promise<T | null> {
      await sweepExpired();
      const row = await readRow<T>(cacheKey);
      return row && !row.expired ? row.payload : null;
    },

    /**
     * Read-through cache. A fresh hit is returned as-is; a miss awaits the
     * fetch.
     *
     * Note the deliberate absence of stale-while-revalidate: the previous
     * implementation kicked off an un-awaited background refresh, which a
     * serverless runtime is free to freeze the moment the response is sent, so
     * the refresh silently never landed. Phase 2 replaces this with a
     * background sync worker; until then a stale entry is refreshed inline.
     */
    async fetch<T>(
      cacheKey: string,
      ttlSeconds: number,
      fetcher: () => Promise<T>,
    ): Promise<{ data: T; cached: boolean }> {
      await sweepExpired();
      const row = await readRow<T>(cacheKey);
      if (row && !row.expired) {
        return { data: row.payload, cached: true };
      }

      try {
        const data = await fetcher();
        await set(cacheKey, data, ttlSeconds);
        return { data, cached: false };
      } catch (error) {
        // Serving a stale payload beats showing an error for a transient blip.
        if (row) return { data: row.payload, cached: true };
        throw error;
      }
    },
  };
}
