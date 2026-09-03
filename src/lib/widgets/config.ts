import type { WidgetType } from "./registry";

/**
 * Per-widget options, stored in `dashboard_widgets.config_json`.
 *
 * Everything here is applied to the snapshot the widget already reads — no
 * option triggers a different upstream call, because widgets never call a
 * provider at all. That is the constraint this whole file is written against:
 * an option is offered only where the stored payload genuinely contains what
 * it takes to honour it, so nothing on the settings dialog is a control that
 * quietly does nothing.
 *
 * Which *connection* feeds a widget is deliberately not in here — it lives in
 * its own column, so deleting a connection can reset it with a foreign key
 * rather than by rewriting JSON in every affected row.
 */
export type WidgetConfig = {
  /** Show only items belonging to this project / service / site / account. */
  scope?: string;
  /** How many rows a list widget renders. */
  limit?: number;
  /** How many days of a time series to plot. */
  rangeDays?: number;
  /**
   * Which connections a cross-source widget reads.
   *
   * Only the status board uses this, and only because "every connection this
   * organization has" is an implicit grant — fine for the owner, wrong the
   * moment the dashboard is shared. Making the set explicit is what lets a
   * share link expose exactly what the widget was configured to show.
   */
  connectionIds?: string[];
};

/** An item list inside a payload, and where the scope name lives on its items. */
type CollectionSpec = {
  /** Dotted path from the payload root. */
  path: string;
  /** Fields to match a scope against, in preference order. */
  scopeFields: string[];
};

type ShapeSpec = {
  collections?: CollectionSpec[];
  /** Dotted paths to `{ ts | date | period }`-bearing point arrays. */
  series?: string[];
  /**
   * For cross-source widgets: the field carrying the connection each item came
   * from, so a chosen set of connections can be honoured client-side too.
   */
  connectionField?: string;
};

/**
 * What each widget's payload holds, for the options that read it.
 *
 * A widget missing from this map supports no options — which is the honest
 * answer for the single-number cards, where there is nothing in the payload to
 * filter or trim.
 */
const SHAPES: Partial<Record<WidgetType, ShapeSpec>> = {
  // Railway
  "railway-services": {
    collections: [{ path: "items", scopeFields: ["name", "detail"] }],
  },
  "railway-deploys": {
    collections: [
      {
        path: "recentDeploys",
        scopeFields: ["projectName", "serviceName"],
      },
    ],
  },
  "railway-projects": {
    collections: [{ path: "projects", scopeFields: ["name"] }],
  },
  "railway-cpu": { series: ["metrics.series[].points"] },
  "railway-memory": { series: ["metrics.series[].points"] },
  "railway-egress": { series: ["metrics.series[].points"] },
  "railway-disk": { series: ["metrics.series[].points"] },

  // Netlify
  "netlify-sites": {
    collections: [{ path: "items", scopeFields: ["name"] }],
  },
  "netlify-deploys": {
    collections: [{ path: "recentDeploys", scopeFields: ["siteName"] }],
  },
  "netlify-forms": {
    collections: [{ path: "forms", scopeFields: ["siteName", "name"] }],
  },

  // Supabase
  "supabase-projects": {
    collections: [{ path: "items", scopeFields: ["name"] }],
  },
  "supabase-services": {
    collections: [{ path: "services", scopeFields: ["projectName"] }],
  },
  "supabase-advisor-issues": {
    collections: [{ path: "advisorIssues", scopeFields: ["projectName"] }],
  },

  // Vercel
  "vercel-projects": {
    collections: [{ path: "items", scopeFields: ["name"] }],
  },
  "vercel-deploys": {
    collections: [{ path: "recentDeploys", scopeFields: ["projectName"] }],
  },

  // Sentry
  "sentry-recent": {
    collections: [{ path: "issues", scopeFields: ["projectName"] }],
  },
  "sentry-projects": {
    collections: [{ path: "projects", scopeFields: ["name"] }],
  },

  // Payments
  "stripe-payments": { collections: [{ path: "payments", scopeFields: [] }] },
  "lemonsqueezy-orders": {
    collections: [{ path: "orders", scopeFields: [] }],
  },

  // Resend
  "resend-domains": { collections: [{ path: "domains", scopeFields: [] }] },
  "resend-emails": { collections: [{ path: "emails", scopeFields: [] }] },
  "resend-broadcasts": {
    collections: [{ path: "broadcasts", scopeFields: [] }],
  },
  "resend-delivery": { series: ["metrics.points"] },
  "resend-open-rate": { series: ["metrics.points"] },
  "resend-click-rate": { series: ["metrics.points"] },

  // Qonto
  "qonto-accounts": {
    collections: [{ path: "balances", scopeFields: ["accountName"] }],
  },
  "qonto-history": { series: ["balanceHistory.points"] },

  // Cross-source
  "status-board": {
    collections: [{ path: "items", scopeFields: ["provider", "name"] }],
    connectionField: "_connectionId",
  },
};

