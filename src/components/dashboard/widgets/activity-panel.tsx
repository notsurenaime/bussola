import { cn } from "@/lib/utils";

type StatusTone = "positive" | "negative" | "neutral";

export type ActivityPanelEvent = {
  id: string;
  /** Compact relative age, e.g. "11h" — see `shortAge()` in widget-format. */
  age?: string | null;
  label: string;
  tone: "destructive" | "warning";
  meta?: string;
};

export type ActivityPanelProps = {
  /** e.g. a service or project name. */
  title: string;
  /** e.g. the parent project or account it belongs to. */
  subtitle?: string;
  status?: { label: string; tone: StatusTone };
  /** The big headline, e.g. "Up to date" / "2 behind" / "Crashed". */
  headline: string;
  headlineTone?: "negative" | "neutral";
  meta?: string;
  /** Recent incidents/attempts, most relevant first. */
  events?: ActivityPanelEvent[];
  /** Events beyond what's shown, e.g. "+2 more". */
  moreCount?: number;
  className?: string;
};

function toneDot(tone: StatusTone): string {
  switch (tone) {
    case "positive":
      return "bg-success";
    case "negative":
      return "bg-destructive";
    case "neutral":
      return "bg-muted-foreground/40";
    default: {
      const _exhaustive: never = tone;
      return _exhaustive;
    }
  }
}

function toneText(tone: StatusTone): string {
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

/**
 * A "what's happening right now" summary: a headline status plus the recent
 * events behind it. Built for deploy health, but the shape (headline + a
 * short list of recent incidents) fits any "latest state of something" widget.
 */
export function ActivityPanel({
  title,
  subtitle,
  status,
  headline,
  headlineTone = "neutral",
  meta,
  events = [],
  moreCount = 0,
  className,
}: ActivityPanelProps) {
  const hasEvents = events.length > 0;

  return (
    <div className={cn("flex h-full min-h-0 flex-col gap-2.5", className)}>
      <div className="flex min-w-0 items-center justify-between gap-2">
        <p className="truncate text-sm font-medium text-foreground">
          {title}
          {subtitle ? (
            <span className="font-normal text-muted-foreground"> · {subtitle}</span>
          ) : null}
        </p>
        {status ? (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 text-xs",
              toneText(status.tone),
            )}
          >
            <span
              className={cn("size-1.5 rounded-full", toneDot(status.tone))}
              aria-hidden
            />
            {status.label}
          </span>
        ) : null}
      </div>

      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 gap-4",
          hasEvents ? "items-start" : "flex-col justify-center",
        )}
      >
        <div className="min-w-0 shrink-0">
          <p
            className={cn(
              "text-2xl leading-none font-semibold tracking-tight tabular-nums",
              headlineTone === "negative" ? "text-destructive" : "text-foreground",
            )}
          >
            {headline}
          </p>
          {meta ? (
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {meta}
            </p>
          ) : null}
        </div>

        {hasEvents ? (
          <ul className="min-w-0 flex-1 space-y-1">
            {events.map((event) => (
              <li
                key={event.id}
                className="flex min-w-0 items-baseline gap-1.5 text-xs"
              >
                <span className="w-7 shrink-0 tabular-nums text-muted-foreground">
                  {event.age || "—"}
                </span>
                <span
                  className={cn(
                    "shrink-0",
                    event.tone === "destructive"
                      ? "text-destructive"
                      : "text-warning",
                  )}
                >
                  {event.label}
                </span>
                {event.meta ? (
                  <span className="min-w-0 truncate font-mono text-muted-foreground">
                    {event.meta}
                  </span>
                ) : null}
              </li>
            ))}
            {moreCount > 0 ? (
              <li className="text-xs text-muted-foreground">
                +{moreCount} more
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
