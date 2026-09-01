import {
  fetchLemonSqueezyDashboard,
  fetchNetlifyDashboard,
  fetchQontoDashboard,
  fetchRailwayDashboard,
  fetchResendDashboard,
  fetchSentryDashboard,
  fetchStripeDashboard,
  fetchSupabaseDashboard,
  fetchVercelDashboard,
  type ConnectionCredentials,
} from "@/lib/connectors";
import type { Provider } from "@/lib/providers";

/**
 * How to produce a provider's dashboard snapshot. Providers absent from this
 * map have no live connector yet and are never scheduled.
 */
const FETCHERS: Partial<
  Record<Provider, (credentials: ConnectionCredentials) => Promise<unknown>>
> = {
  railway: (c) => fetchRailwayDashboard(c.apiKey || ""),
  netlify: (c) => fetchNetlifyDashboard(c.apiKey || ""),
  supabase: (c) => fetchSupabaseDashboard(c.apiKey || ""),
  qonto: (c) => fetchQontoDashboard(c),
  stripe: (c) => fetchStripeDashboard(c),
  lemonsqueezy: (c) => fetchLemonSqueezyDashboard(c),
  sentry: (c) => fetchSentryDashboard(c),
  resend: (c) => fetchResendDashboard(c),
  vercel: (c) => fetchVercelDashboard(c),
};

export function isSyncable(provider: string): provider is Provider {
  return provider in FETCHERS;
}

export async function fetchDashboardSnapshot(
  provider: Provider,
  credentials: ConnectionCredentials,
): Promise<unknown> {
  const fetcher = FETCHERS[provider];
  if (!fetcher) {
    throw new Error(`No connector for provider "${provider}"`);
  }
  return fetcher(credentials);
}
