import type {
  ConnectionCredentials,
  Connector,
  RailwayDashboard,
  RailwayDeployAttempt,
  RailwayDeployHealth,
  RailwayDeployItem,
  RailwayFleetHealth,
  RailwayResourceSnapshot,
  RailwayUsageItem,
  StatusItem,
  TestResult,
  TrackerPoint,
} from "./types";
import { friendlyStatusLabel, toUserFacingError } from "./errors";
import { fetchJson } from "./http";

const ENDPOINT = "https://backboard.railway.com/graphql/v2";
const DEPLOY_TRAIL_LEN = 24;
const RECENT_DEPLOYS = 25;
const FAILED_ATTEMPTS_SHOWN = 3;
const METRICS_LOOKBACK_MS = 60 * 60 * 1000;

type AuthMode = "account" | "project";

async function railwayGraphql<T>(
  token: string,
  query: string,
  mode: AuthMode,
  variables?: Record<string, unknown>,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (mode === "project") {
    headers["Project-Access-Token"] = token;
  } else {
    headers.Authorization = `Bearer ${token}`;
  }

  const json = await fetchJson<{
    data?: T;
    errors?: Array<{ message: string }>;
  }>(
    ENDPOINT,
    { method: "POST", headers, body: JSON.stringify({ query, variables }) },
    { label: "Railway" },
  );

  if (json.errors?.length) {
    throw new Error(json.errors[0]?.message || "Railway GraphQL error");
  }

  if (!json.data) {
    throw new Error("Empty Railway response");
  }

  return json.data;
}

async function resolveRailwayAuth(token: string): Promise<{
  mode: AuthMode;
  projectId?: string;
  environmentId?: string;
  label: string;
}> {
  try {
    const projectAuth = await railwayGraphql<{
      projectToken: { projectId: string; environmentId: string };
    }>(token, `query { projectToken { projectId environmentId } }`, "project");

    let label = "Railway project";
    try {
      const project = await railwayGraphql<{
        project: { name?: string };
      }>(
        token,
        `query ($id: String!) { project(id: $id) { name } }`,
        "project",
        { id: projectAuth.projectToken.projectId },
      );
      if (project.project.name) label = project.project.name;
    } catch {
      // optional
    }

    return {
      mode: "project",
      projectId: projectAuth.projectToken.projectId,
      environmentId: projectAuth.projectToken.environmentId,
      label,
    };
  } catch {
    // Fall through to Bearer account token.
  }

  const account = await railwayGraphql<{
    me: { name?: string; email?: string };
  }>(token, `query { me { name email } }`, "account");

  return {
    mode: "account",
    label: account.me.name || account.me.email || "Railway account",
  };
}

type Tone = TrackerPoint["status"];
type ActiveStatus = RailwayDeployHealth["active"]["status"];

type StatusSpec = {
  tone: Tone;
  label: string;
  stage: string;
  active: ActiveStatus;
  inFlight?: boolean;
  failed?: boolean;
  liveCandidate?: boolean;
};

/** Single source of truth: raw Railway deploy status → everything derived from it. */
const RAILWAY_STATUS: Record<string, StatusSpec> = {
  SUCCESS: { tone: "ok", label: "Running", stage: "Running", active: "healthy", liveCandidate: true },
  CRASHED: { tone: "error", label: "Crashed", stage: "Crashed at runtime", active: "crashed", liveCandidate: true },
  FAILED: { tone: "warn", label: "Failed", stage: "Failed to ship", active: "unknown", failed: true },
  BUILDING: { tone: "warn", label: "Building", stage: "Building", active: "unknown", inFlight: true },
  DEPLOYING: { tone: "warn", label: "Deploying", stage: "Deploying", active: "unknown", inFlight: true },
  INITIALIZING: { tone: "warn", label: "Starting", stage: "Starting", active: "unknown", inFlight: true },
  QUEUED: { tone: "warn", label: "Queued", stage: "Queued", active: "unknown", inFlight: true },
  WAITING: { tone: "warn", label: "Waiting", stage: "Waiting", active: "unknown", inFlight: true },
  SLEEPING: { tone: "idle", label: "Sleeping", stage: "Sleeping", active: "sleeping" },
  REMOVED: { tone: "idle", label: "Removed", stage: "Removed", active: "unknown" },
  REMOVING: { tone: "idle", label: "Removed", stage: "Removed", active: "unknown" },
  SKIPPED: { tone: "idle", label: "Skipped", stage: "Skipped", active: "unknown" },
};

