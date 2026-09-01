import { EmptyState, PageHeader } from "@/components/layout/page";
import { requirePageTenant } from "@/lib/auth/tenant";
import type { WidgetType } from "@/lib/widgets/registry";
import { CreateDashboard } from "./create-dashboard";
import { DashboardGallery, type DashboardSummary } from "./dashboard-gallery";

export default async function DashboardsPage() {
  const repos = await requirePageTenant();

  const [dashboards, widgetTypeRows] = await Promise.all([
    repos.dashboards.list(),
    repos.widgets.listTypesByDashboard(),
  ]);

  const widgetTypesByDashboard = new Map<string, WidgetType[]>();
  for (const row of widgetTypeRows) {
    const types = widgetTypesByDashboard.get(row.dashboardId) ?? [];
    types.push(row.widgetType as WidgetType);
    widgetTypesByDashboard.set(row.dashboardId, types);
  }

  const summaries: DashboardSummary[] = dashboards.map((dashboard) => ({
    id: dashboard.id,
    name: dashboard.name,
    updatedAt: dashboard.updatedAt.toISOString(),
    starred: dashboard.starred,
    // Capped so the thumbnail stays a preview, not a full re-render of the
    // canvas — the top-left corner of the layout is what a user recognizes.
    widgetTypes: (widgetTypesByDashboard.get(dashboard.id) ?? []).slice(0, 4),
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboards"
        description="Compose canvases from your connected sources."
        actions={<CreateDashboard />}
      />

      {summaries.length === 0 ? (
        <EmptyState
          title="No dashboards yet"
          description="Create your first canvas, then drop deploy, error, revenue, and cash blocks onto it."
          action={<CreateDashboard label="Create dashboard" />}
        />
      ) : (
        <DashboardGallery dashboards={summaries} />
      )}
    </div>
  );
}
