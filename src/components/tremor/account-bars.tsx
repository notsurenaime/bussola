import { cn } from "@/lib/utils";

export type AccountBarItem = {
  id: string;
  name: string;
  display: string;
  sharePct: number;
  main?: boolean;
};

type AccountBarsProps = {
  accounts: AccountBarItem[];
  className?: string;
};

export function AccountBars({ accounts, className }: AccountBarsProps) {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col justify-center gap-3 overflow-auto",
        className,
      )}
    >
      {accounts.map((account) => (
        <div key={account.id} className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate font-medium">{account.name}</span>
              {account.main ? (
                <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                  Main
                </span>
              ) : null}
            </div>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {account.display}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary/80 transition-[width] duration-500"
                style={{
                  width: `${Math.max(Math.min(account.sharePct, 100), account.sharePct > 0 ? 3 : 0)}%`,
                }}
              />
            </div>
            <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
              {account.sharePct.toFixed(account.sharePct % 1 === 0 ? 0 : 1)}%
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
