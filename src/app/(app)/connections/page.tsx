import { requirePageTenant } from "@/lib/auth/tenant";
import { COMING_SOON_PROVIDERS, LIVE_PROVIDERS, listConnections } from "@/lib/connectors";
import { getWidgetDefinition } from "@/lib/widgets/registry";
import { ConnectionsManager, type ConnectionView } from "./connections-manager";

export default async function ConnectionsPage() {
  const repos = await requirePageTenant();
  const [connections, widgetTypes] = await Promise.all([
    listConnections(repos),
    repos.widgets.listTypes(),
  ]);

  // How many widgets read from each provider, so removing a connection can say
  // what it will affect.
  const widgetCounts: Record<string, number> = {};
  for (const type of widgetTypes) {
    const provider = getWidgetDefinition(type)?.provider;
    if (!provider || provider === "multi") continue;
    widgetCounts[provider] = (widgetCounts[provider] ?? 0) + 1;
  }

  const views: ConnectionView[] = connections.map((connection) => ({
    id: connection.id,
    provider: connection.provider,
    label: connection.label,
    status: connection.status,
    lastError: connection.lastError,
    syncEnabled: connection.syncEnabled,
    // Dates cross the server/client boundary as ISO strings.
    lastSyncedAt: connection.lastSyncedAt?.toISOString() ?? null,
    consecutiveFailures: connection.consecutiveFailures,
  }));

  return (
    <ConnectionsManager
      connections={views}
      liveProviders={LIVE_PROVIDERS}
      comingSoon={COMING_SOON_PROVIDERS}
      widgetCounts={widgetCounts}
    />
  );
}
