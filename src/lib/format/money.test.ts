import { describe, expect, it } from "vitest";
import { formatMoney, formatSignedMoney } from "./money";

describe("formatMoney", () => {
  it("formats a EUR amount with two fraction digits", () => {
    const out = formatMoney(1234.5);
    expect(out).toMatch(/1.234[.,]50/);
    expect(out).toMatch(/€|EUR/);
  });

  it("honours an explicit currency", () => {
    expect(formatMoney(10, "USD")).toMatch(/\$|USD/);
  });

  it("passes through Intl options", () => {
    expect(formatMoney(10, "EUR", { maximumFractionDigits: 0 })).not.toMatch(
      /[.,]00/,
    );
  });
});

describe("formatSignedMoney", () => {
  it("prefixes a plus sign for positive amounts", () => {
    expect(formatSignedMoney(5).startsWith("+")).toBe(true);
  });

  it("prefixes a minus sign for negative amounts", () => {
    expect(formatSignedMoney(-5).startsWith("−")).toBe(true);
  });

  it("leaves zero unsigned", () => {
    const out = formatSignedMoney(0);
    expect(out.startsWith("+")).toBe(false);
    expect(out.startsWith("−")).toBe(false);
  });
});
