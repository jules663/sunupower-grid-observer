import { describe, it, expect } from "vitest";
import {
  buildFeedEvents,
  buildFeedSections,
  summarizeActivity,
  defaultFilters,
} from "@/lib/feed";
import type { EventCollection, EventProps } from "@/types/grid";

// --- helpers -----------------------------------------------------------------

function makeCollection(events: Partial<EventProps>[]): EventCollection {
  return {
    type: "FeatureCollection",
    features: events.map((e) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [0, 0] },
      properties: {
        event_id: "evt-1",
        asset_ref: "asset-a",
        asset_type: "node",
        event_type: "outage",
        start: "2024-01-10T08:00:00Z",
        severity: "low",
        source: "test",
        confidence: "measured",
        ...e,
      } as EventProps,
    })),
  };
}

const NOW = new Date("2024-06-01T12:00:00Z");

// --- buildFeedEvents ---------------------------------------------------------

describe("buildFeedEvents", () => {
  it("classifies an event that started before now with no end as current", () => {
    const coll = makeCollection([{ start: "2024-01-01T00:00:00Z" }]);
    const evts = buildFeedEvents(coll, null, new Map(), NOW);
    expect(evts).toHaveLength(1);
    expect(evts[0].bucket).toBe("current");
  });

  it("classifies an event that ended before now as past", () => {
    const coll = makeCollection([{
      start: "2024-01-01T00:00:00Z",
      end: "2024-01-02T00:00:00Z",
    }]);
    const evts = buildFeedEvents(coll, null, new Map(), NOW);
    expect(evts[0].bucket).toBe("past");
  });

  it("classifies a future event as ahead", () => {
    const coll = makeCollection([{ start: "2025-01-01T00:00:00Z" }]);
    const evts = buildFeedEvents(coll, null, new Map(), NOW);
    expect(evts[0].bucket).toBe("ahead");
  });

  it("classifies an event spanning now as current", () => {
    const coll = makeCollection([{
      start: "2024-01-01T00:00:00Z",
      end: "2024-12-31T00:00:00Z",
    }]);
    const evts = buildFeedEvents(coll, null, new Map(), NOW);
    expect(evts[0].bucket).toBe("current");
  });

  it("skips events with an unparseable start date", () => {
    const coll = makeCollection([{ start: "not-a-date" }]);
    const evts = buildFeedEvents(coll, null, new Map(), NOW);
    expect(evts).toHaveLength(0);
  });

  it("skips events with a null start date", () => {
    const coll = makeCollection([{ start: null as unknown as string }]);
    const evts = buildFeedEvents(coll, null, new Map(), NOW);
    expect(evts).toHaveLength(0);
  });

  it("treats an unparseable end date as null (no end = ongoing current)", () => {
    const coll = makeCollection([{
      start: "2024-01-01T00:00:00Z",
      end: "not-a-date",
    }]);
    const evts = buildFeedEvents(coll, null, new Map(), NOW);
    expect(evts).toHaveLength(1);
    expect(evts[0].endMs).toBeNull();
    expect(evts[0].bucket).toBe("current");
  });

  it("merges events from both outage and maintenance collections", () => {
    const outage = makeCollection([{ event_id: "o-1", event_type: "outage" }]);
    const maint = makeCollection([{ event_id: "m-1", event_type: "maintenance" }]);
    const evts = buildFeedEvents(outage, maint, new Map(), NOW);
    expect(evts).toHaveLength(2);
  });

  it("resolves asset name from the lookup map", () => {
    const names = new Map([["asset-a", "Hann Substation"]]);
    const coll = makeCollection([{ asset_ref: "asset-a" }]);
    const evts = buildFeedEvents(coll, null, names, NOW);
    expect(evts[0].assetName).toBe("Hann Substation");
  });

  it("falls back to the raw asset_ref when name is not in the map", () => {
    const coll = makeCollection([{ asset_ref: "unknown-slug" }]);
    const evts = buildFeedEvents(coll, null, new Map(), NOW);
    expect(evts[0].assetName).toBe("unknown-slug");
  });

  it("handles null collections gracefully", () => {
    expect(buildFeedEvents(null, null, new Map(), NOW)).toHaveLength(0);
  });
});

