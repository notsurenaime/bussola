import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { jsonError, jsonOk, unauthorized } from "@/lib/api";
import { getDb } from "@/lib/db";
import { dashboardWidgets, dashboards } from "@/lib/db/schema";
import { createId } from "@/lib/id";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const rows = getDb()
    .select()
    .from(dashboards)
    .orderBy(desc(dashboards.updatedAt))
    .all();

  return jsonOk({ dashboards: rows });
}

const createSchema = z.object({
  name: z.string().min(1).max(80),
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return jsonError("Name required");

  const now = new Date();
  const id = createId("dash");
  getDb()
    .insert(dashboards)
    .values({
      id,
      name: parsed.data.name,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  const dashboard = getDb()
    .select()
    .from(dashboards)
    .where(eq(dashboards.id, id))
    .get();

  return jsonOk({ dashboard }, { status: 201 });
}

export async function DELETE(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return jsonError("id required");

  getDb().delete(dashboardWidgets).where(eq(dashboardWidgets.dashboardId, id)).run();
  getDb().delete(dashboards).where(eq(dashboards.id, id)).run();
  return jsonOk({ ok: true });
}
