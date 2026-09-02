import { describe, expect, it } from "vitest";
import { compare, evaluateRule, type RuleSnapshot } from "./evaluate";

const NOW = new Date("2026-09-01T12:00:00Z");
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);

function rule(overrides: Partial<RuleSnapshot> = {}): RuleSnapshot {
  return {
    metric: "sentry.unresolved",
    comparator: "above",
    threshold: "10",
    enabled: true,
    cooldownMinutes: 60,
    lastState: null,
    lastNotifiedAt: null,
    mutedUntil: null,
    ...overrides,
  };
}

describe("compare", () => {
  it("implements every comparator", () => {
    expect(compare(5, "above", 3)).toBe(true);
    expect(compare(3, "above", 3)).toBe(false);
    expect(compare(1, "below", 3)).toBe(true);
    expect(compare(3, "below", 3)).toBe(false);
    expect(compare(3, "equals", 3)).toBe(true);
    expect(compare(3, "not_equals", 3)).toBe(false);
  });
});

describe("evaluateRule", () => {
  it("reads the metric out of the payload and breaches above the threshold", () => {
    const result = evaluateRule(rule(), { unresolved: 42 }, NOW);
    expect(result).toMatchObject({
      kind: "evaluated",
      state: "breached",
      value: 42,
      notify: true,
    });
  });

  it("stays ok below the threshold", () => {
    const result = evaluateRule(rule(), { unresolved: 2 }, NOW);
    expect(result).toMatchObject({ kind: "evaluated", state: "ok" });
  });

  it("says what happened in the message", () => {
    const result = evaluateRule(rule(), { unresolved: 42 }, NOW);
    expect(result.kind === "evaluated" && result.message).toContain(
      "Unresolved issues is 42",
    );
    expect(result.kind === "evaluated" && result.message).toContain("above 10");
  });

  describe("skips", () => {
    it("a disabled rule", () => {
      const result = evaluateRule(rule({ enabled: false }), { unresolved: 99 });
      expect(result).toEqual({ kind: "skipped", reason: "disabled" });
    });

    it("a muted rule, until the mute expires", () => {
      const muted = rule({ mutedUntil: new Date(NOW.getTime() + 60_000) });
      expect(evaluateRule(muted, { unresolved: 99 }, NOW)).toEqual({
        kind: "skipped",
        reason: "muted",
      });

      const expired = rule({ mutedUntil: minutesAgo(1) });
      expect(evaluateRule(expired, { unresolved: 99 }, NOW).kind).toBe(
        "evaluated",
      );
    });

    it("a metric that no longer exists", () => {
      const result = evaluateRule(rule({ metric: "gone.away" }), {});
      expect(result).toEqual({ kind: "skipped", reason: "unknown_metric" });
    });

    it("a threshold that is not a number", () => {
      const result = evaluateRule(rule({ threshold: "soon" }), {
        unresolved: 1,
      });
      expect(result).toEqual({ kind: "skipped", reason: "invalid_threshold" });
    });

    it("a section the source did not report", () => {
      // The regression this guards: reading a missing section as 0 would fire
      // "MRR dropped below 1000" every hour for a key that lost a scope.
      const mrr = rule({ metric: "stripe.mrr", comparator: "below" });
      expect(evaluateRule(mrr, {}, NOW)).toEqual({
        kind: "skipped",
        reason: "no_value",
      });
    });

    it("a payload that has not synced yet", () => {
      expect(evaluateRule(rule(), null, NOW)).toEqual({
        kind: "skipped",
        reason: "no_value",
      });
    });
  });

  describe("notification, on transitions only", () => {
    it("notifies on the first evaluation when already breached", () => {
      const result = evaluateRule(rule({ lastState: null }), { unresolved: 99 }, NOW);
      expect(result.kind === "evaluated" && result.notify).toBe(true);
    });

    it("says nothing on a first evaluation that is fine", () => {
      const result = evaluateRule(rule({ lastState: null }), { unresolved: 1 }, NOW);
      expect(result.kind === "evaluated" && result.notify).toBe(false);
    });

    it("says nothing while a breach simply continues", () => {
      const ongoing = rule({
        lastState: "breached",
        lastNotifiedAt: minutesAgo(5),
      });
      const result = evaluateRule(ongoing, { unresolved: 99 }, NOW);
      expect(result.kind === "evaluated" && result.state).toBe("breached");
      expect(result.kind === "evaluated" && result.notify).toBe(false);
    });

    it("notifies the moment a breach clears", () => {
      const recovering = rule({
        lastState: "breached",
        lastNotifiedAt: minutesAgo(1),
      });
      const result = evaluateRule(recovering, { unresolved: 1 }, NOW);
      expect(result.kind === "evaluated" && result.state).toBe("ok");
      expect(result.kind === "evaluated" && result.notify).toBe(true);
    });

    it("holds a re-breach inside the cooldown", () => {
      const flapping = rule({
        lastState: "ok",
        lastNotifiedAt: minutesAgo(5),
        cooldownMinutes: 60,
      });
      const result = evaluateRule(flapping, { unresolved: 99 }, NOW);
      expect(result.kind === "evaluated" && result.notify).toBe(false);
    });

    it("lets a re-breach through once the cooldown has passed", () => {
      const settled = rule({
        lastState: "ok",
        lastNotifiedAt: minutesAgo(90),
        cooldownMinutes: 60,
      });
      const result = evaluateRule(settled, { unresolved: 99 }, NOW);
      expect(result.kind === "evaluated" && result.notify).toBe(true);
    });

    it("does not hold back a recovery for the cooldown", () => {
      const justFired = rule({
        lastState: "breached",
        lastNotifiedAt: NOW,
        cooldownMinutes: 240,
      });
      const result = evaluateRule(justFired, { unresolved: 0 }, NOW);
      expect(result.kind === "evaluated" && result.notify).toBe(true);
    });
  });

  describe("metric extraction across providers", () => {
    it("derives a shortfall from a total and a healthy count", () => {
      const unhealthy = rule({
        metric: "supabase.unhealthyProjects",
        threshold: "0",
      });
      const result = evaluateRule(unhealthy, { total: 5, healthy: 3 }, NOW);
      expect(result.kind === "evaluated" && result.value).toBe(2);
    });

    it("reads a nested money value", () => {
      const mrr = rule({
        metric: "stripe.mrr",
        comparator: "below",
        threshold: "1000",
      });
      const result = evaluateRule(mrr, { revenue: { mrr: 420 } }, NOW);
      expect(result.kind === "evaluated" && result.state).toBe("breached");
    });

    it("falls back to per-account balances on an older Qonto snapshot", () => {
      const cash = rule({
        metric: "qonto.cashBalance",
        comparator: "below",
        threshold: "5000",
      });
      const result = evaluateRule(
        cash,
        { balances: [{ balance: 1000 }, { balance: 2000 }] },
        NOW,
      );
      expect(result.kind === "evaluated" && result.value).toBe(3000);
    });

    it("prefers the liquidity section when a snapshot has one", () => {
      const cash = rule({ metric: "qonto.cashBalance", threshold: "0" });
      const result = evaluateRule(
        cash,
        { liquidity: { booked: 9000 }, balances: [{ balance: 1 }] },
        NOW,
      );
      expect(result.kind === "evaluated" && result.value).toBe(9000);
    });
  });
});
