"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { SparkleIcon } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { getSourceMeta, SourceIcon } from "@/components/brand/source-icons";
import type { Provider } from "@/lib/providers";
import type { PaymentItem, TrackerPoint } from "@/lib/connectors/types";

export function StatusDot({ status }: { status: string }) {
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

export function statusLabel(status: string): string {
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

export function deployBadgeVariant(
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

/** One shared treatment for every "this widget can't show data right now"
 *  state — connect prompts, load errors, and empty results. */
export function WidgetMessage({
  title,
  action,
}: {
  title: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1.5 px-3 text-center">
      <p className="text-sm text-muted-foreground text-balance">{title}</p>
      {action ? (
        <Link
          href={action.href}
          className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

/** Payment outcomes, in the same badge vocabulary as deploy states. */
export function paymentBadgeVariant(
  status: PaymentItem["status"],
): "secondary" | "outline" | "destructive" {
  switch (status) {
    case "succeeded":
      return "outline";
    case "pending":
      return "secondary";
    case "refunded":
      return "secondary";
    case "failed":
      return "destructive";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function ConnectPrompt({ provider }: { provider: string }) {
  const label =
    provider === "multi" ? "a source" : getSourceMeta(provider).title;
  return (
    <WidgetMessage
      title={`Connect ${label} to see this widget.`}
      action={{ href: "/connections", label: "Open Connections" }}
    />
  );
}

export function NoData({ label }: { label: string }) {
  return <WidgetMessage title={label} />;
}

/**
 * Shown above a widget rendering sample data.
 *
 * Demo data exists so a new account looks alive rather than broken, which only
 * works if nobody can mistake it for their own numbers — so this is a label,
 * not a hint, and it carries the action that makes it go away.
 */
export function DemoNotice({ provider }: { provider?: string }) {
  const label =
    provider && provider !== "multi" ? getSourceMeta(provider).title : "a source";

  return (
    <div className="mb-2 flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1">
      <Badge variant="secondary" className="gap-1">
        <SparkleIcon className="size-3" />
        Demo data
      </Badge>
      <Link
        href="/connections"
        className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        Connect {label} to see yours
      </Link>
    </div>
  );
}

/**
 * Shown above a widget whose snapshot has fallen well behind its sync
 * schedule. The numbers are still real, just old — saying so beats silently
 * presenting stale data as current.
 */
export function StaleNotice({ fetchedAt }: { fetchedAt?: string | null }) {
  const when = fetchedAt ? new Date(fetchedAt) : null;
  const label =
    when && !Number.isNaN(when.getTime())
      ? `Last updated ${formatDistanceToNow(when, { addSuffix: true })}`
      : "This data may be out of date";

  return (
    <p className="mb-2 shrink-0 text-xs text-muted-foreground">{label}</p>
  );
}

export function formatCores(value: number): string {
  return `${value.toFixed(value >= 1 ? 2 : 3)} cores`;
}

export function formatGb(value: number): string {
  return `${value.toFixed(value >= 10 ? 1 : 2)} GB`;
}

export type StatusRow = {
  id: string;
  name: string;
  status: string;
  detail?: string;
  provider?: string;
};

/** Scrollable status list shared by Railway services, Netlify sites, Supabase
 *  projects, and the multi-source status board. */
export function StatusList({
  items,
  showSourceIcon = false,
}: {
  items: StatusRow[];
  showSourceIcon?: boolean;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <ul className="min-h-0 flex-1 divide-y divide-border/60 overflow-y-auto overscroll-contain">
        {items.map((item) => (
          <li
            key={
              showSourceIcon ? `${item.provider}-${item.id}` : item.id
            }
            className="flex items-center gap-2.5 py-2 text-sm"
          >
            <StatusDot status={item.status} />
            {showSourceIcon ? (
              <SourceIcon
                provider={item.provider as Provider}
                className="size-3.5 shrink-0"
              />
            ) : null}
            {showSourceIcon ? (
              <p className="min-w-0 flex-1 truncate font-medium">{item.name}</p>
            ) : (
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{item.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {item.detail}
                </p>
              </div>
            )}
            <span className="shrink-0 text-xs text-muted-foreground">
              {statusLabel(item.status)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
