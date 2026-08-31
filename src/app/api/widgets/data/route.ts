import { jsonError, jsonOk, withTenant } from "@/lib/api";
import {
  fetchNetlifyDashboard,
  fetchQontoDashboard,
  fetchQontoTransactionsPage,
  fetchRailwayDashboard,
  fetchSupabaseDashboard,
  parseCredentials,
} from "@/lib/connectors";
import { toUserFacingError } from "@/lib/connectors/errors";
import type { TenantRepos } from "@/lib/db/tenant";
import type { Provider } from "@/lib/providers";
import {
  isNetlifyWidget,
  isQontoWidget,
  isRailwayWidget,
  isSupabaseWidget,
  type WidgetType,
} from "@/lib/widgets/registry";

export const runtime = "nodejs";

/** TTL per provider dashboard, in seconds. */
const TTL: Record<Provider | "qonto-tx", number> = {
  railway: 45,
  netlify: 45,
  supabase: 60,
  qonto: 60,
  "qonto-tx": 30,
  stripe: 60,
  polar: 60,
  attio: 60,
  vercel: 60,
  webtraffic: 60,
};

function needsConnection(provider: string) {
  return jsonOk({
    needsConnection: true,
    provider,
    items: [],
    trackers: {},
    balances: [],
    transactions: [],
    healthy: 0,
    total: 0,
  });
}

/**
 * Load a provider's dashboard for the calling tenant, through that tenant's
 * cache namespace. Returns null when the tenant has not connected the provider.
 */
async function loadDashboard<T>(
  repos: TenantRepos,
  provider: Provider,
  fetcher: (credentials: ReturnType<typeof parseCredentials>) => Promise<T>,
): Promise<T | null> {
  const conn = await repos.connections.byProvider(provider);
  if (!conn) return null;

  const credentials = parseCredentials(conn.credentialsEncrypted);
  const { data } = await repos.cache.fetch(
    `${provider}-dashboard:${conn.id}`,
    TTL[provider],
    () => fetcher(credentials),
  );
  return data;
}

export async function GET(request: Request) {
  return withTenant(async (repos) => {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") as WidgetType | null;
    if (!type) return jsonError("type required");

    try {
      switch (type) {
        case "railway-tracker":
        case "railway-services":
        case "railway-fleet":
        case "railway-resources":
        case "railway-usage":
        case "railway-deploys": {
          const data = await loadDashboard(repos, "railway", (c) =>
            fetchRailwayDashboard(c.apiKey || ""),
          );
          return data ? jsonOk(data) : needsConnection("railway");
        }
        case "netlify-tracker":
        case "netlify-sites":
        case "netlify-health":
        case "netlify-deploys":
        case "netlify-builds":
        case "netlify-forms": {
          const data = await loadDashboard(repos, "netlify", (c) =>
            fetchNetlifyDashboard(c.apiKey || ""),
          );
          return data ? jsonOk(data) : needsConnection("netlify");
        }
        case "supabase-health":
        case "supabase-projects":
        case "supabase-services":
        case "supabase-traffic":
        case "supabase-requests":
        case "supabase-advisors": {
          const data = await loadDashboard(repos, "supabase", (c) =>
            fetchSupabaseDashboard(c.apiKey || ""),
          );
          return data ? jsonOk(data) : needsConnection("supabase");
        }
        case "qonto-balance":
        case "qonto-cashflow":
        case "qonto-in-out":
        case "qonto-liquidity":
        case "qonto-accounts":
        case "qonto-history": {
          const data = await loadDashboard(repos, "qonto", (c) =>
            fetchQontoDashboard(c),
          );
          return data ? jsonOk(data) : needsConnection("qonto");
        }
        case "qonto-transactions": {
          const conn = await repos.connections.byProvider("qonto");
          if (!conn) return needsConnection("qonto");

          const credentials = parseCredentials(conn.credentialsEncrypted);
          const parsedLimit = Number(searchParams.get("limit") || "20");
          const limit = Number.isFinite(parsedLimit) ? parsedLimit : 20;
          const cursor = searchParams.get("cursor");

          const { data } = await repos.cache.fetch(
            `qonto-tx:${conn.id}:${cursor || "start"}:${limit}`,
            TTL["qonto-tx"],
            () => fetchQontoTransactionsPage(credentials, { cursor, limit }),
          );
          return jsonOk(data);
        }
        case "status-board": {
          const [railway, netlify, supabase] = await Promise.all([
            loadDashboard(repos, "railway", (c) =>
              fetchRailwayDashboard(c.apiKey || ""),
            ).catch(() => null),
            loadDashboard(repos, "netlify", (c) =>
              fetchNetlifyDashboard(c.apiKey || ""),
            ).catch(() => null),
            loadDashboard(repos, "supabase", (c) =>
              fetchSupabaseDashboard(c.apiKey || ""),
            ).catch(() => null),
          ]);

          if (!railway && !netlify && !supabase) {
            return needsConnection("multi");
          }

          return jsonOk({
            items: [
              ...(railway?.items ?? []).slice(0, 8),
              ...(netlify?.items ?? []).slice(0, 8),
              ...(supabase?.items ?? []).slice(0, 8),
            ],
          });
        }
        default: {
          const _exhaustive: never = type;
          return jsonError(`Unknown widget type: ${_exhaustive}`);
        }
      }
    } catch (error) {
      const provider = isRailwayWidget(type)
        ? "railway"
        : isNetlifyWidget(type)
          ? "netlify"
          : isSupabaseWidget(type)
            ? "supabase"
            : isQontoWidget(type)
              ? "qonto"
              : undefined;
      return jsonError(toUserFacingError(error, provider), 502);
    }
  });
}
