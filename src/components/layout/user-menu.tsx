"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  CaretUpDownIcon,
  GearSixIcon,
  MoonIcon,
  SignOutIcon,
  SunIcon,
} from "@phosphor-icons/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSettingsModal } from "@/components/settings/settings-modal-context";
import { signOut, useSession } from "@/lib/auth/client";
import { cn } from "@/lib/utils";

function initialsFor(name: string | null | undefined, email: string): string {
  const source = name?.trim() || email;
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0]!.toUpperCase());
  return letters.join("") || "?";
}

export function UserMenu({ collapsed }: { collapsed: boolean }) {
  const router = useRouter();
  const { data: session } = useSession();
  const { resolvedTheme, setTheme } = useTheme();
  const { openSettings } = useSettingsModal();
  const [planName, setPlanName] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/billing")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { enabled?: boolean; planName?: string } | null) => {
        if (data?.enabled && data.planName) setPlanName(data.planName);
      })
      .catch(() => {
        /* billing is optional; stay silent when it is not available */
      });
  }, []);

  async function logout() {
    await signOut();
    router.push("/login");
    router.refresh();
  }

  if (!session?.user) return null;

  const { name, email, image } = session.user;
  const displayName = name?.trim() || email;
  const initials = initialsFor(name, email);

  const trigger = (
    <button
      type="button"
      className={cn(
        "flex min-w-0 items-center rounded-md text-sm transition-colors hover:bg-sidebar-accent/70",
        collapsed
          ? "justify-center p-1"
          : "w-full gap-2 px-1.5 py-1.5 text-left",
      )}
      aria-label="Account menu"
    >
      <Avatar className="size-7 shrink-0">
        <AvatarImage src={image ?? undefined} alt="" />
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      {!collapsed ? (
        <>
          <span className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="truncate font-medium">{displayName}</span>
            <span className="truncate text-xs text-muted-foreground">
              {planName ?? email}
            </span>
          </span>
          <CaretUpDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
        </>
      ) : null}
    </button>
  );

  return (
    <DropdownMenu>
      {collapsed ? (
        <Tooltip>
          <TooltipTrigger render={<DropdownMenuTrigger render={trigger} />} />
          <TooltipContent side="right">{displayName}</TooltipContent>
        </Tooltip>
      ) : (
        <DropdownMenuTrigger render={trigger} />
      )}

      <DropdownMenuContent side="top" align="start" sideOffset={8}>
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate font-medium">{displayName}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">
            {email}
          </span>
        </DropdownMenuLabel>
        {planName ? (
          <div className="px-2 pb-1.5">
            <Badge variant="secondary">{planName}</Badge>
          </div>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => openSettings()}>
          <GearSixIcon />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            setTheme(resolvedTheme === "dark" ? "light" : "dark")
          }
          closeOnClick={false}
        >
          {resolvedTheme === "dark" ? <SunIcon /> : <MoonIcon />}
          <span className="flex-1">
            {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
          </span>
          <span
            onClick={(e) => e.stopPropagation()}
            className="flex items-center"
          >
            <Switch
              size="sm"
              checked={resolvedTheme === "dark"}
              onCheckedChange={(checked) =>
                setTheme(checked ? "dark" : "light")
              }
              aria-label="Toggle dark mode"
            />
          </span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={logout}>
          <SignOutIcon />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
