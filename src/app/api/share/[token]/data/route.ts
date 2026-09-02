import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import {
  LIMITS,
  rateLimit,
  rateLimitHeaders,
} from "@/lib/http/rate-limit";
import { resolveShare } from "@/lib/sharing/resolve";
import { getWidgetDefinition, type WidgetType } from "@/lib/widgets/registry";
import { applyFilter, envelopeFor, parseWidgetConfig } from "@/lib/widgets/config";
import { serveWidgetData } from "@/lib/widgets/serve";

export const runtime = "nodejs";

type Params = { params: Promise<{ token: string }> };

/**
 * Widget data behind a share link.
 *
 * The token stands in for the session, and everything after that is the
 * authenticated path: the same `serveWidgetData` against repositories bound to
 * the share's organization.
 *
 * What is different, and has to be, is the boundary. A share link may return
 * only what its own dashboard puts on screen — no more. That is enforced on
 * three axes, all server-side:
 *
 *  1. **Which widgets.** The requested type must match a widget on the shared
 *     dashboard, or a link to a deploy board would also answer for the
 *     organization's bank balance.
 *  2. **Which connections.** Cross-source widgets are capped to the
 *     connections this dashboard binds, so a status board cannot enumerate
 *     every source the organization has connected.
 *  3. **Which rows.** The dashboard's own scope, limit and range are applied
 *     here rather than in the browser. Filtering client-side is a display
 *     preference, not a limit — it ships the hidden rows to the recipient and
 *     trusts them not to open the network tab.
 */
export async function GET(request: Request, { params }: Params) {
  const { token } = await params;

  // Metered on the token rather than the address: a link passed around an
  // office is many people behind one NAT, and one person on a phone is several
  // addresses. The token is what was shared, so it is what is metered.
  const limited = rateLimit(`share-data:${token}`, LIMITS.shareData);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests. Slow down and try again shortly." },
      { status: 429, headers: rateLimitHeaders(limited) },
    );
  }

  const share = await resolveShare(token);
  if (!share) return jsonError("This link is no longer active.", 404);

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") as WidgetType | null;
  if (!type || !getWidgetDefinition(type)) return jsonError("Unknown widget");

  const widgets = await share.repos.widgets.listFor(share.dashboardId);
  const connectionId = searchParams.get("connectionId");
  const provider = providerOf(type);

  /*
   * The widgets this request actually answers for.
   *
   * The client polls one canonical type per provider on behalf of every widget
   * of that provider — the same batching the signed-in store does — so the
   * matching set, not a single widget, is what defines the envelope.
   */
  const matching = widgets.filter(
    (widget) =>
      providerOf(widget.widgetType) === provider &&
      (connectionId ? widget.connectionId === connectionId : true),
  );

  if (matching.length === 0) {
    return jsonError("That widget is not on this dashboard.", 403);
  }

  const configs = matching.map((widget) => parseWidgetConfig(safeJson(widget.configJson)));

  const result = await serveWidgetData(share.repos, {
    type,
    connectionId,
    // A cross-source widget reads what it was configured to read...
    connectionIds: unionConnectionIds(configs),
    // ...and never more than the dashboard binds.
    restrictToConnectionIds: boundConnections(widgets, configs),
    limit: numberParam(searchParams.get("limit")),
    cursor: searchParams.get("cursor"),
  });

  const body =
    result.status === 200
      ? applyFilter(type, envelopeFor(configs), result.body)
      : result.body;

  return NextResponse.json(body, {
    status: result.status,
    headers: {
      ...rateLimitHeaders(limited),
      // A shared dashboard is someone else's live data behind a bearer token:
      // nothing in front of it may keep a copy.
      "Cache-Control": "private, no-store",
    },
  });
}

/**
 * Every connection this dashboard can legitimately surface.
 *
 * Two sources: connections a widget is explicitly bound to, and connections a
 * cross-source widget names. A widget left on the provider default binds
 * nothing by id, so `null` — meaning "no ceiling" — is returned when any
 * single-source widget is on the default. That is correct: such a widget
 * already renders whichever connection the provider resolves to, and the
 * provider check in `serveWidgetData` keeps it to that provider.
 */
function boundConnections(
  widgets: Array<{ widgetType: string; connectionId: string | null }>,
  configs: Array<{ connectionIds?: string[] }>,
): string[] | null {
  const ids = new Set<string>();
  let unbounded = false;

  for (const widget of widgets) {
    if (widget.connectionId) {
      ids.add(widget.connectionId);
    } else if (providerOf(widget.widgetType) !== "multi") {
      unbounded = true;
    }
  }

  for (const config of configs) {
    for (const id of config.connectionIds ?? []) ids.add(id);
  }

  if (unbounded) return null;
  return [...ids];
}

/** The connections cross-source widgets ask for, or null when unset. */
function unionConnectionIds(
  configs: Array<{ connectionIds?: string[] }>,
): string[] | null {
  const declared = configs.filter((config) => config.connectionIds !== undefined);
  if (declared.length === 0) return null;
  return [...new Set(declared.flatMap((config) => config.connectionIds ?? []))];
}

function providerOf(type: string): string {
  return getWidgetDefinition(type)?.provider ?? "unknown";
}

function numberParam(raw: string | null): number | undefined {
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}
