"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { KpiCard } from "@/components/tremor/kpi-card";
import { Tracker } from "@/components/tremor/tracker";
import { BarCompare } from "@/components/tremor/bar-compare";
import { AccountPie } from "@/components/tremor/account-pie";
import { BalanceLine } from "@/components/tremor/balance-line";
import { QontoTransactionsWidget } from "@/components/dashboard/qonto-transactions-widget";
import { getSourceMeta, SourceIcon } from "@/components/brand/source-icons";
import { formatMoney, formatSignedMoney } from "@/lib/format/money";
import type { Provider } from "@/lib/db/schema";
import type {
  BalanceHistory,
  BalanceInfo,
  CashflowPeriod,
  LiquidityInfo,
  NetlifyBuildMinutes,
  NetlifyDeployItem,
  NetlifyFormItem,
  RailwayDeployItem,
  RailwayFleetHealth,
  RailwayResourceSnapshot,
  RailwayUsageItem,
  StatusItem,
  SupabaseAdvisorsSummary,
  SupabaseServiceItem,
  SupabaseTrafficBucket,
  TrackerPoint,
} from "@/lib/connectors/types";
import type { WidgetType } from "@/lib/widgets/registry";
import { getWidgetDefinition } from "@/lib/widgets/registry";

type WidgetRendererProps = {
  type: WidgetType;
};

function StatusDot({ status }: { status: string }) {
  const color =
    status === "ok"
      ? "bg-success"
      : status === "warn"
        ? "bg-warning"
        : status === "error"
          ? "bg-destructive"
          : "bg-muted-foreground/40";
  return (
    <span
      className={`inline-block size-2 shrink-0 rounded-full ${color}`}
      aria-hidden
    />
  );
}

function statusLabel(status: string): string {
  switch (status) {
    case "ok":
      return "Operational";
    case "warn":
      return "Degraded";
    case "error":
      return "Down";
    case "idle":
      return "Idle";
    default:
      return "Unknown";
  }
}

