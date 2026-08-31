"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { EmptyState, PageHeader } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Dashboard = {
  id: string;
  name: string;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export default function DashboardsPage() {
  const router = useRouter();
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/dashboards");
    const data = (await res.json()) as { dashboards?: Dashboard[] };
    setDashboards(data.dashboards || []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function createDashboard() {
    if (!name.trim()) return;
    const res = await fetch("/api/dashboards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    const data = (await res.json()) as {
      dashboard?: Dashboard;
      error?: string;
    };
    if (!res.ok || !data.dashboard) {
      toast.error(data.error || "Failed to create dashboard");
      return;
    }
    setOpen(false);
    setName("");
    router.push(`/dashboards/${data.dashboard.id}`);
  }

  async function removeDashboard(id: string) {
    const res = await fetch(`/api/dashboards?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to delete dashboard");
      return;
    }
    setDashboards((prev) => prev.filter((d) => d.id !== id));
    toast.success("Dashboard deleted");
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboards"
        description="Compose canvases from your connected sources."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
              render={
                <Button type="button">
                  <PlusIcon className="size-4" />
                  New dashboard
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create dashboard</DialogTitle>
                <DialogDescription>
                  Give it a clear name — you can rename it later.
                </DialogDescription>
              </DialogHeader>
              <Input
                placeholder="Ops overview"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void createDashboard();
                }}
              />
              <DialogFooter>
                <Button type="button" onClick={() => void createDashboard()}>
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : dashboards.length === 0 ? (
        <EmptyState
          title="No dashboards yet"
          description="Create your first canvas, then drop Railway, Netlify, Supabase, or Qonto blocks onto it."
        />
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {dashboards.map((dashboard) => (
            <li
              key={dashboard.id}
              className="flex items-center justify-between gap-4 py-4"
            >
              <Link
                href={`/dashboards/${dashboard.id}`}
                className="group min-w-0 flex-1"
              >
                <p className="truncate text-base font-medium group-hover:underline">
                  {dashboard.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  Updated{" "}
                  {format(new Date(dashboard.updatedAt), "MMM d, yyyy · HH:mm")}
                </p>
              </Link>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Delete dashboard"
                onClick={() => void removeDashboard(dashboard.id)}
              >
                <TrashIcon className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
