/**
 * The data sources Bussola can connect to.
 *
 * Lives outside `lib/db` because it is a domain type, not a storage detail:
 * pages and route handlers need it, and they are barred from importing the
 * schema module.
 */
export type Provider =
  | "railway"
  | "netlify"
  | "supabase"
  | "qonto"
  | "stripe"
  | "polar"
  | "attio"
  | "vercel"
  | "webtraffic";

export type ConnectionStatus = "connected" | "error" | "unknown";
