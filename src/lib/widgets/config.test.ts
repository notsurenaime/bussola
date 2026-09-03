import { describe, expect, it } from "vitest";
import {
  applyFilter,
  applyWidgetConfig,
  envelopeFor,
  isMultiSource,
  optionsFor,
  parseWidgetConfig,
  scopeValuesFor,
} from "./config";

describe("optionsFor", () => {
  it("offers scope and limit for a list widget with named items", () => {
    expect(optionsFor("railway-deploys")).toEqual(["scope", "limit"]);
  });

  it("offers only limit where items have nothing to scope by", () => {
    expect(optionsFor("stripe-payments")).toEqual(["limit"]);
  });

  it("offers range for a time series", () => {
    expect(optionsFor("qonto-history")).toEqual(["range"]);
  });

  it("offers nothing for a single-number card", () => {
    expect(optionsFor("stripe-mrr")).toEqual([]);
    expect(optionsFor("railway-fleet")).toEqual([]);
  });
});

describe("scopeValuesFor", () => {
  it("reads the values present in the payload, sorted and deduplicated", () => {
    const data = {
      recentDeploys: [
        { projectName: "web", serviceName: "api" },
        { projectName: "api", serviceName: "api" },
        { projectName: "web", serviceName: "worker" },
      ],
    };
    expect(scopeValuesFor("railway-deploys", data)).toEqual(["api", "web"]);
  });

  it("falls back to the next field when the first is missing", () => {
    const data = { recentDeploys: [{ serviceName: "worker" }] };
    expect(scopeValuesFor("railway-deploys", data)).toEqual(["worker"]);
  });

  it("is empty for a widget with no scopeable collection", () => {
    expect(scopeValuesFor("stripe-payments", { payments: [{ id: "a" }] })).toEqual(
      [],
    );
  });

  it("survives a payload that has not loaded", () => {
    expect(scopeValuesFor("railway-deploys", null)).toEqual([]);
  });
});

describe("applyWidgetConfig", () => {
  const deploys = {
    recentDeploys: [
      { id: "1", projectName: "web" },
      { id: "2", projectName: "api" },
      { id: "3", projectName: "web" },
    ],
    fleet: { healthy: 3, total: 3 },
  };

  it("returns the payload untouched when nothing is configured", () => {
    expect(applyWidgetConfig("railway-deploys", {}, deploys)).toBe(deploys);
  });

  it("filters a collection by scope", () => {
    const result = applyWidgetConfig(
      "railway-deploys",
      { scope: "web" },
      deploys,
    );
    expect(result.recentDeploys).toEqual([
      { id: "1", projectName: "web" },
      { id: "3", projectName: "web" },
    ]);
  });

  it("leaves the rest of the payload alone", () => {
    const result = applyWidgetConfig(
      "railway-deploys",
      { scope: "web" },
      deploys,
    );
    expect(result.fleet).toEqual({ healthy: 3, total: 3 });
  });

  it("never mutates the shared snapshot", () => {
    const before = JSON.stringify(deploys);
    applyWidgetConfig("railway-deploys", { scope: "web", limit: 1 }, deploys);
    expect(JSON.stringify(deploys)).toBe(before);
  });

  it("honours an empty result rather than falling back to everything", () => {
    const result = applyWidgetConfig(
      "railway-deploys",
      { scope: "nothing-named-this" },
      deploys,
    );
    expect(result.recentDeploys).toEqual([]);
  });

  it("trims a list to the limit", () => {
    const result = applyWidgetConfig("railway-deploys", { limit: 2 }, deploys);
    expect(result.recentDeploys).toHaveLength(2);
  });

  it("applies scope before limit", () => {
    const result = applyWidgetConfig(
      "railway-deploys",
      { scope: "web", limit: 1 },
      deploys,
    );
    expect(result.recentDeploys).toEqual([{ id: "1", projectName: "web" }]);
  });

  it("trims a time series to the range", () => {
    const day = 86_400_000;
    const now = Date.now();
    const data = {
      balanceHistory: {
        currency: "EUR",
        points: [
          { date: new Date(now - 40 * day).toISOString(), balance: 1 },
          { date: new Date(now - 3 * day).toISOString(), balance: 2 },
          { date: new Date(now).toISOString(), balance: 3 },
        ],
      },
    };

    const result = applyWidgetConfig("qonto-history", { rangeDays: 7 }, data);
    const points = (result.balanceHistory as { points: unknown[] }).points;
    expect(points).toHaveLength(2);
  });

  it("trims points nested one array deep", () => {
    const day = 86_400_000;
    const now = Date.now();
    const data = {
      metrics: {
        series: [
          {
            key: "cpu",
            points: [
              { ts: new Date(now - 40 * day).toISOString(), value: 1 },
              { ts: new Date(now).toISOString(), value: 2 },
            ],
          },
        ],
      },
    };

    const result = applyWidgetConfig("railway-cpu", { rangeDays: 7 }, data);
    const series = (result.metrics as { series: Array<{ points: unknown[] }> })
      .series;
    expect(series[0].points).toHaveLength(1);
  });

  it("keeps a series whose points have no usable timestamp", () => {
    const data = {
      balanceHistory: { points: [{ label: "Mon", balance: 1 }] },
    };
    const result = applyWidgetConfig("qonto-history", { rangeDays: 7 }, data);
    expect((result.balanceHistory as { points: unknown[] }).points).toHaveLength(
      1,
    );
  });

  it("leaves a widget with no shape spec untouched", () => {
    const data = { revenue: { mrr: 100 } };
    expect(applyWidgetConfig("stripe-mrr", { limit: 1 }, data)).toBe(data);
  });
});

