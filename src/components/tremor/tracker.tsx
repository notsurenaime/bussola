"use client";

import * as React from "react";
import * as HoverCardPrimitives from "@radix-ui/react-hover-card";
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
  const [open, setOpen] = React.useState(false);

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
    <HoverCardPrimitives.Root
      open={open}
      onOpenChange={setOpen}
      openDelay={0}
      closeDelay={0}
    >
      <HoverCardPrimitives.Trigger onClick={() => setOpen(true)} asChild>
        {block}
      </HoverCardPrimitives.Trigger>
      <HoverCardPrimitives.Portal>
        <HoverCardPrimitives.Content
          sideOffset={10}
          side="top"
          align="center"
          avoidCollisions
          className={cn(
            "z-50 w-auto rounded-md px-2 py-1 text-sm shadow-md",
            "bg-foreground text-background",
          )}
        >
          {tooltip}
        </HoverCardPrimitives.Content>
      </HoverCardPrimitives.Portal>
    </HoverCardPrimitives.Root>
  );
}

export interface TrackerProps extends React.HTMLAttributes<HTMLDivElement> {
  data: TrackerBlockProps[];
  defaultBackgroundColor?: string;
  hoverEffect?: boolean;
}

export const Tracker = React.forwardRef<HTMLDivElement, TrackerProps>(
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
    );
  },
);

Tracker.displayName = "Tracker";
