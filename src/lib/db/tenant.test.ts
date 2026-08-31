import fs from "fs";
import os from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createId } from "@/lib/id";
import type { TenantRepos } from "./tenant";

/**
 * Tenant isolation, proven against a real Postgres (PGlite) with the real
 * migrations applied — not against mocks.
 *
 * Two organizations are seeded and every repository is exercised from the
 * wrong tenant's perspective. Each assertion below corresponds to a query that
 * before Phase 0 would have crossed the tenant boundary.
 */
let dataDir: string;
let alice: TenantRepos;
let bob: TenantRepos;
let closeDb: () => Promise<void>;

beforeAll(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "bussola-tenant-"));
  process.env.BUSSOLA_DATA_DIR = dataDir;
  delete process.env.DATABASE_URL;
  delete process.env.BUSSOLA_EDITION;

  const db = await import("./index");
  const { forTenant } = await import("./tenant");
  const { organization, user, member } = await import("./schema");

  await db.runMigrations();
  closeDb = db.closeDb;

  const handle = await db.getDb();
  const seed = async (slug: string) => {
    const organizationId = createId("org");
    const userId = createId("usr");
    await handle
      .insert(organization)
      .values({ id: organizationId, name: slug, slug });
    await handle.insert(user).values({
      id: userId,
      name: slug,
      email: `${slug}@example.test`,
    });
    await handle
      .insert(member)
      .values({ id: createId("mem"), organizationId, userId, role: "owner" });
    return forTenant({ organizationId, userId });
  };

  alice = await seed("alice");
  bob = await seed("bob");
}, 60_000);

afterAll(async () => {
  await closeDb?.();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe("migrations", () => {
  it("applies the schema to a fresh Postgres", async () => {
    // Reaching this point means runMigrations() succeeded in beforeAll.
    expect(await alice.dashboards.list()).toEqual([]);
  });
});

describe("dashboard isolation", () => {
  it("does not list another tenant's dashboards", async () => {
    await alice.dashboards.create("Alice ops");
    expect(await alice.dashboards.list()).toHaveLength(1);
    expect(await bob.dashboards.list()).toHaveLength(0);
  });

  it("cannot read another tenant's dashboard by id", async () => {
    const dash = await alice.dashboards.create("Secret");
    expect(await bob.dashboards.get(dash.id)).toBeNull();
  });

  it("cannot rename or delete another tenant's dashboard", async () => {
    const dash = await alice.dashboards.create("Untouched");

    expect(await bob.dashboards.rename(dash.id, "pwned")).toBeNull();
    expect(await bob.dashboards.remove(dash.id)).toBe(false);

    const still = await alice.dashboards.get(dash.id);
    expect(still?.name).toBe("Untouched");
  });
});

describe("widget isolation", () => {
  it("does not expose widgets across tenants", async () => {
    const dash = await alice.dashboards.create("With widgets");
    await alice.widgets.add({
      dashboardId: dash.id,
      widgetType: "railway-fleet",
      title: "Fleet",
      configJson: "{}",
      layoutY: 0,
      layoutW: 3,
      layoutH: 2,
    });

    expect(await alice.widgets.listFor(dash.id)).toHaveLength(1);
    expect(await bob.widgets.listFor(dash.id)).toHaveLength(0);
  });

  it("refuses to move a widget that belongs to a different dashboard", async () => {
    const a = await alice.dashboards.create("A");
    const b = await alice.dashboards.create("B");
    const widget = await alice.widgets.add({
      dashboardId: a.id,
      widgetType: "railway-fleet",
      title: "Fleet",
      configJson: "{}",
      layoutY: 0,
      layoutW: 3,
      layoutH: 2,
    });

    // Same tenant, wrong dashboard: must not match.
    const moved = await alice.widgets.saveLayouts(b.id, [
      { i: widget.id, x: 9, y: 9, w: 1, h: 1 },
    ]);
    expect(moved).toBe(0);

    const [unchanged] = await alice.widgets.listFor(a.id);
    expect(unchanged.layoutX).toBe(0);
    expect(unchanged.layoutY).toBe(0);
  });

  it("refuses to delete another tenant's widget", async () => {
    const dash = await alice.dashboards.create("Guarded");
    const widget = await alice.widgets.add({
      dashboardId: dash.id,
      widgetType: "railway-fleet",
      title: "Fleet",
      configJson: "{}",
      layoutY: 0,
      layoutW: 3,
      layoutH: 2,
    });

    expect(await bob.widgets.remove(dash.id, widget.id)).toBe(false);
    expect(await alice.widgets.listFor(dash.id)).toHaveLength(1);
  });
});

describe("connection isolation", () => {
  it("byProvider never returns another tenant's credentials", async () => {
    await alice.connections.create({
      provider: "railway",
      label: "Alice Railway",
      credentialsEncrypted: "alice-ciphertext",
    });

    const mine = await alice.connections.byProvider("railway");
    expect(mine?.credentialsEncrypted).toBe("alice-ciphertext");

    // The regression this whole phase exists to prevent.
    expect(await bob.connections.byProvider("railway")).toBeNull();
    expect(await bob.connections.list()).toHaveLength(0);
  });

  it("cannot overwrite or delete another tenant's connection", async () => {
    const conn = await alice.connections.create({
      provider: "netlify",
      label: "Alice Netlify",
      credentialsEncrypted: "original",
    });

    expect(
      await bob.connections.update(conn.id, {
        label: "hijacked",
        credentialsEncrypted: "attacker",
      }),
    ).toBeNull();
    expect(await bob.connections.remove(conn.id)).toBe(false);

    const still = await alice.connections.get(conn.id);
    expect(still?.credentialsEncrypted).toBe("original");
  });
});

describe("cache isolation", () => {
  it("namespaces cache entries per organization", async () => {
    await alice.cache.set("shared-key", { secret: "alice" }, 60);
    await bob.cache.set("shared-key", { secret: "bob" }, 60);

    expect(await alice.cache.get("shared-key")).toEqual({ secret: "alice" });
    expect(await bob.cache.get("shared-key")).toEqual({ secret: "bob" });
  });

  it("serves a stale entry when the upstream fetch fails", async () => {
    await alice.cache.set("flaky", { v: 1 }, -1); // already expired
    const { data, cached } = await alice.cache.fetch<{ v: number }>(
      "flaky",
      60,
      () => Promise.reject(new Error("upstream down")),
    );
    expect(data).toEqual({ v: 1 });
    expect(cached).toBe(true);
  });

  it("propagates the error when there is nothing stale to serve", async () => {
    await expect(
      alice.cache.fetch("cold", 60, () => Promise.reject(new Error("boom"))),
    ).rejects.toThrow("boom");
  });
});
