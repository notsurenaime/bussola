import { describe, expect, it, vi } from "vitest";
import { PLANS } from "@/lib/billing/plans";
import type { Entitlements } from "@/lib/billing/entitlements";
import type { McpPrincipal } from "./auth";

/**
 * The MCP tool surface.
 *
 * Entitlements are mocked so the plan branch is exercised without a hosted
 * deployment; everything else runs against a hand-built repository double, so
 * these tests are about what the dispatcher permits rather than about SQL.
 */
const billing = vi.hoisted(() => ({ entitlementsFor: vi.fn() }));

vi.mock("@/lib/billing/entitlements", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/billing/entitlements")>()),
  entitlementsFor: billing.entitlementsFor,
}));

const { TOOLS, callTool } = await import("./tools");

function entitlements(over: Partial<Entitlements> = {}): Entitlements {
  return {
    plan: "team",
    planName: "Team",
    limits: PLANS.team.limits,
    features: PLANS.team.features,
    status: "active",
    active: true,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null,
    extraSeats: 0,
    ...over,
  };
}

const connections = [
  {
    id: "con_1",
    provider: "stripe",
    label: "Main Stripe",
    status: "connected",
    syncEnabled: true,
    lastSyncedAt: new Date("2026-09-01"),
    lastError: null,
    // Present on the row and never expected in any tool's output.
    credentialsEncrypted: "iv.tag.ciphertext",
    organizationId: "org_1",
  },
];

function principal(scope: "read" | "write"): McpPrincipal {
  const repos = {
    ctx: { organizationId: "org_1", userId: "mcp-agent" },
    connections: {
      list: async () => connections,
      get: async (id: string) => connections.find((c) => c.id === id) ?? null,
    },
    dashboards: {
      list: async () => [
        {
          id: "dash_1",
          name: "Ops",
          starred: false,
          updatedAt: new Date("2026-09-01"),
        },
      ],
      get: async (id: string) =>
        id === "dash_1" ? { id: "dash_1", name: "Ops" } : null,
      count: async () => 1,
      create: async (name: string) => ({ id: "dash_2", name }),
      rename: async (id: string, name: string) =>
        id === "dash_1" ? { id, name } : null,
    },
    widgets: {
      listFor: async () => [
        {
          id: "wdg_1",
          widgetType: "stripe-mrr",
          title: "MRR",
          connectionId: null,
          configJson: "{}",
          layoutX: 0,
          layoutY: 0,
          layoutW: 3,
          layoutH: 2,
        },
      ],
      listTypesByDashboard: async () => [
        { dashboardId: "dash_1", widgetType: "stripe-mrr" },
      ],
      countFor: async () => 1,
      nextY: async () => 2,
      add: async (input: { widgetType: string }) => ({
        id: "wdg_2",
        widgetType: input.widgetType,
      }),
      saveLayouts: async () => 1,
      remove: async () => true,
    },
    alertRules: { list: async () => [] },
    alertEvents: { list: async () => [] },
  } as unknown as McpPrincipal["repos"];

  return { tokenId: "tok_1", organizationId: "org_1", scope, repos };
}

describe("tool catalog", () => {
  it("marks exactly the mutating tools as mutating", () => {
    const writers = TOOLS.filter((tool) => tool.mutates).map((t) => t.name);
    expect(writers.sort()).toEqual(
      [
        "add_widget",
        "create_dashboard",
        "move_widget",
        "remove_widget",
        "rename_dashboard",
      ].sort(),
    );
  });

  it("offers no tool that touches credentials or a third-party system", () => {
    // The guarantee the MCP section advertises, asserted rather than promised.
    const forbidden = /credential|token|secret|connect_|restart|resolve|refund/i;
    for (const tool of TOOLS) {
      expect(tool.name).not.toMatch(forbidden);
    }
  });

  it("gives every tool an input schema", () => {
    for (const tool of TOOLS) {
      expect(tool.inputSchema).toMatchObject({ type: "object" });
    }
  });
});