const TONE_CLASS: Record<Tone, string> = {
  ok: "bg-success",
  warn: "bg-warning",
  error: "bg-destructive",
  idle: "bg-muted-foreground/30",
};

function statusSpec(raw?: string): StatusSpec | undefined {
  return raw ? RAILWAY_STATUS[raw.toUpperCase()] : undefined;
}

export function statusColor(status: string): Tone {
  return statusSpec(status)?.tone ?? "idle";
}

function colorFor(status: Tone): string {
  return TONE_CLASS[status];
}

export function rawStatusLabel(raw: string): string {
  return statusSpec(raw)?.label ?? friendlyStatusLabel(statusColor(raw));
}

function isHealthyService(status: Tone): boolean {
  return status === "ok";
}

type ProjectNode = {
  id: string;
  name: string;
  environments?: {
    edges: Array<{ node: { id: string; name: string; isEphemeral?: boolean } }>;
  };
  services: {
    edges: Array<{
      node: {
        id: string;
        name: string;
        serviceInstances: {
          edges: Array<{
            node: {
              environmentId?: string;
              latestDeployment?: {
                id?: string;
                status: string;
                createdAt: string;
                meta?: Record<string, unknown> | null;
              } | null;
            };
          }>;
        };
      };
    }>;
  };
};

type DeploymentNode = {
  id: string;
  status: string;
  createdAt: string;
  serviceId: string;
  meta?: Record<string, unknown> | null;
};

