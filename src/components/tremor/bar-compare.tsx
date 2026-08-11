import { cn } from "@/lib/utils";

type BarCompareRow = {
  label: string;
  value: number;
  display: string;
  tone?: "in" | "out" | "neutral";
};

type BarCompareProps = {
  rows: BarCompareRow[];
  className?: string;
};

function barTone(tone: BarCompareRow["tone"]): string {
  switch (tone) {
    case "in":
      return "bg-success";
    case "out":
      return "bg-foreground/70";
    case "neutral":
    case undefined:
      return "bg-primary";
    default: {
      const _exhaustive: never = tone;
      return _exhaustive;
    }
  }
}

export function BarCompare({ rows, className }: BarCompareProps) {
  const max = Math.max(...rows.map((row) => Math.abs(row.value)), 1);

  return (
    <div className={cn("flex h-full flex-col justify-center gap-4", className)}>
      {rows.map((row, index) => {
        const width = `${Math.max((Math.abs(row.value) / max) * 100, 4)}%`;
        return (
          <div key={`${row.label}-${index}`} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="font-medium tabular-nums text-foreground">
                {row.display}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-500",
                  barTone(row.tone),
                )}
                style={{ width }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
