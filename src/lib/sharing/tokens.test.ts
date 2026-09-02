import { describe, expect, it } from "vitest";
import { hashToken, looksLikeToken, mintToken, tokensMatch } from "./tokens";

describe("mintToken", () => {
  it("namespaces the token so its purpose is visible", () => {
    expect(mintToken("shr").token.startsWith("shr_")).toBe(true);
    expect(mintToken("bsk").token.startsWith("bsk_")).toBe(true);
  });

  it("never repeats", () => {
    const seen = new Set(
      Array.from({ length: 200 }, () => mintToken("shr").token),
    );
    expect(seen.size).toBe(200);
  });

  it("returns a hash that matches the plaintext", () => {
    const minted = mintToken("shr");
    expect(minted.hash).toBe(hashToken(minted.token));
  });

  it("does not embed the token in its own hash", () => {
    // The regression that would matter: storing anything from which the
    // plaintext could be recovered defeats the point of hashing at all.
    const minted = mintToken("shr");
    expect(minted.hash).not.toContain(minted.token.slice(4));
  });

  it("keeps a prefix short enough not to help a guess", () => {
    const minted = mintToken("shr");
    expect(minted.prefix.length).toBe("shr_".length + 8);
    expect(minted.token.startsWith(minted.prefix)).toBe(true);
  });
});

describe("hashToken", () => {
  it("is stable", () => {
    expect(hashToken("shr_abc")).toBe(hashToken("shr_abc"));
  });

  it("differs for different tokens", () => {
    expect(hashToken("shr_abc")).not.toBe(hashToken("shr_abd"));
  });
});

describe("tokensMatch", () => {
  it("matches identical values", () => {
    expect(tokensMatch("abc", "abc")).toBe(true);
  });

  it("rejects different values", () => {
    expect(tokensMatch("abc", "abd")).toBe(false);
  });

  it("rejects different lengths without throwing", () => {
    // timingSafeEqual throws on a length mismatch, so this has to be handled
    // before the comparison rather than by it.
    expect(() => tokensMatch("abc", "abcd")).not.toThrow();
    expect(tokensMatch("abc", "abcd")).toBe(false);
  });
});

describe("looksLikeToken", () => {
  it("accepts what mintToken produces", () => {
    expect(looksLikeToken(mintToken("shr").token)).toBe(true);
    expect(looksLikeToken(mintToken("bsk").token)).toBe(true);
  });

  it("rejects an unknown namespace", () => {
    expect(looksLikeToken("xyz_aaaaaaaaaaaaaaaaaaaaaa")).toBe(false);
  });

  it("rejects path traversal and injection shapes before they reach a query", () => {
    expect(looksLikeToken("../../etc/passwd")).toBe(false);
    expect(looksLikeToken("shr_'; drop table users; --")).toBe(false);
    expect(looksLikeToken("")).toBe(false);
  });

  it("rejects something far too long to be one of ours", () => {
    expect(looksLikeToken(`shr_${"a".repeat(500)}`)).toBe(false);
  });
});
