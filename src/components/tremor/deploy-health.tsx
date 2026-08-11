import { cn } from "@/lib/utils";
import type {
  RailwayDeployAttempt,
  RailwayDeployHealth,
} from "@/lib/connectors/types";

type DeployHealthProps = {
  health: RailwayDeployHealth;
  className?: string;
};

/** Compact relative age: 11h, 2d, 5m */
function shortAge(iso?: string): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  const abs = Math.max(ms, 0);
  const mins = Math.floor(abs / 60_000);
  if (mins < 60) return `${Math.max(mins, 1)}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function shortDeployId(id: string): string {
  return id.replace(/-/g, "").slice(0, 8);
}

function activeLabel(
  status: RailwayDeployHealth["active"]["status"],
): string {
  switch (status) {
    case "healthy":
      return "Healthy";
    case "crashed":
      return "Crashed";
    case "sleeping":
      return "Sleeping";
    case "unknown":
      return "Unknown";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function activeTone(
  status: RailwayDeployHealth["active"]["status"],
): string {
  switch (status) {
    case "healthy":
      return "text-success";
    case "crashed":
      return "text-destructive";
    case "sleeping":
    case "unknown":
      return "text-muted-foreground";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function activeDot(
  status: RailwayDeployHealth["active"]["status"],
): string {
  switch (status) {
    case "healthy":
      return "bg-success";
    case "crashed":
      return "bg-destructive";
    case "sleeping":
    case "unknown":
      return "bg-muted-foreground/40";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function attemptStatusLabel(attempt: RailwayDeployAttempt): string {
  const raw = attempt.rawStatus.toUpperCase();
  if (raw === "FAILED") return "Deploy failed";
  if (raw === "CRASHED") return "Crashed";
  if (raw === "BUILDING") return "Building";
  if (raw === "DEPLOYING") return "Deploying";
  if (raw === "QUEUED") return "Queued";
  if (raw === "WAITING") return "Waiting";
  if (raw === "INITIALIZING") return "Starting";
  return attempt.stage;
}

function AttemptRow({
  attempt,
  tone,
}: {
  attempt: RailwayDeployAttempt;
  tone: "destructive" | "warning";
}) {
  return (
    <li className="flex min-w-0 items-baseline gap-1.5 text-xs">
      <span className="w-7 shrink-0 tabular-nums text-muted-foreground">
        {shortAge(attempt.createdAt) || "—"}
      </span>
      <span
        className={cn(
          "shrink-0",
          tone === "destructive" ? "text-destructive" : "text-warning",
        )}
      >
        {attemptStatusLabel(attempt)}
      </span>
      <span className="min-w-0 truncate font-mono text-muted-foreground">
        {shortDeployId(attempt.id)}
      </span>
    </li>
  );
}

export function DeployHealth({ health, className }: DeployHealthProps) {
  const liveAge = shortAge(health.active.createdAt);
  const behind = health.behindCount;
  const failed = health.failedSinceActive.slice(0, 3);
  const hasAttempts = Boolean(health.inFlight || failed.length > 0);

  const headline =
    behind > 0
      ? `${behind} behind`
      : health.active.status === "crashed"
        ? "Crashed"
        : health.inFlight
          ? "Shipping"
          : "Up to date";

  const metaBits = [
    liveAge ? `live ${liveAge}` : null,
    health.active.commitHash,
    behind === 0 ? health.active.label : null,
  ].filter(Boolean);

  return (
    <div className={cn("flex h-full min-h-0 flex-col gap-2.5", className)}>
      <div className="flex min-w-0 items-center justify-between gap-2">
        <p className="truncate text-sm font-medium text-foreground">
          {health.serviceName}
          <span className="font-normal text-muted-foreground">
            {" "}
            · {health.projectName}
          </span>
        </p>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 text-xs",
            activeTone(health.active.status),
          )}
        >
          <span
            className={cn("size-1.5 rounded-full", activeDot(health.active.status))}
            aria-hidden
          />
          {activeLabel(health.active.status)}
        </span>
      </div>

      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 gap-4",
          hasAttempts ? "items-start" : "flex-col justify-center",
        )}
      >
        <div className="min-w-0 shrink-0">
          <p
            className={cn(
              "text-2xl font-semibold tracking-tight tabular-nums leading-none",
              behind > 0 || health.active.status === "crashed"
                ? "text-destructive"
                : "text-foreground",
            )}
          >
            {headline}
          </p>
          {metaBits.length > 0 ? (
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {metaBits.join(" · ")}
            </p>
          ) : null}
        </div>

        {hasAttempts ? (
          <ul className="min-w-0 flex-1 space-y-1">
            {health.inFlight ? (
              <AttemptRow attempt={health.inFlight} tone="warning" />
            ) : null}
            {failed.map((attempt) => (
              <AttemptRow
                key={attempt.id}
                attempt={attempt}
                tone="destructive"
              />
            ))}
            {behind > failed.length ? (
              <li className="text-xs text-muted-foreground">
                +{behind - failed.length} more
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
