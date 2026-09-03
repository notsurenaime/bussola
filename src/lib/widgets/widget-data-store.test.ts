import { describe, expect, it } from "vitest";
import { WIDGET_REGISTRY } from "./registry";
import { providerFor } from "./widget-data-store";

describe("providerFor", () => {
  it("routes each widget type to its provider", () => {
    expect(providerFor("railway-deploys")).toBe("railway");
    expect(providerFor("netlify-forms")).toBe("netlify");
    expect(providerFor("supabase-traffic")).toBe("supabase");
    expect(providerFor("qonto-balance")).toBe("qonto");
    expect(providerFor("qonto-transactions")).toBe("qonto");
    expect(providerFor("status-board")).toBe("status-board");
  });

  it("covers every registered widget type", () => {
    for (const def of WIDGET_REGISTRY) {
      expect(() => providerFor(def.type)).not.toThrow();
      expect(providerFor(def.type)).toBeTruthy();
    }
  });
});
