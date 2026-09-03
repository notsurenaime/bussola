"use client";

import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/dashboard/widgets/stat-card";
import { ActivityTracker } from "@/components/dashboard/widgets/activity-tracker";
import {
  ActivityPanel,
  type ActivityPanelEvent,
} from "@/components/dashboard/widgets/activity-panel";
import { BarChart } from "@/components/dashboard/widgets/bar-chart";
import { ColumnChart } from "@/components/dashboard/widgets/column-chart";
import { DonutChart } from "@/components/dashboard/widgets/donut-chart";
import { DualLineChart } from "@/components/dashboard/widgets/dual-line-chart";
import { LineChart } from "@/components/dashboard/widgets/line-chart";
import { DataTable } from "@/components/dashboard/widgets/data-table";
import {
  StatusDot,
  StatusList,
  statusLabel,
  type StatusRow,
} from "@/components/dashboard/widgets/status-list";
import {
  ConnectPrompt,
  DemoNotice,
  NoData,
  StaleNotice,
  WidgetMessage,
} from "@/components/dashboard/widgets/widget-messages";
import { QontoTransactionsWidget } from "@/components/dashboard/qonto-transactions-widget";
import {
  deployBadgeVariant,
  formatCores,
  formatGb,
  formatRate,
  paymentBadgeVariant,
  relativeAge,
  shortAge,
  shortId,
  toneBadgeVariant,
} from "@/lib/widgets/widget-format";
import { formatMoney, formatSignedMoney } from "@/lib/format/money";
import type {
  PaymentItem,
  RailwayDeployAttempt,
  ResendBroadcastItem,
  ResendDomainItem,
  ResendEmailItem,
  ResendMetrics,
  RevenueSummary,
  SentryIssueItem,
  MoneyPoint,
  VercelDeployItem,
  BalanceHistory,
  BalanceInfo,
  CashflowPeriod,
  LiquidityInfo,
  NetlifyBuildMinutes,
  NetlifyDeployItem,
  NetlifyFormItem,
  RailwayDeployHealth,
  RailwayBilling,
  RailwayDeployItem,
  RailwayFleetHealth,
  RailwayMetrics,
  RailwayMetricSeries,
  RailwayProjectSummary,
  RailwayResourceSnapshot,
  RailwayUsageItem,
  StatusItem,
  SupabaseAdvisorIssue,
  SupabaseAdvisorsSummary,
  SupabaseServiceItem,
  SupabaseTrafficBucket,
  TrackerPoint,
} from "@/lib/connectors/types";
import type { WidgetType } from "@/lib/widgets/registry";
import { getWidgetDefinition } from "@/lib/widgets/registry";
import { applyWidgetConfig, type WidgetConfig } from "@/lib/widgets/config";
import { useWidgetData } from "@/lib/widgets/widget-data-store";

type WidgetRendererProps = {
  type: WidgetType;
  /** Which connection feeds this widget. Absent means the provider's default. */
  connectionId?: string | null;
  config?: WidgetConfig;
};

const NO_CONFIG: WidgetConfig = {};

export function WidgetRenderer({
  type,
  connectionId,
  config = NO_CONFIG,
}: WidgetRendererProps) {
  if (type === "qonto-transactions") {
    return (
      <QontoTransactionsWidget
        // Keyed on the connection so switching account starts a fresh widget
        // rather than appending a new account's pages onto the old cursor.
        key={connectionId ?? "default"}
        connectionId={connectionId}
        limit={config.limit}
      />
    );
  }
  return <LiveWidget type={type} connectionId={connectionId} config={config} />;
}

function LiveWidget({
  type,
  connectionId,
  config,
}: {
  type: Exclude<WidgetType, "qonto-transactions">;
  connectionId?: string | null;
  config: WidgetConfig;
}) {
  const { data, error, loading } = useWidgetData(type, connectionId);

  if (loading) {
    return (
      <div className="space-y-3 p-1">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-2/3" />
      </div>
    );
  }

  if (error) {
    return (
      <WidgetMessage
        title={error}
        action={{ href: "/connections", label: "Check Connections" }}
      />
    );
  }

  if (!data) return null;

  if (data.needsConnection) {
    const def = getWidgetDefinition(type);
    const provider = String(data.provider || def?.provider || "source");
    return <ConnectPrompt provider={provider} />;
  }

  const sync = data._sync as SyncMeta | undefined;
  const isDemo = data._demo === true;

  // The worker gave up on this source — showing the last snapshot as if it
  // were current would hide a credential that needs replacing.
  if (sync?.disabled) {
    return (
      <WidgetMessage
        title={sync.lastError || "Syncing stopped for this source."}
        action={{ href: "/connections", label: "Reconnect" }}
      />
    );
  }

  // Scope, limit and range narrow the snapshot every widget of this source
  // shares, so this runs per widget rather than in the store.
  const view = applyWidgetConfig(type, config, data);

  return (
    <>
      {isDemo ? (
        <DemoNotice provider={String(data.provider ?? getWidgetDefinition(type)?.provider ?? "")} />
      ) : null}
      {sync?.stale ? <StaleNotice fetchedAt={sync.fetchedAt} /> : null}
      <div className="flex min-h-0 flex-1 flex-col">{renderWidget(type, view)}</div>
    </>
  );
}

