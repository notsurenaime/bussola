/**
 * The data sources Bussola can connect to.
 *
 * Lives outside `lib/db` because it is a domain type, not a storage detail:
 * pages and route handlers need it, and they are barred from importing the
 * schema module.
 */
export type Provider =
  // Wave 1 — API-key based, no OAuth round trip
  | "railway"
  | "supabase"
  | "qonto"
  | "stripe"
  | "resend"
  | "sentry"
  | "lemonsqueezy"
  | "vercel"
  | "netlify"
  // Wave 2 — need an OAuth app
  | "github"
  | "gitlab"
  | "linear"
  | "notion"
  // Planned, not scheduled
  | "polar"
  | "attio"
  | "webtraffic";

export type ConnectionStatus = "connected" | "error" | "unknown";

/** Which credential fields a provider's connect form should ask for. */
export type CredentialField =
  | "apiKey"
  | "login"
  | "secretKey"
  | "orgSlug";
