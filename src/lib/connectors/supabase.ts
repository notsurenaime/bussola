import type {
  ConnectionCredentials,
  Connector,
  StatusItem,
  SupabaseAdvisorsSummary,
  SupabaseDashboard,
  SupabaseServiceItem,
  SupabaseTrafficBucket,
  TestResult,
  TrackerPoint,
} from "./types";
import { friendlyStatusLabel, toUserFacingError } from "./errors";

const BASE = "https://api.supabase.com/v1";
const USAGE_INTERVAL = "7day";
const MAX_DETAIL_PROJECTS = 8;

/** Normalize copy-pasted tokens (Bearer prefix, quotes, whitespace). */
export function normalizeSupabaseToken(raw: string): string {
  let token = raw.trim();
  if (
    (token.startsWith('"') && token.endsWith('"')) ||
    (token.startsWith("'") && token.endsWith("'"))
  ) {
    token = token.slice(1, -1).trim();
  }
  token = token.replace(/^Bearer\s+/i, "").trim();
  token = token.replace(/\s+/g, "");
  return token;
}

function validateSupabaseToken(token: string): string | null {
  if (!token) return "Personal access token required";
  if (token.startsWith("eyJ")) {
    return "This looks like a project API key. Use a personal access token (sbp_…) from Account → Access Tokens.";
  }
  return null;
}

async function supabaseFetch<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase API ${res.status}: ${text.slice(0, 160)}`);
  }
  return res.json() as Promise<T>;
}

type SupabaseProject = {
  id: string;
  ref?: string;
  name: string;
  status: string;
  region?: string;
  created_at?: string;
};

type ServiceHealthRaw = {
  name?: string;
  service?: string;
  healthy?: boolean;
  status?: string;
  info?: { name?: string; healthy?: boolean; status?: string };
};

type UsageRow = {
  timestamp?: string;
  total_auth_requests?: number;
  total_realtime_requests?: number;
  total_rest_requests?: number;
  total_storage_requests?: number;
};

type AdvisorLint = {
  name?: string;
  title?: string;
  level?: string;
  description?: string;
  detail?: string;
  categories?: string[];
};

function projectRef(project: SupabaseProject): string {
  return project.ref || project.id;
}

function mapProjectStatus(status: string): TrackerPoint["status"] {
  const s = status.toLowerCase();
  if (s === "active_healthy" || s === "active") return "ok";
  if (s.includes("fail") || s.includes("inactive") || s.includes("unhealthy")) {
    return "error";
  }
  if (
    s.includes("coming") ||
    s.includes("restor") ||
    s.includes("paus") ||
    s.includes("upgrad")
  ) {
    return "warn";
  }
  return "idle";
}

function mapServiceStatus(
  healthy: boolean | undefined,
  status?: string,
): TrackerPoint["status"] {
  if (typeof healthy === "boolean") {
    return healthy ? "ok" : "error";
  }
  if (!status) return "idle";
  return mapProjectStatus(status);
}

function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${Math.round(value / 1000)}k`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(Math.round(value));
}

function serviceDisplayName(raw: string): string {
  const key = raw.toLowerCase();
  switch (key) {
    case "db":
    case "database":
    case "postgres":
      return "Database";
    case "auth":
    case "gotrue":
      return "Auth";
    case "storage":
      return "Storage";
    case "realtime":
      return "Realtime";
    case "functions":
    case "edge_functions":
    case "edge-functions":
      return "Functions";
    case "rest":
    case "postgrest":
      return "API";
    default:
      return raw.charAt(0).toUpperCase() + raw.slice(1);
  }
}

async function fetchProjectHealth(
  token: string,
  ref: string,
): Promise<ServiceHealthRaw[]> {
  try {
    const data = await supabaseFetch<ServiceHealthRaw[] | { services?: ServiceHealthRaw[] }>(
      token,
      `/projects/${encodeURIComponent(ref)}/health`,
    );
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.services)) return data.services;
    return [];
  } catch {
    return [];
  }
}

async function fetchProjectUsage(
  token: string,
  ref: string,
): Promise<UsageRow[]> {
  try {
    const data = await supabaseFetch<{ result?: UsageRow[]; error?: unknown }>(
      token,
      `/projects/${encodeURIComponent(ref)}/analytics/endpoints/usage.api-counts?interval=${USAGE_INTERVAL}`,
    );
    return data.result || [];
  } catch {
    return [];
  }
}

async function fetchProjectSecurityAdvisors(
  token: string,
  ref: string,
): Promise<AdvisorLint[]> {
  try {
    const data = await supabaseFetch<{ lints?: AdvisorLint[] } | AdvisorLint[]>(
      token,
      `/projects/${encodeURIComponent(ref)}/advisors/security`,
    );
    if (Array.isArray(data)) return data;
    return data.lints || [];
  } catch {
    return [];
  }
}

