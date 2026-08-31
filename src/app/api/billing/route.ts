import { jsonOk, withTenant } from "@/lib/api";
import { entitlementsFor } from "@/lib/billing/entitlements";
import { purchasablePlans } from "@/lib/billing/plans";
import { billingConfigured } from "@/lib/billing/stripe";

export const runtime = "nodejs";

/** Current plan, its limits, and what the tenant is using against them. */
export async function GET() {
  return withTenant(async (repos) => {
    const [entitlements, connections, dashboards] = await Promise.all([
      entitlementsFor(repos.ctx.organizationId),
      repos.connections.count(),
      repos.dashboards.count(),
    ]);

    return jsonOk({
      enabled: billingConfigured(),
      plan: entitlements.plan,
      planName: entitlements.planName,
      status: entitlements.status,
      active: entitlements.active,
      cancelAtPeriodEnd: entitlements.cancelAtPeriodEnd,
      currentPeriodEnd: entitlements.currentPeriodEnd,
      // Infinity does not survive JSON; null reads as "no limit" on the client.
      limits: {
        connections: finite(entitlements.limits.connections),
        dashboards: finite(entitlements.limits.dashboards),
        widgetsPerDashboard: finite(entitlements.limits.widgetsPerDashboard),
      },
      usage: { connections, dashboards },
      plans: purchasablePlans().map((plan) => ({
        id: plan.id,
        name: plan.name,
        limits: {
          connections: finite(plan.limits.connections),
          dashboards: finite(plan.limits.dashboards),
          widgetsPerDashboard: finite(plan.limits.widgetsPerDashboard),
        },
      })),
    });
  });
}

function finite(value: number): number | null {
  return Number.isFinite(value) ? value : null;
}
