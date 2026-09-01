import { describe, expect, it } from "vitest";
import { WIDGET_REGISTRY } from "./registry";
import { bucketFor } from "./widget-data-store";

describe("bucketFor", () => {
  it("routes each widget type to its provider bucket", () => {
    expect(bucketFor("railway-deploys")).toBe("railway");
    expect(bucketFor("netlify-forms")).toBe("netlify");
    expect(bucketFor("supabase-traffic")).toBe("supabase");
    expect(bucketFor("qonto-balance")).toBe("qonto");
    expect(bucketFor("qonto-transactions")).toBe("qonto");
    expect(bucketFor("status-board")).toBe("status-board");
  });

  it("covers every registered widget type", () => {
    for (const def of WIDGET_REGISTRY) {
      expect(() => bucketFor(def.type)).not.toThrow();
      expect(bucketFor(def.type)).toBeTruthy();
    }
  });
});
