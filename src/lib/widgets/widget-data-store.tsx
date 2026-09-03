"use client";

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { WidgetType } from "@/lib/widgets/registry";

/**
 * Where widget data comes from.
 *
 * The signed-in canvas reads `/api/widgets/data`; a shared dashboard reads
 * `/api/share/<token>/data`, which answers the same shapes for a caller with
 * no session. Making it a context rather than a prop keeps every widget
 * component identical between the two — a read-only dashboard renders the same
 * components as the real one, which is the only way the two stay in step.
 */
const DEFAULT_ENDPOINT = "/api/widgets/data";

const EndpointContext = createContext(DEFAULT_ENDPOINT);

export function WidgetDataEndpoint({
  endpoint,
  children,
}: {
  endpoint: string;
  children: ReactNode;
}) {
  return (
    <EndpointContext.Provider value={endpoint}>
      {children}
    </EndpointContext.Provider>
  );
}

export function useWidgetDataEndpoint(): string {
  return useContext(EndpointContext);
}

/**
 * One poll loop per source, shared across every widget reading it.
 *
 * The `/api/widgets/data` route returns the whole provider dashboard for any
 * `railway-*` / `netlify-*` / `supabase-*` / `qonto-*` type, so all widgets of
 * a provider can share a single request keyed by a canonical type. Polling
 * pauses while the tab is hidden and does one catch-up refresh when it returns.
 *
 * The key is provider *and* connection: two widgets on the same Stripe account
 * share one request, while a widget pointed at a second Stripe account gets
 * its own. Sharing by provider alone would hand one account's numbers to the
 * other's widgets.
 */
const POLL_MS = 60_000;

type Provider =
  | "railway"
  | "netlify"
  | "supabase"
  | "qonto"
  | "stripe"
  | "lemonsqueezy"
  | "sentry"
  | "resend"
  | "vercel"
  | "status-board";

const CANONICAL: Record<Provider, WidgetType> = {
  railway: "railway-tracker",
  netlify: "netlify-tracker",
  supabase: "supabase-health",
  qonto: "qonto-balance",
  stripe: "stripe-mrr",
  lemonsqueezy: "lemonsqueezy-mrr",
  sentry: "sentry-issues",
  resend: "resend-domains",
  vercel: "vercel-tracker",
  "status-board": "status-board",
};

export function providerFor(type: WidgetType): Provider {
  if (type === "status-board") return "status-board";
  if (type.startsWith("railway-")) return "railway";
  if (type.startsWith("netlify-")) return "netlify";
  if (type.startsWith("supabase-")) return "supabase";
  if (type.startsWith("stripe-")) return "stripe";
  if (type.startsWith("lemonsqueezy-")) return "lemonsqueezy";
  if (type.startsWith("sentry-")) return "sentry";
  if (type.startsWith("resend-")) return "resend";
  if (type.startsWith("vercel-")) return "vercel";
  return "qonto";
}

/**
 * Identifies one poll loop: a provider, read through one connection, from one
 * endpoint. The endpoint is part of the key so a share page and the app can
 * never be served each other's cached snapshot.
 */
type Key = string;

function keyFor(
  endpoint: string,
  type: WidgetType,
  connectionId?: string | null,
): Key {
  return `${endpoint}|${providerFor(type)}:${connectionId || "default"}`;
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
  url: string;
};

/**
 * An error the API explained. Anything else — a dropped connection, bad JSON —
 * has no message worth showing, so only this one is passed through verbatim.
 */
class ServerMessage extends Error {}

const LOADING: WidgetSnapshot = { data: null, error: null, loading: true };
const entries = new Map<Key, Entry>();

/**
 * Where a key reads from.
 *
 * Built once when the entry is created rather than on every poll, so the
 * request a loop makes cannot drift from the key it is filed under.
 */
function urlFor(
  endpoint: string,
  type: WidgetType,
  connectionId?: string | null,
): string {
  const params = new URLSearchParams({ type: CANONICAL[providerFor(type)] });
  if (connectionId) params.set("connectionId", connectionId);
  return `${endpoint}?${params.toString()}`;
}

function getEntry(key: Key, url: string): Entry {
  let entry = entries.get(key);
  if (!entry) {
    entry = {
      snapshot: LOADING,
      listeners: new Set(),
      inFlight: null,
      timer: null,
      url,
    };
    entries.set(key, entry);
  }
  return entry;
}

function emit(entry: Entry, next: WidgetSnapshot) {
  entry.snapshot = next;
  for (const listener of entry.listeners) listener();
}

function load(key: Key): Promise<void> {
  const entry = entries.get(key);
  if (!entry) return Promise.resolve();
  if (entry.inFlight) return entry.inFlight;

  const run = (async () => {
    try {
      const res = await fetch(entry.url, { cache: "no-store" });
      const json = (await res.json()) as Record<string, unknown> & {
        error?: string;
      };
      if (!res.ok) {
        // The route already turned this into a sentence aimed at the reader
        // ("Provider rate limit hit", "Authentication failed"). Carry it
        // through: replacing it with one generic line hides the one thing that
        // says what to actually do about it.
        throw new ServerMessage(json.error || "Failed to load");
      }
      emit(entry, { data: json, error: null, loading: false });
    } catch (error) {
      emit(entry, {
        data: entry.snapshot.data,
        error:
          error instanceof ServerMessage
            ? error.message
            : "Couldn’t load this widget. Try reconnecting the source.",
        loading: false,
      });
    } finally {
      entry.inFlight = null;
    }
  })();

  entry.inFlight = run;
  return run;
}

/**
 * Force every open loop to refetch.
 *
 * Used after a settings change that the server already knows about — pointing
 * a widget at another connection, say — so the canvas updates without a
 * reload and without waiting out the poll interval.
 */
export function refreshAllWidgets(): void {
  for (const key of entries.keys()) void load(key);
}

let visibilityBound = false;
function bindVisibility() {
  if (visibilityBound || typeof document === "undefined") return;
  visibilityBound = true;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    refreshAllWidgets();
  });
}

function subscribe(key: Key, url: string, listener: () => void): () => void {
  bindVisibility();
  const entry = getEntry(key, url);
  entry.listeners.add(listener);

  if (entry.timer === null) {
    void load(key);
    entry.timer = setInterval(() => {
      if (!document.hidden) void load(key);
    }, POLL_MS);
  }

  return () => {
    entry.listeners.delete(listener);
    if (entry.listeners.size === 0) {
      if (entry.timer !== null) clearInterval(entry.timer);
      entries.delete(key);
    }
  };
}

export function useWidgetData(
  type: WidgetType,
  connectionId?: string | null,
): WidgetSnapshot {
  const endpoint = useWidgetDataEndpoint();
  const key = keyFor(endpoint, type, connectionId);
  const url = urlFor(endpoint, type, connectionId);

  // useSyncExternalStore re-subscribes whenever the `subscribe` function
  // identity changes, so an inline closure here would unsubscribe and
  // resubscribe (deleting and recreating the entry) on every render.
  const subscribeToKey = useCallback(
    (listener: () => void) => subscribe(key, url, listener),
    [key, url],
  );
  const getSnapshot = useCallback(
    () => entries.get(key)?.snapshot ?? LOADING,
    [key],
  );

  return useSyncExternalStore(subscribeToKey, getSnapshot, () => LOADING);
}
