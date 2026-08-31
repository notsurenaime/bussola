"use client";

import { useCallback, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  GearSixIcon,
  PlugsConnectedIcon,
  SidebarSimpleIcon,
  SignOutIcon,
  SquaresFourIcon,
} from "@phosphor-icons/react";
import { BussolaMark } from "@/components/brand/bussola-mark";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { signOut } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboards", label: "Dashboards", icon: SquaresFourIcon },
  { href: "/connections", label: "Connections", icon: PlugsConnectedIcon },
  { href: "/settings", label: "Settings", icon: GearSixIcon },
] as const;

const STORAGE_KEY = "bussola.sidebar.collapsed";

/**
 * Sidebar collapse, read straight from localStorage.
 *
 * `useSyncExternalStore` rather than an effect that copies the value into
 * state: the server has no localStorage, so getServerSnapshot returns the
 * expanded default and the client swaps in the stored value during hydration
 * without a second render pass. Reads are wrapped because a browser set to
 * block site data throws rather than returning null.
 */
const collapseListeners = new Set<() => void>();

function subscribeCollapsed(listener: () => void) {
  collapseListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    collapseListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(next: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  } catch {
    /* a preference that cannot be stored is not worth failing over */
  }
  for (const listener of collapseListeners) listener();
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const collapsed = useSyncExternalStore(
    subscribeCollapsed,
    readCollapsed,
    () => false,
  );

  const toggleCollapsed = useCallback(() => {
    writeCollapsed(!readCollapsed());
  }, []);

  async function logout() {
    await signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={cn(
          "sticky top-0 flex h-screen shrink-0 flex-col overflow-hidden border-r border-border bg-sidebar py-4",
          "transition-[width] duration-100 ease-out motion-reduce:transition-none",
          collapsed ? "w-16 px-2" : "w-60 px-3",
        )}
      >
        <div
          className={cn(
            "mb-5 flex",
            collapsed
              ? "flex-col items-center gap-1"
              : "h-9 items-center justify-between gap-2 px-1",
          )}
        >
          <Link
            href="/dashboards"
            className={cn(
              "flex min-w-0 items-center",
              collapsed ? "justify-center" : "gap-2",
            )}
            aria-label="Bussola home"
          >
            <BussolaMark className="size-5 text-almond-cream-400" />
            {!collapsed ? (
              <span className="truncate text-lg font-semibold tracking-tight">
                Bussola
              </span>
            ) : null}
          </Link>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                  aria-expanded={!collapsed}
                  onClick={toggleCollapsed}
                  className="shrink-0"
                />
              }
            >
              <SidebarSimpleIcon
                className="size-4"
                weight={collapsed ? "fill" : "regular"}
              />
            </TooltipTrigger>
            <TooltipContent side="right">
              {collapsed ? "Expand sidebar" : "Collapse sidebar"}
            </TooltipContent>
          </Tooltip>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            const className = cn(
              "flex items-center rounded-md text-sm transition-colors",
              collapsed ? "justify-center px-0 py-2.5" : "gap-2 px-3 py-2",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground",
            );
            const content = (
              <>
                <Icon
                  className="size-4 shrink-0"
                  weight={active ? "duotone" : "regular"}
                />
                {!collapsed ? (
                  <span className="truncate">{item.label}</span>
                ) : null}
              </>
            );

            if (!collapsed) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={className}
                  aria-label={item.label}
                >
                  {content}
                </Link>
              );
            }

            return (
              <Tooltip key={item.href}>
                <TooltipTrigger
                  render={
                    <Link
                      href={item.href}
                      className={className}
                      aria-label={item.label}
                    />
                  }
                >
                  {content}
                </TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        <div
          className={cn(
            "mt-auto flex gap-1",
            collapsed
              ? "flex-col items-center"
              : "items-center justify-between px-0.5",
          )}
        >
          <ThemeToggle />

          {collapsed ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Log out"
                    onClick={logout}
                  />
                }
              >
                <SignOutIcon className="size-4" />
              </TooltipTrigger>
              <TooltipContent side="right">Log out</TooltipContent>
            </Tooltip>
          ) : (
            <Button variant="ghost" size="sm" onClick={logout}>
              <SignOutIcon className="size-4" />
              Log out
            </Button>
          )}
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-auto">
        <div className="w-full px-4 py-6 sm:px-5 lg:px-6">{children}</div>
      </main>
    </div>
  );
}
