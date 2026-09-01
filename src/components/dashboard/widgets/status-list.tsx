"use client";

import { SourceIcon } from "@/components/brand/source-icons";
import type { Provider } from "@/lib/providers";

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

export type StatusRow = {
  id: string;
  name: string;
  status: string;
  detail?: string;
  provider?: string;
};

/** Scrollable list of status rows — one shape for services, sites, projects,
 *  issues, and the multi-source status board. */
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
            key={showSourceIcon ? `${item.provider}-${item.id}` : item.id}
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
              <p className="min-w-0 flex-1 truncate font-medium">
                {item.name}
              </p>
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