function metaString(
  meta: Record<string, unknown> | null | undefined,
  ...keys: string[]
): string | undefined {
  if (!meta) return undefined;
  for (const key of keys) {
    const value = meta[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

/** Commit label / hash / branch pulled from a deployment's `meta` blob. */
function readDeployMeta(meta?: Record<string, unknown> | null): {
  label: string;
  commitHash?: string;
  branch?: string;
} {
  const hash = metaString(meta, "commitHash", "commitSha", "sha");
  const commitHash = hash ? hash.slice(0, 7) : undefined;
  const message = metaString(meta, "commitMessage", "message", "title");
  let label = "Deploy";
  if (message) {
    const oneLine = message.split("\n")[0].trim();
    label = oneLine.length > 72 ? `${oneLine.slice(0, 69)}…` : oneLine;
  } else if (commitHash) {
    label = commitHash;
  }
  return { label, commitHash, branch: metaString(meta, "branch", "branchName") };
}

/** Human stage from status, with a light meta hint for the FAILED reason. */
export function deployStage(
  rawStatus: string,
  meta?: Record<string, unknown> | null,
): string {
  const spec = statusSpec(rawStatus);
  if (spec?.failed) {
    const reason =
      metaString(meta, "reason", "error", "failureReason")?.toLowerCase() ?? "";
    if (reason.includes("build")) return "Build failed";
    if (reason.includes("health")) return "Healthcheck failed";
    if (reason.includes("deploy")) return "Deploy failed";
  }
  return spec?.stage ?? rawStatusLabel(rawStatus);
}

function toAttempt(d: DeploymentNode): RailwayDeployAttempt {
  const { label, commitHash, branch } = readDeployMeta(d.meta);
  return {
    id: d.id,
    createdAt: d.createdAt,
    rawStatus: d.status,
    stage: deployStage(d.status, d.meta),
    label,
    commitHash,
    branch,
  };
}

const isInFlightStatus = (s: string) => statusSpec(s)?.inFlight === true;
const isFailedAttemptStatus = (s: string) => statusSpec(s)?.failed === true;
const isLiveCandidateStatus = (s: string) =>
  statusSpec(s)?.liveCandidate === true;

function activeStatusFromRaw(raw?: string): ActiveStatus {
  return statusSpec(raw)?.active ?? "unknown";
}

/**
 * Live deploy + how many newer failed attempts sit on top of it
 * (“2 behind” when live is old SUCCESS and newer deploys FAILED).
 */
function buildServiceDeployHealth(
  deployments: DeploymentNode[],
  service: { id: string; name: string; projectName: string },
): RailwayDeployHealth {
  const newestFirst = [...deployments].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const failedSinceActive: RailwayDeployAttempt[] = [];
  let inFlight: RailwayDeployAttempt | null = null;
  let live: DeploymentNode | undefined;

  for (const d of newestFirst) {
    const s = d.status.toUpperCase();
    if (s === "REMOVED" || s === "REMOVING" || s === "SKIPPED") continue;

    if (isInFlightStatus(d.status)) {
      if (!inFlight) inFlight = toAttempt(d);
      continue;
    }

    if (isFailedAttemptStatus(d.status)) {
      if (!live) failedSinceActive.push(toAttempt(d));
      continue;
    }

    if (isLiveCandidateStatus(d.status)) {
      live = d;
      break;
    }
  }

  return {
    serviceId: service.id,
    serviceName: service.name,
    projectName: service.projectName,
    active: live
      ? {
          status: activeStatusFromRaw(live.status),
          createdAt: live.createdAt,
          label: readDeployMeta(live.meta).label,
          commitHash: readDeployMeta(live.meta).commitHash,
          rawStatus: live.status,
        }
      : { status: "unknown" },
    behindCount: failedSinceActive.length,
    failedSinceActive: failedSinceActive.slice(0, FAILED_ATTEMPTS_SHOWN),
    inFlight,
  };
}

function pickPrimaryDeployHealth(
  candidates: RailwayDeployHealth[],
): RailwayDeployHealth | null {
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => {
    const rank = (h: RailwayDeployHealth) => {
      if (h.active.status === "crashed") return 300 + h.behindCount;
      if (h.behindCount > 0) return 200 + h.behindCount;
      if (h.inFlight) return 100;
      if (h.active.status === "sleeping") return 10;
      if (h.active.status === "healthy") return 1;
      return 0;
    };
    return rank(b) - rank(a);
  })[0];
}

/** Honest deploy trail: last N deploys as discrete points (oldest → newest). */
function buildDeployTrail(
  deployments: DeploymentNode[],
  serviceName: string,
  latestStatus?: string,
): { points: TrackerPoint[]; detail: string } {
  const chronological = [...deployments]
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )
    .slice(-DEPLOY_TRAIL_LEN);

  if (chronological.length === 0) {
    if (!latestStatus) {
      return { points: [], detail: "No deploys yet" };
    }
    const status = statusColor(latestStatus);
    return {
      points: [
        {
          key: "latest",
          color: colorFor(status),
          tooltip: `${serviceName}: ${rawStatusLabel(latestStatus)}`,
          status,
        },
      ],
      detail: `Latest · ${rawStatusLabel(latestStatus)}`,
    };
  }

  const points = chronological.map((d) => {
    const status = statusColor(d.status);
    return {
      key: d.id,
      color: colorFor(status),
      tooltip: `${serviceName}: ${rawStatusLabel(d.status)}`,
      status,
    };
  });

  const current = latestStatus || chronological[chronological.length - 1].status;
  const failed = chronological.filter(
    (d) => statusColor(d.status) === "error" || statusColor(d.status) === "warn",
  ).length;

  return {
    points,
    detail:
      failed > 0
        ? `${chronological.length} deploys · ${failed} issues · ${rawStatusLabel(current)}`
        : `${chronological.length} deploys · ${rawStatusLabel(current)}`,
  };
}

const DEPLOYMENTS_QUERY = `query ($input: DeploymentListInput!, $first: Int!) {
  deployments(input: $input, first: $first) {
    edges { node { id status createdAt serviceId meta } }
  }
}`;

async function fetchDeployments(
  token: string,
  mode: AuthMode,
  opts: {
    projectId: string;
    environmentId?: string;
    serviceId?: string;
    first: number;
    swallow?: boolean;
  },
): Promise<DeploymentNode[]> {
  try {
    const data = await railwayGraphql<{
      deployments: { edges: Array<{ node: DeploymentNode }> };
    }>(token, DEPLOYMENTS_QUERY, mode, {
      first: opts.first,
      input: {
        projectId: opts.projectId,
        ...(opts.environmentId ? { environmentId: opts.environmentId } : {}),
        ...(opts.serviceId ? { serviceId: opts.serviceId } : {}),
      },
    });
    return data.deployments.edges.map((e) => e.node);
  } catch (error) {
    if (opts.swallow) return [];
    throw error;
  }
}

function pickEnvironmentId(
  project: ProjectNode,
  preferred?: string,
): string | undefined {
  if (preferred) return preferred;
  const envs = project.environments?.edges.map((e) => e.node) || [];
  const production = envs.find(
    (e) => e.name.toLowerCase() === "production" && !e.isEphemeral,
  );
  return production?.id || envs.find((e) => !e.isEphemeral)?.id || envs[0]?.id;
}

async function fetchEnvironmentMetrics(
  token: string,
  mode: AuthMode,
  environmentId: string,
): Promise<{ cpu: number[]; memory: number[] }> {
  const startDate = new Date(Date.now() - METRICS_LOOKBACK_MS).toISOString();
  try {
    const data = await railwayGraphql<{
      metrics: Array<{
        measurement: string;
        values?: Array<{ ts: number | string; value: number | null }>;
      }>;
    }>(
      token,
      `query (
        $environmentId: String!
        $startDate: DateTime!
        $measurements: [MetricMeasurement!]!
        $groupBy: [MetricTag!]
      ) {
        metrics(
          environmentId: $environmentId
          startDate: $startDate
          measurements: $measurements
          groupBy: $groupBy
        ) {
          measurement
          values { ts value }
        }
      }`,
      mode,
      {
        environmentId,
        startDate,
        measurements: ["CPU_USAGE", "MEMORY_USAGE_GB"],
        groupBy: ["SERVICE_ID"],
      },
    );

    const cpu: number[] = [];
    const memory: number[] = [];
    for (const series of data.metrics || []) {
      const values = (series.values || [])
        .map((v) => v.value)
        .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
      if (values.length === 0) continue;
      const latest = values[values.length - 1];
      if (series.measurement === "CPU_USAGE") cpu.push(latest);
      if (series.measurement === "MEMORY_USAGE_GB") memory.push(latest);
    }
    return { cpu, memory };
  } catch {
    // Fallback without groupBy (environment aggregate).
    try {
      const data = await railwayGraphql<{
        metrics: Array<{
          measurement: string;
          values?: Array<{ value: number | null }>;
        }>;
      }>(
        token,
        `query (
          $environmentId: String!
          $startDate: DateTime!
          $measurements: [MetricMeasurement!]!
        ) {
          metrics(
            environmentId: $environmentId
            startDate: $startDate
            measurements: $measurements
          ) {
            measurement
            values { value }
          }
        }`,
        mode,
        {
          environmentId,
          startDate,
          measurements: ["CPU_USAGE", "MEMORY_USAGE_GB"],
        },
      );
      const cpu: number[] = [];
      const memory: number[] = [];
      for (const series of data.metrics || []) {
        const values = (series.values || [])
          .map((v) => v.value)
          .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
        if (!values.length) continue;
        const latest = values[values.length - 1];
        if (series.measurement === "CPU_USAGE") cpu.push(latest);
        if (series.measurement === "MEMORY_USAGE_GB") memory.push(latest);
      }
      return { cpu, memory };
    } catch {
      return { cpu: [], memory: [] };
    }
  }
}

/** One estimated-usage measurement → its display label and formatted value. */
function usageRow(measurement: string, value: number): { label: string; display: string } {
  const m = measurement.toUpperCase();
  const n = (unit: string) => `${value.toFixed(value >= 10 ? 1 : 2)} ${unit}`;

  let label: string;
  if (m.includes("CPU")) label = "CPU";
  else if (m.includes("MEMORY")) label = "Memory";
  else if (m.includes("NETWORK_TX") || m.includes("EGRESS")) label = "Egress";
  else if (m.includes("NETWORK_RX")) label = "Ingress";
  else if (m.includes("DISK") || m.includes("VOLUME")) label = "Disk";
  else
    label = measurement
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/^\w/, (c) => c.toUpperCase());

  let display: string;
  if (m.includes("CPU")) display = n("vCPU·h");
  else if (
    m.includes("MEMORY") ||
    m.includes("DISK") ||
    m.includes("NETWORK") ||
    m.includes("GB")
  )
    display = n("GB");
  else display = value.toFixed(2);

  return { label, display };
}

