import { createHash, randomBytes, timingSafeEqual } from "crypto";

/**
 * Tokens that stand in for a session.
 *
 * A share link and an API token are both bearer credentials: whoever holds the
 * string is the caller. So neither is ever stored — only its SHA-256 — and the
 * plaintext is returned exactly once, at creation. A database that leaks then
 * hands out no working links, which is the property that makes a link safe to
 * paste into a chat window in the first place.
 *
 * SHA-256 rather than a password hash on purpose: these are 256 bits of
 * `randomBytes`, not something a person chose, so there is no dictionary to
 * attack and nothing for a slow KDF to buy. What matters instead is that the
 * comparison is constant-time and that lookups stay a single indexed read.
 */

/** 32 bytes, base64url: 256 bits of entropy in 43 characters. */
const TOKEN_BYTES = 32;

/** Enough to recognise a token in a list, too little to help guess one. */
const PREFIX_LENGTH = 8;

export type MintedToken = {
  /** Shown once. Never stored, never recoverable. */
  token: string;
  hash: string;
  prefix: string;
};

export function mintToken(namespace: "shr" | "bsk"): MintedToken {
  const token = `${namespace}_${randomBytes(TOKEN_BYTES).toString("base64url")}`;
  return {
    token,
    hash: hashToken(token),
    prefix: token.slice(0, namespace.length + 1 + PREFIX_LENGTH),
  };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Compare two hashes without leaking how far they matched.
 *
 * The lookup itself is by hash, so this guards the last step rather than the
 * query — but a route that ever compares in the other direction (fetch a row,
 * then check its hash) gets the safe comparison for free by using this.
 */
export function tokensMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Reject anything that cannot be one of our tokens before it reaches the
 * database — a URL path segment is attacker-controlled and there is no reason
 * to turn a 4KB one into a query.
 */
export function looksLikeToken(value: string): boolean {
  return /^(shr|bsk)_[A-Za-z0-9_-]{20,64}$/.test(value);
}
