import { eq } from "drizzle-orm";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { jsonError, jsonOk, unauthorized } from "@/lib/api";
import { getDb } from "@/lib/db";
import { dashboardWidgets, dashboards } from "@/lib/db/schema";
import { createId } from "@/lib/id";
import { getWidgetDefinition } from "@/lib/widgets/registry";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

const addSchema = z.object({
  widgetType: z.string(),
  title: z.string().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id: dashboardId } = await params;
  const dashboard = getDb()
    .select()
    .from(dashboards)
    .where(eq(dashboards.id, dashboardId))
    .get();
  if (!dashboard) return jsonError("Dashboard not found", 404);

  const body = await request.json().catch(() => null);
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid widget payload");

  const def = getWidgetDefinition(parsed.data.widgetType);
  if (!def) return jsonError("Unknown widget type");

  const existing = getDb()
    .select()
    .from(dashboardWidgets)
    .where(eq(dashboardWidgets.dashboardId, dashboardId))
    .all();
  const maxY = existing.reduce(
    (acc, w) => Math.max(acc, w.layoutY + w.layoutH),
    0,
  );

  const now = new Date();
  const widgetId = createId("wdg");
  getDb()
    .insert(dashboardWidgets)
    .values({
      id: widgetId,
      dashboardId,
      widgetType: def.type,
      title: parsed.data.title || def.name,
      configJson: JSON.stringify(parsed.data.config || {}),
      layoutX: 0,
      layoutY: maxY,
      layoutW: def.defaultW,
      layoutH: def.defaultH,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  getDb()
    .update(dashboards)
    .set({ updatedAt: now })
    .where(eq(dashboards.id, dashboardId))
    .run();

  return jsonOk(
    {
      widget: {
        id: widgetId,
        widgetType: def.type,
        title: parsed.data.title || def.name,
        config: parsed.data.config || {},
        layout: {
          i: widgetId,
          x: 0,
          y: maxY,
          w: def.defaultW,
          h: def.defaultH,
        },
      },
    },
    { status: 201 },
  );
}

const layoutSchema = z.object({
  layouts: z.array(
    z.object({
      i: z.string(),
      x: z.number(),
      y: z.number(),
      w: z.number(),
      h: z.number(),
    }),
  ),
});

export async function PUT(request: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id: dashboardId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = layoutSchema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid layout payload");

  const now = new Date();
  const db = getDb();

  for (const item of parsed.data.layouts) {
    db.update(dashboardWidgets)
      .set({
        layoutX: item.x,
        layoutY: item.y,
        layoutW: item.w,
        layoutH: item.h,
        updatedAt: now,
      })
      .where(eq(dashboardWidgets.id, item.i))
      .run();
  }

  db.update(dashboards)
    .set({ updatedAt: now })
    .where(eq(dashboards.id, dashboardId))
    .run();

  return jsonOk({ ok: true });
}

export async function DELETE(request: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id: dashboardId } = await params;
  const { searchParams } = new URL(request.url);
  const widgetId = searchParams.get("widgetId");
  if (!widgetId) return jsonError("widgetId required");

  getDb()
    .delete(dashboardWidgets)
    .where(eq(dashboardWidgets.id, widgetId))
    .run();

  getDb()
    .update(dashboards)
    .set({ updatedAt: new Date() })
    .where(eq(dashboards.id, dashboardId))
    .run();

  return jsonOk({ ok: true });
}
