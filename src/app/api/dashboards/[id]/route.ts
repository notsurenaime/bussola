import { z } from "zod";
import { jsonError, jsonOk, withTenant } from "@/lib/api";
import { toCanvasWidget } from "@/lib/widgets/serialize";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  return withTenant(async (repos) => {
    const { id } = await params;
    const dashboard = await repos.dashboards.get(id);
    if (!dashboard) return jsonError("Dashboard not found", 404);

    const widgets = (await repos.widgets.listFor(id)).map(toCanvasWidget);
    return jsonOk({ dashboard, widgets });
  });
}

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
});

export async function PATCH(request: Request, { params }: Params) {
  return withTenant(async (repos) => {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid payload");

    const existing = await repos.dashboards.get(id);
    if (!existing) return jsonError("Dashboard not found", 404);

    const dashboard = parsed.data.name
      ? await repos.dashboards.rename(id, parsed.data.name)
      : existing;

    return jsonOk({ dashboard });
  });
}
