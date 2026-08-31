import { z } from "zod";
import { jsonError, jsonOk, withTenant } from "@/lib/api";
import { overLimit } from "@/lib/billing/guard";
import { getWidgetDefinition } from "@/lib/widgets/registry";
import { toCanvasWidget } from "@/lib/widgets/serialize";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

const addSchema = z.object({
  widgetType: z.string(),
  title: z.string().max(120).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request, { params }: Params) {
  return withTenant(async (repos) => {
    const { id: dashboardId } = await params;
    if (!(await repos.dashboards.get(dashboardId))) {
      return jsonError("Dashboard not found", 404);
    }

    const body = await request.json().catch(() => null);
    const parsed = addSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid widget payload");

    const def = getWidgetDefinition(parsed.data.widgetType);
    if (!def) return jsonError("Unknown widget type");

    const denied = await overLimit(
      repos,
      "widgetsPerDashboard",
      await repos.widgets.countFor(dashboardId),
    );
    if (denied) return denied;

    const row = await repos.widgets.add({
      dashboardId,
      widgetType: def.type,
      title: parsed.data.title || def.name,
      configJson: JSON.stringify(parsed.data.config || {}),
      layoutY: await repos.widgets.nextY(dashboardId),
      layoutW: def.defaultW,
      layoutH: def.defaultH,
    });

    return jsonOk({ widget: toCanvasWidget(row) }, { status: 201 });
  });
}

const layoutSchema = z.object({
  layouts: z.array(
    z.object({
      i: z.string(),
      x: z.number().int().min(0),
      y: z.number().int().min(0),
      w: z.number().int().min(1),
      h: z.number().int().min(1),
    }),
  ),
});

export async function PUT(request: Request, { params }: Params) {
  return withTenant(async (repos) => {
    const { id: dashboardId } = await params;
    if (!(await repos.dashboards.get(dashboardId))) {
      return jsonError("Dashboard not found", 404);
    }

    const body = await request.json().catch(() => null);
    const parsed = layoutSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid layout payload");

    const updated = await repos.widgets.saveLayouts(
      dashboardId,
      parsed.data.layouts,
    );
    return jsonOk({ ok: true, updated });
  });
}

export async function DELETE(request: Request, { params }: Params) {
  return withTenant(async (repos) => {
    const { id: dashboardId } = await params;
    const { searchParams } = new URL(request.url);
    const widgetId = searchParams.get("widgetId");
    if (!widgetId) return jsonError("widgetId required");

    const removed = await repos.widgets.remove(dashboardId, widgetId);
    if (!removed) return jsonError("Widget not found", 404);
    return jsonOk({ ok: true });
  });
}
