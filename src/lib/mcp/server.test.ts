import { describe, expect, it, vi } from "vitest";
import type { McpPrincipal } from "./auth";

const tools = vi.hoisted(() => ({ callTool: vi.fn() }));

vi.mock("./tools", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./tools")>()),
  callTool: tools.callTool,
}));

const { PROTOCOL_VERSION, handleMessage } = await import("./server");

const principal = {
  tokenId: "tok_1",
  organizationId: "org_1",
  scope: "write",
  repos: {} as McpPrincipal["repos"],
} satisfies McpPrincipal;

const rpc = (method: string, params?: Record<string, unknown>, id: unknown = 1) => ({
  jsonrpc: "2.0" as const,
  id,
  method,
  params,
});

describe("initialize", () => {
  it("answers with the version this server implements", async () => {
    const response = await handleMessage(
      principal,
      rpc("initialize", { protocolVersion: "1999-01-01" }),
    );
    // Not the client's version echoed back: that would be a claim to speak a
    // revision this code has never seen.
    expect(response).toMatchObject({
      result: { protocolVersion: PROTOCOL_VERSION },
    });
  });

  it("declares only the capabilities it actually has", async () => {
    const response = await handleMessage(principal, rpc("initialize"));
    const capabilities = (response as { result: { capabilities: object } })
      .result.capabilities;
    expect(capabilities).toEqual({ tools: {} });
  });
});

describe("notifications", () => {
  it("returns nothing for a notification, so the route can answer 202", async () => {
    expect(
      await handleMessage(principal, {
        jsonrpc: "2.0",
        method: "notifications/initialized",
      }),
    ).toBeNull();
  });
});

describe("tools/list", () => {
  it("lists every tool with a schema and read/write annotations", async () => {
    const response = (await handleMessage(principal, rpc("tools/list"))) as {
      result: { tools: Array<{ name: string; annotations: { readOnlyHint: boolean } }> };
    };
    expect(response.result.tools.length).toBeGreaterThan(5);
    for (const tool of response.result.tools) {
      expect(typeof tool.annotations.readOnlyHint).toBe("boolean");
    }
  });

  it("marks read tools read-only and write tools not", async () => {
    const response = (await handleMessage(principal, rpc("tools/list"))) as {
      result: { tools: Array<{ name: string; annotations: { readOnlyHint: boolean } }> };
    };
    const byName = new Map(response.result.tools.map((t) => [t.name, t]));
    expect(byName.get("list_connections")?.annotations.readOnlyHint).toBe(true);
    expect(byName.get("create_dashboard")?.annotations.readOnlyHint).toBe(false);
  });
});

describe("tools/call", () => {
  it("returns both text and structured content on success", async () => {
    tools.callTool.mockResolvedValue({ ok: true, data: { mrr: 1234 } });
    const response = (await handleMessage(
      principal,
      rpc("tools/call", { name: "read_widget_data", arguments: {} }),
    )) as { result: { isError: boolean; structuredContent: unknown; content: unknown[] } };

    expect(response.result.isError).toBe(false);
    expect(response.result.structuredContent).toEqual({ mrr: 1234 });
    expect(response.result.content).toHaveLength(1);
  });

  it("reports a tool failure as isError, not as a protocol error", async () => {
    // The distinction a model acts on: a protocol error means the connection
    // is broken, while isError is an answer it can read and recover from.
    tools.callTool.mockResolvedValue({ ok: false, error: "Dashboard not found" });
    const response = (await handleMessage(
      principal,
      rpc("tools/call", { name: "get_dashboard", arguments: { dashboardId: "x" } }),
    )) as { result: { isError: boolean }; error?: unknown };

    expect(response.error).toBeUndefined();
    expect(response.result.isError).toBe(true);
  });

  it("rejects a call with no tool name at the protocol level", async () => {
    const response = (await handleMessage(principal, rpc("tools/call", {}))) as {
      error: { code: number };
    };
    expect(response.error.code).toBe(-32600);
  });

  it("passes arguments through, defaulting a missing bag to empty", async () => {
    tools.callTool.mockResolvedValue({ ok: true, data: {} });
    await handleMessage(principal, rpc("tools/call", { name: "list_dashboards" }));
    expect(tools.callTool).toHaveBeenCalledWith(principal, "list_dashboards", {});
  });

  it("turns a thrown tool into an internal error rather than a crash", async () => {
    tools.callTool.mockRejectedValue(new Error("boom"));
    const response = (await handleMessage(
      principal,
      rpc("tools/call", { name: "list_dashboards" }),
    )) as { error: { code: number } };
    expect(response.error.code).toBe(-32603);
  });
});

describe("malformed input", () => {
  it("rejects a message that is not a JSON-RPC request", async () => {
    for (const message of [null, "hello", 42, [], { jsonrpc: "2.0" }]) {
      const response = (await handleMessage(principal, message)) as {
        error: { code: number };
      };
      expect(response.error.code).toBe(-32600);
    }
  });

  it("reports an unknown method", async () => {
    const response = (await handleMessage(principal, rpc("resources/list"))) as {
      error: { code: number };
    };
    expect(response.error.code).toBe(-32601);
  });

  it("echoes the request id back, including a string one", async () => {
    const response = (await handleMessage(
      principal,
      rpc("ping", undefined, "abc"),
    )) as { id: string };
    expect(response.id).toBe("abc");
  });
});
