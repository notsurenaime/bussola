"use client";

import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  BellRingingIcon,
  BellSlashIcon,
  CheckIcon,
  PaperPlaneTiltIcon,
  PlusIcon,
  TrashIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { EmptyState, PageHeader, SectionHeading } from "@/components/layout/page";
import { SourceIcon } from "@/components/brand/source-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { PROVIDER_CATALOG } from "@/lib/connectors/catalog";
import type { Provider } from "@/lib/providers";
import { cn } from "@/lib/utils";

type ChannelKind = "email" | "slack" | "discord";
type Comparator = "above" | "below" | "equals" | "not_equals";

export type MetricOption = {
  key: string;
  provider: Provider;
  label: string;
  description: string;
  unit: string;
  defaultComparator: "above" | "below";
  defaultThreshold: number;
};

export type RuleRow = {
  id: string;
  connectionId: string;
  connectionLabel: string;
  provider: Provider;
  metric: string;
  comparator: Comparator;
  threshold: string;
  channelIds: string[];
  enabled: boolean;
  cooldownMinutes: number;
  lastState: string | null;
  lastValue: string | null;
  lastEvaluatedAt: string | null;
  mutedUntil: string | null;
};

export type ChannelRow = {
  id: string;
  kind: ChannelKind;
  label: string;
  enabled: boolean;
  lastError: string | null;
  lastDeliveredAt: string | null;
};

export type EventRow = {
  id: string;
  state: string;
  message: string;
  connectionLabel: string;
  provider: Provider;
  acknowledgedAt: string | null;
  createdAt: string;
};

type Props = {
  initialRules: RuleRow[];
  initialChannels: ChannelRow[];
  initialEvents: EventRow[];
  connections: Array<{ id: string; provider: Provider; label: string }>;
  metrics: MetricOption[];
  allowedChannels: ChannelKind[];
  planName: string;
  emailReady: boolean;
  emailSetupHint: string;
};

const COMPARATOR_LABEL: Record<Comparator, string> = {
  above: "goes above",
  below: "drops below",
  equals: "equals",
  not_equals: "is not",
};

const CHANNEL_LABEL: Record<ChannelKind, string> = {
  email: "Email",
  slack: "Slack",
  discord: "Discord",
};

const CHANNEL_PLACEHOLDER: Record<ChannelKind, string> = {
  email: "alerts@yourcompany.com",
  slack: "https://hooks.slack.com/services/…",
  discord: "https://discord.com/api/webhooks/…",
};

const COOLDOWN_CHOICES = [15, 30, 60, 180, 360, 720, 1440] as const;

/**
 * Rules, channels and what has fired.
 *
 * One screen rather than three, because the three are useless apart: a rule
 * with no channel notifies nobody, and a channel with no rule never fires.
 * Seeing all of it at once is what makes it obvious which half is missing.
 */
