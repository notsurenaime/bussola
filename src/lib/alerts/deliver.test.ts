import { describe, expect, it } from "vitest";
import { validateChannelTarget } from "./deliver";

describe("validateChannelTarget", () => {
  describe("email", () => {
    it("accepts an ordinary address", () => {
      expect(validateChannelTarget("email", "alerts@example.com")).toEqual({
        ok: true,
      });
    });

    it("rejects something with no @", () => {
      const result = validateChannelTarget("email", "alerts.example.com");
      expect(result.ok).toBe(false);
    });

    it("rejects empty input", () => {
      expect(validateChannelTarget("email", "   ").ok).toBe(false);
    });
  });

  describe("slack", () => {
    it("accepts the real webhook host", () => {
      expect(
        validateChannelTarget(
          "slack",
          "https://hooks.slack.com/services/T00/B00/xxxx",
        ),
      ).toEqual({ ok: true });
    });

    it("rejects another host", () => {
      // The property under test: these fields take a URL Bussola will POST to,
      // so accepting an arbitrary host would turn the alert engine into a
      // request forwarder pointed wherever a tenant likes.
      const result = validateChannelTarget(
        "slack",
        "https://internal.example.com/webhook",
      );
      expect(result.ok).toBe(false);
    });

    it("rejects a lookalike subdomain", () => {
      const result = validateChannelTarget(
        "slack",
        "https://hooks.slack.com.evil.example/services/x",
      );
      expect(result.ok).toBe(false);
    });

    it("rejects plain http", () => {
      const result = validateChannelTarget(
        "slack",
        "http://hooks.slack.com/services/x",
      );
      expect(result.ok).toBe(false);
    });

    it("rejects a non-URL", () => {
      expect(validateChannelTarget("slack", "not a url").ok).toBe(false);
    });
  });

  describe("discord", () => {
    it("accepts both hosts Discord uses", () => {
      expect(
        validateChannelTarget("discord", "https://discord.com/api/webhooks/1/x")
          .ok,
      ).toBe(true);
      expect(
        validateChannelTarget(
          "discord",
          "https://discordapp.com/api/webhooks/1/x",
        ).ok,
      ).toBe(true);
    });

    it("rejects another host", () => {
      expect(
        validateChannelTarget("discord", "https://example.com/api/webhooks/1/x")
          .ok,
      ).toBe(false);
    });
  });
});
