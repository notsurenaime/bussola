"use client";

import type { ReactNode } from "react";
import { BussolaMark } from "@/components/brand/bussola-mark";

/** Shared frame for the setup / login screens: one gradient field, one
 *  centered column, one lockup. */
export function AuthShell({
  title = "Bussola",
  description,
  children,
}: {
  title?: ReactNode;
  description: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_25%,var(--color-almond-cream-200),transparent_42%),radial-gradient(circle_at_85%_5%,var(--color-taupe-200),transparent_38%)] dark:bg-[radial-gradient(circle_at_15%_25%,var(--color-dark-coffee-900),transparent_42%),radial-gradient(circle_at_85%_5%,var(--color-black-800),transparent_38%)]"
      />
      <div className="relative w-full max-w-sm space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <BussolaMark className="size-8 text-almond-cream-400" />
            <span className="text-2xl font-semibold tracking-tight">
              {title}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
