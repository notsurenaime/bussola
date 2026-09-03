import { jsonError, withTenant } from "@/lib/api";
import { serveWidgetData } from "@/lib/widgets/serve";
import type { WidgetType } from "@/lib/widgets/registry";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Widget data for a signed-in session.
 *
 * The serving itself lives in `lib/widgets/serve` because a read-only share
 * link needs exactly the same answers — this handler's only job is to turn a
 * session into a tenant and a query string into a request.
 */
export async function GET(request: Request) {
  return withTenant(async (repos) => {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") as WidgetType | null;
    if (!type) return jsonError("type required");

    const rawLimit = Number(searchParams.get("limit"));

    const result = await serveWidgetData(repos, {
      type,
      // Which of this tenant's connections to read. Absent means the default.
      connectionId: searchParams.get("connectionId"),
      limit: Number.isFinite(rawLimit) ? rawLimit : undefined,
      cursor: searchParams.get("cursor"),
    });

    return NextResponse.json(result.body, { status: result.status });
  });
}