async function fetchEstimatedUsage(
  token: string,
  mode: AuthMode,
  projectIds: string[],
): Promise<RailwayUsageItem[]> {
  const aggregates = new Map<string, number>();

  async function pull(projectId?: string) {
    try {
      const data = await railwayGraphql<{
        estimatedUsage: Array<{ measurement: string; estimatedValue: number }>;
      }>(
        token,
        projectId
          ? `query ($projectId: String) {
              estimatedUsage(projectId: $projectId) {
                measurement
                estimatedValue
              }
            }`
          : `query {
              estimatedUsage {
                measurement
                estimatedValue
              }
            }`,
        mode,
        projectId ? { projectId } : undefined,
      );
      for (const row of data.estimatedUsage || []) {
        const prev = aggregates.get(row.measurement) || 0;
        aggregates.set(row.measurement, prev + (row.estimatedValue || 0));
      }
    } catch {
      // optional — token/plan may not expose usage
    }
  }

  if (projectIds.length === 0) {
    await pull();
  } else {
    // Cap to avoid hammering the API on large accounts.
    for (const projectId of projectIds.slice(0, 8)) {
      await pull(projectId);
    }
  }

  const preferred = [
    "CPU_USAGE",
    "MEMORY_USAGE_GB",
    "NETWORK_TX_GB",
    "DISK_USAGE_GB",
  ];

  const items: RailwayUsageItem[] = [];
  for (const key of preferred) {
    const match = [...aggregates.entries()].find(([m]) =>
      m.toUpperCase().includes(key.replace("_USAGE", "").split("_")[0]),
    );
    // Prefer exact-ish matches
    const exact = [...aggregates.entries()].find(
      ([m]) => m.toUpperCase() === key || m.toUpperCase().includes(key),
    );
    const hit = exact || match;
    if (!hit) continue;
    items.push({ measurement: hit[0], value: hit[1], ...usageRow(hit[0], hit[1]) });
  }

  if (items.length === 0) {
    for (const [measurement, value] of aggregates) {
      items.push({ measurement, value, ...usageRow(measurement, value) });
      if (items.length >= 4) break;
    }
  }

  return items.slice(0, 4);
}