/** Whether a widget reads across connections rather than from one. */
export function isMultiSource(type: WidgetType): boolean {
  return Boolean(SHAPES[type]?.connectionField);
}

export type WidgetOption = "scope" | "limit" | "range";

/** Which controls the settings dialog should show for a widget. */
export function optionsFor(type: WidgetType): WidgetOption[] {
  const shape = SHAPES[type];
  if (!shape) return [];

  const options: WidgetOption[] = [];
  if (shape.collections?.some((c) => c.scopeFields.length > 0)) {
    options.push("scope");
  }
  if (shape.collections?.length) options.push("limit");
  if (shape.series?.length) options.push("range");
  return options;
}

export const RANGE_CHOICES = [7, 14, 30, 90] as const;
export const LIMIT_CHOICES = [5, 10, 25, 50] as const;

/* ───────────────────────────── path handling ─────────────────────────────
 *
 * Paths are dotted, with `[]` meaning "every element of this array". Only what
 * the specs above need is supported — a general JSONPath here would be more
 * machinery than three shapes of payload justify.
 * ----------------------------------------------------------------------- */

function readPath(root: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (node, key) =>
        node && typeof node === "object"
          ? (node as Record<string, unknown>)[key]
          : undefined,
      root,
    );
}

/**
 * Rewrite one path inside a payload, copying every object along the way.
 *
 * The snapshot is shared by every widget of a provider — one poll, many
 * readers — so mutating it in place would make one widget's scope silently
 * apply to its neighbours.
 */
function writePath(root: unknown, path: string, value: unknown): unknown {
  const [head, ...rest] = path.split(".");
  if (!head) return value;
  if (!root || typeof root !== "object") return root;

  const node = root as Record<string, unknown>;
  return {
    ...node,
    [head]: rest.length ? writePath(node[head], rest.join("."), value) : value,
  };
}

/** Apply `fn` to each array named by a path, handling one `[]` segment. */
function mapArrayAt(
  root: unknown,
  path: string,
  fn: (items: unknown[]) => unknown[],
): unknown {
  const fanOut = path.indexOf("[].");
  if (fanOut === -1) {
    const current = readPath(root, path);
    if (!Array.isArray(current)) return root;
    return writePath(root, path, fn(current));
  }

  const before = path.slice(0, fanOut);
  const after = path.slice(fanOut + 3);
  const list = readPath(root, before);
  if (!Array.isArray(list)) return root;

  return writePath(
    root,
    before,
    list.map((entry) => mapArrayAt(entry, after, fn)),
  );
}

/* ───────────────────────────── option handling ─────────────────────────── */

function scopeOf(item: unknown, fields: string[]): string | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  for (const field of fields) {
    const value = record[field];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

/**
 * The scope values actually present in a payload.
 *
 * Read from the data rather than from a stored list of projects, so the
 * dropdown can only ever offer a scope that would return something — and so a
 * project deleted upstream disappears from the options on the next sync.
 */
export function scopeValuesFor(
  type: WidgetType,
  data: Record<string, unknown> | null,
): string[] {
  const shape = SHAPES[type];
  if (!shape?.collections || !data) return [];

  const values = new Set<string>();
  for (const collection of shape.collections) {
    if (!collection.scopeFields.length) continue;
    const items = readPath(data, collection.path);
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      const value = scopeOf(item, collection.scopeFields);
      if (value) values.add(value);
    }
  }
  return [...values].sort((a, b) => a.localeCompare(b));
}

