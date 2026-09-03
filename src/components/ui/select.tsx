import * as React from "react";
import { CaretUpDownIcon } from "@phosphor-icons/react/ssr";

import { cn } from "@/lib/utils";

/**
 * A styled native `<select>`.
 *
 * Deliberately not a listbox built out of popovers: every control here picks
 * one value from a short list of strings, and the native element already
 * brings keyboard behaviour, screen-reader semantics and a usable picker on
 * touch devices that a custom one would have to re-earn.
 */
function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative w-full">
      <select
        data-slot="select"
        className={cn(
          "h-8 w-full min-w-0 appearance-none rounded-lg border border-input bg-transparent py-1 pr-8 pl-2.5 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <CaretUpDownIcon className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

export { Select };