const PROJECT_QUERY = `query ($id: String!) {
  project(id: $id) {
    id
    name
    environments {
      edges {
        node {
          id
          name
          isEphemeral
        }
      }
    }
    services {
      edges {
        node {
          id
          name
          serviceInstances {
            edges {
              node {
                environmentId
                latestDeployment {
                  id
                  status
                  createdAt
                  meta
                }
              }
            }
          }
        }
      }
    }
  }
}`;

const ACCOUNT_PROJECTS_QUERY = `query {
  projects {
    edges {
      node {
        id
        name
        environments {
          edges {
            node {
              id
              name
              isEphemeral
            }
          }
        }
        services {
          edges {
            node {
              id
              name
              serviceInstances {
                edges {
                  node {
                    environmentId
                    latestDeployment {
                      id
                      status
                      createdAt
                      meta
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}`;

export const railwayConnector: Connector = {
  provider: "railway",
  async test(credentials: ConnectionCredentials): Promise<TestResult> {
    const token = credentials.apiKey?.trim();
    if (!token) {
      return { ok: false, message: "API token required" };
    }
    try {
      const auth = await resolveRailwayAuth(token);
      return {
        ok: true,
        message:
          auth.mode === "project"
            ? `Connected to project “${auth.label}”`
            : `Connected as ${auth.label}`,
        meta: {
          mode: auth.mode,
          projectId: auth.projectId,
          environmentId: auth.environmentId,
        },
      };
    } catch (error) {
      return {
        ok: false,
        message: toUserFacingError(error, "railway"),
      };
    }
  },
};

