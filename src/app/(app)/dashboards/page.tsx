import { EmptyState, PageHeader } from "@/components/layout/page";
import { GettingStarted } from "@/components/onboarding/getting-started";
import { requirePageTenant } from "@/lib/auth/tenant";
import { CreateDashboard } from "./create-dashboard";
import { DashboardList, type DashboardSummary } from "./dashboard-list";

export default async function DashboardsPage() {
  const repos = await requirePageTenant();

  const [dashboards, connectionCount, widgetCount] = await Promise.all([
    repos.dashboards.list(),
    repos.connections.count(),
    repos.widgets.countAll(),
  ]);

  const summaries: DashboardSummary[] = dashboards.map((dashboard) => ({
    id: dashboard.id,
    name: dashboard.name,
    updatedAt: dashboard.updatedAt.toISOString(),
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboards"
        description="Compose canvases from your connected sources."
        actions={<CreateDashboard />}
      />

      <GettingStarted
        state={{
          hasConnection: connectionCount > 0,
          hasDashboard: dashboards.length > 0,
          hasWidget: widgetCount > 0,
        }}
      />

      {summaries.length === 0 ? (
        <EmptyState
          title="No dashboards yet"
          description="Create your first canvas, then drop deploy, error, revenue, and cash blocks onto it."
          action={<CreateDashboard label="Create dashboard" />}
        />
      ) : (
        <DashboardList dashboards={summaries} />
      )}
    </div>
  );
}
