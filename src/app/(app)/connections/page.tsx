"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowsClockwiseIcon,
  PlugsConnectedIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { SourceIcon } from "@/components/brand/source-icons";
import { EmptyState, PageHeader, SectionHeading } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Provider } from "@/lib/db/schema";

type Connection = {
  id: string;
  provider: Provider;
  label: string;
  status: string;
  lastError?: string | null;
  lastCheckedAt?: string | Date | null;
};

const PROVIDER_META: Record<
  string,
  { name: string; hint: string; fields: Array<"apiKey" | "login" | "secretKey"> }
> = {
  railway: {
    name: "Railway",
    hint: "Account token (railway.com/account/tokens) or project token from project settings — both work",
    fields: ["apiKey"],
  },
  netlify: {
    name: "Netlify",
    hint: "Personal access token from Netlify user settings",
    fields: ["apiKey"],
  },
  supabase: {
    name: "Supabase",
    hint: "Personal access token (starts with sbp_) from supabase.com/dashboard/account/tokens — not a project anon/service key",
    fields: ["apiKey"],
  },
  qonto: {
    name: "Qonto",
    hint: "From Qonto → Integrations → API key: paste login:secret, or enter login and secret separately",
    fields: ["apiKey", "login", "secretKey"],
  },
};

const COMING_SOON = ["stripe", "polar", "attio", "vercel", "webtraffic"];

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [provider, setProvider] = useState<Provider>("railway");
  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [login, setLogin] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/connections");
    const data = (await res.json()) as { connections?: Connection[] };
    setConnections(data.connections || []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function saveConnection() {
    setSaving(true);
    const res = await fetch("/api/connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider,
        label: label || PROVIDER_META[provider]?.name || provider,
        credentials: {
          apiKey: apiKey || undefined,
          login: login || undefined,
          secretKey: secretKey || undefined,
        },
        test: true,
      }),
    });
    const data = (await res.json()) as {
      error?: string;
      testResult?: { ok: boolean; message: string };
    };
    setSaving(false);
    if (!res.ok) {
      toast.error(data.error || "Failed to save connection");
      return;
    }
    if (data.testResult?.ok) {
      toast.success(data.testResult.message);
    } else {
      toast.error(data.testResult?.message || "Saved, but test failed");
    }
    setOpen(false);
    setApiKey("");
    setLogin("");
    setSecretKey("");
    setLabel("");
    await load();
  }

  async function testConnection(id: string) {
    const res = await fetch(`/api/connections/${id}/test`, { method: "POST" });
    const data = (await res.json()) as {
      result?: { ok: boolean; message: string };
    };
    if (data.result?.ok) toast.success(data.result.message);
    else toast.error(data.result?.message || "Test failed");
    await load();
  }

  async function removeConnection(id: string) {
    const res = await fetch(`/api/connections?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to delete");
      return;
    }
    toast.success("Connection removed");
    await load();
  }

  const meta = PROVIDER_META[provider];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Connections"
        description="Store API keys encrypted locally. Widgets never see secrets in the browser."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
              render={
                <Button type="button">
                  <PlugsConnectedIcon className="size-4" />
                  Add connection
                </Button>
              }
            />
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Connect a source</DialogTitle>
                <DialogDescription>
                  Keys are encrypted at rest with AES-256-GCM.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Provider</Label>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(PROVIDER_META) as Provider[]).map((p) => (
                      <Button
                        key={p}
                        type="button"
                        size="sm"
                        variant={provider === p ? "default" : "outline"}
                        onClick={() => setProvider(p)}
                      >
                        <SourceIcon
                          provider={p}
                          branded={provider !== p}
                          className="size-3.5"
                        />
                        {PROVIDER_META[p].name}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="label">Label</Label>
                  <Input
                    id="label"
                    placeholder={meta?.name}
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                  />
                </div>
                {meta?.fields.includes("apiKey") ? (
                  <div className="space-y-2">
                    <Label htmlFor="apiKey">
                      {provider === "qonto"
                        ? "API key (login:secret)"
                        : "API token"}
                    </Label>
                    <Input
                      id="apiKey"
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                ) : null}
                {provider === "qonto" ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="login">Or login</Label>
                      <Input
                        id="login"
                        value={login}
                        onChange={(e) => setLogin(e.target.value)}
                        autoComplete="off"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="secretKey">Secret key</Label>
                      <Input
                        id="secretKey"
                        type="password"
                        value={secretKey}
                        onChange={(e) => setSecretKey(e.target.value)}
                        autoComplete="off"
                      />
                    </div>
                  </>
                ) : null}
                <p className="text-xs text-muted-foreground">{meta?.hint}</p>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveConnection()}
                >
                  {saving ? "Saving…" : "Save & test"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <section className="space-y-3">
        <SectionHeading title="Active" />
        {connections.length === 0 ? (
          <EmptyState
            title="No connections yet"
            description="Connect a source to start powering your widgets."
          />
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {connections.map((connection) => (
              <li
                key={connection.id}
                className="flex flex-wrap items-center justify-between gap-3 py-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <SourceIcon
                      provider={connection.provider}
                      className="size-4"
                    />
                    <p className="font-medium">{connection.label}</p>
                    <Badge
                      className="capitalize"
                      variant={
                        connection.status === "connected"
                          ? "secondary"
                          : connection.status === "error"
                            ? "destructive"
                            : "outline"
                      }
                    >
                      {connection.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {PROVIDER_META[connection.provider]?.name ||
                      connection.provider}
                    {connection.status === "error"
                      ? " · Connection needs attention — retest or reconnect"
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Test connection"
                    onClick={() => void testConnection(connection.id)}
                  >
                    <ArrowsClockwiseIcon className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Delete connection"
                    onClick={() => void removeConnection(connection.id)}
                  >
                    <TrashIcon className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <SectionHeading title="Coming soon" />
        <div className="flex flex-wrap gap-2">
          {COMING_SOON.map((p) => (
            <Badge key={p} variant="outline" className="gap-1.5 capitalize">
              <SourceIcon provider={p as Provider} className="size-3" />
              {p}
            </Badge>
          ))}
        </div>
      </section>
    </div>
  );
}