type SyncMeta = {
  fetchedAt?: string | null;
  stale?: boolean;
  disabled?: boolean;
  lastError?: string | null;
};

/** Maps a Railway deploy attempt's raw status to a short human label. */
function attemptStatusLabel(attempt: RailwayDeployAttempt): string {
  const raw = attempt.rawStatus.toUpperCase();
  if (raw === "FAILED") return "Deploy failed";
  if (raw === "CRASHED") return "Crashed";
  if (raw === "BUILDING") return "Building";
  if (raw === "DEPLOYING") return "Deploying";
  if (raw === "QUEUED") return "Queued";
  if (raw === "WAITING") return "Waiting";
  if (raw === "INITIALIZING") return "Starting";
  return attempt.stage;
}

function eventFromAttempt(
  attempt: RailwayDeployAttempt,
  tone: "destructive" | "warning",
): ActivityPanelEvent {
  return {
    id: attempt.id,
    age: shortAge(attempt.createdAt),
    label: attemptStatusLabel(attempt),
    tone,
    meta: shortId(attempt.id),
  };
}

/**
 * A Resend section that did not come back.
 *
 * Deliberately does not assert why. A restricted key is the common cause, but
 * the same flag is raised by an endpoint the account does not have and by an
 * upstream error, and telling someone with a full-access key that their key is
 * the problem sends them to fix something that is not broken. The server log
 * carries the actual status.
 */
function ResendUnavailable({ what }: { what: string }) {
  return (
    <WidgetMessage
      title={`Resend didn’t return ${what}. A restricted API key is the usual cause — check the connection if it persists.`}
      action={{ href: "/connections", label: "Check connection" }}
    />
  );
}

/** Every Resend chart reads the same metrics call, so they share an empty state. */
function ResendMetricsMissing({ missing }: { missing: boolean }) {
  if (missing) return <ResendUnavailable what="email metrics" />;
  return <NoData label="No email metrics for this period yet." />;
}

/** Which series each usage chart reads, and how to phrase its numbers. */
const RAILWAY_SERIES_FOR: Record<
  "railway-cpu" | "railway-memory" | "railway-egress" | "railway-disk",
  { key: RailwayMetricSeries["key"]; empty: string }
> = {
  "railway-cpu": { key: "cpu", empty: "No CPU metrics reported." },
  "railway-memory": { key: "memory", empty: "No memory metrics reported." },
  "railway-egress": { key: "egress", empty: "No egress metrics reported." },
  "railway-disk": {
    key: "disk",
    // Disk is volume-backed, so a project with no volume reports a real zero.
    empty: "No disk metrics — this project has no volumes attached.",
  },
};

