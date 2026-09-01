import { describe, expect, it } from "vitest";
import { deployStage, rawStatusLabel, statusColor } from "./railway";

describe("statusColor", () => {
  it("maps known raw statuses to tones", () => {
    expect(statusColor("SUCCESS")).toBe("ok");
    expect(statusColor("CRASHED")).toBe("error");
    expect(statusColor("FAILED")).toBe("warn");
    expect(statusColor("BUILDING")).toBe("warn");
    expect(statusColor("QUEUED")).toBe("warn");
    expect(statusColor("SLEEPING")).toBe("idle");
    expect(statusColor("REMOVED")).toBe("idle");
    expect(statusColor("SKIPPED")).toBe("idle");
  });

  it("is case-insensitive and defaults unknown to idle", () => {
    expect(statusColor("success")).toBe("ok");
    expect(statusColor("WHAT_IS_THIS")).toBe("idle");
    expect(statusColor("")).toBe("idle");
  });
});

describe("rawStatusLabel", () => {
  it("returns the friendly label for known statuses", () => {
    expect(rawStatusLabel("SUCCESS")).toBe("Running");
    expect(rawStatusLabel("INITIALIZING")).toBe("Starting");
    expect(rawStatusLabel("REMOVING")).toBe("Removed");
    expect(rawStatusLabel("SLEEPING")).toBe("Sleeping");
  });

  it("falls back to a tone-derived label for unknown statuses", () => {
    expect(rawStatusLabel("MYSTERY")).toBe("Idle");
  });
});

describe("deployStage", () => {
  it("derives a stage from the status", () => {
    expect(deployStage("SUCCESS")).toBe("Running");
    expect(deployStage("CRASHED")).toBe("Crashed at runtime");
    expect(deployStage("BUILDING")).toBe("Building");
  });

  it("refines FAILED using the meta reason", () => {
    expect(deployStage("FAILED", { reason: "build step exploded" })).toBe(
      "Build failed",
    );
    expect(deployStage("FAILED", { error: "healthcheck timed out" })).toBe(
      "Healthcheck failed",
    );
    expect(deployStage("FAILED", { failureReason: "deploy rejected" })).toBe(
      "Deploy failed",
    );
    expect(deployStage("FAILED")).toBe("Failed to ship");
  });

  it("falls back to the raw label for unknown statuses", () => {
    expect(deployStage("NONSENSE")).toBe("Idle");
  });
});
