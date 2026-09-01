import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, encryptionConfigured } from "./vault";

const KEY_ENV = "BUSSOLA_ENCRYPTION_KEY";
let original: string | undefined;

beforeEach(() => {
  original = process.env[KEY_ENV];
});

afterEach(() => {
  if (original === undefined) delete process.env[KEY_ENV];
  else process.env[KEY_ENV] = original;
});

describe("vault", () => {
  it("round-trips a secret with a 64-char hex key", () => {
    process.env[KEY_ENV] = "a".repeat(64);
    const payload = encryptSecret("hunter2");
    expect(payload).not.toContain("hunter2");
    expect(decryptSecret(payload)).toBe("hunter2");
  });

  it("round-trips a secret with an arbitrary passphrase key", () => {
    process.env[KEY_ENV] = "not-hex-just-a-passphrase";
    expect(decryptSecret(encryptSecret("café ☕ unicode"))).toBe("café ☕ unicode");
  });

  it("round-trips using the deterministic local fallback key", () => {
    delete process.env[KEY_ENV];
    expect(decryptSecret(encryptSecret("local"))).toBe("local");
  });

  it("produces a unique IV per call", () => {
    process.env[KEY_ENV] = "b".repeat(64);
    expect(encryptSecret("same")).not.toBe(encryptSecret("same"));
  });

  it("rejects a tampered ciphertext (GCM auth tag)", () => {
    process.env[KEY_ENV] = "c".repeat(64);
    const [iv, tag, data] = encryptSecret("secret").split(".");
    const flipped = Buffer.from(data, "base64");
    flipped[0] ^= 0x01;
    const tampered = [iv, tag, flipped.toString("base64")].join(".");
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("rejects a malformed payload", () => {
    expect(() => decryptSecret("nope")).toThrow(/invalid encrypted payload/i);
  });

  it("cannot decrypt with the wrong key", () => {
    process.env[KEY_ENV] = "d".repeat(64);
    const payload = encryptSecret("secret");
    process.env[KEY_ENV] = "e".repeat(64);
    expect(() => decryptSecret(payload)).toThrow();
  });

  it("reports whether an explicit key is configured", () => {
    process.env[KEY_ENV] = "f".repeat(64);
    expect(encryptionConfigured()).toBe(true);
    delete process.env[KEY_ENV];
    expect(encryptionConfigured()).toBe(false);
  });
});
