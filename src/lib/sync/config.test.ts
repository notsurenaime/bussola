import { describe, expect, it } from "vitest";
import {
  MAX_BACKOFF_SECONDS,
  SYNC_INTERVAL_SECONDS,
  nextDelaySeconds,
} from "./config";

describe("nextDelaySeconds", () => {
  it("uses the provider's plain interval when healthy", () => {
    expect(nextDelaySeconds("railway", 0)).toBe(
      SYNC_INTERVAL_SECONDS.railway,
    );
    expect(nextDelaySeconds("qonto", 0)).toBe(SYNC_INTERVAL_SECONDS.qonto);
  });

  it("doubles per consecutive failure", () => {
    const base = SYNC_INTERVAL_SECONDS.railway;
    expect(nextDelaySeconds("railway", 1)).toBe(base * 2);
    expect(nextDelaySeconds("railway", 2)).toBe(base * 4);
    expect(nextDelaySeconds("railway", 3)).toBe(base * 8);
  });

  it("never backs off past the ceiling", () => {
    expect(nextDelaySeconds("railway", 50)).toBe(MAX_BACKOFF_SECONDS);
    expect(nextDelaySeconds("qonto", 999)).toBe(MAX_BACKOFF_SECONDS);
  });

  it("stays finite for absurd failure counts", () => {
    expect(Number.isFinite(nextDelaySeconds("netlify", 1e6))).toBe(true);
  });

  it("gives the bank API a slower cadence than the deploy platforms", () => {
    expect(SYNC_INTERVAL_SECONDS.qonto).toBeGreaterThan(
      SYNC_INTERVAL_SECONDS.railway,
    );
  });
});
