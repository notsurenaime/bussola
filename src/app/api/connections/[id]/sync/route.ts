import { jsonError, jsonOk, withTenant } from "@/lib/api";
import { syncNow } from "@/lib/sync/runner";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/**
 * Refresh one connection immediately, ignoring its schedule.
 *
 * Scoped through the tenant repositories first: syncNow works on a raw id, so
 * without this check one tenant could force a refresh of another's connection
 * and drive traffic on their behalf.
 */
export async function POST(_request: Request, { params }: Params) {
  return withTenant(async (repos) => {
    const { id } = await params;

    const connection = await repos.connections.get(id);
    if (!connection) return jsonError("Connection not found", 404);

    const outcome = await syncNow(id);
    if (!outcome) return jsonError("Connection not found", 404);

    return jsonOk({
      ok: outcome.ok,
      error: outcome.error ?? null,
      disabled: outcome.disabled ?? false,
    });
  });
}
