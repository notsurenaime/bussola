import type { dashboardWidgets } from "@/lib/db/schema";
import { parseWidgetConfig, type WidgetConfig } from "./config";

type WidgetRow = typeof dashboardWidgets.$inferSelect;

export type CanvasWidgetDto = {
  id: string;
  widgetType: string;
  title: string | null;
  /** Null means "this organization's default connection for the provider". */
  connectionId: string | null;
  config: WidgetConfig;
  layout: { i: string; x: number; y: number; w: number; h: number };
};

/**
 * One place that turns a stored widget row into the canvas shape the client
 * renders — previously inlined identically in three route handlers.
 */
export function toCanvasWidget(row: WidgetRow): CanvasWidgetDto {
  let raw: unknown = {};
  try {
    raw = JSON.parse(row.configJson || "{}");
  } catch {
    // A malformed config must not take the whole dashboard down.
    raw = {};
  }

  return {
    id: row.id,
    widgetType: row.widgetType,
    title: row.title,
    connectionId: row.connectionId,
    // Parsed here rather than in the component: a config written by an older
    // build, or by hand through the API, reaches the canvas already clamped to
    // what the renderer knows how to apply.
    config: parseWidgetConfig(raw),
    layout: {
      i: row.id,
      x: row.layoutX,
      y: row.layoutY,
      w: row.layoutW,
      h: row.layoutH,
    },
  };
}
