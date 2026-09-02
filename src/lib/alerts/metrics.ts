import type { Provider } from "@/lib/providers";

/**
 * The numbers a rule can watch.
 *
 * Every one of these is read straight out of a snapshot the sync worker
 * already stores — no metric here triggers a provider call of its own, so
 * adding an alert costs no upstream traffic at all. That constraint is also
 * what keeps this list honest: if a number is not in the payload, it is not
 * offered.
 *
 * `extract` returns null rather than 0 for "the source did not report this".
 * The difference matters: a Railway token scoped to one project has no billing
 * section, and a rule that read that as €0 would fire "spend dropped to zero"
 * every hour forever.
 */
export type MetricUnit = "count" | "percent" | "money" | "cores" | "gb";

export type MetricDefinition = {
  key: string;
  provider: Provider;
  label: string;
  /** What the number means, in the words someone setting a threshold uses. */
  description: string;
  unit: MetricUnit;
  /** The comparator that makes sense for this metric by default. */
  defaultComparator: "above" | "below";
  /** A threshold that is useful out of the box. */
  defaultThreshold: number;
  extract: (payload: Record<string, unknown>) => number | null;
};

/* ─────────────────────────── payload readers ─────────────────────────────
 *
 * Snapshots are plain JSON by the time they reach here — a payload written by
 * an older connector may be missing whole sections — so every read is
 * defensive rather than cast to the connector's type.
 * ----------------------------------------------------------------------- */

