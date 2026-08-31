import { z } from "zod";
import { jsonError, jsonOk, withTenant } from "@/lib/api";

export const runtime = "nodejs";

export async function GET() {
  return withTenant(async (repos) => {
    return jsonOk({ dashboards: await repos.dashboards.list() });
  });
}

const createSchema = z.object({
  name: z.string().min(1).max(80),
});

export async function POST(request: Request) {
  return withTenant(async (repos) => {
    const body = await request.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return jsonError("Name required");

    const dashboard = await repos.dashboards.create(parsed.data.name);
    return jsonOk({ dashboard }, { status: 201 });
  });
}

export async function DELETE(request: Request) {
  return withTenant(async (repos) => {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return jsonError("id required");

    // Widgets cascade with the dashboard row.
    const removed = await repos.dashboards.remove(id);
    if (!removed) return jsonError("Dashboard not found", 404);
    return jsonOk({ ok: true });
  });
}
