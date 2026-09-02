import { z } from "zod";
import { jsonError, jsonOk, withTenant } from "@/lib/api";
import { getMetric, METRICS } from "@/lib/alerts/metrics";
import { entitlementsFor } from "@/lib/billing/entitlements";

export const runtime = "nodejs";

const COMPARATORS = ["above", "below", "equals", "not_equals"] as const;

/** The catalog the rule builder renders, minus the extractor functions. */
const METRIC_CATALOG = METRICS.map(
  ({ key, provider, label, description, unit, defaultComparator, defaultThreshold }) => ({
    key,
    provider,
    label,
    description,
    unit,
    defaultComparator,
    defaultThreshold,
  }),
);

function toDto(row: {
  id: string;
  connectionId: string;
  metric: string;
  comparator: string;
  threshold: string;
  channelIdsJson: string;
  enabled: boolean;
  cooldownMinutes: number;
  lastState: string | null;
  lastValue: string | null;
  lastEvaluatedAt: Date | null;
  lastNotifiedAt: Date | null;
  mutedUntil: Date | null;
  createdAt: Date;
  provider: string;
  connectionLabel: string;
}) {
  let channelIds: string[] = [];
  try {
    const parsed = JSON.parse(row.channelIdsJson);
    if (Array.isArray(parsed)) channelIds = parsed.filter((id) => typeof id === "string");
  } catch {
    channelIds = [];
  }

  return {
    id: row.id,
    connectionId: row.connectionId,
    connectionLabel: row.connectionLabel,
    provider: row.provider,
    metric: row.metric,
    metricLabel: getMetric(row.metric)?.label ?? row.metric,
    unit: getMetric(row.metric)?.unit ?? "count",
    comparator: row.comparator,
    threshold: row.threshold,
    channelIds,
    enabled: row.enabled,
    cooldownMinutes: row.cooldownMinutes,
    lastState: row.lastState,
    lastValue: row.lastValue,
    lastEvaluatedAt: row.lastEvaluatedAt,
    lastNotifiedAt: row.lastNotifiedAt,
    mutedUntil: row.mutedUntil,
    createdAt: row.createdAt,
  };
}

export async function GET() {
  return withTenant(async (repos) => {
    const entitlements = await entitlementsFor(repos.ctx.organizationId);
    return jsonOk({
      rules: (await repos.alertRules.list()).map(toDto),
      metrics: METRIC_CATALOG,
      allowedChannels: entitlements.features.alertChannels,
      planName: entitlements.planName,
    });
  });
}

const createSchema = z.object({
  connectionId: z.string(),
  metric: z.string(),
  comparator: z.enum(COMPARATORS),
  threshold: z.number().finite(),
  channelIds: z.array(z.string()).max(10).optional(),
  cooldownMinutes: z.number().int().min(5).max(1440).optional(),
});

export async function POST(request: Request) {
  return withTenant(async (repos) => {
    const body = await request.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid rule payload");

    const entitlements = await entitlementsFor(repos.ctx.organizationId);
    if (entitlements.features.alertChannels.length === 0) {
      return jsonError(
        `Alerts are not part of the ${entitlements.planName} plan.`,
        402,
      );
    }

    const connection = await repos.connections.get(parsed.data.connectionId);
    if (!connection) return jsonError("Connection not found", 404);

    const metric = getMetric(parsed.data.metric);
    if (!metric) return jsonError("Unknown metric");
    if (metric.provider !== connection.provider) {
      return jsonError(
        `${metric.label} is a ${metric.provider} metric, not ${connection.provider}.`,
      );
    }

    // Channel ids are checked against this tenant's own channels, so a rule
    // cannot be pointed at another organization's Slack webhook.
    const own = new Set((await repos.channels.list()).map((c) => c.id));
    const channelIds = (parsed.data.channelIds ?? []).filter((id) => own.has(id));

    const rule = await repos.alertRules.create({
      connectionId: connection.id,
      metric: metric.key,
      comparator: parsed.data.comparator,
      threshold: String(parsed.data.threshold),
      channelIds,
      cooldownMinutes: parsed.data.cooldownMinutes ?? 60,
    });

    return jsonOk(
      {
        rule: toDto({
          ...rule,
          provider: connection.provider,
          connectionLabel: connection.label,
        }),
      },
      { status: 201 },
    );
  });
}

const updateSchema = z.object({
  id: z.string(),
  comparator: z.enum(COMPARATORS).optional(),
  threshold: z.number().finite().optional(),
  channelIds: z.array(z.string()).max(10).optional(),
  enabled: z.boolean().optional(),
  cooldownMinutes: z.number().int().min(5).max(1440).optional(),
  /** Hours to stay quiet, or 0 to unmute. */
  muteHours: z.number().int().min(0).max(720).optional(),
});

export async function PATCH(request: Request) {
  return withTenant(async (repos) => {
    const body = await request.json().catch(() => null);
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid rule payload");

    const existing = await repos.alertRules.get(parsed.data.id);
    if (!existing) return jsonError("Rule not found", 404);

    let channelIds: string[] | undefined;
    if (parsed.data.channelIds) {
      const own = new Set((await repos.channels.list()).map((c) => c.id));
      channelIds = parsed.data.channelIds.filter((id) => own.has(id));
    }

    const rule = await repos.alertRules.update(parsed.data.id, {
      comparator: parsed.data.comparator,
      threshold:
        parsed.data.threshold !== undefined
          ? String(parsed.data.threshold)
          : undefined,
      channelIds,
      enabled: parsed.data.enabled,
      cooldownMinutes: parsed.data.cooldownMinutes,
      ...(parsed.data.muteHours !== undefined
        ? {
            mutedUntil: parsed.data.muteHours
              ? new Date(Date.now() + parsed.data.muteHours * 3_600_000)
              : null,
          }
        : {}),
    });
    if (!rule) return jsonError("Rule not found", 404);

    const connection = await repos.connections.get(rule.connectionId);
    return jsonOk({
      rule: toDto({
        ...rule,
        provider: connection?.provider ?? "unknown",
        connectionLabel: connection?.label ?? "Removed source",
      }),
    });
  });
}

export async function DELETE(request: Request) {
  return withTenant(async (repos) => {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return jsonError("id required");

    const removed = await repos.alertRules.remove(id);
    if (!removed) return jsonError("Rule not found", 404);
    return jsonOk({ ok: true });
  });
}
