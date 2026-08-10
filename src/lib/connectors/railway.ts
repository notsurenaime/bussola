import type {
  ConnectionCredentials,
  Connector,
  RailwayDashboard,
  RailwayDeployItem,
  RailwayFleetHealth,
  RailwayResourceSnapshot,
  RailwayUsageItem,
  StatusItem,
  TestResult,
  TrackerPoint,
} from "./types";
import { friendlyStatusLabel, toUserFacingError } from "./errors";

const ENDPOINT = "https://backboard.railway.com/graphql/v2";
const DEPLOY_TRAIL_LEN = 24;
const RECENT_DEPLOYS = 25;
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

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Railway API ${res.status}`);
  }

  const json = (await res.json()) as {
    data?: T;
    errors?: Array<{ message: string }>;
  };

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

/** Map Railway deployment status → board/tracker tone. */
function statusColor(status: string): TrackerPoint["status"] {
  const s = status.toUpperCase();
  if (s === "SUCCESS") return "ok";
  if (s === "CRASHED") return "error";
  if (s === "FAILED") return "warn";
  if (
    s === "BUILDING" ||
    s === "DEPLOYING" ||
    s === "INITIALIZING" ||
    s === "QUEUED" ||
    s === "WAITING"
  ) {
    return "warn";
  }
  if (s === "REMOVED" || s === "REMOVING" || s === "SLEEPING" || s === "SKIPPED") {
    return "idle";
  }
  return "idle";
}

function colorFor(status: TrackerPoint["status"]): string {
  switch (status) {
    case "ok":
      return "bg-success";
    case "warn":
      return "bg-warning";
    case "error":
      return "bg-destructive";
    case "idle":
      return "bg-muted-foreground/30";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function rawStatusLabel(raw: string): string {
  const s = raw.toUpperCase();
  switch (s) {
    case "SUCCESS":
      return "Running";
    case "CRASHED":
      return "Crashed";
    case "FAILED":
      return "Failed";
    case "SLEEPING":
      return "Sleeping";
    case "BUILDING":
      return "Building";
    case "DEPLOYING":
      return "Deploying";
    case "QUEUED":
      return "Queued";
    case "WAITING":
      return "Waiting";
    case "INITIALIZING":
      return "Starting";
    case "REMOVED":
    case "REMOVING":
      return "Removed";
    case "SKIPPED":
      return "Skipped";
    default:
      return friendlyStatusLabel(statusColor(raw));
  }
}

function isHealthyService(status: TrackerPoint["status"]): boolean {
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
};

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

async function fetchServiceDeployments(
  token: string,
  mode: AuthMode,
  input: {
    projectId: string;
    environmentId?: string;
    serviceId: string;
  },
): Promise<DeploymentNode[]> {
  const data = await railwayGraphql<{
    deployments: { edges: Array<{ node: DeploymentNode }> };
  }>(
    token,
    `query ($input: DeploymentListInput!, $first: Int!) {
      deployments(input: $input, first: $first) {
        edges {
          node {
            id
            status
            createdAt
            serviceId
          }
        }
      }
    }`,
    mode,
    {
      first: 48,
      input: {
        projectId: input.projectId,
        ...(input.environmentId
          ? { environmentId: input.environmentId }
          : {}),
        serviceId: input.serviceId,
      },
    },
  );

  return data.deployments.edges.map((e) => e.node);
}

async function fetchProjectDeployments(
  token: string,
  mode: AuthMode,
  projectId: string,
  environmentId?: string,
): Promise<DeploymentNode[]> {
  try {
    const data = await railwayGraphql<{
      deployments: { edges: Array<{ node: DeploymentNode }> };
    }>(
      token,
      `query ($input: DeploymentListInput!, $first: Int!) {
        deployments(input: $input, first: $first) {
          edges {
            node {
              id
              status
              createdAt
              serviceId
            }
          }
        }
      }`,
      mode,
      {
        first: RECENT_DEPLOYS,
        input: {
          projectId,
          ...(environmentId ? { environmentId } : {}),
        },
      },
    );
    return data.deployments.edges.map((e) => e.node);
  } catch {
    return [];
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

function formatUsageValue(measurement: string, value: number): string {
  const m = measurement.toUpperCase();
  if (m.includes("CPU")) {
    return `${value.toFixed(value >= 10 ? 1 : 2)} vCPU·h`;
  }
  if (m.includes("MEMORY") || m.includes("DISK") || m.includes("NETWORK") || m.includes("GB")) {
    return `${value.toFixed(value >= 10 ? 1 : 2)} GB`;
  }
  return value.toFixed(2);
}

function usageLabel(measurement: string): string {
  const m = measurement.toUpperCase();
  if (m.includes("CPU")) return "CPU";
  if (m.includes("MEMORY")) return "Memory";
  if (m.includes("NETWORK_TX") || m.includes("EGRESS")) return "Egress";
  if (m.includes("NETWORK_RX")) return "Ingress";
  if (m.includes("DISK") || m.includes("VOLUME")) return "Disk";
  return measurement
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
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
    items.push({
      measurement: hit[0],
      label: usageLabel(hit[0]),
      value: hit[1],
      display: formatUsageValue(hit[0], hit[1]),
    });
  }

  if (items.length === 0) {
    for (const [measurement, value] of aggregates) {
      items.push({
        measurement,
        label: usageLabel(measurement),
        value,
        display: formatUsageValue(measurement, value),
      });
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
  const recentDeploys: RailwayDeployItem[] = [];
  const serviceNameById = new Map<string, { name: string; projectName: string }>();
  const environmentIds = new Set<string>();

  for (const project of projects) {
    const environmentId = pickEnvironmentId(project, auth.environmentId);
    if (environmentId) environmentIds.add(environmentId);

    // Prefer project-wide deploy list when possible.
    const projectDeploys = await fetchProjectDeployments(
      token,
      auth.mode,
      project.id,
      environmentId,
    );

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
      if (deployments.length === 0) {
        try {
          deployments = await fetchServiceDeployments(token, auth.mode, {
            projectId: project.id,
            environmentId,
            serviceId: service.id,
          });
        } catch {
          deployments = [];
        }
      }

      const trail = buildDeployTrail(deployments, service.name, latest?.status);

      items.push({
        id: service.id,
        name: `${project.name} / ${service.name}`,
        provider: "railway",
        status,
        detail: trail.detail,
        updatedAt: latest?.createdAt,
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
        });
      }
    }

    // Project-level deploys not tied above (edge case).
    for (const d of projectDeploys) {
      if (recentDeploys.some((x) => x.id === d.id)) continue;
      const meta = serviceNameById.get(d.serviceId);
      recentDeploys.push({
        id: d.id,
        serviceId: d.serviceId,
        serviceName: meta?.name || "Service",
        projectName: meta?.projectName || project.name,
        status: statusColor(d.status),
        rawStatus: d.status,
        createdAt: d.createdAt,
      });
    }
  }

  recentDeploys.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

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
    fleet,
    recentDeploys: recentDeploys.slice(0, RECENT_DEPLOYS),
    resources,
    usage,
  };
}

/** Back-compat for status-board and older callers. */
export async function fetchRailwayStatus(
  apiKey: string,
): Promise<{ items: StatusItem[]; trackers: Record<string, TrackerPoint[]> }> {
  const dash = await fetchRailwayDashboard(apiKey);
  return { items: dash.items, trackers: dash.trackers };
}
