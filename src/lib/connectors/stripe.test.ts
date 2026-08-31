import { describe, expect, it } from "vitest";
import { chargeStatus, monthlyAmount } from "./stripe";

/**
 * MRR normalisation is where revenue bugs live: a yearly plan counted as
 * monthly overstates recurring revenue twelvefold.
 */
describe("monthlyAmount", () => {
  it("passes a monthly price through unchanged", () => {
    expect(
      monthlyAmount({ unit_amount: 1200, recurring: { interval: "month" } }),
    ).toBe(1200);
  });

  it("spreads a yearly price across twelve months", () => {
    expect(
      monthlyAmount({ unit_amount: 12000, recurring: { interval: "year" } }),
    ).toBe(1000);
  });

  it("divides by the interval count", () => {
    // Billed every 3 months.
    expect(
      monthlyAmount({
        unit_amount: 3000,
        recurring: { interval: "month", interval_count: 3 },
      }),
    ).toBe(1000);
  });

  it("scales weekly and daily prices up to a month", () => {
    expect(
      monthlyAmount({ unit_amount: 1200, recurring: { interval: "week" } }),
    ).toBeCloseTo(5200, 5);
    expect(
      monthlyAmount({ unit_amount: 120, recurring: { interval: "day" } }),
    ).toBeCloseTo(3650, 5);
  });

  it("contributes nothing for a one-off price", () => {
    expect(monthlyAmount({ unit_amount: 5000 })).toBe(0);
    expect(monthlyAmount({ unit_amount: 5000, recurring: null })).toBe(0);
  });

  it("contributes nothing for a metered price with no unit amount", () => {
    expect(monthlyAmount({ recurring: { interval: "month" } })).toBe(0);
    expect(
      monthlyAmount({ unit_amount: null, recurring: { interval: "month" } }),
    ).toBe(0);
  });

  it("ignores an interval it does not know", () => {
    expect(
      monthlyAmount({ unit_amount: 100, recurring: { interval: "fortnight" } }),
    ).toBe(0);
  });

  it("handles a missing price at all", () => {
    expect(monthlyAmount(undefined)).toBe(0);
  });
});

describe("chargeStatus", () => {
  it("maps Stripe outcomes onto the shared vocabulary", () => {
    expect(chargeStatus({ status: "succeeded" })).toBe("succeeded");
    expect(chargeStatus({ status: "pending" })).toBe("pending");
    expect(chargeStatus({ status: "failed" })).toBe("failed");
  });

  it("reports a refund as refunded even though the charge succeeded", () => {
    expect(chargeStatus({ status: "succeeded", refunded: true })).toBe(
      "refunded",
    );
  });

  it("treats anything unrecognised as failed rather than succeeded", () => {
    expect(chargeStatus({ status: "who_knows" })).toBe("failed");
  });
});
