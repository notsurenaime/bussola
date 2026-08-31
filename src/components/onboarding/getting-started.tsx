import Link from "next/link";
import { CheckCircleIcon, CircleDashedIcon } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";

export type SetupState = {
  hasConnection: boolean;
  hasDashboard: boolean;
  hasWidget: boolean;
};

export function isSetupComplete(state: SetupState): boolean {
  return state.hasConnection && state.hasDashboard && state.hasWidget;
}

type Step = {
  title: string;
  description: string;
  done: boolean;
  href: string;
  cta: string;
};

/**
 * The first-run path, in the order it has to happen: a source, a canvas,
 * something on it.
 *
 * Progress is derived from what actually exists rather than stored, so it can
 * never drift out of sync with reality — deleting your only connection puts
 * step one back, which is correct. The card disappears once all three are done
 * and never comes back on its own.
 */
export function GettingStarted({ state }: { state: SetupState }) {
  if (isSetupComplete(state)) return null;

  const steps: Step[] = [
    {
      title: "Connect a source",
      description:
        "Paste a read-only API token. It is encrypted before it is stored.",
      done: state.hasConnection,
      href: "/connections",
      cta: "Open Connections",
    },
    {
      title: "Create a dashboard",
      description: "A canvas you arrange yourself. You can have several.",
      done: state.hasDashboard,
      href: "/dashboards",
      cta: "Create one",
    },
    {
      title: "Add your first widget",
      description: "Drag, resize, and drop in the blocks you care about.",
      done: state.hasWidget,
      href: "/dashboards",
      cta: "Add a widget",
    },
  ];

  const done = steps.filter((step) => step.done).length;
  const next = steps.find((step) => !step.done);

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-medium">Get set up</h2>
        <p className="text-sm text-muted-foreground">
          {done} of {steps.length} done
        </p>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Until then, widgets show sample data so you can see what they do.
      </p>

      <ol className="mt-4 space-y-3">
        {steps.map((step) => (
          <li key={step.title} className="flex items-start gap-3">
            {step.done ? (
              <CheckCircleIcon
                weight="fill"
                className="mt-0.5 size-5 shrink-0 text-success"
              />
            ) : (
              <CircleDashedIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            )}
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-sm font-medium",
                  step.done && "text-muted-foreground line-through",
                )}
              >
                {step.title}
              </p>
              {!step.done ? (
                <p className="text-sm text-muted-foreground">
                  {step.description}
                </p>
              ) : null}
            </div>
            {step === next ? (
              <Link
                href={step.href}
                className="shrink-0 text-sm font-medium underline-offset-4 hover:underline"
              >
                {step.cta}
              </Link>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
