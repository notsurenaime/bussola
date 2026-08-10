import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { jsonError, jsonOk, unauthorized } from "@/lib/api";
import { getDb } from "@/lib/db";
import { dashboardWidgets, dashboards } from "@/lib/db/schema";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const dashboard = getDb()
    .select()
    .from(dashboards)
    .where(eq(dashboards.id, id))
    .get();

  if (!dashboard) return jsonError("Dashboard not found", 404);

  const widgets = getDb()
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

  return jsonOk({ dashboard, widgets });
}

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
});

export async function PATCH(request: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid payload");

  const existing = getDb()
    .select()
    .from(dashboards)
    .where(eq(dashboards.id, id))
    .get();
  if (!existing) return jsonError("Dashboard not found", 404);

  getDb()
    .update(dashboards)
    .set({
      name: parsed.data.name ?? existing.name,
      updatedAt: new Date(),
    })
    .where(eq(dashboards.id, id))
    .run();

  const dashboard = getDb()
    .select()
    .from(dashboards)
    .where(eq(dashboards.id, id))
    .get();

  return jsonOk({ dashboard });
}
