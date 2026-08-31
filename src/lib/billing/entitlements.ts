import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { subscriptions } from "@/lib/db/schema";
import { isCloud } from "@/lib/edition";
import {
  DEFAULT_PLAN,
  PLANS,
  SELF_HOSTED_LIMITS,
  type PlanId,
  type PlanLimits,
} from "./plans";

/**
 * Stripe statuses that still entitle a customer to their paid plan.
 *
 * `past_due` is deliberately included: a failed renewal should trigger dunning,
 * not lock someone out of their dashboards while their card is being retried.
 */
const ENTITLING_STATUSES = new Set(["active", "trialing", "past_due"]);

export type Entitlements = {
  plan: PlanId;
  planName: string;
  limits: PlanLimits;
  status: string;
  /** True while a paid plan is in a state that still grants access. */
  active: boolean;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
};

const SELF_HOSTED: Entitlements = {
  plan: "scale",
  planName: "Self-hosted",
  limits: SELF_HOSTED_LIMITS,
  status: "self_hosted",
  active: true,
  cancelAtPeriodEnd: false,
  currentPeriodEnd: null,
};

/**
 * What this organization is allowed to do.
 *
 * Reads the local subscription row that the Stripe webhook keeps up to date —
 * never Stripe itself, so billing can be down without taking dashboards with
 * it. Self-hosted short-circuits before touching the database at all.
 */
export type SubscriptionRow = {
  plan: PlanId;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
};

/**
 * Turn a stored subscription into entitlements.
 *
 * Split out from the database read so every branch — no row, a lapsed one, a
 * plan id we no longer recognise — is directly testable. Anything that is not
 * an entitling status falls back to the free plan rather than the plan named
 * on the row, so a cancelled Scale subscription does not keep Scale limits.
 */
export function entitlementsFromRow(
  row: SubscriptionRow | null,
): Entitlements {
  if (!row || !ENTITLING_STATUSES.has(row.status)) {
    return {
      plan: DEFAULT_PLAN,
      planName: PLANS[DEFAULT_PLAN].name,
      limits: PLANS[DEFAULT_PLAN].limits,
      status: row?.status ?? "none",
      active: false,
      cancelAtPeriodEnd: row?.cancelAtPeriodEnd ?? false,
      currentPeriodEnd: row?.currentPeriodEnd ?? null,
    };
  }

  const plan = PLANS[row.plan] ?? PLANS[DEFAULT_PLAN];
  return {
    plan: plan.id,
    planName: plan.name,
    limits: plan.limits,
    status: row.status,
    active: true,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    currentPeriodEnd: row.currentPeriodEnd,
  };
}

/**
 * What this organization is allowed to do.
 *
 * Reads the local subscription row that the Stripe webhook keeps up to date —
 * never Stripe itself, so billing can be down without taking dashboards with
 * it. Self-hosted short-circuits before touching the database at all.
 */
export async function entitlementsFor(
  organizationId: string,
): Promise<Entitlements> {
  if (!isCloud) return SELF_HOSTED;

  const db = await getDb();
  const [row] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.organizationId, organizationId))
    .limit(1);

  return entitlementsFromRow(row ?? null);
}

export type LimitName = keyof PlanLimits;

export type LimitCheck =
  | { allowed: true }
  | { allowed: false; limit: number; plan: PlanId; message: string };

const LIMIT_LABELS: Record<LimitName, string> = {
  connections: "connections",
  dashboards: "dashboards",
  widgetsPerDashboard: "widgets on a dashboard",
};

/**
 * Whether one more of something fits within the plan.
 *
 * `current` is counted at the moment of the check rather than tracked, so a
 * plan downgrade never leaves a stale counter behind — existing rows keep
 * working, only adding more is refused.
 */
export function checkLimit(
  entitlements: Entitlements,
  limit: LimitName,
  current: number,
): LimitCheck {
  const max = entitlements.limits[limit];
  if (current < max) return { allowed: true };

  return {
    allowed: false,
    limit: max,
    plan: entitlements.plan,
    message: `Your ${entitlements.planName} plan includes ${max} ${LIMIT_LABELS[limit]}. Upgrade to add more.`,
  };
}
