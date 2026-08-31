import fs from "fs";
import os from "os";
import path from "path";
import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createId } from "@/lib/id";

/**
 * Webhook persistence, against a real Postgres.
 *
 * The properties that matter here are that a replayed event does not apply
 * twice, and that a failed event can be retried — Stripe redelivers freely and
 * a double-applied plan change is a billing incident.
 */
let dataDir: string;
let closeDb: () => Promise<void>;
let db: Awaited<ReturnType<typeof import("@/lib/db").getDb>>;
let schema: typeof import("@/lib/db/schema");
let billing: typeof import("./subscription");
let organizationId: string;

function stripeSubscription(over: Record<string, unknown> = {}) {
  return {
    id: "sub_stripe_1",
    customer: "cus_1",
    status: "active",
    cancel_at_period_end: false,
    items: {
      data: [
        {
          price: { id: "price_pro_123" },
          current_period_end: Math.floor(Date.UTC(2027, 0, 1) / 1000),
        },
      ],
    },
    ...over,
  } as unknown as Stripe.Subscription;
}

beforeAll(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "bussola-billing-"));
  process.env.BUSSOLA_DATA_DIR = dataDir;
  delete process.env.DATABASE_URL;
  delete process.env.BUSSOLA_EDITION;
  process.env.STRIPE_PRICE_PRO = "price_pro_123";

  const dbModule = await import("@/lib/db");
  schema = await import("@/lib/db/schema");
  billing = await import("./subscription");

  await dbModule.runMigrations();
  closeDb = dbModule.closeDb;
  db = await dbModule.getDb();

  organizationId = createId("org");
  await db
    .insert(schema.organization)
    .values({ id: organizationId, name: "Billing", slug: "billing" });
}, 60_000);

afterAll(async () => {
  await closeDb?.();
  fs.rmSync(dataDir, { recursive: true, force: true });
  delete process.env.STRIPE_PRICE_PRO;
});

beforeEach(async () => {
  await db.delete(schema.subscriptions);
  await db.delete(schema.billingEvents);
});

async function readSubscription() {
  const [row] = await db
    .select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.organizationId, organizationId))
    .limit(1);
  return row;
}

describe("claimEvent", () => {
  it("claims an event the first time", async () => {
    expect(await billing.claimEvent("evt_1", "customer.subscription.updated"))
      .toBe(true);
  });

  it("refuses a replay of the same event", async () => {
    await billing.claimEvent("evt_1", "customer.subscription.updated");
    expect(await billing.claimEvent("evt_1", "customer.subscription.updated"))
      .toBe(false);
  });

  it("lets a released event be claimed again so Stripe can retry", async () => {
    await billing.claimEvent("evt_1", "customer.subscription.updated");
    await billing.releaseEvent("evt_1");
    expect(await billing.claimEvent("evt_1", "customer.subscription.updated"))
      .toBe(true);
  });

  it("treats distinct events independently", async () => {
    expect(await billing.claimEvent("evt_1", "a")).toBe(true);
    expect(await billing.claimEvent("evt_2", "a")).toBe(true);
  });
});

describe("applySubscription", () => {
  it("stores the plan resolved from the Stripe price", async () => {
    await billing.applySubscription(stripeSubscription(), organizationId);

    const row = await readSubscription();
    expect(row.plan).toBe("pro");
    expect(row.status).toBe("active");
    expect(row.stripeSubscriptionId).toBe("sub_stripe_1");
    expect(row.stripeCustomerId).toBe("cus_1");
    expect(row.currentPeriodEnd?.toISOString()).toBe(
      new Date(Date.UTC(2027, 0, 1)).toISOString(),
    );
  });

  it("updates in place rather than creating a second row", async () => {
    await billing.applySubscription(stripeSubscription(), organizationId);
    await billing.applySubscription(
      stripeSubscription({ status: "canceled", cancel_at_period_end: true }),
      organizationId,
    );

    const rows = await db.select().from(schema.subscriptions);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("canceled");
    expect(rows[0].cancelAtPeriodEnd).toBe(true);
  });

  it("does not grant a paid plan for an unrecognised price", async () => {
    await billing.applySubscription(
      stripeSubscription({
        items: { data: [{ price: { id: "price_unknown" } }] },
      }),
      organizationId,
    );
    expect((await readSubscription()).plan).toBe("free");
  });

  it("reads the period end from the subscription when items omit it", async () => {
    await billing.applySubscription(
      stripeSubscription({
        items: { data: [{ price: { id: "price_pro_123" } }] },
        current_period_end: Math.floor(Date.UTC(2028, 5, 1) / 1000),
      }),
      organizationId,
    );
    expect((await readSubscription()).currentPeriodEnd?.toISOString()).toBe(
      new Date(Date.UTC(2028, 5, 1)).toISOString(),
    );
  });

  it("accepts an expanded customer object as well as an id", async () => {
    await billing.applySubscription(
      stripeSubscription({ customer: { id: "cus_expanded" } }),
      organizationId,
    );
    expect((await readSubscription()).stripeCustomerId).toBe("cus_expanded");
  });
});

describe("organizationForStoredCustomer", () => {
  it("resolves a known customer back to its organization", async () => {
    await billing.applySubscription(stripeSubscription(), organizationId);
    expect(await billing.organizationForStoredCustomer("cus_1")).toBe(
      organizationId,
    );
  });

  it("returns null for a customer it has never seen", async () => {
    expect(await billing.organizationForStoredCustomer("cus_nope")).toBeNull();
  });
});
