"use client";

import { useTransition } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { SquaresFourIcon, StarIcon, TrashIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { WidgetPreview } from "@/components/dashboard/widget-previews";
import type { WidgetType } from "@/lib/widgets/registry";
import { cn } from "@/lib/utils";
import { deleteDashboardAction, starDashboardAction } from "./actions";

export type DashboardSummary = {
  id: string;
  name: string;
  updatedAt: string;
  starred: boolean;
  /** First few widgets, in layout order, for the card thumbnail. */
  widgetTypes: WidgetType[];
};

export function DashboardGallery({
  dashboards,
}: {
  dashboards: DashboardSummary[];
}) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {dashboards.map((dashboard) => (
        <DashboardCard key={dashboard.id} dashboard={dashboard} />
      ))}
    </div>
  );
}

function DashboardCard({ dashboard }: { dashboard: DashboardSummary }) {
  const [deleting, startDelete] = useTransition();
  const [starring, startStar] = useTransition();

  function remove() {
    startDelete(async () => {
      const result = await deleteDashboardAction(dashboard.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Deleted “${dashboard.name}”`);
    });
  }

  function toggleStar() {
    startStar(async () => {
      const result = await starDashboardAction(
        dashboard.id,
        !dashboard.starred,
      );
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <div className="group relative flex flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:border-foreground/30">
      <div className="absolute top-3 right-3 z-10 flex items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={
            dashboard.starred
              ? `Unstar ${dashboard.name}`
              : `Star ${dashboard.name}`
          }
          aria-pressed={dashboard.starred}
          disabled={starring}
          onClick={toggleStar}
        >
          <StarIcon
            className={cn(
              "size-4",
              dashboard.starred && "text-almond-cream-400",
            )}
            weight={dashboard.starred ? "fill" : "regular"}
          />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Delete ${dashboard.name}`}
          disabled={deleting}
          onClick={remove}
        >
          <TrashIcon className="size-4" />
        </Button>
      </div>

      <Link href={`/dashboards/${dashboard.id}`} className="block">
        <div className="mb-5 flex h-32 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-muted/40 p-2.5">
          {dashboard.widgetTypes.length === 0 ? (
            <SquaresFourIcon className="size-8 text-muted-foreground" />
          ) : (
            <div
              className={cn(
                "grid h-full w-full gap-1.5",
                dashboard.widgetTypes.length === 1
                  ? "grid-cols-1"
                  : "grid-cols-2",
              )}
            >
              {dashboard.widgetTypes.map((type, i) => (
                <WidgetPreview
                  key={`${type}-${i}`}
                  type={type}
                  className="h-full"
                />
              ))}
            </div>
          )}
        </div>
        <p className="truncate pr-14 text-sm font-medium group-hover:underline">
          {dashboard.name}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Updated{" "}
          {format(new Date(dashboard.updatedAt), "MMM d, yyyy · HH:mm")}
        </p>
      </Link>
    </div>
  );
}