// --- buildFeedSections -------------------------------------------------------

describe("buildFeedSections", () => {
  it("splits events into the correct buckets", () => {
    const outage = makeCollection([
      { event_id: "past-1", start: "2023-01-01T00:00:00Z", end: "2023-01-02T00:00:00Z" },
      { event_id: "cur-1",  start: "2024-01-01T00:00:00Z" },
      { event_id: "fwd-1",  start: "2025-01-01T00:00:00Z" },
    ]);
    const evts = buildFeedEvents(outage, null, new Map(), NOW);
    const sections = buildFeedSections(evts, defaultFilters());
    expect(sections.ahead).toHaveLength(1);
    expect(sections.current).toHaveLength(1);
    expect(sections.past).toHaveLength(1);
    expect(sections.totalMatched).toBe(3);
  });

  it("filters by event type", () => {
    const coll = makeCollection([
      { event_id: "o-1", event_type: "outage" },
      { event_id: "m-1", event_type: "maintenance" },
    ]);
    const evts = buildFeedEvents(coll, null, new Map(), NOW);
    const filters = { ...defaultFilters(), types: new Set<"outage" | "maintenance" | "constraint">(["maintenance"]) };
    const sections = buildFeedSections(evts, filters);
    expect(sections.totalMatched).toBe(1);
  });

  it("filters by free-text query matching asset name", () => {
    const names = new Map([["asset-a", "Tobene Power Plant"]]);
    const coll = makeCollection([
      { event_id: "e-1", asset_ref: "asset-a" },
      { event_id: "e-2", asset_ref: "unknown" },
    ]);
    const evts = buildFeedEvents(coll, null, names, NOW);
    const filters = { ...defaultFilters(), query: "tobene" };
    const sections = buildFeedSections(evts, filters);
    expect(sections.totalMatched).toBe(1);
  });

  it("filters by year, excluding events outside the window", () => {
    const coll = makeCollection([
      { event_id: "e-2024", start: "2024-03-01T00:00:00Z", end: "2024-03-02T00:00:00Z" },
      { event_id: "e-2023", start: "2023-03-01T00:00:00Z", end: "2023-03-02T00:00:00Z" },
    ]);
    const evts = buildFeedEvents(coll, null, new Map(), NOW);
    const filters = { ...defaultFilters(), year: 2024 as const };
    const sections = buildFeedSections(evts, filters);
    expect(sections.totalMatched).toBe(1);
    expect(sections.past[0].props.event_id).toBe("e-2024");
  });

  it("year filter always passes constraints through", () => {
    const coll = makeCollection([{
      event_id: "c-1",
      event_type: "constraint",
      start: "2020-01-01T00:00:00Z",
    }]);
    const evts = buildFeedEvents(coll, null, new Map(), NOW);
    const filters = { ...defaultFilters(), year: 2024 as const };
    const sections = buildFeedSections(evts, filters);
    expect(sections.totalMatched).toBe(1);
  });

  it("sorts ahead section soonest-first", () => {
    const coll = makeCollection([
      { event_id: "far",  start: "2026-01-01T00:00:00Z" },
      { event_id: "near", start: "2024-07-01T00:00:00Z" },
    ]);
    const evts = buildFeedEvents(coll, null, new Map(), NOW);
    const sections = buildFeedSections(evts, defaultFilters());
    expect(sections.ahead[0].props.event_id).toBe("near");
    expect(sections.ahead[1].props.event_id).toBe("far");
  });

  it("sorts past section most-recent-first", () => {
    const coll = makeCollection([
      { event_id: "older", start: "2023-01-01T00:00:00Z", end: "2023-01-02T00:00:00Z" },
      { event_id: "newer", start: "2023-06-01T00:00:00Z", end: "2023-06-02T00:00:00Z" },
    ]);
    const evts = buildFeedEvents(coll, null, new Map(), NOW);
    const sections = buildFeedSections(evts, defaultFilters());
    expect(sections.past[0].props.event_id).toBe("newer");
    expect(sections.past[1].props.event_id).toBe("older");
  });

  it("ranks maintenance before outage/constraint at the same timestamp", () => {
    const coll = makeCollection([
      { event_id: "out-1",  start: "2024-07-01T00:00:00Z", event_type: "outage" },
      { event_id: "maint-1", start: "2024-07-01T00:00:00Z", event_type: "maintenance" },
    ]);
    const evts = buildFeedEvents(coll, null, new Map(), NOW);
    const sections = buildFeedSections(evts, defaultFilters());
    expect(sections.ahead[0].props.event_id).toBe("maint-1");
    expect(sections.ahead[1].props.event_id).toBe("out-1");
  });
});

