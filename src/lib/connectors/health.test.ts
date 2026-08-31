import { describe, expect, it } from "vitest";
import { connectionHealth } from "./health";
import { PROVIDER_CATALOG } from "./catalog";
import { COMING_SOON_PROVIDERS, LIVE_PROVIDERS } from "./index";

const base = { status: "connected", syncEnabled: true, consecutiveFailures: 0 };

describe("connectionHealth", () => {
  it("reports a healthy connection", () => {
    expect(connectionHealth(base)).toEqual({ tone: "ok", label: "Connected" });
  });

  it("reports a fresh connection that has not been tested", () => {
    expect(connectionHealth({ ...base, status: "unknown" }).label).toBe(
      "Not tested",
    );
  });

  it("calls a failing but still-scheduled connection retrying", () => {
    const health = connectionHealth({
      ...base,
      status: "error",
      consecutiveFailures: 2,
    });
    expect(health).toEqual({ tone: "warn", label: "Retrying" });
  });

  it("warns while failures are accumulating even if status lags behind", () => {
    expect(connectionHealth({ ...base, consecutiveFailures: 1 }).tone).toBe(
      "warn",
    );
  });

  it("says sync stopped once it has been given up on", () => {
    // The stale status field still says "error"; what matters is that nothing
    // is retrying any more, which is the state needing action.
    const health = connectionHealth({
      status: "error",
      syncEnabled: false,
      consecutiveFailures: 10,
    });
    expect(health).toEqual({ tone: "error", label: "Sync stopped" });
  });

  it("says sync stopped even for a connection that once looked healthy", () => {
    expect(
      connectionHealth({ ...base, syncEnabled: false }).label,
    ).toBe("Sync stopped");
  });
});

describe("provider catalog", () => {
  it("describes every provider the app knows about", () => {
    for (const provider of [...LIVE_PROVIDERS, ...COMING_SOON_PROVIDERS]) {
      const entry = PROVIDER_CATALOG[provider];
      expect(entry, provider).toBeDefined();
      expect(entry.name.length, provider).toBeGreaterThan(0);
      expect(entry.tagline.length, provider).toBeGreaterThan(0);
    }
  });

  it("tells you how to get a token for every connectable source", () => {
    for (const provider of LIVE_PROVIDERS) {
      const entry = PROVIDER_CATALOG[provider];
      expect(entry.hint.length, provider).toBeGreaterThan(0);
      expect(entry.docsUrl, provider).toMatch(/^https:\/\//);
      expect(entry.fields.length, provider).toBeGreaterThan(0);
    }
  });

  it("asks for a credential field on every connectable source", () => {
    for (const provider of LIVE_PROVIDERS) {
      expect(PROVIDER_CATALOG[provider].fields, provider).toContain("apiKey");
    }
  });

  it("labels the scope field wherever one is asked for", () => {
    for (const entry of Object.values(PROVIDER_CATALOG)) {
      if (entry.fields.includes("orgSlug")) {
        expect(entry.orgSlugLabel, entry.provider).toBeTruthy();
      }
    }
  });
});
