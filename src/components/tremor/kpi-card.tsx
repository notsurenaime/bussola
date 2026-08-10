import { cn } from "@/lib/utils";

type TrendTone = "positive" | "negative" | "neutral";

type KpiCardProps = {
  label: string;
  value: string;
  hint?: string;
  trend?: string;
  trendTone?: TrendTone;
  className?: string;
};

function toneClass(tone: TrendTone): string {
  switch (tone) {
    case "positive":
      return "text-success";
    case "negative":
      return "text-destructive";
    case "neutral":
      return "text-muted-foreground";
    default: {
      const _exhaustive: never = tone;
      return _exhaustive;
    }
  }
}

export function KpiCard({
  label,
  value,
  hint,
  trend,
  trendTone = "neutral",
  className,
}: KpiCardProps) {
  return (
    <div className={cn("flex h-full flex-col justify-between gap-3", className)}>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-3xl font-semibold tracking-tight text-foreground tabular-nums">
          {value}
        </p>
      </div>
      {(hint || trend) && (
        <div className="flex items-center justify-between gap-2 text-xs">
          {hint ? (
            <span className="text-muted-foreground">{hint}</span>
          ) : (
            <span />
          )}
          {trend ? (
            <span className={cn("tabular-nums", toneClass(trendTone))}>
              {trend}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}
