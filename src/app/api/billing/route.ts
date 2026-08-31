import { jsonOk, withTenant } from "@/lib/api";
import { entitlementsFor } from "@/lib/billing/entitlements";
import {
  EXTRA_SEAT_CENTS,
  priceIdFor,
  purchasablePlans,
} from "@/lib/billing/plans";
import { billingConfigured } from "@/lib/billing/stripe";

export const runtime = "nodejs";

/** Infinity does not survive JSON; null reads as "no limit" on the client. */
function finite(value: number): number | null {
  return Number.isFinite(value) ? value : null;
}

/** Current plan, what it allows, and what the tenant is using against it. */
export async function GET() {
  return withTenant(async (repos) => {
    const [entitlements, connections, dashboards, seatsUsed] =
      await Promise.all([
        entitlementsFor(repos.ctx.organizationId),
        repos.connections.count(),
        repos.dashboards.count(),
        repos.members.countSeats(),
      ]);

    return jsonOk({
      enabled: billingConfigured(),
      plan: entitlements.plan,
      planName: entitlements.planName,
      status: entitlements.status,
      active: entitlements.active,
      cancelAtPeriodEnd: entitlements.cancelAtPeriodEnd,
      currentPeriodEnd: entitlements.currentPeriodEnd,
      extraSeats: entitlements.extraSeats,
      features: entitlements.features,
      limits: {
        dashboards: finite(entitlements.limits.dashboards),
        widgetsPerDashboard: finite(entitlements.limits.widgetsPerDashboard),
        connections: finite(entitlements.limits.connections),
        seats: finite(entitlements.limits.seats),
        historyDays: finite(entitlements.limits.historyDays),
      },
      usage: { connections, dashboards, seats: seatsUsed },
      extraSeatCents: EXTRA_SEAT_CENTS,
      plans: purchasablePlans().map((plan) => ({
        id: plan.id,
        name: plan.name,
        monthlyCents: plan.monthlyCents,
        yearlyCents: plan.yearlyCents,
        currency: plan.currency,
        features: plan.features,
        intervals: {
          monthly: Boolean(priceIdFor(plan.id, "monthly")),
          yearly: Boolean(priceIdFor(plan.id, "yearly")),
        },
        limits: {
          dashboards: finite(plan.limits.dashboards),
          widgetsPerDashboard: finite(plan.limits.widgetsPerDashboard),
          connections: finite(plan.limits.connections),
          seats: finite(plan.limits.seats),
          historyDays: finite(plan.limits.historyDays),
        },
      })),
    });
  });
}
