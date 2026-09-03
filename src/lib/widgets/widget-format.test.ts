import { describe, expect, it } from "vitest";
import { formatRate, relativeAge, toneBadgeVariant } from "./widget-format";

describe("relativeAge", () => {
  const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
  const MIN = 60_000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;

  it("steps up through the units", () => {
    expect(relativeAge(ago(30 * 1000))).toBe("just now");
    expect(relativeAge(ago(5 * MIN))).toBe("5m ago");
    expect(relativeAge(ago(8 * HOUR))).toBe("8h ago");
    expect(relativeAge(ago(10 * DAY))).toBe("10d ago");
    expect(relativeAge(ago(75 * DAY))).toBe("2mo ago");
    expect(relativeAge(ago(400 * DAY))).toBe("1y ago");
  });

  it("switches unit at the boundary rather than saying 60m", () => {
    expect(relativeAge(ago(59 * MIN))).toBe("59m ago");
    expect(relativeAge(ago(HOUR))).toBe("1h ago");
    expect(relativeAge(ago(23 * HOUR))).toBe("23h ago");
    expect(relativeAge(ago(DAY))).toBe("1d ago");
  });

  it("does not count into the future when clocks disagree", () => {
    expect(relativeAge(new Date(Date.now() + 5 * MIN).toISOString())).toBe(
      "just now",
    );
  });

  it("returns null for anything unusable", () => {
    expect(relativeAge(undefined)).toBeNull();
    expect(relativeAge(null)).toBeNull();
    expect(relativeAge("")).toBeNull();
    expect(relativeAge("not a date")).toBeNull();
  });
});

describe("formatRate", () => {
  it("keeps a decimal only when it carries information", () => {
    expect(formatRate(100)).toBe("100%");
    expect(formatRate(0)).toBe("0%");
    expect(formatRate(70.37)).toBe("70.4%");
    expect(formatRate(3.7)).toBe("3.7%");
  });
});

describe("toneBadgeVariant", () => {
  it("gives every tone a distinct colour", () => {
    expect(toneBadgeVariant("ok")).toBe("success");
    expect(toneBadgeVariant("warn")).toBe("warning");
    expect(toneBadgeVariant("error")).toBe("destructive");
    expect(toneBadgeVariant("idle")).toBe("secondary");
  });
});
