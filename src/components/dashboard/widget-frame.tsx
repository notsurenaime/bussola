"use client";

import { DotsSixVerticalIcon, TrashIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { SourceIcon } from "@/components/brand/source-icons";
import { cn } from "@/lib/utils";
import { WidgetRenderer } from "@/components/dashboard/widget-renderer";
import {
  getWidgetDefinition,
  type WidgetType,
} from "@/lib/widgets/registry";

type WidgetFrameProps = {
  id: string;
  type: WidgetType;
  title?: string | null;
  editMode: boolean;
  onRemove: (id: string) => void;
};

export function WidgetFrame({
  id,
  type,
  title,
  editMode,
  onRemove,
}: WidgetFrameProps) {
  const def = getWidgetDefinition(type);
  // Prefer live registry name when the stored title is a legacy default.
  const legacyTitles: Partial<Record<WidgetType, string[]>> = {
    "railway-tracker": [
      "Railway Tracker",
      "Railway Uptime",
      "Deploy Health",
    ],
    "supabase-health": ["Supabase Health", "Project Health"],
    "netlify-tracker": ["Netlify Tracker", "Deploy Health"],
    "qonto-balance": ["Qonto Balance", "Cash Balance"],
    "qonto-transactions": ["Qonto Transactions", "Recent Transactions"],
  };
  const legacy = legacyTitles[type];
  const heading =
    legacy && (!title || legacy.includes(title))
      ? def?.name || type
      : title || def?.name || type;

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground",
        editMode && "border-dashed",
      )}
    >
      <div
        className={cn(
          "flex shrink-0 items-center justify-between gap-2 border-b border-border/70 px-3 py-2",
          editMode && "drag-handle cursor-grab active:cursor-grabbing",
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          {editMode ? (
            <DotsSixVerticalIcon className="size-4 shrink-0 text-muted-foreground" />
          ) : null}
          {def ? (
            <SourceIcon provider={def.provider} className="size-3.5" />
          ) : null}
          <p className="truncate text-sm font-medium">{heading}</p>
        </div>
        {editMode ? (
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="Remove widget"
            onClick={() => onRemove(id)}
          >
            <TrashIcon className="size-3.5" />
          </Button>
        ) : null}
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
        <WidgetRenderer type={type} />
      </div>
    </div>
  );
}