function deployBadgeVariant(
  status: TrackerPoint["status"],
): "secondary" | "outline" | "destructive" {
  switch (status) {
    case "ok":
      return "outline";
    case "warn":
      return "secondary";
    case "error":
      return "destructive";
    case "idle":
      return "secondary";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function ConnectPrompt({ provider }: { provider: string }) {
  const label =
    provider === "multi" ? "a source" : getSourceMeta(provider).title;
  return (
    <div className="flex h-full flex-col justify-center gap-2">
      <p className="text-sm font-medium">Connect {label}</p>
      <Link
        href="/connections"
        className="text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        Open Connections
      </Link>
    </div>
  );
}

function NoData({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center">
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function formatCores(value: number): string {
  return `${value.toFixed(value >= 1 ? 2 : 3)} cores`;
}

function formatGb(value: number): string {
  return `${value.toFixed(value >= 10 ? 1 : 2)} GB`;
}

export function WidgetRenderer({ type }: WidgetRendererProps) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (type === "qonto-transactions") return;

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    async function load() {
      try {
        const res = await fetch(`/api/widgets/data?type=${type}`);
        const json = (await res.json()) as Record<string, unknown> & {
          error?: string;
        };
        if (!res.ok) throw new Error(json.error || "Failed to load");
        if (!cancelled) {
          setData(json);
          setError(null);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError("Couldn’t load this widget. Try reconnecting the source.");
          setLoading(false);
        }
      }
    }

    void load();
    timer = setInterval(() => void load(), 60000);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [type]);

  if (type === "qonto-transactions") {
    return <QontoTransactionsWidget />;
  }

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
      <div className="flex h-full flex-col justify-center gap-2">
        <p className="text-sm text-muted-foreground">{error}</p>
        <Link
          href="/connections"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Check Connections
        </Link>
      </div>
    );
  }

  if (!data) return null;

  if (data.needsConnection) {
    const def = getWidgetDefinition(type);
    const provider = String(data.provider || def?.provider || "source");
    return <ConnectPrompt provider={provider} />;
  }

  switch (type) {
    case "railway-tracker": {
      const items = (data.items as StatusItem[]) || [];
      const trackers =
        (data.trackers as Record<string, TrackerPoint[]>) || {};
      const first = items[0];
      const points = first ? trackers[first.id] || [] : [];

      if (!first) {
        return <NoData label="No services found for this connection." />;
      }
      if (points.length === 0) {
        return <NoData label="No deployment history yet." />;
      }

      return (
        <div className="flex h-full flex-col justify-center gap-3">
          <p className="truncate text-sm font-medium">{first.name}</p>
          <Tracker data={points} hoverEffect />
          <p className="text-xs text-muted-foreground">
            {first.detail}
            {items.length > 1 ? ` · +${items.length - 1} more` : ""}
          </p>
        </div>
      );
    }
    case "railway-services": {
      const items = (data.items as StatusItem[]) || [];
      if (items.length === 0) {
        return <NoData label="No Railway services found." />;
      }
      return (
        <div className="flex h-full min-h-0 flex-col">
          <ul className="min-h-0 flex-1 divide-y divide-border/60 overflow-y-auto overscroll-contain">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-2.5 py-2 text-sm"
              >
                <StatusDot status={item.status} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.detail}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {statusLabel(item.status)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      );
    }
    case "railway-fleet": {
      const fleet = data.fleet as RailwayFleetHealth | undefined;
      if (!fleet || fleet.total === 0) {
        return <NoData label="No Railway services found." />;
      }
      const allHealthy = fleet.healthy === fleet.total;
      const issues = fleet.crashed + fleet.degraded;
      return (
        <KpiCard
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
          <BarCompare
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
          <BarCompare
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
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <TableHead className="h-9">Service</TableHead>
                <TableHead className="h-9">Status</TableHead>
                <TableHead className="h-9 text-right">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deploys.map((deploy) => (
                <TableRow key={deploy.id}>
                  <TableCell className="py-2">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate font-medium">
                        {deploy.serviceName}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {deploy.projectName}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    <Badge variant={deployBadgeVariant(deploy.status)}>
                      {deploy.rawStatus.toLowerCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap py-2 text-right text-muted-foreground">
                    {format(new Date(deploy.createdAt), "MMM d · HH:mm")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
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
          <Tracker data={points} hoverEffect />
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
      return (
        <div className="flex h-full min-h-0 flex-col">
          <ul className="min-h-0 flex-1 divide-y divide-border/60 overflow-y-auto overscroll-contain">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-2.5 py-2 text-sm"
              >
                <StatusDot status={item.status} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.detail}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {statusLabel(item.status)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      );
    }
    case "netlify-health": {
      const healthy = Number(data.healthy || 0);
      const total = Number(data.total || 0);
      if (total === 0) {
        return <NoData label="No Netlify sites found." />;
      }
      return (
        <KpiCard
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
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <TableHead className="h-9">Site</TableHead>
                <TableHead className="h-9">Status</TableHead>
                <TableHead className="h-9 text-right">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deploys.map((deploy) => (
                <TableRow key={deploy.id}>
                  <TableCell className="py-2">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate font-medium">
                        {deploy.siteName}
                      </span>
                      {deploy.branch ? (
                        <span className="truncate text-xs text-muted-foreground">
                          {deploy.branch}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    <Badge variant={deployBadgeVariant(deploy.status)}>
                      {deploy.rawState.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap py-2 text-right text-muted-foreground">
                    {format(new Date(deploy.createdAt), "MMM d · HH:mm")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
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
        <KpiCard
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
          <BarCompare
            rows={forms.slice(0, 5).map((form) => ({
              label: form.name,
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
        <KpiCard
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
      return (
        <div className="flex h-full min-h-0 flex-col">
          <ul className="min-h-0 flex-1 divide-y divide-border/60 overflow-y-auto overscroll-contain">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-2.5 py-2 text-sm"
              >
                <StatusDot status={item.status} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.detail}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {statusLabel(item.status)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      );
    }
    case "supabase-services": {
      const services = (data.services as SupabaseServiceItem[]) || [];
      if (services.length === 0) {
        return (
          <NoData label="No service health data yet (check PAT permissions)." />
        );
      }
      return (
        <div className="flex h-full min-h-0 flex-col">
          <ul className="min-h-0 flex-1 divide-y divide-border/60 overflow-y-auto overscroll-contain">
            {services.map((service) => (
              <li
                key={service.id}
                className="flex items-center gap-2.5 py-2 text-sm"
              >
                <StatusDot status={service.status} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {service.projectName} / {service.serviceName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {service.detail}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {statusLabel(service.status)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      );
    }
    case "supabase-traffic": {
      const traffic = (data.traffic as SupabaseTrafficBucket[]) || [];
      if (traffic.length === 0 || traffic.every((row) => row.value === 0)) {
        return <NoData label="No API traffic in the last 7 days." />;
      }
      return (
        <div className="flex h-full flex-col justify-center gap-3">
          <BarCompare
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
        <KpiCard
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
          <KpiCard
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
          <KpiCard
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
        <KpiCard
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
        <KpiCard
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
        <KpiCard
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
          <BarCompare
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
        <AccountPie
          accounts={balances.map((account, index) => ({
            id: `${account.accountName}-${index}`,
            name: account.accountName,
            value: account.balance,
            display: formatMoney(account.balance, account.currency),
            sharePct: account.sharePct ?? 0,
            main: account.main,
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
          <BalanceLine
            className="min-h-0 flex-1"
            points={history.points.map((point) => ({
              ...point,
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
      return (
        <div className="flex h-full min-h-0 flex-col">
          <ul className="min-h-0 flex-1 divide-y divide-border/60 overflow-y-auto overscroll-contain">
            {items.map((item) => (
              <li
                key={`${item.provider}-${item.id}`}
                className="flex items-center gap-2.5 py-2 text-sm"
              >
                <StatusDot status={item.status} />
                <SourceIcon
                  provider={item.provider as Provider}
                  className="size-3.5 shrink-0"
                />
                <p className="min-w-0 flex-1 truncate font-medium">
                  {item.name}
                </p>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {statusLabel(item.status)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      );
    }
    default: {
      const _exhaustive: never = type;
      return <p>Unknown widget {_exhaustive}</p>;
    }
  }
}