describe("scope enforcement", () => {
  it("refuses a mutating tool to a read-only token", async () => {
    billing.entitlementsFor.mockResolvedValue(entitlements());
    const result = await callTool(principal("read"), "create_dashboard", {
      name: "Nope",
    });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain("read-only");
  });

  it("allows a read tool to a read-only token", async () => {
    const result = await callTool(principal("read"), "list_dashboards", {});
    expect(result.ok).toBe(true);
  });

  it("allows a mutating tool to a write token", async () => {
    billing.entitlementsFor.mockResolvedValue(entitlements());
    const result = await callTool(principal("write"), "create_dashboard", {
      name: "Ops 2",
    });
    expect(result.ok).toBe(true);
  });

  it("refuses an unknown tool", async () => {
    const result = await callTool(principal("write"), "drop_database", {});
    expect(result.ok).toBe(false);
  });
});

describe("list_connections", () => {
  it("never returns the credential ciphertext", async () => {
    const result = await callTool(principal("write"), "list_connections", {});
    expect(result.ok).toBe(true);
    const serialized = JSON.stringify(result.ok && result.data);
    expect(serialized).not.toContain("ciphertext");
    expect(serialized).not.toContain("credentialsEncrypted");
  });

  it("reports sync health, which is the point of listing them", async () => {
    const result = await callTool(principal("read"), "list_connections", {});
    expect(result.ok && result.data).toMatchObject({
      connections: [expect.objectContaining({ status: "connected" })],
    });
  });
});

describe("plan limits apply to agents too", () => {
  it("refuses a dashboard past the plan's allowance", async () => {
    billing.entitlementsFor.mockResolvedValue(
      entitlements({ plan: "trial", planName: "Trial", limits: PLANS.trial.limits }),
    );
    const result = await callTool(principal("write"), "create_dashboard", {
      name: "One too many",
    });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain("Trial");
  });
});

describe("argument handling", () => {
  it("requires the arguments a tool declares", async () => {
    billing.entitlementsFor.mockResolvedValue(entitlements());
    expect((await callTool(principal("write"), "create_dashboard", {})).ok).toBe(
      false,
    );
    expect(
      (await callTool(principal("read"), "get_dashboard", {})).ok,
    ).toBe(false);
  });

  it("reports a dashboard that does not exist rather than inventing one", async () => {
    const result = await callTool(principal("read"), "get_dashboard", {
      dashboardId: "dash_missing",
    });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain("not found");
  });

  it("refuses a widget type that is not in the registry", async () => {
    billing.entitlementsFor.mockResolvedValue(entitlements());
    const result = await callTool(principal("write"), "add_widget", {
      dashboardId: "dash_1",
      widgetType: "made-up-widget",
    });
    expect(result.ok).toBe(false);
  });

  it("refuses to pin a widget to a connection of another provider", async () => {
    billing.entitlementsFor.mockResolvedValue(entitlements());
    const result = await callTool(principal("write"), "add_widget", {
      dashboardId: "dash_1",
      // A Railway widget, pointed at the Stripe connection.
      widgetType: "railway-fleet",
      connectionId: "con_1",
    });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain("railway");
  });

  it("clamps a widget move to the grid instead of rejecting it", async () => {
    billing.entitlementsFor.mockResolvedValue(entitlements());
    const result = await callTool(principal("write"), "move_widget", {
      dashboardId: "dash_1",
      widgetId: "wdg_1",
      x: 99,
      y: -5,
      w: 40,
      h: 0,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects a move with non-numeric coordinates", async () => {
    billing.entitlementsFor.mockResolvedValue(entitlements());
    const result = await callTool(principal("write"), "move_widget", {
      dashboardId: "dash_1",
      widgetId: "wdg_1",
      x: "left",
      y: 0,
      w: 3,
      h: 2,
    });
    expect(result.ok).toBe(false);
  });
});
