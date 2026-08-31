/**
 * What each plan allows.
 *
 * Limits live here rather than in Stripe so the app can answer "may this
 * tenant add another connection?" from its own database, without a network
 * call in the request path. Stripe stays the source of truth for *which* plan
 * is active; this file says what that plan means.
 */
export type PlanId = "free" | "pro" | "scale";

export type PlanLimits = {
  /** Provider connections the organization may hold. */
  connections: number;
  /** Dashboards the organization may create. */
  dashboards: number;
  /** Widgets on a single dashboard. */
  widgetsPerDashboard: number;
};

export type Plan = {
  id: PlanId;
  name: string;
  /** Undefined for plans that are not purchasable (free, self-hosted). */
  priceEnvVar?: string;
  limits: PlanLimits;
};

export const UNLIMITED = Number.POSITIVE_INFINITY;

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    limits: { connections: 1, dashboards: 2, widgetsPerDashboard: 8 },
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceEnvVar: "STRIPE_PRICE_PRO",
    limits: { connections: 6, dashboards: 15, widgetsPerDashboard: 40 },
  },
  scale: {
    id: "scale",
    name: "Scale",
    priceEnvVar: "STRIPE_PRICE_SCALE",
    limits: {
      connections: UNLIMITED,
      dashboards: UNLIMITED,
      widgetsPerDashboard: UNLIMITED,
    },
  },
};

export const DEFAULT_PLAN: PlanId = "free";

/** Everything a self-hosted install may do: all of it. */
export const SELF_HOSTED_LIMITS: PlanLimits = {
  connections: UNLIMITED,
  dashboards: UNLIMITED,
  widgetsPerDashboard: UNLIMITED,
};

export function isPlanId(value: string): value is PlanId {
  return value in PLANS;
}

/** The configured Stripe price for a purchasable plan, if any. */
export function priceIdFor(plan: PlanId): string | undefined {
  const envVar = PLANS[plan].priceEnvVar;
  return envVar ? process.env[envVar] || undefined : undefined;
}

/**
 * Map a Stripe price back to our plan. Unknown prices fall back to free rather
 * than guessing, so a mis-configured price cannot silently grant Scale limits.
 */
export function planForPriceId(priceId: string | null | undefined): PlanId {
  if (!priceId) return DEFAULT_PLAN;
  for (const plan of Object.values(PLANS)) {
    if (plan.priceEnvVar && process.env[plan.priceEnvVar] === priceId) {
      return plan.id;
    }
  }
  return DEFAULT_PLAN;
}

/** Plans a customer can actually buy, in display order. */
export function purchasablePlans(): Plan[] {
  return [PLANS.pro, PLANS.scale].filter((plan) => Boolean(priceIdFor(plan.id)));
}
