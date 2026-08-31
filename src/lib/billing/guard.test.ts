import { describe, expect, it, vi } from "vitest";
import { PLANS } from "./plans";
import type { Entitlements } from "./entitlements";

/**
 * The guard that turns an entitlement into an HTTP answer.
 *
 * `entitlementsFor` is mocked so this exercises the hosted branch without a
 * cloud deployment: the point under test is that a full plan produces a 402
 * carrying a message a customer can act on, not how the plan was looked up.
 */
const entitlements = vi.hoisted(() => ({ entitlementsFor: vi.fn() }));

vi.mock("./entitlements", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./entitlements")>()),
  entitlementsFor: entitlements.entitlementsFor,
}));

const { overLimit } = await import("./guard");

const repos = { ctx: { organizationId: "org_1", userId: "usr_1" } } as never;

function plan(over: Partial<Entitlements> = {}): Entitlements {
  return {
    plan: "free",
    planName: "Free",
    limits: PLANS.free.limits,
    status: "none",
    active: false,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null,
    ...over,
  };
}

describe("overLimit", () => {
  it("lets a request through below the limit", async () => {
    entitlements.entitlementsFor.mockResolvedValue(plan());
    expect(await overLimit(repos, "dashboards", 0)).toBeNull();
  });

  it("answers 402 once the plan is full", async () => {
    entitlements.entitlementsFor.mockResolvedValue(plan());
    const response = await overLimit(
      repos,
      "dashboards",
      PLANS.free.limits.dashboards,
    );

    expect(response).not.toBeNull();
    expect(response!.status).toBe(402);
    await expect(response!.json()).resolves.toMatchObject({
      error: expect.stringContaining("Free"),
    });
  });

  it("names the thing that ran out", async () => {
    entitlements.entitlementsFor.mockResolvedValue(plan());
    const response = await overLimit(
      repos,
      "connections",
      PLANS.free.limits.connections,
    );
    const body = (await response!.json()) as { error: string };
    expect(body.error).toContain("connections");
  });

  it("never blocks an unlimited plan", async () => {
    entitlements.entitlementsFor.mockResolvedValue(
      plan({ plan: "scale", planName: "Scale", limits: PLANS.scale.limits }),
    );
    expect(await overLimit(repos, "connections", 5_000)).toBeNull();
  });

  it("asks for the entitlements of the calling organization only", async () => {
    entitlements.entitlementsFor.mockResolvedValue(plan());
    await overLimit(repos, "dashboards", 0);
    expect(entitlements.entitlementsFor).toHaveBeenCalledWith("org_1");
  });
});