function obj(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function at(payload: Record<string, unknown>, path: string): number | null {
  const parts = path.split(".");
  let node: unknown = payload;
  for (const part of parts) {
    const record = obj(node);
    if (!record) return null;
    node = record[part];
  }
  return num(node);
}

/** `total - healthy`, when both are reported. */
function shortfall(
  payload: Record<string, unknown>,
  totalPath: string,
  healthyPath: string,
): number | null {
  const total = at(payload, totalPath);
  const healthy = at(payload, healthyPath);
  if (total === null || healthy === null) return null;
  return Math.max(0, total - healthy);
}

function arrayAt(payload: Record<string, unknown>, key: string): unknown[] {
  const value = payload[key];
  return Array.isArray(value) ? value : [];
}

export const METRICS: MetricDefinition[] = [
  /* ───────────────────────────── Railway ──────────────────────────────── */
  {
    key: "railway.crashedServices",
    provider: "railway",
    label: "Crashed services",
    description: "Services Railway reports as crashed",
    unit: "count",
    defaultComparator: "above",
    defaultThreshold: 0,
    extract: (p) => at(p, "fleet.crashed"),
  },
  {
    key: "railway.unhealthyServices",
    provider: "railway",
    label: "Unhealthy services",
    description: "Services not currently healthy",
    unit: "count",
    defaultComparator: "above",
    defaultThreshold: 0,
    extract: (p) => shortfall(p, "fleet.total", "fleet.healthy"),
  },
  {
    key: "railway.failedDeploys",
    provider: "railway",
    label: "Failed deploys since live",
    description: "Deploys that failed after the one currently serving traffic",
    unit: "count",
    defaultComparator: "above",
    defaultThreshold: 0,
    extract: (p) => at(p, "deployHealth.behindCount"),
  },
  {
    key: "railway.cpuCores",
    provider: "railway",
    label: "CPU usage",
    description: "Average vCPU across sampled services",
    unit: "cores",
    defaultComparator: "above",
    defaultThreshold: 1,
    extract: (p) => at(p, "resources.cpuCores"),
  },
  {
    key: "railway.memoryGb",
    provider: "railway",
    label: "Memory usage",
    description: "Average memory across sampled services",
    unit: "gb",
    defaultComparator: "above",
    defaultThreshold: 1,
    extract: (p) => at(p, "resources.memoryGb"),
  },
  {
    key: "railway.estimatedBill",
    provider: "railway",
    label: "Estimated bill",
    description: "Projected spend for the current billing cycle",
    unit: "money",
    defaultComparator: "above",
    defaultThreshold: 50,
    extract: (p) => at(p, "billing.estimatedBill"),
  },
  {
    key: "railway.creditBalance",
    provider: "railway",
    label: "Credit balance",
    description: "Credit left on the Railway workspace",
    unit: "money",
    defaultComparator: "below",
    defaultThreshold: 10,
    extract: (p) => at(p, "billing.creditBalance"),
  },

  /* ───────────────────────────── Vercel ───────────────────────────────── */
  {
    key: "vercel.failedProjects",
    provider: "vercel",
    label: "Projects not ready",
    description: "Projects whose latest deploy is not ready",
    unit: "count",
    defaultComparator: "above",
    defaultThreshold: 0,
    extract: (p) => shortfall(p, "total", "ready"),
  },

  /* ───────────────────────────── Netlify ──────────────────────────────── */
  {
    key: "netlify.unhealthySites",
    provider: "netlify",
    label: "Sites not published",
    description: "Sites whose latest deploy did not publish",
    unit: "count",
    defaultComparator: "above",
    defaultThreshold: 0,
    extract: (p) => shortfall(p, "total", "healthy"),
  },
  {
    key: "netlify.buildMinutes",
    provider: "netlify",
    label: "Build minutes used",
    description: "Build minutes consumed this period",
    unit: "count",
    defaultComparator: "above",
    defaultThreshold: 250,
    extract: (p) => at(p, "buildMinutes.current"),
  },
  {
    key: "netlify.formSubmissions",
    provider: "netlify",
    label: "Form submissions",
    description: "Total submissions across every form",
    unit: "count",
    defaultComparator: "above",
    defaultThreshold: 10,
    extract: (p) => at(p, "formSubmissionsTotal"),
  },

  /* ──────────────────────────── Supabase ──────────────────────────────── */
  {
    key: "supabase.unhealthyProjects",
    provider: "supabase",
    label: "Unhealthy projects",
    description: "Projects not reporting as healthy",
    unit: "count",
    defaultComparator: "above",
    defaultThreshold: 0,
    extract: (p) => shortfall(p, "total", "healthy"),
  },
  {
    key: "supabase.securityErrors",
    provider: "supabase",
    label: "Security advisors (errors)",
    description: "Open advisor findings at error level",
    unit: "count",
    defaultComparator: "above",
    defaultThreshold: 0,
    extract: (p) => at(p, "advisors.errors"),
  },
  {
    key: "supabase.advisorsTotal",
    provider: "supabase",
    label: "Security advisors (all)",
    description: "Every open advisor finding",
    unit: "count",
    defaultComparator: "above",
    defaultThreshold: 5,
    extract: (p) => at(p, "advisors.total"),
  },
  {
    key: "supabase.requests7d",
    provider: "supabase",
    label: "API requests (7 days)",
    description: "Total API requests over the last week",
    unit: "count",
    defaultComparator: "above",
    defaultThreshold: 100_000,
    extract: (p) => at(p, "requestVolume.total"),
  },

  /* ───────────────────────────── Sentry ───────────────────────────────── */
  {
    key: "sentry.unresolved",
    provider: "sentry",
    label: "Unresolved issues",
    description: "Issues still open in Sentry",
    unit: "count",
    defaultComparator: "above",
    defaultThreshold: 10,
    extract: (p) => at(p, "unresolved"),
  },
  {
    key: "sentry.events24h",
    provider: "sentry",
    label: "Events (24h)",
    description: "Error events across the last day",
    unit: "count",
    defaultComparator: "above",
    defaultThreshold: 100,
    extract: (p) => at(p, "events24h"),
  },

  /* ───────────────────────────── Stripe ───────────────────────────────── */
  {
    key: "stripe.mrr",
    provider: "stripe",
    label: "MRR",
    description: "Monthly recurring revenue",
    unit: "money",
    defaultComparator: "below",
    defaultThreshold: 1000,
    extract: (p) => at(p, "revenue.mrr"),
  },
  {
    key: "stripe.activeSubscriptions",
    provider: "stripe",
    label: "Active subscriptions",
    description: "Subscriptions currently active",
    unit: "count",
    defaultComparator: "below",
    defaultThreshold: 10,
    extract: (p) => at(p, "revenue.activeSubscriptions"),
  },
  {
    key: "stripe.volume30d",
    provider: "stripe",
    label: "Revenue (30 days)",
    description: "Gross volume over the trailing 30 days",
    unit: "money",
    defaultComparator: "below",
    defaultThreshold: 1000,
    extract: (p) => at(p, "volume30d.value"),
  },
  {
    key: "stripe.balanceAvailable",
    provider: "stripe",
    label: "Stripe balance",
    description: "Funds available to pay out",
    unit: "money",
    defaultComparator: "below",
    defaultThreshold: 100,
    extract: (p) => at(p, "balance.available"),
  },

  /* ─────────────────────────── Lemon Squeezy ──────────────────────────── */
  {
    key: "lemonsqueezy.mrr",
    provider: "lemonsqueezy",
    label: "MRR",
    description: "Monthly recurring revenue",
    unit: "money",
    defaultComparator: "below",
    defaultThreshold: 1000,
    extract: (p) => at(p, "revenue.mrr"),
  },
  {
    key: "lemonsqueezy.revenue30d",
    provider: "lemonsqueezy",
    label: "Revenue (30 days)",
    description: "Store revenue over the trailing 30 days",
    unit: "money",
    defaultComparator: "below",
    defaultThreshold: 1000,
    extract: (p) => at(p, "revenue30d.value"),
  },
  {
    key: "lemonsqueezy.activeSubscriptions",
    provider: "lemonsqueezy",
    label: "Active subscriptions",
    description: "Subscriptions currently active",
    unit: "count",
    defaultComparator: "below",
    defaultThreshold: 10,
    extract: (p) => at(p, "revenue.activeSubscriptions"),
  },

  /* ───────────────────────────── Resend ───────────────────────────────── */
  {
    key: "resend.deliveryRate",
    provider: "resend",
    label: "Delivery rate",
    description: "Share of sent email that was delivered",
    unit: "percent",
    defaultComparator: "below",
    defaultThreshold: 95,
    extract: (p) => at(p, "metrics.totals.deliveryRate"),
  },
  {
    key: "resend.openRate",
    provider: "resend",
    label: "Open rate",
    description: "Share of delivered email that was opened",
    unit: "percent",
    defaultComparator: "below",
    defaultThreshold: 20,
    extract: (p) => at(p, "metrics.totals.openRate"),
  },
  {
    key: "resend.bounced",
    provider: "resend",
    label: "Bounced emails",
    description: "Emails that bounced in the reported window",
    unit: "count",
    defaultComparator: "above",
    defaultThreshold: 5,
    extract: (p) => at(p, "metrics.totals.bounced"),
  },
  {
    key: "resend.unverifiedDomains",
    provider: "resend",
    label: "Unverified domains",
    description: "Sending domains not fully verified",
    unit: "count",
    defaultComparator: "above",
    defaultThreshold: 0,
    extract: (p) => shortfall(p, "total", "verified"),
  },

  /* ───────────────────────────── Qonto ────────────────────────────────── */
  {
    key: "qonto.cashBalance",
    provider: "qonto",
    label: "Cash balance",
    description: "Total booked cash across every account",
    unit: "money",
    defaultComparator: "below",
    defaultThreshold: 5000,
    extract: (p) => {
      const booked = at(p, "liquidity.booked");
      if (booked !== null) return booked;
      // Older snapshots predate the liquidity section but still carry the
      // per-account balances the section was derived from.
      const balances = arrayAt(p, "balances");
      if (!balances.length) return null;
      return balances.reduce<number>((total, entry) => {
        const balance = num(obj(entry)?.balance);
        return total + (balance ?? 0);
      }, 0);
    },
  },
  {
    key: "qonto.availableLiquidity",
    provider: "qonto",
    label: "Available liquidity",
    description: "Spendable balance once pending items settle",
    unit: "money",
    defaultComparator: "below",
    defaultThreshold: 5000,
    extract: (p) => at(p, "liquidity.available"),
  },
  {
    key: "qonto.netCashflow30d",
    provider: "qonto",
    label: "Net cashflow (30 days)",
    description: "Money in minus money out over the last 30 days",
    unit: "money",
    defaultComparator: "below",
    defaultThreshold: 0,
    extract: (p) => at(p, "cashflow30d.net"),
  },
  {
    key: "qonto.outflow30d",
    provider: "qonto",
    label: "Spend (30 days)",
    description: "Money out over the last 30 days",
    unit: "money",
    defaultComparator: "above",
    defaultThreshold: 10_000,
    extract: (p) => at(p, "cashflow30d.outflow"),
  },
];

const BY_KEY = new Map(METRICS.map((metric) => [metric.key, metric]));

export function getMetric(key: string): MetricDefinition | null {
  return BY_KEY.get(key) ?? null;
}

export function metricsForProvider(provider: Provider): MetricDefinition[] {
  return METRICS.filter((metric) => metric.provider === provider);
}

/** Providers that have anything worth alerting on. */
export function alertableProviders(): Provider[] {
  return [...new Set(METRICS.map((metric) => metric.provider))];
}

/**
 * A metric value in the words a notification uses.
 *
 * Currency is deliberately unlabelled: the payload carries its own currency
 * per source and this formatter does not have it, so a bare number beats
 * confidently printing the wrong symbol.
 */
export function formatMetricValue(
  value: number,
  unit: MetricUnit,
): string {
  switch (unit) {
    case "percent":
      return `${value.toFixed(1)}%`;
    case "money":
      return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
    case "cores":
      return `${value.toFixed(2)} vCPU`;
    case "gb":
      return `${value.toFixed(2)} GB`;
    case "count":
      return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
    default: {
      const _exhaustive: never = unit;
      return String(_exhaustive);
    }
  }
}
