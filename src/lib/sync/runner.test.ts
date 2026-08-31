import fs from "fs";
import os from "os";
import path from "path";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createId } from "@/lib/id";
import type { Provider } from "@/lib/providers";

/**
 * The sync worker, against a real Postgres with the real migrations.
 *
 * Provider calls are mocked — the point here is the scheduling contract
 * (claiming, backoff, giving up, reviving), which is what stands between a
 * broken token and thousands of pointless calls to someone else's API.
 */
const upstream = vi.hoisted(() => ({
  fetchDashboardSnapshot: vi.fn(),
}));

vi.mock("./providers", () => ({
  isSyncable: (provider: string) =>
    ["railway", "netlify", "supabase", "qonto"].includes(provider),
  fetchDashboardSnapshot: upstream.fetchDashboardSnapshot,
}));

let dataDir: string;
let closeDb: () => Promise<void>;
let db: Awaited<ReturnType<typeof import("@/lib/db").getDb>>;
let schema: typeof import("@/lib/db/schema");
let runner: typeof import("./runner");
let config: typeof import("./config");
let encryptSecret: (value: string) => string;
let organizationId: string;

beforeAll(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "bussola-sync-"));
  process.env.BUSSOLA_DATA_DIR = dataDir;
  delete process.env.DATABASE_URL;
  delete process.env.BUSSOLA_EDITION;

  const dbModule = await import("@/lib/db");
  schema = await import("@/lib/db/schema");
  runner = await import("./runner");
  config = await import("./config");
  ({ encryptSecret } = await import("@/lib/crypto/vault"));

  await dbModule.runMigrations();
  closeDb = dbModule.closeDb;
  db = await dbModule.getDb();

  organizationId = createId("org");
  await db
    .insert(schema.organization)
    .values({ id: organizationId, name: "Sync", slug: "sync" });
}, 60_000);

