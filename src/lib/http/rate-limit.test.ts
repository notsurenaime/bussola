import { afterEach, describe, expect, it, vi } from "vitest";
import { LIMITS, rateLimit, rateLimitHeaders, resetRateLimits } from "./rate-limit";

afterEach(() => {
  resetRateLimits();
  vi.useRealTimers();
});

const rule = { limit: 3, windowMs: 1000 };

describe("rateLimit", () => {
  it("allows up to the limit and then refuses", () => {
    for (let i = 0; i < 3; i += 1) {
      expect(rateLimit("a", rule).ok).toBe(true);
    }
    expect(rateLimit("a", rule).ok).toBe(false);
  });

  it("counts down what is left", () => {
    expect(rateLimit("a", rule).remaining).toBe(2);
    expect(rateLimit("a", rule).remaining).toBe(1);
    expect(rateLimit("a", rule).remaining).toBe(0);
  });

  it("keys are independent", () => {
    for (let i = 0; i < 3; i += 1) rateLimit("a", rule);
    expect(rateLimit("a", rule).ok).toBe(false);
    expect(rateLimit("b", rule).ok).toBe(true);
  });

  it("says how long to wait", () => {
    for (let i = 0; i < 3; i += 1) rateLimit("a", rule);
    const denied = rateLimit("a", rule);
    expect(denied.retryAfter).toBeGreaterThan(0);
    expect(denied.retryAfter).toBeLessThanOrEqual(1);
  });

  it("lets the window slide rather than resetting on a fixed boundary", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T12:00:00Z"));

    rateLimit("a", rule);
    rateLimit("a", rule);
    vi.advanceTimersByTime(600);
    rateLimit("a", rule);
    expect(rateLimit("a", rule).ok).toBe(false);

    // The first two age out; the third is still inside the window.
    vi.advanceTimersByTime(500);
    expect(rateLimit("a", rule).ok).toBe(true);
    expect(rateLimit("a", rule).ok).toBe(true);
    expect(rateLimit("a", rule).ok).toBe(false);
  });

  it("recovers fully once the window has passed", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T12:00:00Z"));
    for (let i = 0; i < 3; i += 1) rateLimit("a", rule);
    expect(rateLimit("a", rule).ok).toBe(false);

    vi.advanceTimersByTime(1500);
    expect(rateLimit("a", rule).ok).toBe(true);
  });
});

describe("rateLimitHeaders", () => {
  it("omits Retry-After while the caller is inside the limit", () => {
    const headers = rateLimitHeaders(rateLimit("a", rule)) as Record<string, string>;
    expect(headers["RateLimit-Limit"]).toBe("3");
    expect(headers["Retry-After"]).toBeUndefined();
  });

  it("includes Retry-After once refused", () => {
    for (let i = 0; i < 3; i += 1) rateLimit("a", rule);
    const headers = rateLimitHeaders(rateLimit("a", rule)) as Record<string, string>;
    expect(headers["Retry-After"]).toBeDefined();
  });
});

describe("the configured limits", () => {
  it("leaves room for a canvas of widgets polling every 60s", () => {
    // Twelve widgets on a share page, one poll a minute each, is 12/min. The
    // limit has to clear that comfortably or a normal viewer trips it.
    expect(LIMITS.shareData.limit).toBeGreaterThan(60);
  });

  it("meters credential guessing harder than legitimate use", () => {
    expect(LIMITS.mcpAnonymous.limit).toBeLessThan(LIMITS.mcp.limit);
  });
});
