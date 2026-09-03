import { AlertsManager } from "@/app/(app)/alerts/alerts-manager";
import { requirePageTenant } from "@/lib/auth/tenant";
import { entitlementsFor } from "@/lib/billing/entitlements";
import { METRICS } from "@/lib/alerts/metrics";
import { emailConfigured, EMAIL_SETUP_HINT } from "@/lib/notify/email";
import { listConnections } from "@/lib/connectors";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const repos = await requirePageTenant();

  const [rules, channels, events, connections, entitlements] =
    await Promise.all([
      repos.alertRules.list(),
      repos.channels.list(),
      repos.alertEvents.list(50),
      listConnections(repos),
      entitlementsFor(repos.ctx.organizationId),
    ]);

  return (
    <AlertsManager
      initialRules={rules.map((rule) => ({
        id: rule.id,
        connectionId: rule.connectionId,
        connectionLabel: rule.connectionLabel,
        provider: rule.provider,
        metric: rule.metric,
        comparator: rule.comparator,
        threshold: rule.threshold,
        channelIds: safeIds(rule.channelIdsJson),
        enabled: rule.enabled,
        cooldownMinutes: rule.cooldownMinutes,
        lastState: rule.lastState,
        lastValue: rule.lastValue,
        lastEvaluatedAt: iso(rule.lastEvaluatedAt),
        mutedUntil: iso(rule.mutedUntil),
      }))}
      initialChannels={channels.map((channel) => ({
        id: channel.id,
        kind: channel.kind,
        label: channel.label,
        enabled: channel.enabled,
        lastError: channel.lastError,
        lastDeliveredAt: iso(channel.lastDeliveredAt),
      }))}
      initialEvents={events.map((event) => ({
        id: event.id,
        state: event.state,
        message: event.message,
        connectionLabel: event.connectionLabel,
        provider: event.provider,
        acknowledgedAt: iso(event.acknowledgedAt),
        createdAt: iso(event.createdAt)!,
      }))}
      connections={connections.map((connection) => ({
        id: connection.id,
        provider: connection.provider,
        label: connection.label,
      }))}
      // Sent whole rather than fetched: the catalog is static, and the rule
      // builder is unusable until it arrives.
      metrics={METRICS.map(
        ({ key, provider, label, description, unit, defaultComparator, defaultThreshold }) => ({
          key,
          provider,
          label,
          description,
          unit,
          defaultComparator,
          defaultThreshold,
        }),
      )}
      allowedChannels={entitlements.features.alertChannels}
      planName={entitlements.planName}
      emailReady={emailConfigured()}
      emailSetupHint={EMAIL_SETUP_HINT}
    />
  );
}

/** Dates cross the server/client boundary as ISO strings. */
function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function safeIds(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}
