export type ConnectionHealthInput = {
  status: string;
  syncEnabled: boolean;
  consecutiveFailures: number;
};

export type ConnectionHealth = {
  tone: "ok" | "warn" | "error";
  label: string;
};

/**
 * What a connection card should say.
 *
 * The order matters. A connection whose sync has been switched off after
 * repeated failures still has status "error" and a stale error message, but
 * the useful thing to say is that it has stopped trying — that is the state
 * needing action, and it is the one a plain status field cannot express.
 */
export function connectionHealth(
  connection: ConnectionHealthInput,
): ConnectionHealth {
  if (!connection.syncEnabled) {
    return { tone: "error", label: "Sync stopped" };
  }
  if (connection.status === "error" || connection.consecutiveFailures > 0) {
    // Still scheduled, so this is a transient blip rather than a dead token.
    return { tone: "warn", label: "Retrying" };
  }
  if (connection.status === "connected") {
    return { tone: "ok", label: "Connected" };
  }
  return { tone: "warn", label: "Not tested" };
}
