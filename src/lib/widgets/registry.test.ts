import { describe, expect, it } from "vitest";
import { LIVE_PROVIDERS } from "@/lib/connectors";
import {
  WIDGET_REGISTRY,
  getWidgetDefinition,
  isLemonSqueezyWidget,
  isNetlifyWidget,
  isQontoWidget,
  isRailwayWidget,
  isResendWidget,
  isSentryWidget,
  isStripeWidget,
  isSupabaseWidget,
  isVercelWidget,
  type WidgetType,
} from "./registry";

/**
 * Adding a connector touches the registry, the sync fetchers, the data route
 * and the renderer. These check the wiring lines up, because "forgot one of
 * the ten places" is the likely failure, not a subtle logic bug.
 */
const PROVIDER_MATCHERS: Array<[string, (t: WidgetType) => boolean]> = [
  ["railway", isRailwayWidget],
  ["netlify", isNetlifyWidget],
  ["supabase", isSupabaseWidget],
  ["qonto", isQontoWidget],
  ["stripe", isStripeWidget],
  ["lemonsqueezy", isLemonSqueezyWidget],
  ["sentry", isSentryWidget],
  ["resend", isResendWidget],
  ["vercel", isVercelWidget],
];

describe("widget registry", () => {
  it("has no duplicate widget types", () => {
    const types = WIDGET_REGISTRY.map((w) => w.type);
    expect(types).toHaveLength(new Set(types).size);
  });

  it("resolves every registered type back to its definition", () => {
    for (const widget of WIDGET_REGISTRY) {
      expect(getWidgetDefinition(widget.type)?.type, widget.type).toBe(
        widget.type,
      );
    }
  });

  it("gives every widget a sane default and minimum size", () => {
    for (const widget of WIDGET_REGISTRY) {
      expect(widget.minW, widget.type).toBeGreaterThan(0);
      expect(widget.minH, widget.type).toBeGreaterThan(0);
      expect(widget.defaultW, widget.type).toBeGreaterThanOrEqual(widget.minW);
      expect(widget.defaultH, widget.type).toBeGreaterThanOrEqual(widget.minH);
    }
  });

  it("gives every widget a name and description", () => {
    for (const widget of WIDGET_REGISTRY) {
      expect(widget.name.length, widget.type).toBeGreaterThan(0);
      expect(widget.description.length, widget.type).toBeGreaterThan(0);
    }
  });

  it("points every widget at a live provider", () => {
    for (const widget of WIDGET_REGISTRY) {
      if (widget.provider === "multi") continue;
      expect(LIVE_PROVIDERS, widget.type).toContain(widget.provider);
    }
  });

  it("matches every widget to exactly one provider predicate", () => {
    for (const widget of WIDGET_REGISTRY) {
      const matched = PROVIDER_MATCHERS.filter(([, matches]) =>
        matches(widget.type),
      ).map(([provider]) => provider);

      if (widget.provider === "multi") {
        expect(matched, widget.type).toEqual([]);
        continue;
      }
      expect(matched, widget.type).toEqual([widget.provider]);
    }
  });

  it("offers at least one widget for every live provider", () => {
    for (const provider of LIVE_PROVIDERS) {
      const widgets = WIDGET_REGISTRY.filter((w) => w.provider === provider);
      expect(widgets.length, provider).toBeGreaterThan(0);
    }
  });
});
