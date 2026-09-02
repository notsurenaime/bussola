"use client";

import { useMemo } from "react";
import {
  ResponsiveGridLayout,
  useContainerWidth,
  type Layout,
  type ResponsiveLayouts,
} from "react-grid-layout";
import { BussolaMark } from "@/components/brand/bussola-mark";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { WidgetFrame } from "@/components/dashboard/widget-frame";
import type { CanvasWidget } from "@/components/dashboard/dashboard-canvas";
import { WidgetDataEndpoint } from "@/lib/widgets/widget-data-store";
import type { WidgetType } from "@/lib/widgets/registry";
import "react-grid-layout/css/styles.css";

type Props = {
  token: string;
  dashboardName: string;
  widgets: CanvasWidget[];
  whiteLabel: boolean;
};

/**
 * A dashboard as a visitor sees it.
 *
 * The same `WidgetFrame` the owner uses, with edit mode off and no callbacks
 * — so a shared canvas cannot drift from the real one, and there is no code
 * path here that could mutate anything even if a control were added by
 * mistake. Every request it makes goes to the share endpoint, which checks the
 * token on each one rather than trusting that this page rendered.
 */
export function SharedCanvas({
  token,
  dashboardName,
  widgets,
  whiteLabel,
}: Props) {
  const { width, containerRef, mounted } = useContainerWidth();

  const layout: Layout = useMemo(
    () =>
      widgets.map((widget) => ({
        i: widget.id,
        x: widget.layout.x,
        y: widget.layout.y,
        w: widget.layout.w,
        h: widget.layout.h,
        static: true,
      })),
    [widgets],
  );

  const layouts: ResponsiveLayouts = useMemo(
    () => ({ lg: layout, md: layout, sm: layout }),
    [layout],
  );

  return (
    <WidgetDataEndpoint endpoint={`/api/share/${token}/data`}>
      <div className="mx-auto w-full max-w-[1400px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {dashboardName}
            </h1>
            <p className="text-sm text-muted-foreground">
              Read-only view · updates live
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
          </div>
        </header>

        {widgets.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
            This dashboard has no widgets yet.
          </p>
        ) : (
          <div ref={containerRef} className="min-h-[420px]">
            {mounted ? (
              <ResponsiveGridLayout
                className="layout"
                width={width}
                layouts={layouts}
                breakpoints={{ lg: 1024, md: 768, sm: 0 }}
                cols={{ lg: 12, md: 8, sm: 4 }}
                rowHeight={72}
                margin={[16, 16] as const}
                dragConfig={{ enabled: false }}
                resizeConfig={{ enabled: false }}
              >
                {widgets.map((widget) => (
                  <div key={widget.id}>
                    <WidgetFrame
                      id={widget.id}
                      type={widget.widgetType as WidgetType}
                      title={widget.title}
                      connectionId={widget.connectionId}
                      config={widget.config}
                      editMode={false}
                      onRemove={() => {}}
                    />
                  </div>
                ))}
              </ResponsiveGridLayout>
            ) : null}
          </div>
        )}

        {/*
          White-label removes the mark and the link, not the page — a client
          report should look like the sender's, and a free link should say
          where it came from.
        */}
        {whiteLabel ? null : (
          <footer className="flex items-center justify-center gap-2 border-t border-border pt-6 text-xs text-muted-foreground">
            <BussolaMark className="size-3.5" />
            <span>
              Shared with{" "}
              <a
                href="https://bussola.app"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-foreground"
              >
                Bussola
              </a>
            </span>
          </footer>
        )}
      </div>
    </WidgetDataEndpoint>
  );
}
