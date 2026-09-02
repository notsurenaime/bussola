import type { AlertComparator, AlertState } from "@/lib/db/schema";
import { formatMetricValue, getMetric } from "./metrics";

/**
 * Deciding whether an alert fires.
 *
 * Kept pure and separate from anything that reads a database or sends a
 * message, because this is the part that is easy to get subtly wrong and
 * impossible to test through a worker: the difference between a useful alert
 * and an unusable one is entirely in these rules.
 *
 * Three of them do the work:
 *
 *  1. **Notify on transition, not on state.** A rule that fires every time the
 *     condition still holds sends one message per sync, forever. What someone
 *     wants to know is that something *became* broken, and later that it
 *     stopped being broken.
 *  2. **Cooldown is a floor under repeat breaches, not under recoveries.** A
 *     value that flaps across the threshold must not send a message a minute;
 *     a recovery is always worth saying immediately.
 *  3. **An unreadable metric is not a breach.** A source that stopped
 *     reporting a section is a gap, not a zero, and firing "MRR dropped to 0"
 *     because a token lost a scope is worse than saying nothing.
 */

export type RuleSnapshot = {
  metric: string;
  comparator: AlertComparator;
  /** Stored as text so a threshold keeps exactly what was typed. */
  threshold: string;
  enabled: boolean;
  cooldownMinutes: number;
  lastState: AlertState | null;
  lastNotifiedAt: Date | null;
  mutedUntil: Date | null;
};

export type Evaluation =
  | { kind: "skipped"; reason: SkipReason }
  | {
      kind: "evaluated";
      state: AlertState;
      value: number;
      /** True when this transition should reach the channels. */
      notify: boolean;
      message: string;
    };

export type SkipReason =
  | "disabled"
  | "muted"
  | "unknown_metric"
  | "invalid_threshold"
  | "no_value";

export function compare(
  value: number,
  comparator: AlertComparator,
  threshold: number,
): boolean {
  switch (comparator) {
    case "above":
      return value > threshold;
    case "below":
      return value < threshold;
    case "equals":
      return value === threshold;
    case "not_equals":
      return value !== threshold;
    default: {
      const _exhaustive: never = comparator;
      return _exhaustive;
    }
  }
}

const COMPARATOR_WORDS: Record<AlertComparator, string> = {
  above: "above",
  below: "below",
  equals: "equal to",
  not_equals: "not equal to",
};

export function evaluateRule(
  rule: RuleSnapshot,
  payload: Record<string, unknown> | null,
  now: Date = new Date(),
): Evaluation {
  if (!rule.enabled) return { kind: "skipped", reason: "disabled" };
  if (rule.mutedUntil && rule.mutedUntil > now) {
    return { kind: "skipped", reason: "muted" };
  }

  const metric = getMetric(rule.metric);
  if (!metric) return { kind: "skipped", reason: "unknown_metric" };

  const threshold = Number(rule.threshold);
  if (!Number.isFinite(threshold)) {
    return { kind: "skipped", reason: "invalid_threshold" };
  }

  const value = payload ? metric.extract(payload) : null;
  if (value === null) return { kind: "skipped", reason: "no_value" };

  const breached = compare(value, rule.comparator, threshold);
  const state: AlertState = breached ? "breached" : "ok";

  const reading = formatMetricValue(value, metric.unit);
  const limit = formatMetricValue(threshold, metric.unit);
  const message = breached
    ? `${metric.label} is ${reading} — ${COMPARATOR_WORDS[rule.comparator]} ${limit}.`
    : `${metric.label} is back to ${reading}.`;

  return {
    kind: "evaluated",
    state,
    value,
    notify: shouldNotify(rule, state, now),
    message,
  };
}

/**
 * Whether a state warrants a message.
 *
 * The first evaluation of a rule is the awkward case. A rule created while
 * something is already broken has no previous state, and staying silent until
 * it breaks *again* would mean the alert someone just set up never fires. So a
 * first evaluation notifies when it is a breach, and stays quiet when it is
 * not — nobody wants "everything is fine" the moment they save a rule.
 */
function shouldNotify(
  rule: RuleSnapshot,
  state: AlertState,
  now: Date,
): boolean {
  if (rule.lastState === null) return state === "breached";

  if (state !== rule.lastState) {
    // Recoveries are never held back: "it is fixed" is time-critical in a way
    // that a repeat of "it is still broken" is not.
    if (state === "ok") return true;

    if (!rule.lastNotifiedAt) return true;
    const elapsedMinutes =
      (now.getTime() - rule.lastNotifiedAt.getTime()) / 60_000;
    return elapsedMinutes >= rule.cooldownMinutes;
  }

  // Unchanged state: nothing happened worth another message.
  return false;
}
