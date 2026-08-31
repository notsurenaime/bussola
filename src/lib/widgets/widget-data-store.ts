"use client";

import { useSyncExternalStore } from "react";
import type { WidgetType } from "@/lib/widgets/registry";

/**
 * One poll loop per provider, shared across every widget on the page.
 *
 * The `/api/widgets/data` route returns the whole provider dashboard for any
 * `railway-*` / `netlify-*` / `supabase-*` / `qonto-*` type, so all widgets of a
 * provider can share a single request keyed by a canonical type. Polling pauses
 * while the tab is hidden and does one catch-up refresh when it returns.
 */
const POLL_MS = 60_000;

type Bucket =
  | "railway"
  | "netlify"
  | "supabase"
  | "qonto"
  | "status-board";

const CANONICAL: Record<Bucket, WidgetType> = {
  railway: "railway-tracker",
  netlify: "netlify-tracker",
  supabase: "supabase-health",
  qonto: "qonto-balance",
  "status-board": "status-board",
};

export function bucketFor(type: WidgetType): Bucket {
  if (type === "status-board") return "status-board";
  if (type.startsWith("railway-")) return "railway";
  if (type.startsWith("netlify-")) return "netlify";
  if (type.startsWith("supabase-")) return "supabase";
  return "qonto";
}

export type WidgetSnapshot = {
  data: (Record<string, unknown> & { needsConnection?: boolean }) | null;
  error: string | null;
  loading: boolean;
};

type Entry = {
  snapshot: WidgetSnapshot;
  listeners: Set<() => void>;
  inFlight: Promise<void> | null;
  timer: ReturnType<typeof setInterval> | null;
};

const LOADING: WidgetSnapshot = { data: null, error: null, loading: true };
const entries = new Map<Bucket, Entry>();

function getEntry(bucket: Bucket): Entry {
  let entry = entries.get(bucket);
  if (!entry) {
    entry = { snapshot: LOADING, listeners: new Set(), inFlight: null, timer: null };
    entries.set(bucket, entry);
  }
  return entry;
}

function emit(entry: Entry, next: WidgetSnapshot) {
  entry.snapshot = next;
  for (const listener of entry.listeners) listener();
}

function load(bucket: Bucket): Promise<void> {
  const entry = getEntry(bucket);
  if (entry.inFlight) return entry.inFlight;

  const run = (async () => {
    try {
      const res = await fetch(
        `/api/widgets/data?type=${CANONICAL[bucket]}`,
        { cache: "no-store" },
      );
      const json = (await res.json()) as Record<string, unknown> & {
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "Failed to load");
      emit(entry, { data: json, error: null, loading: false });
    } catch {
      emit(entry, {
        data: entry.snapshot.data,
        error: "Couldn’t load this widget. Try reconnecting the source.",
        loading: false,
      });
    } finally {
      entry.inFlight = null;
    }
  })();

  entry.inFlight = run;
  return run;
}

let visibilityBound = false;
function bindVisibility() {
  if (visibilityBound || typeof document === "undefined") return;
  visibilityBound = true;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    for (const bucket of entries.keys()) void load(bucket);
  });
}

function subscribe(bucket: Bucket, listener: () => void): () => void {
  bindVisibility();
  const entry = getEntry(bucket);
  entry.listeners.add(listener);

  if (entry.timer === null) {
    void load(bucket);
    entry.timer = setInterval(() => {
      if (!document.hidden) void load(bucket);
    }, POLL_MS);
  }

  return () => {
    entry.listeners.delete(listener);
    if (entry.listeners.size === 0) {
      if (entry.timer !== null) clearInterval(entry.timer);
      entries.delete(bucket);
    }
  };
}

export function useWidgetData(type: WidgetType): WidgetSnapshot {
  const bucket = bucketFor(type);
  return useSyncExternalStore(
    (listener) => subscribe(bucket, listener),
    () => getEntry(bucket).snapshot,
    () => LOADING,
  );
}
