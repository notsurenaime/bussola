import fs from "fs";
import os from "os";
import path from "path";
import { afterAll, beforeAll, afterEach, describe, expect, it } from "vitest";

/**
 * The cron entry point is the one route with no user behind it, so its only
 * protection is the shared secret. An open one would let anyone force provider
 * traffic for every tenant at once.
 */
let POST: (request: Request) => Promise<Response>;
let dataDir: string;
let closeDb: () => Promise<void>;

const post = (headers: Record<string, string> = {}) =>
  POST(new Request("http://localhost/api/internal/sync", { method: "POST", headers }));

beforeAll(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "bussola-cron-"));
  process.env.BUSSOLA_DATA_DIR = dataDir;
  delete process.env.DATABASE_URL;
  delete process.env.BUSSOLA_EDITION;

  const db = await import("@/lib/db");
  await db.runMigrations();
  closeDb = db.closeDb;

  ({ POST } = await import("./route"));
}, 60_000);

afterEach(() => {
  delete process.env.BUSSOLA_SYNC_SECRET;
});

afterAll(async () => {
  await closeDb?.();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe("POST /api/internal/sync", () => {
  it("stays closed when no secret is configured", async () => {
    expect((await post()).status).toBe(401);
    expect((await post({ authorization: "Bearer anything" })).status).toBe(401);
  });

  it("rejects a wrong secret", async () => {
    process.env.BUSSOLA_SYNC_SECRET = "correct-horse";
    expect((await post({ authorization: "Bearer wrong" })).status).toBe(401);
    expect((await post({ "x-sync-secret": "wrong" })).status).toBe(401);
    expect((await post()).status).toBe(401);
  });

  it("accepts the secret as a bearer token", async () => {
    process.env.BUSSOLA_SYNC_SECRET = "correct-horse";
    const res = await post({ authorization: "Bearer correct-horse" });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ claimed: 0 });
  });

  it("accepts the secret as a plain header", async () => {
    process.env.BUSSOLA_SYNC_SECRET = "correct-horse";
    expect((await post({ "x-sync-secret": "correct-horse" })).status).toBe(200);
  });

  it("does not treat an empty configured secret as a match", async () => {
    process.env.BUSSOLA_SYNC_SECRET = "";
    expect((await post({ "x-sync-secret": "" })).status).toBe(401);
  });
});
