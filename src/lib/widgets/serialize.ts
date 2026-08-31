import type { dashboardWidgets } from "@/lib/db/schema";

type WidgetRow = typeof dashboardWidgets.$inferSelect;

export type CanvasWidgetDto = {
  id: string;
  widgetType: string;
  title: string | null;
  config: Record<string, unknown>;
  layout: { i: string; x: number; y: number; w: number; h: number };
};

/**
 * One place that turns a stored widget row into the canvas shape the client
 * renders — previously inlined identically in three route handlers.
 */
export function toCanvasWidget(row: WidgetRow): CanvasWidgetDto {
  let config: Record<string, unknown> = {};
  try {
    config = JSON.parse(row.configJson || "{}") as Record<string, unknown>;
  } catch {
    // A malformed config must not take the whole dashboard down.
    config = {};
  }

  return {
    id: row.id,
    widgetType: row.widgetType,
    title: row.title,
    config,
    layout: {
      i: row.id,
      x: row.layoutX,
      y: row.layoutY,
      w: row.layoutW,
      h: row.layoutH,
    },
  };
}
