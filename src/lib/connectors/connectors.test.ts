import { describe, expect, it } from "vitest";
import { orderStatus } from "./lemonsqueezy";
import { levelStatus, projectStatus } from "./sentry";
import { domainStatus, domainStatusLabel } from "./resend";
import { deployStateLabel, deployStatus } from "./vercel";
import { COMING_SOON_PROVIDERS, LIVE_PROVIDERS, getConnector } from "./index";

describe("Lemon Squeezy order status", () => {
  it("maps the paid states", () => {
    expect(orderStatus("paid")).toBe("succeeded");
    expect(orderStatus("pending")).toBe("pending");
  });

  it("treats both refund shapes as refunded", () => {
    expect(orderStatus("refunded")).toBe("refunded");
    expect(orderStatus("partial_refund")).toBe("refunded");
  });

  it("does not assume success for an unknown state", () => {
    expect(orderStatus("mystery")).toBe("failed");
    expect(orderStatus(undefined)).toBe("failed");
  });
});

describe("Sentry mapping", () => {
  it("treats fatal and error alike", () => {
    expect(levelStatus("fatal")).toBe("error");
    expect(levelStatus("error")).toBe("error");
    expect(levelStatus("warning")).toBe("warn");
    expect(levelStatus("info")).toBe("ok");
    expect(levelStatus(undefined)).toBe("idle");
  });

  it("marks a project that has never reported as idle, not healthy", () => {
    expect(projectStatus({ status: "active", firstEvent: null })).toBe("idle");
    expect(projectStatus({ status: "active", firstEvent: "2026-01-01" })).toBe(
      "ok",
    );
  });

  it("flags a project that is not active", () => {
    expect(projectStatus({ status: "pending_deletion" })).toBe("warn");
  });
});

describe("Resend domain status", () => {
  it("only counts a verified domain as healthy", () => {
    expect(domainStatus("verified")).toBe("ok");
    expect(domainStatus("pending")).toBe("warn");
    expect(domainStatus("failed")).toBe("error");
    expect(domainStatus("not_started")).toBe("error");
  });

  it("renders raw statuses readably", () => {
    expect(domainStatusLabel("temporary_failure")).toBe("temporary failure");
    expect(domainStatusLabel(undefined)).toBe("Unknown");
  });
});

describe("Vercel deploy status", () => {
  it("maps ready states", () => {
    expect(deployStatus("READY")).toBe("ok");
    expect(deployStatus("ERROR")).toBe("error");
    expect(deployStatus("BUILDING")).toBe("warn");
    expect(deployStatus("QUEUED")).toBe("warn");
    expect(deployStatus("CANCELED")).toBe("idle");
    expect(deployStatus(undefined)).toBe("idle");
  });

  it("labels states in sentence case", () => {
    expect(deployStateLabel("READY")).toBe("Ready");
    expect(deployStateLabel("BUILDING")).toBe("Building");
    expect(deployStateLabel(undefined)).toBe("Unknown");
  });
});

describe("connector registry", () => {
  it("has a working connector for every live provider", () => {
    for (const provider of LIVE_PROVIDERS) {
      expect(getConnector(provider), provider).not.toBeNull();
    }
  });

  it("covers all eight Wave 1 providers", () => {
    for (const provider of [
      "railway",
      "supabase",
      "qonto",
      "stripe",
      "resend",
      "sentry",
      "lemonsqueezy",
      "vercel",
    ]) {
      expect(LIVE_PROVIDERS, provider).toContain(provider);
    }
  });

  it("does not offer a connector for a coming-soon provider", () => {
    for (const provider of COMING_SOON_PROVIDERS) {
      expect(getConnector(provider), provider).toBeNull();
    }
  });

  it("never lists a provider as both live and coming soon", () => {
    const overlap = LIVE_PROVIDERS.filter((p) =>
      COMING_SOON_PROVIDERS.includes(p),
    );
    expect(overlap).toEqual([]);
  });
});
