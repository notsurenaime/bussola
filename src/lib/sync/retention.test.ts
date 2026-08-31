import fs from "fs";
import os from "os";
import path from "path";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createId } from "@/lib/id";

/**
 * History sampling, against a real Postgres.
 *
 * The property that matters is the hourly bucket: the worker runs every minute
 * or two, and keeping every run would cost tens of thousands of rows per
 * connection per month for a resolution nobody plots.
 */
let dataDir: string;
let closeDb: () => Promise<void>;
let db: Awaited<ReturnType<typeof import("@/lib/db").getDb>>;
let schema: typeof import("@/lib/db/schema");
let retention: typeof import("./retention");
let organizationId: string;
let connectionId: string;

beforeAll(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "bussola-history-"));
  process.env.BUSSOLA_DATA_DIR = dataDir;
  delete process.env.DATABASE_URL;
  delete process.env.BUSSOLA_EDITION;

  const dbModule = await import("@/lib/db");
  schema = await import("@/lib/db/schema");
  retention = await import("./retention");
  const { encryptSecret } = await import("@/lib/crypto/vault");

  await dbModule.runMigrations();
  closeDb = dbModule.closeDb;
  db = await dbModule.getDb();

  organizationId = createId("org");
  connectionId = createId("con");
  await db
    .insert(schema.organization)
    .values({ id: organizationId, name: "H", slug: "h" });
  await db.insert(schema.connections).values({
    id: connectionId,
    organizationId,
    provider: "railway",
    label: "r",
    credentialsEncrypted: encryptSecret("{}"),
  });
}, 60_000);

afterAll(async () => {
  await closeDb?.();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

beforeEach(async () => {
  await db.delete(schema.connectionHistory);
});

const sample = (payload: unknown) =>
  retention.recordHistory({
    organizationId,
    connectionId,
    kind: "dashboard",
    payload,
  });

async function rows() {
  return db
    .select()
    .from(schema.connectionHistory)
    .where(eq(schema.connectionHistory.connectionId, connectionId));
}

describe("recordHistory", () => {
  it("writes one sample", async () => {
    await sample({ n: 1 });
    expect(await rows()).toHaveLength(1);
  });

  it("keeps one row per hour, holding the latest value", async () => {
    await sample({ n: 1 });
    await sample({ n: 2 });
    await sample({ n: 3 });

    const stored = await rows();
    expect(stored).toHaveLength(1);
    expect(JSON.parse(stored[0].payloadJson)).toEqual({ n: 3 });
  });

  it("buckets to the top of the hour", async () => {
    await sample({ n: 1 });
    const [stored] = await rows();
    expect(stored.bucket.getMinutes()).toBe(0);
    expect(stored.bucket.getSeconds()).toBe(0);
  });

  it("keeps separate rows for separate hours", async () => {
    await sample({ n: 1 });
    // Backdate the stored bucket, then sample again: a new hour, a new row.
    await db
      .update(schema.connectionHistory)
      .set({ bucket: new Date(Date.now() - 2 * 60 * 60 * 1000) })
      .where(eq(schema.connectionHistory.connectionId, connectionId));

    await sample({ n: 2 });
    expect(await rows()).toHaveLength(2);
  });
});

describe("readHistory", () => {
  it("returns samples inside the window, oldest first", async () => {
    await sample({ n: 1 });
    await db
      .update(schema.connectionHistory)
      .set({ bucket: new Date(Date.now() - 3 * 60 * 60 * 1000) })
      .where(eq(schema.connectionHistory.connectionId, connectionId));
    await sample({ n: 2 });

    const found = await retention.readHistory({
      organizationId,
      connectionIds: [connectionId],
      kind: "dashboard",
      since: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });

    expect(found).toHaveLength(2);
    expect(found[0].bucket.getTime()).toBeLessThan(found[1].bucket.getTime());
  });

  it("excludes samples older than the window", async () => {
    await sample({ n: 1 });
    await db
      .update(schema.connectionHistory)
      .set({ bucket: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000) })
      .where(eq(schema.connectionHistory.connectionId, connectionId));

    const found = await retention.readHistory({
      organizationId,
      connectionIds: [connectionId],
      kind: "dashboard",
      since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    });
    expect(found).toHaveLength(0);
  });

  it("returns nothing for an empty connection list", async () => {
    expect(
      await retention.readHistory({
        organizationId,
        connectionIds: [],
        kind: "dashboard",
        since: new Date(0),
      }),
    ).toEqual([]);
  });
});

describe("pruneHistory", () => {
  it("keeps everything on a self-hosted install", async () => {
    await sample({ n: 1 });
    await db
      .update(schema.connectionHistory)
      .set({ bucket: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000) })
      .where(eq(schema.connectionHistory.connectionId, connectionId));

    const report = await retention.pruneHistory();
    expect(report.deleted).toBe(0);
    expect(await rows()).toHaveLength(1);
  });
});
