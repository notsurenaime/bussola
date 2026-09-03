import fs from "fs";
import os from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createId } from "@/lib/id";

/**
 * Reading an invitation without a session.
 *
 * The regression this exists for: Better Auth's own `getInvitation` requires a
 * session *and* an email match, which is right for accepting and useless for
 * rendering the page — the person an invitation exists for is exactly the one
 * with no account yet. Routing the page through it turned every first-time
 * invitee into "this invitation is no longer valid".
 */
let dataDir: string;
let closeDb: () => Promise<void>;
let resolveInvitation: typeof import("./resolve").resolveInvitation;
let pendingId: string;

beforeAll(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "bussola-invites-"));
  process.env.BUSSOLA_DATA_DIR = dataDir;
  delete process.env.DATABASE_URL;
  delete process.env.BUSSOLA_EDITION;

  const db = await import("@/lib/db");
  const schema = await import("@/lib/db/schema");
  ({ resolveInvitation } = await import("./resolve"));

  await db.runMigrations();
  closeDb = db.closeDb;
  const handle = await db.getDb();

  const organizationId = createId("org");
  const userId = createId("usr");
  await handle.insert(schema.organization).values({
    id: organizationId,
    name: "Acme",
    slug: `acme-${organizationId.slice(-6)}`,
  });
  await handle.insert(schema.user).values({
    id: userId,
    name: "Ada",
    email: "ada@example.test",
  });

  pendingId = createId("inv");
  await handle.insert(schema.invitation).values({
    id: pendingId,
    organizationId,
    email: "newcomer@example.test",
    role: "member",
    status: "pending",
    expiresAt: new Date(Date.now() + 7 * 86_400_000),
    inviterId: userId,
  });
}, 60_000);

afterAll(async () => {
  await closeDb?.();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe("resolveInvitation", () => {
  it("reads a pending invitation with no session at all", async () => {
    const invitation = await resolveInvitation(pendingId);
    expect(invitation).toMatchObject({
      email: "newcomer@example.test",
      organizationName: "Acme",
      inviterName: "Ada",
      status: "pending",
    });
  });

  it("returns null for an id that does not exist", async () => {
    expect(await resolveInvitation(createId("inv"))).toBeNull();
  });

  it("rejects a hostile id before it reaches a query", async () => {
    for (const id of [
      "../../etc/passwd",
      "'; drop table invitation; --",
      "a".repeat(200),
      "",
      "has spaces",
    ]) {
      expect(await resolveInvitation(id)).toBeNull();
    }
  });
});
