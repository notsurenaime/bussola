import { decryptSecret, encryptSecret } from "@/lib/crypto/vault";
import type { TenantRepos } from "@/lib/db/tenant";
import type { Provider } from "@/lib/db/schema";
import { netlifyConnector } from "./netlify";
import { qontoConnector } from "./qonto";
import { railwayConnector } from "./railway";
import { supabaseConnector } from "./supabase";
import type { ConnectionCredentials, Connector, TestResult } from "./types";

const connectors: Record<string, Connector> = {
  railway: railwayConnector,
  netlify: netlifyConnector,
  supabase: supabaseConnector,
  qonto: qontoConnector,
};

export const LIVE_PROVIDERS: Provider[] = [
  "railway",
  "netlify",
  "supabase",
  "qonto",
];

export const COMING_SOON_PROVIDERS: Provider[] = [
  "stripe",
  "polar",
  "attio",
  "vercel",
  "webtraffic",
];

export function getConnector(provider: string): Connector | null {
  return connectors[provider] || null;
}

export function parseCredentials(encrypted: string): ConnectionCredentials {
  return JSON.parse(decryptSecret(encrypted)) as ConnectionCredentials;
}

function normalizeCredentials(
  credentials: ConnectionCredentials,
): ConnectionCredentials {
  const trim = (value?: string) => {
    if (value == null) return value;
    const next = value.trim();
    return next.length ? next : undefined;
  };
  return {
    ...credentials,
    apiKey: trim(credentials.apiKey),
    login: trim(credentials.login),
    secretKey: trim(credentials.secretKey),
    accessToken: trim(credentials.accessToken),
    refreshToken: trim(credentials.refreshToken),
    orgSlug: trim(credentials.orgSlug),
  };
}

/**
 * Run the provider's credential check and record the outcome.
 *
 * `repos` is already bound to the caller's organization, so an id belonging to
 * another tenant resolves to nothing rather than being tested or overwritten.
 */
export async function testAndPersist(
  repos: TenantRepos,
  connectionId: string,
): Promise<TestResult> {
  const row = await repos.connections.get(connectionId);
  if (!row) {
    return { ok: false, message: "Connection not found" };
  }

  const connector = getConnector(row.provider);
  if (!connector) {
    return { ok: false, message: "Provider not supported yet" };
  }

  const credentials = parseCredentials(row.credentialsEncrypted);
  const result = await connector.test(credentials);

  await repos.connections.recordTest(connectionId, {
    status: result.ok ? "connected" : "error",
    error: result.ok ? null : result.message,
  });

  return result;
}

export async function upsertConnection(
  repos: TenantRepos,
  input: {
    id?: string;
    provider: Provider;
    label: string;
    credentials: ConnectionCredentials;
  },
): Promise<string | null> {
  const credentialsEncrypted = encryptSecret(
    JSON.stringify(normalizeCredentials(input.credentials)),
  );

  if (input.id) {
    const updated = await repos.connections.update(input.id, {
      label: input.label,
      credentialsEncrypted,
    });
    return updated?.id ?? null;
  }

  const created = await repos.connections.create({
    provider: input.provider,
    label: input.label,
    credentialsEncrypted,
  });
  return created.id;
}

/** Connection rows minus the ciphertext, safe to serialize to the client. */
export async function listConnections(repos: TenantRepos) {
  const rows = await repos.connections.list();
  return rows.map((row) => ({
    id: row.id,
    provider: row.provider,
    label: row.label,
    status: row.status,
    lastCheckedAt: row.lastCheckedAt,
    lastError: row.lastError,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

export * from "./railway";
export * from "./netlify";
export * from "./supabase";
export * from "./qonto";
export * from "./types";
