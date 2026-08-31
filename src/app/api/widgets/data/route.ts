import { jsonError, jsonOk, withTenant } from "@/lib/api";
import { fetchQontoTransactionsPage, parseCredentials } from "@/lib/connectors";
import { toUserFacingError } from "@/lib/connectors/errors";
import type { TenantRepos } from "@/lib/db/tenant";
import {
  demoDashboard,
  demoStatusBoard,
  demoTransactions,
} from "@/lib/demo/fixtures";
import type { Provider } from "@/lib/providers";
import { SYNC_INTERVAL_SECONDS } from "@/lib/sync/config";
import { syncNow } from "@/lib/sync/runner";
import {
  isLemonSqueezyWidget,
  isNetlifyWidget,
  isQontoWidget,
  isRailwayWidget,
  isResendWidget,
  isSentryWidget,
  isStripeWidget,
  isSupabaseWidget,
  isVercelWidget,
  type WidgetType,
} from "@/lib/widgets/registry";

export const runtime = "nodejs";

/** A snapshot older than this many intervals is reported as stale. */
const STALE_AFTER_INTERVALS = 3;

/** Transactions are paginated and read straight through, so keep a short TTL. */
const TRANSACTIONS_TTL_SECONDS = 30;

/**
 * What a widget shows before its source is connected.
 *
 * A grid of empty boxes makes a new account look broken rather than new, so an
 * unconnected provider renders sample data instead — the same components, the
 * same shapes, plausible numbers. `_demo` is what makes it unmistakable: the
 * frame labels it and links to Connections, so nobody reads these as their own
 * figures. Providers without fixtures fall back to the empty state.
 */
function notConnected(provider: Provider | "multi") {
  const demo =
    provider === "multi" ? demoStatusBoard() : demoDashboard(provider);

  if (demo) {
    return jsonOk({ ...demo, _demo: true, provider });
  }

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
 * Serve a provider's dashboard from the snapshot the sync worker stored.
 *
 * This request never calls a provider — with one exception. A connection that
 * has just been added has no snapshot yet, and waiting for the next worker tick
 * would leave the user staring at a spinner, so the first read after connecting
 * syncs inline. Every read after that is a single local query, which is what
 * decouples upstream traffic from the number of people looking at dashboards.
 */
async function serveDashboard(repos: TenantRepos, provider: Provider) {
  let snapshot = await repos.snapshots.forProvider(provider);
  if (!snapshot) return notConnected(provider);

  if (!snapshot.payload) {
    await syncNow(snapshot.connectionId);
    snapshot = await repos.snapshots.forProvider(provider);
  }

  if (!snapshot?.payload) {
    return jsonError(
      snapshot?.lastError || "Could not load data for this source.",
      502,
    );
  }

  const intervalMs = (SYNC_INTERVAL_SECONDS[provider] ?? 120) * 1000;
  const ageMs = Date.now() - new Date(snapshot.fetchedAt!).getTime();

  return jsonOk({
    ...snapshot.payload,
    _sync: {
      fetchedAt: snapshot.fetchedAt,
      stale: ageMs > intervalMs * STALE_AFTER_INTERVALS,
      // Sync gave up on this connection; the credentials likely need replacing.
      disabled: !snapshot.syncEnabled,
      lastError: snapshot.lastError,
    },
  });
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
        case "railway-deploys":
          return await serveDashboard(repos, "railway");

        case "netlify-tracker":
        case "netlify-sites":
        case "netlify-health":
        case "netlify-deploys":
        case "netlify-builds":
        case "netlify-forms":
          return await serveDashboard(repos, "netlify");

        case "supabase-health":
        case "supabase-projects":
        case "supabase-services":
        case "supabase-traffic":
        case "supabase-requests":
        case "supabase-advisors":
          return await serveDashboard(repos, "supabase");

        case "stripe-mrr":
        case "stripe-revenue":
        case "stripe-payments":
          return await serveDashboard(repos, "stripe");

        case "lemonsqueezy-mrr":
        case "lemonsqueezy-revenue":
        case "lemonsqueezy-orders":
          return await serveDashboard(repos, "lemonsqueezy");

        case "sentry-issues":
        case "sentry-recent":
        case "sentry-projects":
          return await serveDashboard(repos, "sentry");

        case "resend-domains":
        case "resend-emails":
          return await serveDashboard(repos, "resend");

        case "vercel-tracker":
        case "vercel-projects":
        case "vercel-deploys":
          return await serveDashboard(repos, "vercel");

        case "qonto-balance":
        case "qonto-cashflow":
        case "qonto-in-out":
        case "qonto-liquidity":
        case "qonto-accounts":
        case "qonto-history":
          return await serveDashboard(repos, "qonto");

        case "qonto-transactions": {
          // Cursor pagination cannot be snapshotted usefully — each page is a
          // distinct, user-driven request — so this one path still reads
          // through to Qonto, behind the per-tenant cache.
          const conn = await repos.connections.byProvider("qonto");
          if (!conn) return jsonOk({ ...demoTransactions(), _demo: true });

          const credentials = parseCredentials(conn.credentialsEncrypted);
          const parsedLimit = Number(searchParams.get("limit") || "20");
          const limit = Number.isFinite(parsedLimit) ? parsedLimit : 20;
          const cursor = searchParams.get("cursor");

          const { data } = await repos.cache.fetch(
            `qonto-tx:${conn.id}:${cursor || "start"}:${limit}`,
            TRANSACTIONS_TTL_SECONDS,
            () => fetchQontoTransactionsPage(credentials, { cursor, limit }),
          );
          return jsonOk(data);
        }

        case "status-board": {
          const [railway, netlify, supabase] = await Promise.all([
            repos.snapshots.forProvider("railway"),
            repos.snapshots.forProvider("netlify"),
            repos.snapshots.forProvider("supabase"),
          ]);

          if (!railway && !netlify && !supabase) {
            return notConnected("multi");
          }

          const itemsOf = (
            snapshot: Awaited<
              ReturnType<TenantRepos["snapshots"]["forProvider"]>
            >,
          ) => {
            const items = snapshot?.payload?.items;
            return Array.isArray(items) ? items.slice(0, 8) : [];
          };

          return jsonOk({
            items: [
              ...itemsOf(railway),
              ...itemsOf(netlify),
              ...itemsOf(supabase),
            ],
          });
        }

        default: {
          const _exhaustive: never = type;
          return jsonError(`Unknown widget type: ${_exhaustive}`);
        }
      }
    } catch (error) {
      const provider = providerForWidget(type);
      return jsonError(toUserFacingError(error, provider), 502);
    }
  });
}

/** Which provider a widget belongs to, for turning an error into its wording. */
function providerForWidget(type: WidgetType): Provider | undefined {
  if (isRailwayWidget(type)) return "railway";
  if (isNetlifyWidget(type)) return "netlify";
  if (isSupabaseWidget(type)) return "supabase";
  if (isQontoWidget(type)) return "qonto";
  if (isStripeWidget(type)) return "stripe";
  if (isLemonSqueezyWidget(type)) return "lemonsqueezy";
  if (isSentryWidget(type)) return "sentry";
  if (isResendWidget(type)) return "resend";
  if (isVercelWidget(type)) return "vercel";
  return undefined;
}
