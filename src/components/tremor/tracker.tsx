"use client";

import { forwardRef } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface TrackerBlockProps {
  key?: string | number;
  color?: string;
  tooltip?: string;
  hoverEffect?: boolean;
  defaultBackgroundColor?: string;
}

function Block({
  color,
  tooltip,
  defaultBackgroundColor,
  hoverEffect,
}: TrackerBlockProps) {
  const block = (
    <div className="size-full overflow-hidden px-[0.5px] transition first:rounded-l-[4px] first:pl-0 last:rounded-r-[4px] last:pr-0 sm:px-px">
      <div
        className={cn(
          "size-full rounded-[1px]",
          color || defaultBackgroundColor,
          hoverEffect && "hover:opacity-50",
        )}
      />
    </div>
  );

  if (!tooltip) return block;

  return (
    <Tooltip>
      <TooltipTrigger render={block} />
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export interface TrackerProps extends React.HTMLAttributes<HTMLDivElement> {
  data: TrackerBlockProps[];
  defaultBackgroundColor?: string;
  hoverEffect?: boolean;
}

export const Tracker = forwardRef<HTMLDivElement, TrackerProps>(
  (
    {
      data = [],
      defaultBackgroundColor = "bg-muted-foreground/30",
      className,
      hoverEffect,
      ...props
    },
    forwardedRef,
  ) => {
    return (
      <TooltipProvider delay={0}>
        <div
          ref={forwardedRef}
          className={cn("group flex h-8 w-full items-center", className)}
          {...props}
        >
          {data.map((item, index) => {
            const { key: itemKey, ...blockProps } = item;
            return (
              <Block
                key={itemKey ?? index}
                defaultBackgroundColor={defaultBackgroundColor}
                hoverEffect={hoverEffect}
                {...blockProps}
              />
            );
          })}
        </div>
      </TooltipProvider>
    );
  },
);

Tracker.displayName = "Tracker";
