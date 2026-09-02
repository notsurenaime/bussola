import type { PaymentItem, TrackerPoint } from "@/lib/connectors/types";

/** Deploy-style states, in the same badge vocabulary across every provider. */
export function deployBadgeVariant(
  status: TrackerPoint["status"],
): "secondary" | "outline" | "destructive" {
  switch (status) {
    case "ok":
      return "outline";
    case "warn":
      return "secondary";
    case "error":
      return "destructive";
    case "idle":
      return "secondary";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

/** Payment outcomes, in the same badge vocabulary as deploy states. */
export function paymentBadgeVariant(
  status: PaymentItem["status"],
): "secondary" | "outline" | "destructive" {
  switch (status) {
    case "succeeded":
      return "outline";
    case "pending":
      return "secondary";
    case "refunded":
      return "secondary";
    case "failed":
      return "destructive";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

/**
 * Status vocabulary as a coloured badge, for states worth reading at a glance:
 * a bounced email or a failed domain should be findable without reading a word.
 */
export function toneBadgeVariant(
  tone: TrackerPoint["status"],
): "success" | "warning" | "destructive" | "secondary" {
  switch (tone) {
    case "ok":
      return "success";
    case "warn":
      return "warning";
    case "error":
      return "destructive";
    case "idle":
      return "secondary";
    default: {
      const _exhaustive: never = tone;
      return _exhaustive;
    }
  }
}

export function formatCores(value: number): string {
  return `${value.toFixed(value >= 1 ? 2 : 3)} cores`;
}

export function formatGb(value: number): string {
  return `${value.toFixed(value >= 10 ? 1 : 2)} GB`;
}

/** Compact relative age: 11h, 2d, 5m — used by any "how long ago" label. */
export function shortAge(iso?: string | null): string | null {
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

/** Short, readable form of an opaque id: edfcd041 */
export function shortId(id: string): string {
  return id.replace(/-/g, "").slice(0, 8);
}

/**
 * Spelled-out relative age: 8h ago, 10d ago, 2mo ago.
 *
 * `shortAge` is the dense form for badges sitting next to a status; this is the
 * one for a table column that has to read as a sentence on its own.
 */
export function relativeAge(iso?: string | null): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;

  const mins = Math.floor(Math.max(ms, 0) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  return `${Math.floor(months / 12)}y ago`;
}

/** Percentages arrive as 0–100 from Resend; keep one decimal only when it matters. */
export function formatRate(value: number): string {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}