afterAll(async () => {
  await closeDb?.();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

beforeEach(async () => {
  upstream.fetchDashboardSnapshot.mockReset();
  await db.delete(schema.connections);
});

async function seedConnection(
  provider: Provider = "railway",
  overrides: Partial<typeof schema.connections.$inferInsert> = {},
) {
  const id = createId("con");
  await db.insert(schema.connections).values({
    id,
    organizationId,
    provider,
    label: `${provider} test`,
    credentialsEncrypted: encryptSecret(JSON.stringify({ apiKey: "token" })),
    nextSyncAt: new Date(Date.now() - 1000),
    ...overrides,
  });
  return id;
}

async function readConnection(id: string) {
  const [row] = await db
    .select()
    .from(schema.connections)
    .where(eq(schema.connections.id, id))
    .limit(1);
  return row;
}

describe("claiming", () => {
  it("syncs a due connection and stores the snapshot", async () => {
    upstream.fetchDashboardSnapshot.mockResolvedValue({ items: [{ id: "a" }] });
    const id = await seedConnection("railway");

    const report = await runner.runDueSyncs();

    expect(report.claimed).toBe(1);
    expect(report.succeeded).toBe(1);

    const [snapshot] = await db
      .select()
      .from(schema.connectionSnapshots)
      .where(eq(schema.connectionSnapshots.connectionId, id))
      .limit(1);
    expect(JSON.parse(snapshot.payloadJson)).toEqual({ items: [{ id: "a" }] });
    expect(snapshot.organizationId).toBe(organizationId);
  });

  it("leaves connections that are not due yet alone", async () => {
    await seedConnection("railway", {
      nextSyncAt: new Date(Date.now() + 60_000),
    });
    const report = await runner.runDueSyncs();
    expect(report.claimed).toBe(0);
    expect(upstream.fetchDashboardSnapshot).not.toHaveBeenCalled();
  });

  it("skips connections whose sync has been disabled", async () => {
    await seedConnection("railway", { syncEnabled: false });
    const report = await runner.runDueSyncs();
    expect(report.claimed).toBe(0);
  });

  it("never hands the same connection to two concurrent runs", async () => {
    upstream.fetchDashboardSnapshot.mockResolvedValue({ ok: true });
    await seedConnection("railway");
    await seedConnection("netlify");

    const [a, b] = await Promise.all([
      runner.runDueSyncs(),
      runner.runDueSyncs(),
    ]);

    const ids = [...a.outcomes, ...b.outcomes].map((o) => o.connectionId);
    expect(ids).toHaveLength(new Set(ids).size);
    expect(a.claimed + b.claimed).toBe(2);
  });

  it("re-claims a connection once its lease expires", async () => {
    upstream.fetchDashboardSnapshot.mockResolvedValue({ ok: true });
    const id = await seedConnection("railway");
    await runner.runDueSyncs();

    // Pretend the worker died mid-fetch: the claim is in place, nothing stored.
    await db
      .update(schema.connections)
      .set({ nextSyncAt: new Date(Date.now() - 1000) })
      .where(eq(schema.connections.id, id));

    const report = await runner.runDueSyncs();
    expect(report.claimed).toBe(1);
  });
});

describe("failure handling", () => {
  it("records the failure and backs the connection off", async () => {
    upstream.fetchDashboardSnapshot.mockRejectedValue(new Error("401 boom"));
    const id = await seedConnection("railway");

    const report = await runner.runDueSyncs();
    expect(report.failed).toBe(1);

    const row = await readConnection(id);
    expect(row.consecutiveFailures).toBe(1);
    expect(row.status).toBe("error");
    expect(row.lastError).toBeTruthy();
    expect(row.syncEnabled).toBe(true);
    expect(row.nextSyncAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("gives up after the failure ceiling and stops scheduling", async () => {
    upstream.fetchDashboardSnapshot.mockRejectedValue(new Error("401 boom"));
    const id = await seedConnection("railway", {
      consecutiveFailures: config.MAX_CONSECUTIVE_FAILURES - 1,
    });

    const report = await runner.runDueSyncs();

    expect(report.disabled).toBe(1);
    const row = await readConnection(id);
    expect(row.syncEnabled).toBe(false);
  });

  it("clears the failure count after a success", async () => {
    const id = await seedConnection("railway", { consecutiveFailures: 4 });
    upstream.fetchDashboardSnapshot.mockResolvedValue({ ok: true });

    await runner.runDueSyncs();

    const row = await readConnection(id);
    expect(row.consecutiveFailures).toBe(0);
    expect(row.status).toBe("connected");
    expect(row.lastError).toBeNull();
    expect(row.lastSyncedAt).not.toBeNull();
  });

  it("does not surface the raw provider error to the tenant", async () => {
    upstream.fetchDashboardSnapshot.mockRejectedValue(
      new Error("401 Unauthorized: token sk_live_abc123 rejected"),
    );
    const id = await seedConnection("railway");
    await runner.runDueSyncs();

    const row = await readConnection(id);
    expect(row.lastError).not.toContain("sk_live_abc123");
  });

  it("stops scheduling a provider that has no connector", async () => {
    const id = await seedConnection("stripe");
    const report = await runner.runDueSyncs();

    expect(report.disabled).toBe(1);
    expect(upstream.fetchDashboardSnapshot).not.toHaveBeenCalled();
    expect((await readConnection(id)).syncEnabled).toBe(false);
  });
});

describe("syncNow", () => {
  it("refreshes one connection regardless of its schedule", async () => {
    upstream.fetchDashboardSnapshot.mockResolvedValue({ fresh: true });
    const id = await seedConnection("railway", {
      nextSyncAt: new Date(Date.now() + 3_600_000),
    });

    const outcome = await runner.syncNow(id);
    expect(outcome?.ok).toBe(true);

    const [snapshot] = await db
      .select()
      .from(schema.connectionSnapshots)
      .where(eq(schema.connectionSnapshots.connectionId, id))
      .limit(1);
    expect(JSON.parse(snapshot.payloadJson)).toEqual({ fresh: true });
  });

  it("returns null for a connection that does not exist", async () => {
    expect(await runner.syncNow("con_missing")).toBeNull();
  });
});