export function AlertsManager({
  initialRules,
  initialChannels,
  initialEvents,
  connections,
  metrics,
  allowedChannels,
  planName,
  emailReady,
  emailSetupHint,
}: Props) {
  const [rules, setRules] = useState(initialRules);
  const [channels, setChannels] = useState(initialChannels);
  const [events, setEvents] = useState(initialEvents);
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [showChannelForm, setShowChannelForm] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  const alertsAvailable = allowedChannels.length > 0;
  const unacknowledged = events.filter(
    (event) => event.state === "breached" && !event.acknowledgedAt,
  ).length;

  /** Connections that have at least one metric worth watching. */
  const alertable = useMemo(() => {
    const withMetrics = new Set(metrics.map((metric) => metric.provider));
    return connections.filter((connection) =>
      withMetrics.has(connection.provider),
    );
  }, [connections, metrics]);

  async function createRule(input: {
    connectionId: string;
    metric: string;
    comparator: Comparator;
    threshold: number;
    channelIds: string[];
    cooldownMinutes: number;
  }) {
    const res = await fetch("/api/alerts/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const json = (await res.json()) as { rule?: RuleRow; error?: string };
    if (!res.ok || !json.rule) {
      toast.error(json.error || "Could not create the rule");
      return false;
    }
    setRules((prev) => [json.rule!, ...prev]);
    setShowRuleForm(false);
    toast.success("Rule created");
    return true;
  }

  async function patchRule(id: string, patch: Record<string, unknown>) {
    const res = await fetch("/api/alerts/rules", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    const json = (await res.json()) as { rule?: RuleRow; error?: string };
    if (!res.ok || !json.rule) {
      toast.error(json.error || "Could not update the rule");
      return;
    }
    setRules((prev) => prev.map((rule) => (rule.id === id ? json.rule! : rule)));
  }

  async function deleteRule(id: string) {
    const res = await fetch(`/api/alerts/rules?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Could not delete the rule");
      return;
    }
    setRules((prev) => prev.filter((rule) => rule.id !== id));
    toast.success("Rule deleted");
  }

  async function createChannel(input: {
    kind: ChannelKind;
    label: string;
    target: string;
  }) {
    const res = await fetch("/api/alerts/channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const json = (await res.json()) as { channel?: ChannelRow; error?: string };
    if (!res.ok || !json.channel) {
      toast.error(json.error || "Could not add the channel");
      return false;
    }
    setChannels((prev) => [...prev, json.channel!]);
    setShowChannelForm(false);
    toast.success("Channel added");
    return true;
  }

  async function deleteChannel(id: string) {
    const res = await fetch(`/api/alerts/channels?id=${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Could not remove the channel");
      return;
    }
    setChannels((prev) => prev.filter((channel) => channel.id !== id));
    // A rule that pointed at it is now down one destination; reflect that
    // without a refetch so the rule list does not claim a channel that is gone.
    setRules((prev) =>
      prev.map((rule) => ({
        ...rule,
        channelIds: rule.channelIds.filter((channelId) => channelId !== id),
      })),
    );
    toast.success("Channel removed");
  }

  /**
   * Prove a channel end to end.
   *
   * A channel is otherwise only tested the first time something breaks, which
   * is the worst possible moment to discover a typo in a webhook URL or an
   * unset mail provider.
   */
  async function sendTest(channel: ChannelRow) {
    setTesting(channel.id);
    try {
      const res = await fetch("/api/alerts/channels/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: channel.id }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };

      if (!res.ok) {
        toast.error(json.error || "Could not send a test");
        return;
      }
      if (json.ok) {
        toast.success(`Test sent to ${channel.label}`);
      } else {
        toast.error(json.error || "The channel did not accept the message");
      }

      const now = new Date().toISOString();
      setChannels((prev) =>
        prev.map((row) =>
          row.id === channel.id
            ? {
                ...row,
                lastError: json.ok ? null : (json.error ?? "Delivery failed"),
                lastDeliveredAt: json.ok ? now : row.lastDeliveredAt,
              }
            : row,
        ),
      );
    } finally {
      setTesting(null);
    }
  }

  async function acknowledgeAll() {
    const res = await fetch("/api/alerts/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      toast.error("Could not acknowledge");
      return;
    }
    const now = new Date().toISOString();
    setEvents((prev) =>
      prev.map((event) =>
        event.acknowledgedAt ? event : { ...event, acknowledgedAt: now },
      ),
    );
  }

  return (
    <div className="space-y-10">
      <PageHeader
        title="Alerts"
        description="Get told when a number crosses a line, instead of finding out next time you look."
        actions={
          unacknowledged > 0 ? (
            <Button type="button" variant="outline" onClick={acknowledgeAll}>
              <CheckIcon className="size-4" />
              Acknowledge {unacknowledged}
            </Button>
          ) : null
        }
      />

      {!alertsAvailable ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/40 p-4">
          <WarningIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="space-y-1 text-sm">
            <p className="font-medium">
              Alerts are not part of the {planName} plan.
            </p>
            <p className="text-muted-foreground">
              Solo adds email alerts; Team adds Slack and Discord. Self-hosted
              has all three.
            </p>
          </div>
        </div>
      ) : null}

      {/* ── Recent ─────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <SectionHeading
          title="Recent"
          description="Every time a rule changed its mind, whether or not a channel took it."
        />
        {events.length === 0 ? (
          <EmptyState
            icon={<BellRingingIcon />}
            title="Nothing has fired"
            description="Alerts appear here the moment a rule's metric crosses its threshold."
          />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {events.map((event) => (
              <li
                key={event.id}
                className="flex items-start gap-3 px-4 py-3 text-sm"
              >
                <span
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full",
                    event.state === "breached" ? "bg-destructive" : "bg-success",
                  )}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate">{event.message}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <SourceIcon provider={event.provider} className="size-3" />
                    {event.connectionLabel} ·{" "}
                    {formatDistanceToNow(new Date(event.createdAt), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
                {event.state === "breached" && !event.acknowledgedAt ? (
                  <Badge variant="destructive">New</Badge>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Rules ──────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <SectionHeading
          title="Rules"
          description="What to watch, and when it counts as a problem."
          actions={
            alertable.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowRuleForm((open) => !open)}
              >
                <PlusIcon className="size-4" />
                New rule
              </Button>
            ) : null
          }
        />

        {showRuleForm ? (
          <RuleForm
            connections={alertable}
            metrics={metrics}
            channels={channels}
            onCancel={() => setShowRuleForm(false)}
            onCreate={createRule}
          />
        ) : null}

        {alertable.length === 0 ? (
          <EmptyState
            title="No sources to watch yet"
            description="Connect a source and its numbers become available here."
            action={
              <Button type="button" render={<a href="/connections" />}>
                Go to Connections
              </Button>
            }
          />
        ) : rules.length === 0 ? (
          <EmptyState
            title="No rules yet"
            description="A rule watches one number on one source and tells you when it crosses your line."
          />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {rules.map((rule) => {
              const metric = metrics.find((m) => m.key === rule.metric);
              const muted =
                rule.mutedUntil && new Date(rule.mutedUntil) > new Date();
              return (
                <li key={rule.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="flex flex-wrap items-center gap-x-1.5 text-sm">
                      <SourceIcon provider={rule.provider} className="size-3.5" />
                      <span className="font-medium">
                        {metric?.label ?? rule.metric}
                      </span>
                      <span className="text-muted-foreground">
                        {COMPARATOR_LABEL[rule.comparator]} {rule.threshold}
                      </span>
                      <span className="text-muted-foreground">
                        · {rule.connectionLabel}
                      </span>
                    </p>
                    <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {rule.lastState ? (
                        <Badge
                          variant={
                            rule.lastState === "breached"
                              ? "destructive"
                              : "success"
                          }
                        >
                          {rule.lastState === "breached" ? "Breached" : "OK"}
                          {rule.lastValue ? ` · ${rule.lastValue}` : ""}
                        </Badge>
                      ) : (
                        <Badge variant="outline">Not evaluated yet</Badge>
                      )}
                      <span>
                        {rule.channelIds.length === 0
                          ? "In-app only"
                          : `${rule.channelIds.length} channel${
                              rule.channelIds.length === 1 ? "" : "s"
                            }`}
                      </span>
                      {muted ? <span>· muted</span> : null}
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={muted ? "Unmute rule" : "Mute for 24 hours"}
                    onClick={() =>
                      patchRule(rule.id, { muteHours: muted ? 0 : 24 })
                    }
                  >
                    <BellSlashIcon
                      className={cn("size-4", muted && "text-warning")}
                    />
                  </Button>
                  <Switch
                    checked={rule.enabled}
                    aria-label={`${rule.enabled ? "Disable" : "Enable"} rule`}
                    onCheckedChange={(checked) =>
                      patchRule(rule.id, { enabled: checked })
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete rule"
                    onClick={() => deleteRule(rule.id)}
                  >
                    <TrashIcon className="size-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── Channels ───────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <SectionHeading
          title="Channels"
          description="Where alerts go. Without one, a rule still records here but reaches nobody."
          actions={
            alertsAvailable ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowChannelForm((open) => !open)}
              >
                <PlusIcon className="size-4" />
                Add channel
              </Button>
            ) : null
          }
        />

        {showChannelForm ? (
          <ChannelForm
            allowedChannels={allowedChannels}
            emailReady={emailReady}
            emailSetupHint={emailSetupHint}
            onCancel={() => setShowChannelForm(false)}
            onCreate={createChannel}
          />
        ) : null}

        {channels.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            No channels yet. Alerts will still show on this page.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {channels.map((channel) => (
              <li
                key={channel.id}
                className="flex items-center gap-3 px-4 py-3 text-sm"
              >
                <Badge variant="outline">{CHANNEL_LABEL[channel.kind]}</Badge>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{channel.label}</p>
                  {channel.lastError ? (
                    <p className="truncate text-xs text-destructive">
                      {channel.lastError}
                    </p>
                  ) : channel.lastDeliveredAt ? (
                    <p className="text-xs text-muted-foreground">
                      Last delivered{" "}
                      {formatDistanceToNow(new Date(channel.lastDeliveredAt), {
                        addSuffix: true,
                      })}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Nothing sent yet
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={testing === channel.id}
                  onClick={() => sendTest(channel)}
                >
                  <PaperPlaneTiltIcon className="size-3.5" />
                  {testing === channel.id ? "Sending…" : "Send test"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove channel"
                  onClick={() => deleteChannel(channel.id)}
                >
                  <TrashIcon className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function RuleForm({
  connections,
  metrics,
  channels,
  onCancel,
  onCreate,
}: {
  connections: Array<{ id: string; provider: Provider; label: string }>;
  metrics: MetricOption[];
  channels: ChannelRow[];
  onCancel: () => void;
  onCreate: (input: {
    connectionId: string;
    metric: string;
    comparator: Comparator;
    threshold: number;
    channelIds: string[];
    cooldownMinutes: number;
  }) => Promise<boolean>;
}) {
  const [connectionId, setConnectionId] = useState(connections[0]?.id ?? "");
  const connection = connections.find((c) => c.id === connectionId);

  /** Only this source's metrics — a Stripe rule cannot watch Railway. */
  const available = metrics.filter(
    (metric) => metric.provider === connection?.provider,
  );

  const [metricKey, setMetricKey] = useState(available[0]?.key ?? "");
  const metric = available.find((m) => m.key === metricKey) ?? available[0];

  const [comparator, setComparator] = useState<Comparator>(
    metric?.defaultComparator ?? "above",
  );
  const [threshold, setThreshold] = useState(
    String(metric?.defaultThreshold ?? 0),
  );
  const [channelIds, setChannelIds] = useState<string[]>([]);
  const [cooldown, setCooldown] = useState(60);
  const [saving, setSaving] = useState(false);

  /** Picking a metric replaces the defaults it came with. */
  function chooseMetric(key: string) {
    setMetricKey(key);
    const next = available.find((m) => m.key === key);
    if (next) {
      setComparator(next.defaultComparator);
      setThreshold(String(next.defaultThreshold));
    }
  }

  function chooseConnection(id: string) {
    setConnectionId(id);
    const provider = connections.find((c) => c.id === id)?.provider;
    const first = metrics.find((m) => m.provider === provider);
    if (first) {
      setMetricKey(first.key);
      setComparator(first.defaultComparator);
      setThreshold(String(first.defaultThreshold));
    }
  }

  const numeric = Number(threshold);
  const valid = Boolean(connectionId && metricKey) && Number.isFinite(numeric);

  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="rule-connection">Source</Label>
          <Select
            id="rule-connection"
            value={connectionId}
            onChange={(event) => chooseConnection(event.target.value)}
          >
            {connections.map((connection) => (
              <option key={connection.id} value={connection.id}>
                {connection.label} ({PROVIDER_CATALOG[connection.provider].name})
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rule-metric">Watch</Label>
          <Select
            id="rule-metric"
            value={metricKey}
            onChange={(event) => chooseMetric(event.target.value)}
          >
            {available.map((metric) => (
              <option key={metric.key} value={metric.key}>
                {metric.label}
              </option>
            ))}
          </Select>
          {metric ? (
            <p className="text-xs text-muted-foreground">{metric.description}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rule-comparator">When it</Label>
          <Select
            id="rule-comparator"
            value={comparator}
            onChange={(event) =>
              setComparator(event.target.value as Comparator)
            }
          >
            {(Object.keys(COMPARATOR_LABEL) as Comparator[]).map((key) => (
              <option key={key} value={key}>
                {COMPARATOR_LABEL[key]}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rule-threshold">Threshold</Label>
          <Input
            id="rule-threshold"
            type="number"
            step="any"
            value={threshold}
            onChange={(event) => setThreshold(event.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rule-cooldown">Don’t repeat within</Label>
          <Select
            id="rule-cooldown"
            value={String(cooldown)}
            onChange={(event) => setCooldown(Number(event.target.value))}
          >
            {COOLDOWN_CHOICES.map((minutes) => (
              <option key={minutes} value={String(minutes)}>
                {minutes >= 60 ? `${minutes / 60} hours` : `${minutes} minutes`}
              </option>
            ))}
          </Select>
          <p className="text-xs text-muted-foreground">
            Recoveries are always sent immediately.
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Notify</Label>
        {channels.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No channels yet — this rule will record here and nowhere else.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {channels.map((channel) => {
              const on = channelIds.includes(channel.id);
              return (
                <Button
                  key={channel.id}
                  type="button"
                  size="sm"
                  variant={on ? "default" : "outline"}
                  onClick={() =>
                    setChannelIds((prev) =>
                      on
                        ? prev.filter((id) => id !== channel.id)
                        : [...prev, channel.id],
                    )
                  }
                >
                  {CHANNEL_LABEL[channel.kind]} · {channel.label}
                </Button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          disabled={!valid || saving}
          onClick={async () => {
            setSaving(true);
            await onCreate({
              connectionId,
              metric: metricKey,
              comparator,
              threshold: numeric,
              channelIds,
              cooldownMinutes: cooldown,
            });
            setSaving(false);
          }}
        >
          {saving ? "Creating…" : "Create rule"}
        </Button>
      </div>
    </div>
  );
}

function ChannelForm({
  allowedChannels,
  emailReady,
  emailSetupHint,
  onCancel,
  onCreate,
}: {
  allowedChannels: ChannelKind[];
  emailReady: boolean;
  emailSetupHint: string;
  onCancel: () => void;
  onCreate: (input: {
    kind: ChannelKind;
    label: string;
    target: string;
  }) => Promise<boolean>;
}) {
  const [kind, setKind] = useState<ChannelKind>(allowedChannels[0] ?? "email");
  const [label, setLabel] = useState("");
  const [target, setTarget] = useState("");
  const [saving, setSaving] = useState(false);

  // Email needs server configuration no plan can supply, so this warns rather
  // than blocks: someone may well be setting the variables next.
  const emailUnconfigured = kind === "email" && !emailReady;

  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="channel-kind">Type</Label>
          <Select
            id="channel-kind"
            value={kind}
            onChange={(event) => setKind(event.target.value as ChannelKind)}
          >
            {allowedChannels.map((option) => (
              <option key={option} value={option}>
                {CHANNEL_LABEL[option]}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="channel-label">Name</Label>
          <Input
            id="channel-label"
            value={label}
            placeholder="e.g. On-call"
            onChange={(event) => setLabel(event.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="channel-target">
            {kind === "email" ? "Address" : "Webhook URL"}
          </Label>
          <Input
            id="channel-target"
            value={target}
            placeholder={CHANNEL_PLACEHOLDER[kind]}
            onChange={(event) => setTarget(event.target.value)}
          />
        </div>
      </div>

      {emailUnconfigured ? (
        <p className="flex items-start gap-2 text-xs text-warning">
          <WarningIcon className="mt-0.5 size-3.5 shrink-0" />
          {emailSetupHint}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          disabled={!label.trim() || !target.trim() || saving}
          onClick={async () => {
            setSaving(true);
            await onCreate({ kind, label: label.trim(), target: target.trim() });
            setSaving(false);
          }}
        >
          {saving ? "Adding…" : "Add channel"}
        </Button>
      </div>
    </div>
  );
}
