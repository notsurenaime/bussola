import { getSessionUser } from "@/lib/auth/session";
import { cachedFetch } from "@/lib/cache";
import { jsonError, jsonOk, unauthorized } from "@/lib/api";
import {
  fetchNetlifyDashboard,
  fetchQontoDashboard,
  fetchQontoTransactionsPage,
  fetchRailwayDashboard,
  fetchSupabaseDashboard,
  getConnectionByProvider,
  parseCredentials,
} from "@/lib/connectors";
import { toUserFacingError } from "@/lib/connectors/errors";
import {
  isNetlifyWidget,
  isQontoWidget,
  isRailwayWidget,
  isSupabaseWidget,
  type WidgetType,
} from "@/lib/widgets/registry";

export const runtime = "nodejs";

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

async function loadQontoDashboard(connectionId: string, encrypted: string) {
  const credentials = parseCredentials(encrypted);
  const { data } = await cachedFetch(`qonto-dashboard:${connectionId}`, 60, () =>
    fetchQontoDashboard(credentials),
  );
  return data;
}

async function loadRailwayDashboard(connectionId: string, encrypted: string) {
  const credentials = parseCredentials(encrypted);
  const { data } = await cachedFetch(
    `railway-dashboard:${connectionId}`,
    45,
    () => fetchRailwayDashboard(credentials.apiKey || ""),
  );
  return data;
}

async function loadSupabaseDashboard(connectionId: string, encrypted: string) {
  const credentials = parseCredentials(encrypted);
  const { data } = await cachedFetch(
    `supabase-dashboard:${connectionId}`,
    60,
    () => fetchSupabaseDashboard(credentials.apiKey || ""),
  );
  return data;
}

async function loadNetlifyDashboard(connectionId: string, encrypted: string) {
  const credentials = parseCredentials(encrypted);
  const { data } = await cachedFetch(
    `netlify-dashboard:${connectionId}`,
    45,
    () => fetchNetlifyDashboard(credentials.apiKey || ""),
  );
  return data;
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

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
        const conn = getConnectionByProvider("railway");
        if (!conn) return needsConnection("railway");
        const data = await loadRailwayDashboard(
          conn.id,
          conn.credentialsEncrypted,
        );
        return jsonOk(data);
      }
      case "netlify-tracker":
      case "netlify-sites":
      case "netlify-health":
      case "netlify-deploys":
      case "netlify-builds":
      case "netlify-forms": {
        const conn = getConnectionByProvider("netlify");
        if (!conn) return needsConnection("netlify");
        const data = await loadNetlifyDashboard(
          conn.id,
          conn.credentialsEncrypted,
        );
        return jsonOk(data);
      }
      case "supabase-health":
      case "supabase-projects":
      case "supabase-services":
      case "supabase-traffic":
      case "supabase-requests":
      case "supabase-advisors": {
        const conn = getConnectionByProvider("supabase");
        if (!conn) return needsConnection("supabase");
        const data = await loadSupabaseDashboard(
          conn.id,
          conn.credentialsEncrypted,
        );
        return jsonOk(data);
      }
      case "qonto-transactions": {
        const conn = getConnectionByProvider("qonto");
        if (!conn) return needsConnection("qonto");
        const credentials = parseCredentials(conn.credentialsEncrypted);
        const limit = Number(searchParams.get("limit") || "20");
        const cursor = searchParams.get("cursor");
        const cacheKey = `qonto-tx:${conn.id}:${cursor || "start"}:${limit}`;
        const { data } = await cachedFetch(cacheKey, 30, () =>
          fetchQontoTransactionsPage(credentials, {
            cursor,
            limit: Number.isFinite(limit) ? limit : 20,
          }),
        );
        return jsonOk(data);
      }
      case "qonto-balance":
      case "qonto-cashflow":
      case "qonto-in-out":
      case "qonto-liquidity":
      case "qonto-accounts":
      case "qonto-history": {
        const conn = getConnectionByProvider("qonto");
        if (!conn) return needsConnection("qonto");
        const data = await loadQontoDashboard(
          conn.id,
          conn.credentialsEncrypted,
        );
        return jsonOk(data);
      }
      case "status-board": {
        const railwayConn = getConnectionByProvider("railway");
        const netlifyConn = getConnectionByProvider("netlify");
        const supabaseConn = getConnectionByProvider("supabase");

        if (!railwayConn && !netlifyConn && !supabaseConn) {
          return needsConnection("multi");
        }

        const empty = { items: [] as never[] };
        const [railway, netlify, supabase] = await Promise.all([
          railwayConn
            ? loadRailwayDashboard(
                railwayConn.id,
                railwayConn.credentialsEncrypted,
              )
                .then((data) => ({ items: data.items }))
                .catch(() => empty)
            : Promise.resolve(empty),
          netlifyConn
            ? loadNetlifyDashboard(
                netlifyConn.id,
                netlifyConn.credentialsEncrypted,
              )
                .then((data) => ({ items: data.items }))
                .catch(() => empty)
            : Promise.resolve(empty),
          supabaseConn
            ? loadSupabaseDashboard(
                supabaseConn.id,
                supabaseConn.credentialsEncrypted,
              )
                .then((data) => ({ items: data.items }))
                .catch(() => empty)
            : Promise.resolve(empty),
        ]);

        return jsonOk({
          items: [
            ...railway.items.slice(0, 8),
            ...netlify.items.slice(0, 8),
            ...supabase.items.slice(0, 8),
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
}
