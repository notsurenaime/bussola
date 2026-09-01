"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowClockwiseIcon,
  ArrowSquareOutIcon,
  PencilSimpleIcon,
  PlugsIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { PageHeader, SectionHeading } from "@/components/layout/page";
import { SourceIcon } from "@/components/brand/source-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PROVIDER_CATALOG } from "@/lib/connectors/catalog";
import { connectionHealth } from "@/lib/connectors/health";
import type { Provider } from "@/lib/providers";
import { cn } from "@/lib/utils";
import { ConnectionDialog } from "@/components/connections/connection-dialog";

export type ConnectionView = {
  id: string;
  provider: Provider;
  label: string;
  status: string;
  lastError: string | null;
  syncEnabled: boolean;
  lastSyncedAt: string | null;
  consecutiveFailures: number;
};

type Props = {
  connections: ConnectionView[];
  liveProviders: Provider[];
  comingSoon: Provider[];
  /** How many widgets currently read from each provider. */
  widgetCounts: Record<string, number>;
};

/** "1 widget" / "3 widgets" as one text node, so no JSX whitespace surprises. */
function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export function ConnectionsManager({
  connections,
  liveProviders,
  comingSoon,
  widgetCounts,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<{
    provider: Provider;
    connection?: ConnectionView;
  } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const byProvider = new Map(connections.map((c) => [c.provider, c]));

  async function call(
    id: string,
    path: string,
    messages: { ok: string; fail: string },
  ) {
    setBusy(id);
    try {
      const res = await fetch(path, { method: "POST" });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string | null;
        result?: { ok: boolean; message: string };
      };
      const ok = data.result ? data.result.ok : data.ok;
      const message = data.result?.message || data.error;

      if (ok) toast.success(message || messages.ok);
      else toast.error(message || messages.fail);

      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function remove(connection: ConnectionView) {
    const uses = widgetCounts[connection.provider] ?? 0;
    const warning =
      uses > 0 ? ` ${plural(uses, "widget")} will fall back to demo data.` : "";
    if (
      !window.confirm(
        `Remove the ${PROVIDER_CATALOG[connection.provider].name} connection?${warning}`,
      )
    ) {
      return;
    }

    setBusy(connection.id);
    try {
      const res = await fetch(`/api/connections?id=${connection.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error("Could not remove the connection");
        return;
      }
      toast.success("Connection removed");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Connections"
        description="Tokens are encrypted before they are stored, and never reach the browser."
      />

      <section className="space-y-3">
        <SectionHeading
          title="Sources"
          description={`${connections.length} of ${liveProviders.length} connected`}
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {liveProviders.map((provider) => {
            const entry = PROVIDER_CATALOG[provider];
            const connection = byProvider.get(provider);
            const state = connection ? connectionHealth(connection) : null;

            return (
              <div
                key={provider}
                className={cn(
                  "flex flex-col gap-3 rounded-lg border border-border bg-card p-4",
                  state?.tone === "error" && "border-destructive/40",
                )}
              >
                <div className="flex items-start gap-3">
                  <SourceIcon provider={provider} className="mt-0.5 size-5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">
                        {entry.name}
                      </p>
                      {state ? (
                        <Badge
                          variant={
                            state.tone === "ok"
                              ? "secondary"
                              : state.tone === "warn"
                                ? "outline"
                                : "destructive"
                          }
                        >
                          {state.label}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground text-balance">
                      {entry.tagline}
                    </p>
                  </div>
                </div>

                {connection ? (
                  <>
                    <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <div>
                        <dt className="sr-only">Last synced</dt>
                        <dd>
                          {connection.lastSyncedAt
                            ? `Synced ${formatDistanceToNow(
                                new Date(connection.lastSyncedAt),
                                { addSuffix: true },
                              )}`
                            : "Not synced yet"}
                        </dd>
                      </div>
                      {widgetCounts[provider] ? (
                        <div>
                          <dt className="sr-only">Widgets</dt>
                          <dd>{plural(widgetCounts[provider], "widget")}</dd>
                        </div>
                      ) : null}
                    </dl>

                    {connection.lastError ? (
                      <p
                        className={cn(
                          "text-xs text-balance",
                          connection.syncEnabled
                            ? "text-muted-foreground"
                            : "text-destructive",
                        )}
                      >
                        {connection.lastError}
                        {!connection.syncEnabled
                          ? " Syncing stopped after repeated failures — save new credentials to resume."
                          : null}
                      </p>
                    ) : null}

                    <div className="mt-auto flex flex-wrap items-center gap-1 pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        disabled={busy === connection.id}
                        onClick={() =>
                          call(
                            connection.id,
                            `/api/connections/${connection.id}/sync`,
                            { ok: "Refreshed", fail: "Refresh failed" },
                          )
                        }
                      >
                        <ArrowClockwiseIcon className="size-3" />
                        Refresh
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        disabled={busy === connection.id}
                        onClick={() =>
                          call(
                            connection.id,
                            `/api/connections/${connection.id}/test`,
                            { ok: "Credentials work", fail: "Test failed" },
                          )
                        }
                      >
                        Test
                      </Button>
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              aria-label={`Edit ${entry.name} connection`}
                              onClick={() => setEditing({ provider, connection })}
                            >
                              <PencilSimpleIcon className="size-3" />
                            </Button>
                          }
                        />
                        <TooltipContent>Replace credentials</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              aria-label={`Remove ${entry.name} connection`}
                              disabled={busy === connection.id}
                              onClick={() => remove(connection)}
                            >
                              <TrashIcon className="size-3" />
                            </Button>
                          }
                        />
                        <TooltipContent>Remove</TooltipContent>
                      </Tooltip>
                    </div>
                  </>
                ) : (
                  <div className="mt-auto flex items-center gap-2 pt-1">
                    <Button
                      type="button"
                      size="xs"
                      onClick={() => setEditing({ provider })}
                    >
                      <PlugsIcon className="size-3" />
                      Connect
                    </Button>
                    {entry.docsUrl ? (
                      <a
                        href={entry.docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                      >
                        Get a token
                        <ArrowSquareOutIcon className="size-3" />
                      </a>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeading
          title="Coming soon"
          description="Wave 2 needs an OAuth app for each provider."
        />
        <div className="flex flex-wrap gap-2">
          {comingSoon.map((provider) => {
            const entry = PROVIDER_CATALOG[provider];
            return (
              <Tooltip key={provider}>
                <TooltipTrigger
                  render={
                    <Badge variant="outline" className="gap-1.5">
                      <SourceIcon provider={provider} className="size-3" />
                      {entry.name}
                    </Badge>
                  }
                />
                <TooltipContent>
                  {entry.tagline}
                  {entry.soonNote ? ` · ${entry.soonNote}` : ""}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </section>

      {editing ? (
        <ConnectionDialog
          provider={editing.provider}
          connectionId={editing.connection?.id}
          currentLabel={editing.connection?.label}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
