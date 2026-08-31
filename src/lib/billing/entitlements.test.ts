import { afterEach, describe, expect, it } from "vitest";
import {
  checkLimit,
  entitlementsFromRow,
  type SubscriptionRow,
} from "./entitlements";
import { PLANS, UNLIMITED, planForPriceId, priceIdFor } from "./plans";

const row = (over: Partial<SubscriptionRow> = {}): SubscriptionRow => ({
  plan: "pro",
  status: "active",
  cancelAtPeriodEnd: false,
  currentPeriodEnd: null,
  ...over,
});

afterEach(() => {
  delete process.env.STRIPE_PRICE_PRO;
  delete process.env.STRIPE_PRICE_SCALE;
});

describe("entitlementsFromRow", () => {
  it("falls back to free with no subscription at all", () => {
    const result = entitlementsFromRow(null);
    expect(result.plan).toBe("free");
    expect(result.active).toBe(false);
    expect(result.limits).toEqual(PLANS.free.limits);
  });

  it("grants the paid plan while active", () => {
    const result = entitlementsFromRow(row({ plan: "pro" }));
    expect(result.plan).toBe("pro");
    expect(result.active).toBe(true);
    expect(result.limits.connections).toBe(PLANS.pro.limits.connections);
  });

  it("grants the plan during a trial", () => {
    expect(entitlementsFromRow(row({ status: "trialing" })).active).toBe(true);
  });

  it("keeps access while a renewal is being retried", () => {
    // Dunning should chase the card, not lock someone out of their dashboards.
    const result = entitlementsFromRow(row({ status: "past_due" }));
    expect(result.active).toBe(true);
    expect(result.plan).toBe("pro");
  });

  it.each(["canceled", "incomplete", "incomplete_expired", "unpaid", "none"])(
    "drops to free when the status is %s",
    (status) => {
      const result = entitlementsFromRow(row({ plan: "scale", status }));
      expect(result.plan).toBe("free");
      expect(result.active).toBe(false);
      expect(result.limits).toEqual(PLANS.free.limits);
    },
  );

  it("falls back to free for a plan id it no longer knows", () => {
    const result = entitlementsFromRow(
      row({ plan: "legacy-enterprise" as never }),
    );
    expect(result.plan).toBe("free");
  });

  it("keeps the cancellation notice visible while still active", () => {
    const ends = new Date("2027-01-01");
    const result = entitlementsFromRow(
      row({ cancelAtPeriodEnd: true, currentPeriodEnd: ends }),
    );
    expect(result.active).toBe(true);
    expect(result.cancelAtPeriodEnd).toBe(true);
    expect(result.currentPeriodEnd).toEqual(ends);
  });
});

describe("checkLimit", () => {
  const free = entitlementsFromRow(null);

  it("allows creation below the limit", () => {
    expect(checkLimit(free, "dashboards", 0).allowed).toBe(true);
    expect(
      checkLimit(free, "dashboards", PLANS.free.limits.dashboards - 1).allowed,
    ).toBe(true);
  });

  it("refuses once the limit is reached", () => {
    const result = checkLimit(free, "dashboards", PLANS.free.limits.dashboards);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.message).toContain("Free");
      expect(result.limit).toBe(PLANS.free.limits.dashboards);
    }
  });

  it("refuses when already over the limit after a downgrade", () => {
    expect(checkLimit(free, "connections", 99).allowed).toBe(false);
  });

  it("never refuses on an unlimited plan", () => {
    const unlimited = entitlementsFromRow(row({ plan: "scale" }));
    expect(unlimited.limits.connections).toBe(UNLIMITED);
    expect(checkLimit(unlimited, "connections", 10_000).allowed).toBe(true);
  });
});

describe("planForPriceId", () => {
  it("maps a configured price to its plan", () => {
    process.env.STRIPE_PRICE_PRO = "price_pro_123";
    expect(planForPriceId("price_pro_123")).toBe("pro");
  });

  it("refuses to guess: an unknown price is free, not the highest plan", () => {
    process.env.STRIPE_PRICE_SCALE = "price_scale_1";
    expect(planForPriceId("price_someone_elses")).toBe("free");
    expect(planForPriceId(null)).toBe("free");
    expect(planForPriceId(undefined)).toBe("free");
  });

  it("does not match a plan whose price is unset", () => {
    // An unset env var must not make `undefined === undefined` a match.
    expect(planForPriceId(undefined as unknown as string)).toBe("free");
    expect(priceIdFor("pro")).toBeUndefined();
  });
});
