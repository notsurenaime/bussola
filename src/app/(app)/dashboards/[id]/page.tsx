import { notFound } from "next/navigation";
import {
  DashboardCanvas,
  type CanvasWidget,
} from "@/components/dashboard/dashboard-canvas";
import { requirePageTenant } from "@/lib/auth/tenant";
import { toCanvasWidget } from "@/lib/widgets/serialize";

type Props = { params: Promise<{ id: string }> };

export default async function DashboardDetailPage({ params }: Props) {
  const { id } = await params;
  const repos = await requirePageTenant();

  const dashboard = await repos.dashboards.get(id);
  if (!dashboard) notFound();

  const widgets: CanvasWidget[] = (await repos.widgets.listFor(id)).map(
    toCanvasWidget,
  );

  return (
    <DashboardCanvas
      dashboardId={dashboard.id}
      name={dashboard.name}
      initialWidgets={widgets}
    />
  );
}
