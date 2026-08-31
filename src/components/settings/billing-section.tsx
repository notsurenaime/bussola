"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SectionHeading } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type BillingState = {
  enabled: boolean;
  planName: string;
  status: string;
  active: boolean;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  limits: { connections: number | null; dashboards: number | null };
  usage: { connections: number; dashboards: number };
  plans: Array<{ id: string; name: string }>;
};

/**
 * Renders nothing unless this deployment actually takes payments, so the
 * self-hosted edition never shows a plan it does not have.
 */
export function BillingSection() {
  const [state, setState] = useState<BillingState | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/billing")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: BillingState | null) => {
        if (data?.enabled) setState(data);
      })
      .catch(() => {
        /* billing is optional; stay silent when it is not available */
      });
  }, []);

  if (!state) return null;

  async function open(path: string, body?: unknown) {
    setPending(path);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        toast.error(data.error || "Could not reach the billing portal");
        return;
      }
      window.location.assign(data.url);
    } finally {
      setPending(null);
    }
  }

  const renews = state.currentPeriodEnd
    ? new Date(state.currentPeriodEnd).toLocaleDateString()
    : null;

  return (
    <section className="space-y-4 border-t border-border pt-6">
      <SectionHeading
        title="Plan"
        description="Billing is handled by Stripe."
        actions={
          <Badge variant={state.active ? "secondary" : "outline"}>
            {state.planName}
          </Badge>
        }
      />

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <Usage
          label="Connections"
          used={state.usage.connections}
          limit={state.limits.connections}
        />
        <Usage
          label="Dashboards"
          used={state.usage.dashboards}
          limit={state.limits.dashboards}
        />
      </dl>

      {state.cancelAtPeriodEnd && renews ? (
        <p className="text-sm text-muted-foreground">
          Your plan ends on {renews}.
        </p>
      ) : renews ? (
        <p className="text-sm text-muted-foreground">Renews {renews}.</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {state.plans.map((plan) => (
          <Button
            key={plan.id}
            variant="outline"
            size="sm"
            disabled={pending !== null}
            onClick={() => open("/api/billing/checkout", { plan: plan.id })}
          >
            {state.active ? `Switch to ${plan.name}` : `Upgrade to ${plan.name}`}
          </Button>
        ))}
        <Button
          variant="ghost"
          size="sm"
          disabled={pending !== null}
          onClick={() => open("/api/billing/portal")}
        >
          Manage billing
        </Button>
      </div>
    </section>
  );
}

function Usage({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number | null;
}) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">
        {used}
        <span className="text-muted-foreground">
          {limit === null ? " / unlimited" : ` / ${limit}`}
        </span>
      </dd>
    </div>
  );
}
