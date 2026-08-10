import { notFound } from "next/navigation";
import { eq, asc } from "drizzle-orm";
import {
  DashboardCanvas,
  type CanvasWidget,
} from "@/components/dashboard/dashboard-canvas";
import { getDb } from "@/lib/db";
import { dashboardWidgets, dashboards } from "@/lib/db/schema";

type Props = { params: Promise<{ id: string }> };

export default async function DashboardDetailPage({ params }: Props) {
  const { id } = await params;
  const dashboard = getDb()
    .select()
    .from(dashboards)
    .where(eq(dashboards.id, id))
    .get();

  if (!dashboard) notFound();

  const widgets: CanvasWidget[] = getDb()
    .select()
    .from(dashboardWidgets)
    .where(eq(dashboardWidgets.dashboardId, id))
    .orderBy(asc(dashboardWidgets.layoutY), asc(dashboardWidgets.layoutX))
    .all()
    .map((w) => ({
      id: w.id,
      widgetType: w.widgetType,
      title: w.title,
      config: JSON.parse(w.configJson || "{}") as Record<string, unknown>,
      layout: {
        i: w.id,
        x: w.layoutX,
        y: w.layoutY,
        w: w.layoutW,
        h: w.layoutH,
      },
    }));

  return (
    <DashboardCanvas
      dashboardId={dashboard.id}
      name={dashboard.name}
      initialWidgets={widgets}
    />
  );
}
