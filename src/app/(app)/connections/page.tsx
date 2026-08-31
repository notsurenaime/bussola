import { requireTenant } from "@/lib/auth/tenant";
import { COMING_SOON_PROVIDERS, listConnections } from "@/lib/connectors";
import { ConnectionsManager } from "./connections-manager";

export default async function ConnectionsPage() {
  const repos = await requireTenant();
  const connections = await listConnections(repos);

  return (
    <ConnectionsManager
      // Dates cross the server/client boundary as ISO strings.
      initialConnections={connections.map((connection) => ({
        ...connection,
        lastCheckedAt: connection.lastCheckedAt?.toISOString() ?? null,
        createdAt: connection.createdAt.toISOString(),
        updatedAt: connection.updatedAt.toISOString(),
      }))}
      comingSoon={COMING_SOON_PROVIDERS}
    />
  );
}
