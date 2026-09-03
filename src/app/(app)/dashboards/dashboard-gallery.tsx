"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { SquaresFourIcon, StarIcon, TrashIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, startDelete] = useTransition();
  const [starring, startStar] = useTransition();

  function remove() {
    startDelete(async () => {
      const result = await deleteDashboardAction(dashboard.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setConfirmOpen(false);
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

      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {/* The pseudo-element stretches the link over the whole card, so the
              thumbnail stays clickable while the buttons sit above it. */}
          <Link
            href={`/dashboards/${dashboard.id}`}
            className="block before:absolute before:inset-0 before:rounded-xl"
          >
            <p className="truncate text-sm font-medium group-hover:underline">
              {dashboard.name}
            </p>
          </Link>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Updated{" "}
            {format(new Date(dashboard.updatedAt), "MMM d, yyyy · HH:mm")}
          </p>
        </div>

        <div className="relative z-10 -mt-1 -mr-1 flex shrink-0 items-center gap-0.5">
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

          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${dashboard.name}`}
                />
              }
            >
              <TrashIcon className="size-4" />
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete dashboard</DialogTitle>
                <DialogDescription>
                  “{dashboard.name}” and its widgets will be permanently
                  deleted. This can’t be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose render={<Button type="button" variant="outline" />}>
                  Cancel
                </DialogClose>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={deleting}
                  onClick={remove}
                >
                  {deleting ? "Deleting…" : "Delete"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