/** Timestamp on a point, whatever the connector called it. */
function pointTime(point: unknown): number | null {
  if (!point || typeof point !== "object") return null;
  const record = point as Record<string, unknown>;
  for (const key of ["ts", "date", "period"]) {
    const raw = record[key];
    if (typeof raw !== "string") continue;
    const parsed = Date.parse(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

/**
 * The filter one or several widgets add up to.
 *
 * `scopes` is a set rather than a single value because a share envelope is the
 * union of what a dashboard's widgets display; a single widget simply has a
 * set of one. `undefined` anywhere means "no filter on this axis".
 */
export type WidgetFilter = {
  scopes?: string[];
  limit?: number;
  rangeDays?: number;
  /** Cross-source widgets: which connections' items to keep. */
  connectionIds?: string[];
};

/**
 * Narrow a payload to what a filter asks for.
 *
 * Returns the payload untouched when nothing applies, so the common case
 * costs one map lookup and no copying.
 *
 * A scope that matches nothing is honoured rather than ignored: an empty list
 * is the truthful answer to "only show project X" when project X reported
 * nothing, and silently showing everything instead would read as X being
 * enormous rather than absent.
 */
export function applyFilter(
  type: WidgetType,
  filter: WidgetFilter,
  data: Record<string, unknown>,
): Record<string, unknown> {
  const shape = SHAPES[type];
  if (!shape) return data;

  const scopes = filter.scopes?.length ? new Set(filter.scopes) : null;
  const hasLimit = typeof filter.limit === "number" && filter.limit > 0;
  const hasRange = typeof filter.rangeDays === "number" && filter.rangeDays > 0;
  // An explicitly empty set is a real choice — "this board shows nothing" —
  // so presence is what matters here, not length.
  const connections =
    shape.connectionField && filter.connectionIds
      ? new Set(filter.connectionIds)
      : null;
  if (!scopes && !hasLimit && !hasRange && !connections) return data;

  let next: unknown = data;

  for (const collection of shape.collections ?? []) {
    next = mapArrayAt(next, collection.path, (items) => {
      let result = items;
      if (connections) {
        result = result.filter((item) => {
          const id =
            item && typeof item === "object"
              ? (item as Record<string, unknown>)[shape.connectionField!]
              : undefined;
          return typeof id === "string" && connections.has(id);
        });
      }
      if (scopes && collection.scopeFields.length) {
        result = result.filter((item) => {
          const value = scopeOf(item, collection.scopeFields);
          return value !== null && scopes.has(value);
        });
      }
      if (hasLimit) result = result.slice(0, filter.limit);
      return result;
    });
  }

  if (hasRange) {
    const cutoff = Date.now() - filter.rangeDays! * 86_400_000;
    for (const path of shape.series ?? []) {
      next = mapArrayAt(next, path, (points) => {
        const kept = points.filter((point) => {
          const at = pointTime(point);
          // A point with no parseable timestamp is kept: dropping it would
          // silently empty a chart whose connector labels points differently.
          return at === null || at >= cutoff;
        });
        return kept.length ? kept : points;
      });
    }
  }

  return next as Record<string, unknown>;
}

/** One widget's own view of its payload. */
export function applyWidgetConfig(
  type: WidgetType,
  config: WidgetConfig,
  data: Record<string, unknown>,
): Record<string, unknown> {
  return applyFilter(
    type,
    {
      scopes: config.scope ? [config.scope] : undefined,
      limit: config.limit,
      rangeDays: config.rangeDays,
      connectionIds: config.connectionIds,
    },
    data,
  );
}

/**
 * What a set of widgets, taken together, put on screen.
 *
 * This is the boundary a share link is held to. Applying it server-side is
 * what makes a widget's scope a real limit rather than a display preference:
 * without it the response carries every project and the browser hides some,
 * which is no protection at all from anyone who opens the network tab.
 *
 * The union, not the intersection — and an unfiltered widget widens the
 * envelope to everything, because that widget genuinely renders everything.
 * Nothing inside the envelope is hidden on the page, so nothing inside it is
 * a disclosure.
 */
export function envelopeFor(configs: WidgetConfig[]): WidgetFilter {
  if (configs.length === 0) return {};

  const scopes: string[] = [];
  const connectionIds: string[] = [];
  let unscoped = false;
  let unlimited = false;
  let maxLimit = 0;
  let unbounded = false;
  let maxRange = 0;
  let anyConnectionSet = false;
  let allConnections = false;

  for (const config of configs) {
    if (config.scope) scopes.push(config.scope);
    else unscoped = true;

    if (config.limit && config.limit > 0) maxLimit = Math.max(maxLimit, config.limit);
    else unlimited = true;

    if (config.rangeDays && config.rangeDays > 0) {
      maxRange = Math.max(maxRange, config.rangeDays);
    } else unbounded = true;

    if (config.connectionIds) {
      anyConnectionSet = true;
      connectionIds.push(...config.connectionIds);
    } else {
      // A widget with no declared set reads every connection, so the envelope
      // cannot be narrower than that.
      allConnections = true;
    }
  }

  return {
    scopes: unscoped || scopes.length === 0 ? undefined : [...new Set(scopes)],
    limit: unlimited ? undefined : maxLimit,
    rangeDays: unbounded ? undefined : maxRange,
    connectionIds:
      anyConnectionSet && !allConnections ? [...new Set(connectionIds)] : undefined,
  };
}

/** Parse stored JSON into a config, discarding anything malformed. */
export function parseWidgetConfig(raw: unknown): WidgetConfig {
  if (!raw || typeof raw !== "object") return {};
  const record = raw as Record<string, unknown>;

  const config: WidgetConfig = {};
  if (typeof record.scope === "string" && record.scope.trim()) {
    config.scope = record.scope;
  }
  if (typeof record.limit === "number" && Number.isFinite(record.limit)) {
    config.limit = Math.max(1, Math.min(200, Math.trunc(record.limit)));
  }
  if (
    typeof record.rangeDays === "number" &&
    Number.isFinite(record.rangeDays)
  ) {
    config.rangeDays = Math.max(1, Math.min(730, Math.trunc(record.rangeDays)));
  }
  if (Array.isArray(record.connectionIds)) {
    const ids = record.connectionIds.filter(
      (id): id is string => typeof id === "string" && id.length > 0,
    );
    // Kept even when empty: "this board shows no sources" is a real choice,
    // and dropping the key would silently reopen it to everything.
    config.connectionIds = [...new Set(ids)].slice(0, 100);
  }
  return config;
}