function formatRailwayValue(value: number, unit: string): string {
  if (unit === "GB" && value > 0 && value < 0.1) {
    return `${(value * 1024).toFixed(value * 1024 < 10 ? 2 : 1)} MB`;
  }
  if (unit === "vCPU") return `${value.toFixed(value >= 1 ? 2 : 3)} vCPU`;
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${unit}`;
}

function renderRailwaySeries(
  type: "railway-cpu" | "railway-memory" | "railway-egress" | "railway-disk",
  data: Record<string, unknown>,
) {
  const spec = RAILWAY_SERIES_FOR[type];
  const metrics = data.metrics as RailwayMetrics | null;
  const series = metrics?.series.find((s) => s.key === spec.key);

  if (!metrics || !series || series.points.length === 0) {
    return <NoData label={spec.empty} />;
  }

  const scope = metrics.environmentName
    ? `${metrics.projectName} · ${metrics.environmentName}`
    : metrics.projectName;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="truncate text-xs text-muted-foreground">{scope}</p>
        <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
          peak {formatRailwayValue(series.peak, series.unit)}
        </p>
      </div>
      <p className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">
        {series.latest !== null
          ? formatRailwayValue(series.latest, series.unit)
          : "—"}
      </p>
      <div className="min-h-0 flex-1">
        <LineChart
          points={series.points.map((point) => ({
            label: point.label,
            value: point.value,
            display: formatRailwayValue(point.value, series.unit),
          }))}
        />
      </div>
    </div>
  );
}

function renderWidget(
  type: Exclude<WidgetType, "qonto-transactions">,
  data: Record<string, unknown>,
) {
  switch (type) {
    case "railway-tracker": {
      const health = data.deployHealth as RailwayDeployHealth | null | undefined;
      if (!health) {
        return <NoData label="No services found for this connection." />;
      }
      const behind = health.behindCount;
      const liveAge = shortAge(health.active.createdAt);
      const events: ActivityPanelEvent[] = [
        ...(health.inFlight ? [eventFromAttempt(health.inFlight, "warning" as const)] : []),
        ...health.failedSinceActive
          .slice(0, 3)
          .map((attempt) => eventFromAttempt(attempt, "destructive" as const)),
      ];
      return (
        <ActivityPanel
          title={health.serviceName}
          subtitle={health.projectName}
          status={{
            label:
              health.active.status === "healthy"
                ? "Healthy"
                : health.active.status === "crashed"
                  ? "Crashed"
                  : health.active.status === "sleeping"
                    ? "Sleeping"
                    : "Unknown",
            tone:
              health.active.status === "healthy"
                ? "positive"
                : health.active.status === "crashed"
                  ? "negative"
                  : "neutral",
          }}
          headline={
            behind > 0
              ? `${behind} behind`
              : health.active.status === "crashed"
                ? "Crashed"
                : health.inFlight
                  ? "Shipping"
                  : "Up to date"
          }
          headlineTone={
            behind > 0 || health.active.status === "crashed"
              ? "negative"
              : "neutral"
          }
          meta={[
            liveAge ? `live ${liveAge}` : null,
            health.active.commitHash,
            behind === 0 ? health.active.label : null,
          ]
            .filter(Boolean)
            .join(" · ")}
          events={events}
          moreCount={Math.max(behind - health.failedSinceActive.slice(0, 3).length, 0)}
        />
      );
    }
    case "railway-services": {
      const items = (data.items as StatusItem[]) || [];
      if (items.length === 0) {
        return <NoData label="No Railway services found." />;
      }
      return <StatusList items={items} />;
    }
    case "railway-fleet": {
      const fleet = data.fleet as RailwayFleetHealth | undefined;
      if (!fleet || fleet.total === 0) {
        return <NoData label="No Railway services found." />;
      }
      const allHealthy = fleet.healthy === fleet.total;
      const issues = fleet.crashed + fleet.degraded;
      return (
        <StatCard
          label="Healthy services"
          value={`${fleet.healthy}/${fleet.total}`}
          hint={
            issues > 0
              ? `${issues} need attention`
              : fleet.sleeping > 0
                ? `${fleet.sleeping} sleeping`
                : "All services checked"
          }
          trend={allHealthy ? "All healthy" : undefined}
          trendTone={allHealthy ? "positive" : "neutral"}
        />
      );
    }
    case "railway-resources": {
      const resources = data.resources as RailwayResourceSnapshot | undefined;
      if (
        !resources ||
        (resources.cpuCores == null && resources.memoryGb == null)
      ) {
        return (
          <NoData label="No CPU/memory metrics yet (needs a running deploy)." />
        );
      }
      return (
        <div className="flex h-full flex-col justify-center gap-3">
          <BarChart
            rows={[
              {
                label: "CPU",
                value: resources.cpuCores ?? 0,
                display:
                  resources.cpuCores == null
                    ? "—"
                    : formatCores(resources.cpuCores),
                tone: "neutral",
              },
              {
                label: "Memory",
                value: resources.memoryGb ?? 0,
                display:
                  resources.memoryGb == null
                    ? "—"
                    : formatGb(resources.memoryGb),
                tone: "out",
              },
            ]}
          />
          <p className="text-xs text-muted-foreground">{resources.label}</p>
        </div>
      );
    }
    case "railway-usage": {
      const usage = (data.usage as RailwayUsageItem[]) || [];
      if (usage.length === 0) {
        return (
          <NoData label="No usage estimate available for this token/plan." />
        );
      }
      return (
        <div className="flex h-full flex-col justify-center gap-3">
          <BarChart
            rows={usage.map((row) => ({
              label: row.label,
              value: row.value,
              display: row.display,
              tone: "neutral" as const,
            }))}
          />
          <p className="text-xs text-muted-foreground">Current billing cycle</p>
        </div>
      );
    }
    case "railway-deploys": {
      const deploys = (data.recentDeploys as RailwayDeployItem[]) || [];
      if (deploys.length === 0) {
        return <NoData label="No recent deployments." />;
      }
      return (
        <DataTable
          data={deploys}
          rowKey={(deploy) => deploy.id}
          columns={[
            {
              header: "Service",
              render: (deploy) => (
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate font-medium">
                    {deploy.serviceName}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {deploy.projectName}
                  </span>
                </div>
              ),
            },
            {
              header: "Status",
              render: (deploy) => (
                <Badge variant={deployBadgeVariant(deploy.status)}>
                  {deploy.rawStatus.toLowerCase()}
                </Badge>
              ),
            },
            {
              header: "When",
              align: "right",
              className: "whitespace-nowrap text-muted-foreground",
              render: (deploy) => format(new Date(deploy.createdAt), "MMM d · HH:mm"),
            },
          ]}
        />
      );
    }
    case "netlify-tracker": {
      const items = (data.items as StatusItem[]) || [];
      const trackers =
        (data.trackers as Record<string, TrackerPoint[]>) || {};
      const first = items[0];
      const points = first ? trackers[first.id] || [] : [];

      if (!first) {
        return <NoData label="No sites found for this connection." />;
      }
      if (points.length === 0) {
        return <NoData label="No deployment history yet." />;
      }

      return (
        <div className="flex h-full flex-col justify-center gap-3">
          <p className="truncate text-sm font-medium">{first.name}</p>
          <ActivityTracker data={points} hoverEffect />
          <p className="text-xs text-muted-foreground">
            {first.detail}
            {items.length > 1 ? ` · +${items.length - 1} more` : ""}
          </p>
        </div>
      );
    }
    case "netlify-sites": {
      const items = (data.items as StatusItem[]) || [];
      if (items.length === 0) {
        return <NoData label="No Netlify sites found." />;
      }
      return <StatusList items={items} />;
    }
    case "netlify-health": {
      const healthy = Number(data.healthy || 0);
      const total = Number(data.total || 0);
      if (total === 0) {
        return <NoData label="No Netlify sites found." />;
      }
      return (
        <StatCard
          label="Ready sites"
          value={`${healthy}/${total}`}
          hint={total === 1 ? "1 site" : `${total} sites`}
          trend={healthy === total ? "All ready" : undefined}
          trendTone={healthy === total ? "positive" : "neutral"}
        />
      );
    }
    case "netlify-deploys": {
      const deploys = (data.recentDeploys as NetlifyDeployItem[]) || [];
      if (deploys.length === 0) {
        return <NoData label="No recent deployments." />;
      }
      return (
        <DataTable
          data={deploys}
          rowKey={(deploy) => deploy.id}
          columns={[
            {
              header: "Site",
              render: (deploy) => (
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate font-medium">{deploy.siteName}</span>
                  {deploy.branch ? (
                    <span className="truncate text-xs text-muted-foreground">
                      {deploy.branch}
                    </span>
                  ) : null}
                </div>
              ),
            },
            {
              header: "Status",
              render: (deploy) => (
                <Badge variant={deployBadgeVariant(deploy.status)}>
                  {deploy.rawState.replace(/_/g, " ")}
                </Badge>
              ),
            },
            {
              header: "When",
              align: "right",
              className: "whitespace-nowrap text-muted-foreground",
              render: (deploy) => format(new Date(deploy.createdAt), "MMM d · HH:mm"),
            },
          ]}
        />
      );
    }
    case "netlify-builds": {
      const builds = data.buildMinutes as NetlifyBuildMinutes | null;
      if (!builds) {
        return (
          <NoData label="No build-minute data for this account/token." />
        );
      }
      const tone =
        builds.deltaPct == null
          ? "neutral"
          : builds.deltaPct > 10
            ? "negative"
            : builds.deltaPct < -10
              ? "positive"
              : "neutral";
      return (
        <StatCard
          label="Build minutes"
          value={String(builds.current)}
          hint={builds.label}
          trend={
            builds.deltaPct == null
              ? builds.previous > 0
                ? `Prev ${builds.previous}`
                : undefined
              : `${builds.deltaPct > 0 ? "+" : ""}${builds.deltaPct}% vs prior`
          }
          trendTone={tone}
        />
      );
    }
    case "netlify-forms": {
      const forms = (data.forms as NetlifyFormItem[]) || [];
      const total = Number(data.formSubmissionsTotal || 0);
      if (forms.length === 0) {
        return <NoData label="No Netlify Forms on connected sites." />;
      }
      return (
        <div className="flex h-full flex-col justify-center gap-3">
          <BarChart
            rows={forms.slice(0, 5).map((form) => ({
              label: `${form.name} · ${form.siteName}`,
              value: form.submissionCount,
              display: String(form.submissionCount),
              tone: "neutral" as const,
            }))}
          />
          <p className="text-xs text-muted-foreground">
            {total} total submissions
            {forms.length > 5 ? ` · top 5 of ${forms.length}` : ""}
          </p>
        </div>
      );
    }
    case "supabase-health": {
      const healthy = Number(data.healthy || 0);
      const total = Number(data.total || 0);
      if (total === 0) {
        return <NoData label="No Supabase projects found." />;
      }
      return (
        <StatCard
          label="Healthy projects"
          value={`${healthy}/${total}`}
          hint={total === 1 ? "1 project" : `${total} projects`}
          trend={healthy === total ? "All healthy" : undefined}
          trendTone={healthy === total ? "positive" : "neutral"}
        />
      );
    }
    case "supabase-projects": {
      const items = (data.items as StatusItem[]) || [];
      if (items.length === 0) {
        return <NoData label="No Supabase projects found." />;
      }
      return <StatusList items={items} />;
    }
    case "supabase-services": {
      const services = (data.services as SupabaseServiceItem[]) || [];
      if (services.length === 0) {
        return (
          <NoData label="No service health data yet (check PAT permissions)." />
        );
      }
      const items: StatusRow[] = services.map((service) => ({
        id: service.id,
        name: `${service.projectName} / ${service.serviceName}`,
        status: service.status,
        detail: service.detail,
      }));
      return <StatusList items={items} />;
    }
    case "supabase-traffic": {
      const traffic = (data.traffic as SupabaseTrafficBucket[]) || [];
      if (traffic.length === 0 || traffic.every((row) => row.value === 0)) {
        return <NoData label="No API traffic in the last 7 days." />;
      }
      return (
        <div className="flex h-full flex-col justify-center gap-3">
          <BarChart
            rows={traffic.map((row) => ({
              label: row.label,
              value: row.value,
              display: row.display,
              tone: "neutral" as const,
            }))}
          />
          <p className="text-xs text-muted-foreground">Last 7 days</p>
        </div>
      );
    }
    case "supabase-requests": {
      const volume = data.requestVolume as
        | { total: number; days: number; label: string }
        | undefined;
      if (!volume || volume.total === 0) {
        return <NoData label="No API requests recorded yet." />;
      }
      return (
        <StatCard
          label={`${volume.days}-day requests`}
          value={new Intl.NumberFormat(undefined, {
            notation: volume.total >= 10000 ? "compact" : "standard",
            maximumFractionDigits: 1,
          }).format(volume.total)}
          hint={volume.label}
        />
      );
    }
    case "supabase-advisors": {
      const advisors = data.advisors as SupabaseAdvisorsSummary | undefined;
      if (!advisors) {
        return <NoData label="No advisor data available." />;
      }
      if (advisors.total === 0) {
        return (
          <StatCard
            label="Security findings"
            value="0"
            hint="No open issues"
            trend="Clean"
            trendTone="positive"
          />
        );
      }
      return (
        <div className="flex h-full min-h-0 flex-col gap-3">
          <StatCard
            label="Security findings"
            value={String(advisors.total)}
            hint={`${advisors.errors} errors · ${advisors.warnings} warnings`}
            trendTone={advisors.errors > 0 ? "negative" : "neutral"}
            trend={advisors.errors > 0 ? "Needs attention" : "Review suggested"}
          />
          {advisors.top && advisors.top.length > 0 ? (
            <ul className="min-h-0 flex-1 space-y-1.5 overflow-auto text-xs text-muted-foreground">
              {advisors.top.slice(0, 3).map((item, index) => (
                <li key={`${item.title}-${index}`} className="truncate">
                  <span className="font-medium text-foreground/80">
                    {item.level}
                  </span>{" "}
                  · {item.title}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      );
    }
    case "qonto-balance": {
      const balances = (data.balances as BalanceInfo[]) || [];
      const liquidity = data.liquidity as LiquidityInfo | undefined;
      if (!balances.length || !liquidity) {
        return <NoData label="No Qonto accounts found." />;
      }
      const hint =
        balances.length === 1
          ? balances[0].accountName
          : `${balances.length} accounts`;
      return (
        <StatCard
          label="Total cash"
          value={formatMoney(liquidity.booked, liquidity.currency)}
          hint={hint}
        />
      );
    }
    case "qonto-liquidity": {
      const liquidity = data.liquidity as LiquidityInfo | undefined;
      if (!liquidity || liquidity.accountCount === 0) {
        return <NoData label="No Qonto accounts found." />;
      }
      const tied = Math.max(liquidity.pendingDelta, 0);
      return (
        <StatCard
          label="Available to spend"
          value={formatMoney(liquidity.available, liquidity.currency)}
          hint={
            tied > 0
              ? `${formatMoney(tied, liquidity.currency)} tied in pending`
              : "No pending hold"
          }
        />
      );
    }
    case "qonto-cashflow": {
      const cashflow = data.cashflow30d as CashflowPeriod | undefined;
      if (!cashflow) {
        return <NoData label="No cashflow data yet." />;
      }
      const tone =
        cashflow.net > 0
          ? "positive"
          : cashflow.net < 0
            ? "negative"
            : "neutral";
      return (
        <StatCard
          label={`${cashflow.days}-day net`}
          value={formatSignedMoney(cashflow.net, cashflow.currency)}
          hint={`${cashflow.transactionCount} completed txs`}
          trend={
            cashflow.net > 0
              ? "Cash positive"
              : cashflow.net < 0
                ? "Cash negative"
                : "Flat"
          }
          trendTone={tone}
        />
      );
    }
    case "qonto-in-out": {
      const cashflow = data.cashflow30d as CashflowPeriod | undefined;
      if (!cashflow) {
        return <NoData label="No cashflow data yet." />;
      }
      if (cashflow.inflow === 0 && cashflow.outflow === 0) {
        return <NoData label="No completed transactions in the last 30 days." />;
      }
      return (
        <div className="flex h-full flex-col justify-center gap-3">
          <BarChart
            rows={[
              {
                label: "In",
                value: cashflow.inflow,
                display: formatMoney(cashflow.inflow, cashflow.currency),
                tone: "in",
              },
              {
                label: "Out",
                value: cashflow.outflow,
                display: formatMoney(cashflow.outflow, cashflow.currency),
                tone: "out",
              },
            ]}
          />
          <p className="text-xs text-muted-foreground">
            Last {cashflow.days} days · net{" "}
            <span className="tabular-nums">
              {formatSignedMoney(cashflow.net, cashflow.currency)}
            </span>
          </p>
        </div>
      );
    }
    case "qonto-accounts": {
      const balances = (data.balances as BalanceInfo[]) || [];
      if (!balances.length) {
        return <NoData label="No Qonto accounts found." />;
      }
      return (
        <DonutChart
          items={balances.map((account, index) => ({
            id: `${account.accountName}-${index}`,
            name: account.accountName,
            value: account.balance,
            display: formatMoney(account.balance, account.currency),
            sharePct: account.sharePct ?? 0,
            highlight: account.main,
          }))}
        />
      );
    }
    case "qonto-history": {
      const history = data.balanceHistory as BalanceHistory | undefined;
      if (!history?.points?.length) {
        return <NoData label="No balance history yet." />;
      }
      const first = history.points[0]?.balance ?? 0;
      const last = history.points[history.points.length - 1]?.balance ?? 0;
      const delta = last - first;
      return (
        <div className="flex h-full min-h-0 flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-medium tabular-nums">
              {formatMoney(last, history.currency)}
            </p>
            <p
              className={
                delta > 0
                  ? "text-xs tabular-nums text-success"
                  : delta < 0
                    ? "text-xs tabular-nums text-destructive"
                    : "text-xs tabular-nums text-muted-foreground"
              }
            >
              {formatSignedMoney(delta, history.currency)} · {history.days}d
            </p>
          </div>
          <LineChart
            className="min-h-0 flex-1"
            points={history.points.map((point) => ({
              label: point.label,
              value: point.balance,
              display: formatMoney(point.balance, history.currency),
            }))}
          />
          <p className="text-[10px] text-muted-foreground">
            From settled transactions
            {history.incomplete ? " · partial window" : ""}
          </p>
        </div>
      );
    }
    case "stripe-mrr":
    case "lemonsqueezy-mrr": {
      const revenue = data.revenue as RevenueSummary | undefined;
      if (!revenue) return <NoData label="No subscription data yet." />;
      return (
        <StatCard
          label="Monthly recurring revenue"
          value={formatMoney(revenue.mrr, revenue.currency.toUpperCase())}
          hint={`${revenue.activeSubscriptions} active${
            revenue.trialingSubscriptions > 0
              ? ` · ${revenue.trialingSubscriptions} trialing`
              : ""
          }`}
          trend={revenue.truncated ? "Partial — very large account" : undefined}
          trendTone="neutral"
        />
      );
    }
    case "stripe-revenue": {
      const volume = data.volume30d as MoneyPoint | undefined;
      const revenue = data.revenue as RevenueSummary | undefined;
      if (!volume) return <NoData label="No payments in the last 30 days." />;
      return (
        <StatCard
          label="Revenue (30 days)"
          value={formatMoney(
            volume.value,
            (revenue?.currency ?? "eur").toUpperCase(),
          )}
          hint={volume.display}
        />
      );
    }
    case "lemonsqueezy-revenue": {
      const volume = data.revenue30d as MoneyPoint | undefined;
      const revenue = data.revenue as RevenueSummary | undefined;
      if (!volume) return <NoData label="No store revenue yet." />;
      return (
        <StatCard
          label="Revenue (30 days)"
          value={formatMoney(
            volume.value,
            (revenue?.currency ?? "usd").toUpperCase(),
          )}
          hint={volume.display}
        />
      );
    }
    case "stripe-payments":
    case "lemonsqueezy-orders": {
      const payments =
        ((data.payments ?? data.orders) as PaymentItem[] | undefined) || [];
      if (payments.length === 0) {
        return <NoData label="No payments yet." />;
      }
      return (
        <DataTable
          data={payments}
          rowKey={(payment) => payment.id}
          columns={[
            {
              header: "Payment",
              render: (payment) => (
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate font-medium">
                    {payment.description}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {payment.customer ||
                      format(new Date(payment.createdAt), "d MMM, HH:mm")}
                  </span>
                </div>
              ),
            },
            {
              header: "Status",
              render: (payment) => (
                <Badge variant={paymentBadgeVariant(payment.status)}>
                  {payment.status}
                </Badge>
              ),
            },
            {
              header: "Amount",
              align: "right",
              className: "font-medium tabular-nums",
              render: (payment) =>
                formatMoney(payment.amount, payment.currency.toUpperCase()),
            },
          ]}
        />
      );
    }
    case "sentry-issues": {
      const unresolved = Number(data.unresolved ?? 0);
      const events = Number(data.events24h ?? 0);
      return (
        <StatCard
          label="Unresolved issues"
          value={data.truncated ? `${unresolved}+` : String(unresolved)}
          hint={`${events.toLocaleString()} events in 24h`}
          trend={unresolved === 0 ? "All clear" : undefined}
          trendTone={unresolved === 0 ? "positive" : "neutral"}
        />
      );
    }
    case "sentry-recent": {
      const issues = (data.issues as SentryIssueItem[]) || [];
      if (issues.length === 0) {
        return <NoData label="No unresolved issues. " />;
      }
      return (
        <DataTable
          data={issues}
          rowKey={(issue) => issue.id}
          columns={[
            {
              header: "Issue",
              render: (issue) => (
                <div className="flex min-w-0 items-start gap-2">
                  <StatusDot status={issue.status} />
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate font-medium">{issue.title}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {issue.projectName || issue.culprit || issue.level}
                    </span>
                  </div>
                </div>
              ),
            },
            {
              header: "Events",
              align: "right",
              className: "tabular-nums",
              render: (issue) => issue.count.toLocaleString(),
            },
          ]}
        />
      );
    }
    case "sentry-projects": {
      const projects = (data.projects as StatusItem[]) || [];
      if (projects.length === 0) {
        return <NoData label="No Sentry projects found." />;
      }
      return <StatusList items={projects} />;
    }
    case "resend-domains": {
      const domains = (data.domains as ResendDomainItem[]) || [];
      if (domains.length === 0) {
        return <NoData label="No sending domains configured." />;
      }
      return (
        <DataTable
          data={domains}
          rowKey={(domain) => domain.id}
          columns={[
            {
              header: "Domain",
              render: (domain) => (
                <div className="flex min-w-0 items-center gap-2">
                  <StatusDot status={domain.status} />
                  <span className="truncate font-medium">{domain.name}</span>
                </div>
              ),
            },
            {
              header: "Status",
              render: (domain) => (
                <Badge variant={toneBadgeVariant(domain.status)}>
                  {domain.rawStatus}
                </Badge>
              ),
            },
            {
              header: "Created",
              align: "right",
              render: (domain) => (
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  {relativeAge(domain.createdAt) ?? "—"}
                </span>
              ),
            },
          ]}
        />
      );
    }
    case "resend-emails": {
      if (data.emailsUnavailable) {
        return <ResendUnavailable what="sent emails" />;
      }
      const emails = (data.emails as ResendEmailItem[]) || [];
      if (emails.length === 0) {
        return <NoData label="No emails sent yet." />;
      }
      return (
        <DataTable
          data={emails}
          rowKey={(email) => email.id}
          columns={[
            {
              header: "Email",
              render: (email) => (
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate font-medium">{email.subject}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {email.to}
                  </span>
                </div>
              ),
            },
            {
              header: "Status",
              render: (email) => (
                <Badge variant={toneBadgeVariant(email.tone)}>
                  {email.status}
                </Badge>
              ),
            },
            {
              header: "Sent",
              align: "right",
              render: (email) => (
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  {relativeAge(email.sentAt) ?? "—"}
                </span>
              ),
            },
          ]}
        />
      );
    }
    case "resend-broadcasts": {
      if (data.broadcastsUnavailable) {
        return <ResendUnavailable what="broadcasts" />;
      }
      const broadcasts = (data.broadcasts as ResendBroadcastItem[]) || [];
      if (broadcasts.length === 0) {
        return <NoData label="No broadcasts yet." />;
      }
      return (
        <DataTable
          data={broadcasts}
          rowKey={(broadcast) => broadcast.id}
          columns={[
            {
              header: "Broadcast",
              render: (broadcast) => (
                <span className="truncate font-medium">{broadcast.name}</span>
              ),
            },
            {
              header: "Status",
              render: (broadcast) => (
                <Badge variant={toneBadgeVariant(broadcast.tone)}>
                  {broadcast.status}
                </Badge>
              ),
            },
            {
              header: "Updated",
              align: "right",
              render: (broadcast) => (
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  {relativeAge(broadcast.updatedAt) ?? "—"}
                </span>
              ),
            },
          ]}
        />
      );
    }
    case "resend-delivery": {
      const metrics = data.metrics as ResendMetrics | null;
      if (data.metricsUnavailable || !metrics) {
        return <ResendMetricsMissing missing={Boolean(data.metricsUnavailable)} />;
      }
      return (
        <DualLineChart
          countLabel="Emails"
          rateLabel="Deliverability"
          points={metrics.points.map((point) => ({
            label: point.label,
            count: point.sent,
            rate: point.deliveryRate,
            countDisplay: `${point.sent} sent · ${point.delivered} delivered`,
            rateDisplay: `${formatRate(point.deliveryRate)} delivered`,
          }))}
        />
      );
    }
    case "resend-open-rate":
    case "resend-click-rate": {
      const metrics = data.metrics as ResendMetrics | null;
      if (data.metricsUnavailable || !metrics) {
        return <ResendMetricsMissing missing={Boolean(data.metricsUnavailable)} />;
      }
      const opens = type === "resend-open-rate";
      return (
        <ColumnChart
          domainMax={100}
          headline={{
            label: `Last ${metrics.days} days`,
            value: formatRate(
              opens ? metrics.totals.openRate : metrics.totals.clickRate,
            ),
          }}
          points={metrics.points.map((point) => ({
            label: point.label,
            value: opens ? point.openRate : point.clickRate,
            display: formatRate(opens ? point.openRate : point.clickRate),
            hint: `${point.delivered} delivered`,
          }))}
        />
      );
    }
    case "resend-outcomes": {
      const metrics = data.metrics as ResendMetrics | null;
      if (data.metricsUnavailable || !metrics) {
        return <ResendMetricsMissing missing={Boolean(data.metricsUnavailable)} />;
      }
      const total = metrics.outcomes.reduce(
        (sum, slice) => sum + slice.value,
        0,
      );
      if (total === 0) {
        return <NoData label="No emails sent in this period." />;
      }
      return (
        <DonutChart
          items={metrics.outcomes.map((slice) => ({
            id: slice.id,
            name: slice.name,
            value: slice.value,
            display: `${slice.value} email${slice.value === 1 ? "" : "s"}`,
            sharePct: (slice.value / total) * 100,
          }))}
        />
      );
    }
    case "vercel-tracker": {
      const trackers = (data.trackers as Record<string, TrackerPoint[]>) || {};
      const entries = Object.entries(trackers).filter(
        ([, points]) => points.length > 0,
      );
      if (entries.length === 0) {
        return <NoData label="No Vercel deployments yet." />;
      }
      return (
        <div className="min-h-0 flex-1 space-y-3 overflow-auto overscroll-contain">
          {entries.map(([name, points]) => (
            <div key={name} className="space-y-1.5">
              <p className="truncate text-xs text-muted-foreground">{name}</p>
              <ActivityTracker data={points} />
            </div>
          ))}
        </div>
      );
    }
    case "vercel-projects": {
      const items = (data.items as StatusItem[]) || [];
      if (items.length === 0) {
        return <NoData label="No Vercel projects found." />;
      }
      return <StatusList items={items} />;
    }
    case "vercel-deploys": {
      const deploys = (data.recentDeploys as VercelDeployItem[]) || [];
      if (deploys.length === 0) {
        return <NoData label="No recent deployments." />;
      }
      return (
        <DataTable
          data={deploys}
          rowKey={(deploy) => deploy.id}
          columns={[
            {
              header: "Project",
              render: (deploy) => (
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate font-medium">
                    {deploy.projectName}
                  </span>
                  {deploy.branch || deploy.commitMessage ? (
                    <span className="truncate text-xs text-muted-foreground">
                      {deploy.commitMessage || deploy.branch}
                    </span>
                  ) : null}
                </div>
              ),
            },
            {
              header: "Status",
              render: (deploy) => (
                <Badge variant={deployBadgeVariant(deploy.status)}>
                  {deploy.rawState}
                </Badge>
              ),
            },
            {
              header: "When",
              align: "right",
              className: "text-xs text-muted-foreground",
              render: (deploy) => format(new Date(deploy.createdAt), "d MMM, HH:mm"),
            },
          ]}
        />
      );
    }
    case "railway-projects": {
      const projects = (data.projects as RailwayProjectSummary[]) || [];
      if (projects.length === 0) {
        return <NoData label="No Railway projects found." />;
      }
      return (
        <DataTable
          data={projects}
          rowKey={(project) => project.id}
          columns={[
            {
              header: "Project",
              render: (project) => (
                <div className="flex min-w-0 items-center gap-2">
                  <StatusDot status={project.status} />
                  <span className="truncate font-medium">{project.name}</span>
                </div>
              ),
            },
            {
              header: "Services",
              render: (project) => (
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  {project.detail}
                </span>
              ),
            },
            {
              header: "Status",
              align: "right",
              render: (project) => (
                <Badge variant={toneBadgeVariant(project.status)}>
                  {statusLabel(project.status)}
                </Badge>
              ),
            },
          ]}
        />
      );
    }
    case "railway-billing": {
      const billing = data.billing as RailwayBilling | null;
      if (!billing) {
        return (
          <WidgetMessage title="Railway didn’t return billing. It is workspace-scoped, so a project token cannot read it." />
        );
      }
      const currency = billing.currency.toUpperCase();
      const cycle =
        billing.cycleStart && billing.cycleEnd
          ? `${format(new Date(billing.cycleStart), "d MMM")} – ${format(new Date(billing.cycleEnd), "d MMM")}`
          : undefined;
      return (
        <StatCard
          label="Estimated bill"
          value={
            billing.estimatedBill !== null
              ? formatMoney(billing.estimatedBill, currency)
              : "—"
          }
          hint={
            billing.currentUsage !== null
              ? `${formatMoney(billing.currentUsage, currency)} used so far`
              : billing.workspaceName
          }
          trend={cycle}
          trendTone="neutral"
        />
      );
    }
    case "railway-cpu":
    case "railway-memory":
    case "railway-egress":
    case "railway-disk":
      return renderRailwaySeries(type, data);
    case "supabase-advisor-issues": {
      const issues = (data.advisorIssues as SupabaseAdvisorIssue[]) || [];
      if (issues.length === 0) {
        return <NoData label="No advisor findings — nothing to fix." />;
      }
      return (
        <DataTable
          data={issues}
          rowKey={(issue) => issue.id}
          columns={[
            {
              header: "Finding",
              render: (issue) => (
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate font-medium">{issue.title}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {issue.projectName} · {issue.kind}
                  </span>
                </div>
              ),
            },
            {
              header: "Level",
              align: "right",
              render: (issue) => (
                <Badge variant={toneBadgeVariant(issue.status)}>
                  {issue.level}
                </Badge>
              ),
            },
          ]}
        />
      );
    }
    case "status-board": {
      const items =
        (data.items as Array<{
          id: string;
          name: string;
          provider: string;
          status: string;
          detail: string;
        }>) || [];
      if (items.length === 0) {
        return <NoData label="No status items from connected sources." />;
      }
      return <StatusList items={items} showSourceIcon />;
    }
    default: {
      // The assignment still enforces exhaustiveness at compile time: a new
      // WidgetType with no case above fails to typecheck here. At runtime this
      // is reached only by a widget left on a dashboard after its type was
      // retired, so say so plainly rather than leaving a blank card.
      const _exhaustive: never = type;
      void _exhaustive;
      return (
        <WidgetMessage title="This widget is no longer available. Remove it from the dashboard in edit mode." />
      );
    }
  }
}
