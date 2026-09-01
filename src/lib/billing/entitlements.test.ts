import { afterEach, describe, expect, it } from "vitest";
import {
  checkLimit,
  entitlementsFromRow,
  type SubscriptionRow,
} from "./entitlements";
import { PLANS, UNLIMITED, planForPriceId, priceIdFor } from "./plans";

const row = (over: Partial<SubscriptionRow> = {}): SubscriptionRow => ({
  plan: "solo",
  status: "active",
  cancelAtPeriodEnd: false,
  currentPeriodEnd: null,
  extraSeats: 0,
  ...over,
});

afterEach(() => {
  delete process.env.STRIPE_PRICE_SOLO_MONTHLY;
  delete process.env.STRIPE_PRICE_TEAM_MONTHLY;
});

describe("entitlementsFromRow", () => {
  it("falls back to free with no subscription at all", () => {
    const result = entitlementsFromRow(null);
    expect(result.plan).toBe("trial");
    expect(result.active).toBe(false);
    expect(result.limits).toEqual(PLANS.trial.limits);
  });

  it("grants the paid plan while active", () => {
    const result = entitlementsFromRow(row({ plan: "solo" }));
    expect(result.plan).toBe("solo");
    expect(result.active).toBe(true);
    expect(result.limits.connections).toBe(PLANS.solo.limits.connections);
  });

  it("grants the plan during a trial", () => {
    expect(entitlementsFromRow(row({ status: "trialing" })).active).toBe(true);
  });

  it("keeps access while a renewal is being retried", () => {
    // Dunning should chase the card, not lock someone out of their dashboards.
    const result = entitlementsFromRow(row({ status: "past_due" }));
    expect(result.active).toBe(true);
    expect(result.plan).toBe("solo");
  });

  it.each(["canceled", "incomplete", "incomplete_expired", "unpaid", "none"])(
    "drops to free when the status is %s",
    (status) => {
      const result = entitlementsFromRow(row({ plan: "team", status }));
      expect(result.plan).toBe("trial");
      expect(result.active).toBe(false);
      expect(result.limits).toEqual(PLANS.trial.limits);
    },
  );

  it("falls back to free for a plan id it no longer knows", () => {
    const result = entitlementsFromRow(
      row({ plan: "legacy-enterprise" as never }),
    );
    expect(result.plan).toBe("trial");
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
  const trial = entitlementsFromRow(null);

  it("allows creation below the limit", () => {
    expect(checkLimit(trial, "dashboards", 0).allowed).toBe(true);
    expect(
      checkLimit(trial, "dashboards", PLANS.trial.limits.dashboards - 1).allowed,
    ).toBe(true);
  });

  it("refuses once the limit is reached", () => {
    const result = checkLimit(trial, "dashboards", PLANS.trial.limits.dashboards);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.message).toContain("Trial");
      expect(result.limit).toBe(PLANS.trial.limits.dashboards);
    }
  });

  it("refuses when already over the limit after a downgrade", () => {
    expect(checkLimit(trial, "dashboards", 99).allowed).toBe(false);
  });

  it("never limits connections on any plan", () => {
    // Connectors are the reason to buy Bussola, so they are never rationed —
    // the plans differ on dashboards, widgets, seats and history instead.
    for (const id of ["trial", "solo", "team"] as const) {
      expect(PLANS[id].limits.connections).toBe(UNLIMITED);
    }
    const solo = entitlementsFromRow(row({ plan: "solo" }));
    expect(checkLimit(solo, "connections", 10_000).allowed).toBe(true);
  });

  it("never refuses on an unlimited plan", () => {
    const unlimited = entitlementsFromRow(row({ plan: "team" }));
    expect(unlimited.limits.connections).toBe(UNLIMITED);
    expect(checkLimit(unlimited, "connections", 10_000).allowed).toBe(true);
  });
});

describe("planForPriceId", () => {
  it("maps a configured price to its plan", () => {
    process.env.STRIPE_PRICE_SOLO_MONTHLY = "price_pro_123";
    expect(planForPriceId("price_pro_123")).toBe("solo");
  });

  it("refuses to guess: an unknown price is free, not the highest plan", () => {
    process.env.STRIPE_PRICE_TEAM_MONTHLY = "price_scale_1";
    expect(planForPriceId("price_someone_elses")).toBe("trial");
    expect(planForPriceId(null)).toBe("trial");
    expect(planForPriceId(undefined)).toBe("trial");
  });

  it("does not match a plan whose price is unset", () => {
    // An unset env var must not make `undefined === undefined` a match.
    expect(planForPriceId(undefined as unknown as string)).toBe("trial");
    expect(priceIdFor("solo")).toBeUndefined();
  });
});