describe("parseWidgetConfig", () => {
  it("keeps recognised fields", () => {
    expect(
      parseWidgetConfig({ scope: "web", limit: 10, rangeDays: 30 }),
    ).toEqual({ scope: "web", limit: 10, rangeDays: 30 });
  });

  it("drops unknown and malformed fields", () => {
    expect(
      parseWidgetConfig({ scope: 4, limit: "ten", nonsense: true }),
    ).toEqual({});
  });

  it("clamps out-of-range numbers rather than rejecting the whole config", () => {
    expect(parseWidgetConfig({ limit: 10_000, rangeDays: 0 })).toEqual({
      limit: 200,
      rangeDays: 1,
    });
  });

  it("survives a non-object", () => {
    expect(parseWidgetConfig(null)).toEqual({});
    expect(parseWidgetConfig("nope")).toEqual({});
  });
});

describe("envelopeFor", () => {
  /*
   * The envelope is the boundary a share link is held to: the union of what a
   * dashboard's widgets put on screen. Getting the union backwards — an
   * intersection, or ignoring an unfiltered widget — would either hide data
   * the page renders or expose data it does not.
   */
  it("is empty for no widgets", () => {
    expect(envelopeFor([])).toEqual({});
  });

  it("unions the scopes several widgets show", () => {
    const envelope = envelopeFor([{ scope: "alpha" }, { scope: "beta" }]);
    expect(envelope.scopes?.sort()).toEqual(["alpha", "beta"]);
  });

  it("deduplicates a scope two widgets share", () => {
    expect(envelopeFor([{ scope: "a" }, { scope: "a" }]).scopes).toEqual(["a"]);
  });

  it("widens to everything when any widget is unscoped", () => {
    // That widget genuinely renders everything, so nothing is being hidden.
    expect(envelopeFor([{ scope: "alpha" }, {}]).scopes).toBeUndefined();
  });

  it("takes the largest limit, and none when a widget has none", () => {
    expect(envelopeFor([{ limit: 5 }, { limit: 25 }]).limit).toBe(25);
    expect(envelopeFor([{ limit: 5 }, {}]).limit).toBeUndefined();
  });

  it("takes the longest range, and none when a widget has none", () => {
    expect(envelopeFor([{ rangeDays: 7 }, { rangeDays: 90 }]).rangeDays).toBe(90);
    expect(envelopeFor([{ rangeDays: 7 }, {}]).rangeDays).toBeUndefined();
  });

  it("unions declared connection sets", () => {
    const envelope = envelopeFor([
      { connectionIds: ["a"] },
      { connectionIds: ["b", "a"] },
    ]);
    expect(envelope.connectionIds?.sort()).toEqual(["a", "b"]);
  });

  it("widens to every connection when a widget declares none", () => {
    expect(
      envelopeFor([{ connectionIds: ["a"] }, {}]).connectionIds,
    ).toBeUndefined();
  });

  it("honours an explicitly empty connection set", () => {
    // "This board shows nothing" is a real choice, and must not read the same
    // as "this board was never configured".
    expect(envelopeFor([{ connectionIds: [] }]).connectionIds).toEqual([]);
  });
});

describe("applyFilter with several scopes", () => {
  const data = {
    recentDeploys: [
      { id: "1", projectName: "alpha" },
      { id: "2", projectName: "beta" },
      { id: "3", projectName: "gamma" },
    ],
  };

  it("keeps every item matching any scope in the set", () => {
    const result = applyFilter(
      "railway-deploys",
      { scopes: ["alpha", "gamma"] },
      data,
    );
    expect(result.recentDeploys).toHaveLength(2);
  });

  it("drops everything when no item matches", () => {
    const result = applyFilter("railway-deploys", { scopes: ["nope"] }, data);
    expect(result.recentDeploys).toEqual([]);
  });
});

describe("cross-source connection filtering", () => {
  const board = {
    items: [
      { id: "a", name: "api", _connectionId: "con_1" },
      { id: "b", name: "cash", _connectionId: "con_2" },
    ],
  };

  it("recognises which widgets read across connections", () => {
    expect(isMultiSource("status-board")).toBe(true);
    expect(isMultiSource("stripe-mrr")).toBe(false);
  });

  it("keeps only the chosen connections' items", () => {
    const result = applyFilter("status-board", { connectionIds: ["con_1"] }, board);
    expect(result.items).toEqual([
      { id: "a", name: "api", _connectionId: "con_1" },
    ]);
  });

  it("shows nothing for an empty set rather than everything", () => {
    const result = applyFilter("status-board", { connectionIds: [] }, board);
    expect(result.items).toEqual([]);
  });

  it("leaves the board alone when no set is declared", () => {
    expect(applyFilter("status-board", {}, board)).toBe(board);
  });

  it("ignores a connection set on a single-source widget", () => {
    const data = { recentDeploys: [{ id: "1", projectName: "alpha" }] };
    expect(
      applyFilter("railway-deploys", { connectionIds: ["con_1"] }, data),
    ).toBe(data);
  });
});

describe("parseWidgetConfig with connection sets", () => {
  it("keeps a declared set", () => {
    expect(parseWidgetConfig({ connectionIds: ["a", "b"] })).toEqual({
      connectionIds: ["a", "b"],
    });
  });

  it("keeps an empty set, since that is a real choice", () => {
    expect(parseWidgetConfig({ connectionIds: [] })).toEqual({
      connectionIds: [],
    });
  });

  it("drops non-string entries and duplicates", () => {
    expect(parseWidgetConfig({ connectionIds: ["a", 4, "a", null] })).toEqual({
      connectionIds: ["a"],
    });
  });

  it("ignores a set that is not an array", () => {
    expect(parseWidgetConfig({ connectionIds: "a" })).toEqual({});
  });
});
