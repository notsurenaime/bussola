import { z } from "zod";
import { jsonError, jsonOk, withTenant } from "@/lib/api";

export const runtime = "nodejs";

/**
 * The in-app alert feed.
 *
 * Written on every notification whether or not a channel accepted it, so this
 * is the one place that always has the full history — a Slack webhook that has
 * been deleted loses the message, never the record that the rule fired.
 */
export async function GET(request: Request) {
  return withTenant(async (repos) => {
    const { searchParams } = new URL(request.url);
    const rawLimit = Number(searchParams.get("limit") || "50");
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(Math.trunc(rawLimit), 1), 200)
      : 50;

    const events = await repos.alertEvents.list(limit);

    return jsonOk({
      events: events.map((event) => ({
        id: event.id,
        ruleId: event.ruleId,
        state: event.state,
        value: event.value,
        message: event.message,
        metric: event.metric,
        provider: event.provider,
        connectionLabel: event.connectionLabel,
        acknowledgedAt: event.acknowledgedAt,
        createdAt: event.createdAt,
        // Which channels took it, and what any of them said when they didn't.
        deliveries: parseDeliveries(event.deliveriesJson),
      })),
      unacknowledged: await repos.alertEvents.unacknowledgedCount(),
    });
  });
}

function parseDeliveries(raw: string): unknown[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const ackSchema = z.object({
  /** Omitted means "everything currently unacknowledged". */
  id: z.string().optional(),
});

export async function POST(request: Request) {
  return withTenant(async (repos) => {
    const body = await request.json().catch(() => null);
    const parsed = ackSchema.safeParse(body ?? {});
    if (!parsed.success) return jsonError("Invalid payload");

    if (!parsed.data.id) {
      const count = await repos.alertEvents.acknowledgeAll();
      return jsonOk({ ok: true, acknowledged: count });
    }

    const event = await repos.alertEvents.acknowledge(parsed.data.id);
    if (!event) return jsonError("Alert not found", 404);
    return jsonOk({ ok: true, acknowledged: 1 });
  });
}
