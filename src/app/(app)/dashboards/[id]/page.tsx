import { notFound } from "next/navigation";
import {
  DashboardCanvas,
  type CanvasWidget,
} from "@/components/dashboard/dashboard-canvas";
import { requirePageTenant } from "@/lib/auth/tenant";
import { entitlementsFor } from "@/lib/billing/entitlements";
import { toCanvasWidget } from "@/lib/widgets/serialize";

type Props = { params: Promise<{ id: string }> };

export default async function DashboardDetailPage({ params }: Props) {
  const { id } = await params;
  const repos = await requirePageTenant();

  const dashboard = await repos.dashboards.get(id);
  if (!dashboard) notFound();

  const [widgets, entitlements] = await Promise.all([
    repos.widgets.listFor(id),
    entitlementsFor(repos.ctx.organizationId),
  ]);

  const canvasWidgets: CanvasWidget[] = widgets.map(toCanvasWidget);

  return (
    <DashboardCanvas
      dashboardId={dashboard.id}
      name={dashboard.name}
      initialWidgets={canvasWidgets}
      initialStarred={dashboard.starred}
      canShare={entitlements.features.sharing}
    />
  );
}