export async function fetchRailwayDashboard(
  apiKey: string,
): Promise<RailwayDashboard> {
  const token = apiKey.trim();
  const auth = await resolveRailwayAuth(token);

  let projects: ProjectNode[] = [];
  if (auth.mode === "project" && auth.projectId) {
    const data = await railwayGraphql<{ project: ProjectNode }>(
      token,
      PROJECT_QUERY,
      "project",
      { id: auth.projectId },
    );
    projects = [data.project];
  } else {
    const data = await railwayGraphql<{
      projects: { edges: Array<{ node: ProjectNode }> };
    }>(token, ACCOUNT_PROJECTS_QUERY, "account");
    projects = data.projects.edges.map((e) => e.node);
  }

  const items: StatusItem[] = [];
  const trackers: Record<string, TrackerPoint[]> = {};
  const deployHealthCandidates: RailwayDeployHealth[] = [];
  const recentDeploys: RailwayDeployItem[] = [];
  const serviceNameById = new Map<string, { name: string; projectName: string }>();
  const environmentIds = new Set<string>();

  for (const project of projects) {
    const environmentId = pickEnvironmentId(project, auth.environmentId);
    if (environmentId) environmentIds.add(environmentId);

    // Prefer project-wide deploy list when possible.
    const projectDeploys = await fetchDeployments(token, auth.mode, {
      projectId: project.id,
      environmentId,
      first: RECENT_DEPLOYS,
      swallow: true,
    });

    for (const serviceEdge of project.services.edges) {
      const service = serviceEdge.node;
      serviceNameById.set(service.id, {
        name: service.name,
        projectName: project.name,
      });

      const instance =
        service.serviceInstances.edges.find(
          (e) => !environmentId || e.node.environmentId === environmentId,
        )?.node || service.serviceInstances.edges[0]?.node;

      const latest = instance?.latestDeployment;
      const status = statusColor(latest?.status || "UNKNOWN");
      const instanceEnv = instance?.environmentId || environmentId;
      if (instanceEnv) environmentIds.add(instanceEnv);

      let deployments = projectDeploys.filter((d) => d.serviceId === service.id);
      const hasLive = deployments.some((d) => isLiveCandidateStatus(d.status));
      if (deployments.length === 0 || !hasLive) {
        try {
          const serviceDeploys = await fetchDeployments(token, auth.mode, {
            projectId: project.id,
            environmentId,
            serviceId: service.id,
            first: 48,
          });
          if (serviceDeploys.length > 0) deployments = serviceDeploys;
        } catch {
          // Keep whatever project-level list we already have.
        }
      }

      // Ensure latestDeployment is represented even if list is thin.
      if (
        latest?.id &&
        !deployments.some((d) => d.id === latest.id)
      ) {
        deployments = [
          {
            id: latest.id,
            status: latest.status,
            createdAt: latest.createdAt,
            serviceId: service.id,
            meta: latest.meta,
          },
          ...deployments,
        ];
      }

      const trail = buildDeployTrail(deployments, service.name, latest?.status);
      const health = buildServiceDeployHealth(deployments, {
        id: service.id,
        name: service.name,
        projectName: project.name,
      });
      deployHealthCandidates.push(health);

      const behindHint =
        health.behindCount > 0
          ? `${health.behindCount} behind live`
          : health.active.status === "crashed"
            ? "Live crashed"
            : health.active.status === "healthy"
              ? "Up to date"
              : trail.detail;

      items.push({
        id: service.id,
        name: `${project.name} / ${service.name}`,
        provider: "railway",
        status,
        detail: behindHint,
        updatedAt: health.active.createdAt || latest?.createdAt,
      });
      trackers[service.id] = trail.points;

      for (const d of deployments) {
        recentDeploys.push({
          id: d.id,
          serviceId: service.id,
          serviceName: service.name,
          projectName: project.name,
          status: statusColor(d.status),
          rawStatus: d.status,
          createdAt: d.createdAt,
          ...readDeployMeta(d.meta),
          stage: deployStage(d.status, d.meta),
        });
      }
    }

    // Project-level deploys not tied above (edge case).
    for (const d of projectDeploys) {
      if (recentDeploys.some((x) => x.id === d.id)) continue;
      const named = serviceNameById.get(d.serviceId);
      recentDeploys.push({
        id: d.id,
        serviceId: d.serviceId,
        serviceName: named?.name || "Service",
        projectName: named?.projectName || project.name,
        status: statusColor(d.status),
        rawStatus: d.status,
        createdAt: d.createdAt,
        ...readDeployMeta(d.meta),
        stage: deployStage(d.status, d.meta),
      });
    }
  }

  recentDeploys.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const deployHealth = pickPrimaryDeployHealth(deployHealthCandidates);

  const fleet: RailwayFleetHealth = {
    healthy: items.filter((i) => isHealthyService(i.status)).length,
    total: items.length,
    crashed: items.filter((i) => i.status === "error").length,
    sleeping: items.filter((i) => i.status === "idle").length,
    degraded: items.filter((i) => i.status === "warn").length,
  };

  // Metrics — sample up to 3 environments.
  const cpuSamples: number[] = [];
  const memorySamples: number[] = [];
  for (const envId of [...environmentIds].slice(0, 3)) {
    const metrics = await fetchEnvironmentMetrics(token, auth.mode, envId);
    cpuSamples.push(...metrics.cpu);
    memorySamples.push(...metrics.memory);
  }

  const avg = (values: number[]) =>
    values.length
      ? values.reduce((sum, v) => sum + v, 0) / values.length
      : null;

  const resources: RailwayResourceSnapshot = {
    cpuCores: avg(cpuSamples),
    memoryGb: avg(memorySamples),
    sampledServices: Math.max(cpuSamples.length, memorySamples.length),
    label:
      Math.max(cpuSamples.length, memorySamples.length) > 0
        ? `Avg · last hour · ${Math.max(cpuSamples.length, memorySamples.length)} series`
        : "No metrics in the last hour",
  };

  const usage = await fetchEstimatedUsage(
    token,
    auth.mode,
    projects.map((p) => p.id),
  );

  return {
    items,
    trackers,
    deployHealth,
    fleet,
    recentDeploys: recentDeploys.slice(0, RECENT_DEPLOYS),
    resources,
    usage,
  };
}