function normalizeServices(
  projectName: string,
  projectId: string,
  rows: ServiceHealthRaw[],
): SupabaseServiceItem[] {
  return rows
    .map((row, index) => {
      const rawName =
        row.name ||
        row.service ||
        row.info?.name ||
        `service-${index}`;
      const healthy =
        typeof row.healthy === "boolean"
          ? row.healthy
          : typeof row.info?.healthy === "boolean"
            ? row.info.healthy
            : undefined;
      const statusText = row.status || row.info?.status;
      const status = mapServiceStatus(healthy, statusText);
      const serviceName = serviceDisplayName(rawName);
      return {
        id: `${projectId}:${rawName}`,
        projectName,
        serviceName,
        status,
        healthy: status === "ok",
        detail:
          statusText ||
          (status === "ok" ? "Healthy" : friendlyStatusLabel(status)),
      };
    })
    .filter((s) => Boolean(s.serviceName));
}

export const supabaseConnector: Connector = {
  provider: "supabase",
  async test(credentials: ConnectionCredentials): Promise<TestResult> {
    const token = normalizeSupabaseToken(credentials.apiKey || "");
    const validationError = validateSupabaseToken(token);
    if (validationError) {
      return { ok: false, message: validationError };
    }
    try {
      const projects = await supabaseFetch<SupabaseProject[]>(token, "/projects");
      return {
        ok: true,
        message: `Connected — ${projects.length} project(s)`,
      };
    } catch (error) {
      return {
        ok: false,
        message: toUserFacingError(error, "supabase"),
      };
    }
  },
};

export async function fetchSupabaseDashboard(
  apiKey: string,
): Promise<SupabaseDashboard> {
  const token = normalizeSupabaseToken(apiKey);
  const validationError = validateSupabaseToken(token);
  if (validationError) {
    throw new Error(validationError);
  }

  const projects = await supabaseFetch<SupabaseProject[]>(token, "/projects");
  const items: StatusItem[] = projects.map((p) => {
    const status = mapProjectStatus(p.status);
    return {
      id: projectRef(p),
      name: p.name,
      provider: "supabase" as const,
      status,
      detail: p.region
        ? `${friendlyStatusLabel(status)} · ${p.region}`
        : friendlyStatusLabel(status),
      updatedAt: p.created_at,
    };
  });
  const healthy = items.filter((i) => i.status === "ok").length;

  const detailProjects = projects.slice(0, MAX_DETAIL_PROJECTS);
  const services: SupabaseServiceItem[] = [];
  let auth = 0;
  let rest = 0;
  let storage = 0;
  let realtime = 0;
  let usageAvailable = false;

  const advisorSummary: SupabaseAdvisorsSummary = {
    total: 0,
    errors: 0,
    warnings: 0,
    infos: 0,
    projectCount: 0,
    top: [],
  };

  // Sequential-ish batches to respect analytics rate limits (30/min).
  for (const project of detailProjects) {
    const ref = projectRef(project);
    const [healthRows, usageRows, lints] = await Promise.all([
      fetchProjectHealth(token, ref),
      fetchProjectUsage(token, ref),
      fetchProjectSecurityAdvisors(token, ref),
    ]);

    services.push(...normalizeServices(project.name, ref, healthRows));

    if (usageRows.length > 0) {
      usageAvailable = true;
      for (const row of usageRows) {
        auth += row.total_auth_requests || 0;
        rest += row.total_rest_requests || 0;
        storage += row.total_storage_requests || 0;
        realtime += row.total_realtime_requests || 0;
      }
    }

    if (lints.length > 0) {
      advisorSummary.projectCount += 1;
    }
    for (const lint of lints) {
      advisorSummary.total += 1;
      const level = (lint.level || "").toUpperCase();
      if (level === "ERROR" || level === "CRITICAL") advisorSummary.errors += 1;
      else if (level === "WARN" || level === "WARNING") advisorSummary.warnings += 1;
      else advisorSummary.infos += 1;

      if ((advisorSummary.top?.length || 0) < 5) {
        advisorSummary.top = [
          ...(advisorSummary.top || []),
          {
            title: lint.title || lint.name || "Advisor finding",
            level: level || "INFO",
            projectName: project.name,
          },
        ];
      }
    }
  }

  const traffic: SupabaseTrafficBucket[] = usageAvailable
    ? [
        { label: "REST", value: rest, display: formatCount(rest) },
        { label: "Auth", value: auth, display: formatCount(auth) },
        { label: "Storage", value: storage, display: formatCount(storage) },
        { label: "Realtime", value: realtime, display: formatCount(realtime) },
      ]
    : [];

  const requestTotal = auth + rest + storage + realtime;

  return {
    items,
    healthy,
    total: items.length,
    services,
    traffic,
    requestVolume: {
      total: requestTotal,
      days: 7,
      label: usageAvailable
        ? `Across ${detailProjects.length} project${detailProjects.length === 1 ? "" : "s"} · 7 days`
        : "No usage data yet",
    },
    advisors: advisorSummary,
  };
}

/** Back-compat for status-board and older callers. */
export async function fetchSupabaseProjects(apiKey: string): Promise<{
  items: StatusItem[];
  healthy: number;
  total: number;
}> {
  const dash = await fetchSupabaseDashboard(apiKey);
  return { items: dash.items, healthy: dash.healthy, total: dash.total };
}
