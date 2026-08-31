"use client";

import { useTransition } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { TrashIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteDashboardAction } from "./actions";

export type DashboardSummary = {
  id: string;
  name: string;
  updatedAt: string;
};

export function DashboardList({ dashboards }: { dashboards: DashboardSummary[] }) {
  const [pending, startTransition] = useTransition();

  function remove(id: string, name: string) {
    startTransition(async () => {
      const result = await deleteDashboardAction(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Deleted “${name}”`);
    });
  }

  return (
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
            aria-label={`Delete ${dashboard.name}`}
            disabled={pending}
            onClick={() => remove(dashboard.id, dashboard.name)}
          >
            <TrashIcon className="size-4" />
          </Button>
        </li>
      ))}
    </ul>
  );
}
