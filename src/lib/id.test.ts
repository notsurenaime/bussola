import { describe, expect, it } from "vitest";
import { createId } from "./id";

describe("createId", () => {
  it("returns a 16-char lowercase-alnum id with no prefix", () => {
    expect(createId()).toMatch(/^[0-9a-z]{16}$/);
  });

  it("prefixes with an underscore separator", () => {
    expect(createId("con")).toMatch(/^con_[0-9a-z]{16}$/);
  });

  it("is collision-free across many calls", () => {
    const ids = new Set(Array.from({ length: 5000 }, () => createId()));
    expect(ids.size).toBe(5000);
  });
});
