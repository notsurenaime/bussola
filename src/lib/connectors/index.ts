import { eq } from "drizzle-orm";
import { decryptSecret, encryptSecret } from "@/lib/crypto/vault";
import { getDb } from "@/lib/db";
import { connections, type Provider } from "@/lib/db/schema";
import { createId } from "@/lib/id";
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

export async function testAndPersist(
  connectionId: string,
): Promise<TestResult> {
  const db = getDb();
  const row = db
    .select()
    .from(connections)
    .where(eq(connections.id, connectionId))
    .get();
  if (!row) {
    return { ok: false, message: "Connection not found" };
  }

  const connector = getConnector(row.provider);
  if (!connector) {
    return { ok: false, message: "Provider not supported yet" };
  }

  const credentials = parseCredentials(row.credentialsEncrypted);
  const result = await connector.test(credentials);
  db.update(connections)
    .set({
      status: result.ok ? "connected" : "error",
      lastCheckedAt: new Date(),
      lastError: result.ok ? null : result.message,
      updatedAt: new Date(),
    })
    .where(eq(connections.id, connectionId))
    .run();

  return result;
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

export function upsertConnection(input: {
  id?: string;
  provider: Provider;
  label: string;
  credentials: ConnectionCredentials;
}) {
  const db = getDb();
  const now = new Date();
  const credentials = normalizeCredentials(input.credentials);
  const encrypted = encryptSecret(JSON.stringify(credentials));

  if (input.id) {
    db.update(connections)
      .set({
        label: input.label,
        credentialsEncrypted: encrypted,
        status: "unknown",
        lastError: null,
        updatedAt: now,
      })
      .where(eq(connections.id, input.id))
      .run();
    return input.id;
  }

  const id = createId("con");
  db.insert(connections)
    .values({
      id,
      provider: input.provider,
      label: input.label,
      credentialsEncrypted: encrypted,
      status: "unknown",
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return id;
}

export function listConnections() {
  return getDb().select().from(connections).all().map((row) => ({
    id: row.id,
    provider: row.provider as Provider,
    label: row.label,
    status: row.status,
    lastCheckedAt: row.lastCheckedAt,
    lastError: row.lastError,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

export function getConnectionByProvider(provider: Provider) {
  return getDb()
    .select()
    .from(connections)
    .where(eq(connections.provider, provider))
    .get();
}

export function deleteConnection(id: string) {
  getDb().delete(connections).where(eq(connections.id, id)).run();
}

export * from "./railway";
export * from "./netlify";
export * from "./supabase";
export * from "./qonto";
export * from "./types";