// --- summarizeActivity -------------------------------------------------------

describe("summarizeActivity", () => {
  it("returns zero count when there are no current events", () => {
    const coll = makeCollection([{
      start: "2023-01-01T00:00:00Z",
      end: "2023-01-02T00:00:00Z",
    }]);
    const result = summarizeActivity(coll, null, NOW);
    expect(result.count).toBe(0);
    expect(result.worstSeverity).toBeNull();
    expect(result.constraintCount).toBe(0);
  });

  it("counts current events and identifies worst severity", () => {
    const coll = makeCollection([
      { event_id: "e-1", start: "2024-01-01T00:00:00Z", severity: "low",  event_type: "outage" },
      { event_id: "e-2", start: "2024-01-01T00:00:00Z", severity: "high", event_type: "outage" },
    ]);
    const result = summarizeActivity(coll, null, NOW);
    expect(result.count).toBe(2);
    expect(result.worstSeverity).toBe("high");
  });

  it("escalates severity: critical > high > medium > low", () => {
    const coll = makeCollection([
      { event_id: "e-1", start: "2024-01-01T00:00:00Z", severity: "medium",   event_type: "outage" },
      { event_id: "e-2", start: "2024-01-01T00:00:00Z", severity: "critical", event_type: "outage" },
    ]);
    const result = summarizeActivity(coll, null, NOW);
    expect(result.worstSeverity).toBe("critical");
  });

  it("counts constraints separately and does not set worstSeverity from them", () => {
    const coll = makeCollection([{
      event_id: "c-1",
      start: "2020-01-01T00:00:00Z",
      event_type: "constraint",
      severity: "critical",
    }]);
    const result = summarizeActivity(coll, null, NOW);
    expect(result.count).toBe(1);
    expect(result.constraintCount).toBe(1);
    expect(result.worstSeverity).toBeNull(); // constraints don't set urgency
  });

  it("handles null collections", () => {
    const result = summarizeActivity(null, null, NOW);
    expect(result.count).toBe(0);
    expect(result.worstSeverity).toBeNull();
  });
});

// --- defaultFilters ----------------------------------------------------------

describe("defaultFilters", () => {
  it("includes all event types", () => {
    const f = defaultFilters();
    expect(f.types.has("maintenance")).toBe(true);
    expect(f.types.has("outage")).toBe(true);
    expect(f.types.has("constraint")).toBe(true);
  });

  it("includes all severity tiers", () => {
    const f = defaultFilters();
    expect(f.severities.has("low")).toBe(true);
    expect(f.severities.has("critical")).toBe(true);
  });

  it("includes all confidence tiers", () => {
    const f = defaultFilters();
    expect(f.confidences.has("measured")).toBe(true);
    expect(f.confidences.has("modeled")).toBe(true);
  });

  it("defaults to all years", () => {
    expect(defaultFilters().year).toBe("all");
  });
});
