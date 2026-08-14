import { describe, it, expect } from "vitest";
import type { EventConfidence } from "@/types/grid";
import {
  computeReliability,
  heatColor,
  heatRadius,
  availableYears,
  measuredIndicesByScope,
} from "@/lib/reliability";
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
        asset_ref: "hann",
        asset_type: "node",
        event_type: "outage",
        start: "2024-01-10T00:00:00Z",
        severity: "medium",
        source: "test",
        confidence: "measured",
        ...e,
      } as EventProps,
    })),
  };
}

// --- computeReliability ------------------------------------------------------

describe("computeReliability", () => {
  it("returns empty profiles with maxScore 0 when there are no events", () => {
    const result = computeReliability(null, null);
    expect(result.profiles.size).toBe(0);
    expect(result.maxScore).toBe(0);
  });

  it("creates a profile for each unique asset_ref", () => {
    const coll = makeCollection([
      { event_id: "e-1", asset_ref: "hann" },
      { event_id: "e-2", asset_ref: "tobene" },
    ]);
    const result = computeReliability(coll, null);
    expect(result.profiles.size).toBe(2);
    expect(result.profiles.has("hann")).toBe(true);
    expect(result.profiles.has("tobene")).toBe(true);
  });

  it("accumulates event_count correctly", () => {
    const coll = makeCollection([
      { event_id: "e-1", asset_ref: "hann" },
      { event_id: "e-2", asset_ref: "hann" },
    ]);
    const result = computeReliability(coll, null);
    expect(result.profiles.get("hann")!.event_count).toBe(2);
  });

  it("highest-stress asset always gets score 100 (normalization)", () => {
    const coll = makeCollection([
      { event_id: "e-1", asset_ref: "bad",  severity: "critical", duration_min: 1440, event_type: "outage" },
      { event_id: "e-2", asset_ref: "fine", severity: "low",      duration_min: 30,   event_type: "outage" },
    ]);
    const result = computeReliability(coll, null);
    expect(result.profiles.get("bad")!.reliability_score).toBe(100);
    expect(result.maxScore).toBe(100);
  });

  it("asset with no events has no profile (not a zero-score entry)", () => {
    const coll = makeCollection([{ asset_ref: "active" }]);
    const result = computeReliability(coll, null);
    expect(result.profiles.has("inactive")).toBe(false);
  });

  it("year filter: includes events from the specified year only", () => {
    const coll = makeCollection([
      { event_id: "e-2024", asset_ref: "hann", start: "2024-03-01T00:00:00Z" },
      { event_id: "e-2023", asset_ref: "hann", start: "2023-03-01T00:00:00Z" },
    ]);
    const result = computeReliability(coll, null, 2024);
    expect(result.profiles.get("hann")!.event_count).toBe(1);
  });

  it("year filter: constraints always included regardless of year", () => {
    const coll = makeCollection([{
      event_id: "c-1",
      asset_ref: "hann",
      event_type: "constraint",
      start: "2020-01-01T00:00:00Z",
    }]);
    const result = computeReliability(coll, null, 2024);
    expect(result.profiles.has("hann")).toBe(true);
  });

  it("confidence filter: excludes events not in the set", () => {
    const coll = makeCollection([
      { event_id: "e-m",  asset_ref: "hann", confidence: "measured" },
      { event_id: "e-mo", asset_ref: "hann", confidence: "modeled"  },
    ]);
    const result = computeReliability(coll, null, "all", new Set<EventConfidence>(["measured"]));
    expect(result.profiles.get("hann")!.event_count).toBe(1);
  });

  it("profile confidence is the lowest tier among contributing events", () => {
    const coll = makeCollection([
      { event_id: "e-1", asset_ref: "hann", confidence: "measured" },
      { event_id: "e-2", asset_ref: "hann", confidence: "modeled"  },
    ]);
    const result = computeReliability(coll, null);
    expect(result.profiles.get("hann")!.confidence).toBe("modeled");
  });

  it("single measured event keeps measured confidence", () => {
    const coll = makeCollection([{ confidence: "measured" }]);
    const result = computeReliability(coll, null);
    expect(result.profiles.get("hann")!.confidence).toBe("measured");
  });

  it("worst_severity tracks the highest severity among contributing events", () => {
    const coll = makeCollection([
      { event_id: "e-1", asset_ref: "hann", severity: "low",  event_type: "outage" },
      { event_id: "e-2", asset_ref: "hann", severity: "high", event_type: "outage" },
    ]);
    const result = computeReliability(coll, null);
    expect(result.profiles.get("hann")!.worst_severity).toBe("high");
  });

  it("total_outage_hours accumulates only outage duration_min", () => {
    const coll = makeCollection([
      { event_id: "e-1", asset_ref: "hann", event_type: "outage",      duration_min: 120 },
      { event_id: "e-2", asset_ref: "hann", event_type: "maintenance", duration_min: 60  },
    ]);
    const result = computeReliability(coll, null);
    expect(result.profiles.get("hann")!.total_outage_hours).toBe(2); // only the outage
  });

  it("skips events with a missing asset_ref", () => {
    const coll = makeCollection([{ asset_ref: "" }]);
    const result = computeReliability(coll, null);
    expect(result.profiles.size).toBe(0);
  });
});

// --- heatColor ---------------------------------------------------------------

describe("heatColor", () => {
  it("returns calm blue for score 0 (no events baseline)", () => {
    expect(heatColor(0)).toBe("#3B82F6");
  });

  it("returns yellow in the 1–24 range", () => {
    expect(heatColor(1)).toBe("#FACC15");
    expect(heatColor(24)).toBe("#FACC15");
  });

  it("returns amber in the 25–49 range", () => {
    expect(heatColor(25)).toBe("#F59E0B");
    expect(heatColor(49)).toBe("#F59E0B");
  });

  it("returns orange-red in the 50–74 range", () => {
    expect(heatColor(50)).toBe("#F97316");
    expect(heatColor(74)).toBe("#F97316");
  });

  it("returns red at 75 and above", () => {
    expect(heatColor(75)).toBe("#EF4444");
    expect(heatColor(100)).toBe("#EF4444");
  });

  it("clamps values below 0 to the baseline color", () => {
    expect(heatColor(-10)).toBe("#3B82F6");
  });

  it("clamps values above 100 to the critical color", () => {
    expect(heatColor(150)).toBe("#EF4444");
  });
});

// --- heatRadius --------------------------------------------------------------

describe("heatRadius", () => {
  it("returns minimum radius (8) for score 0", () => {
    expect(heatRadius(0)).toBe(8);
  });

  it("returns maximum radius (22) for score 100", () => {
    expect(heatRadius(100)).toBe(22);
  });

  it("returns a value within [8, 22] for any score in [0, 100]", () => {
    for (const s of [0, 10, 25, 50, 75, 99, 100]) {
      const r = heatRadius(s);
      expect(r).toBeGreaterThanOrEqual(8);
      expect(r).toBeLessThanOrEqual(22);
    }
  });

  it("clamps out-of-range inputs", () => {
    expect(heatRadius(-5)).toBe(8);
    expect(heatRadius(200)).toBe(22);
  });
});

// --- availableYears ----------------------------------------------------------

describe("availableYears", () => {
  it("returns an empty array when there are no events", () => {
    expect(availableYears(null, null)).toEqual([]);
  });

  it("returns unique sorted years from outage and maintenance collections", () => {
    const outage = makeCollection([
      { start: "2022-06-01T00:00:00Z", event_type: "outage" },
      { start: "2024-01-01T00:00:00Z", event_type: "outage" },
    ]);
    const maint = makeCollection([
      { start: "2023-03-01T00:00:00Z", event_type: "maintenance" },
      { start: "2022-09-01T00:00:00Z", event_type: "outage" },
    ]);
    expect(availableYears(outage, maint)).toEqual([2022, 2023, 2024]);
  });

  it("excludes constraints (they are year-agnostic)", () => {
    const coll = makeCollection([{
      event_type: "constraint",
      start: "2020-01-01T00:00:00Z",
    }]);
    expect(availableYears(coll, null)).toEqual([]);
  });

  it("skips events with an unparseable start date", () => {
    const coll = makeCollection([{ start: "bad-date", event_type: "outage" }]);
    expect(availableYears(coll, null)).toEqual([]);
  });
});

// --- measuredIndicesByScope --------------------------------------------------

describe("measuredIndicesByScope", () => {
  it("returns an empty map when collection is null", () => {
    expect(measuredIndicesByScope(null).size).toBe(0);
  });

  it("ignores events that are not 'measured' confidence", () => {
    const coll = makeCollection([{
      confidence: "reported",
      saifi: 2.5,
      saidi_min: 120,
      scope: "Dakar system",
      period: "2024 H1",
    }]);
    expect(measuredIndicesByScope(coll).size).toBe(0);
  });

  it("ignores measured events without saifi or saidi", () => {
    const coll = makeCollection([{
      confidence: "measured",
      scope: "Dakar system",
      period: "2024 H1",
      // no saifi / saidi_min
    }]);
    expect(measuredIndicesByScope(coll).size).toBe(0);
  });

  it("groups entries by scope", () => {
    const coll = makeCollection([
      { event_id: "e-1", confidence: "measured", saifi: 1.2, scope: "Dakar system",   period: "2024 H1", start: "2024-01-01T00:00:00Z" },
      { event_id: "e-2", confidence: "measured", saifi: 0.8, scope: "National total",  period: "2024 H1", start: "2024-01-01T00:00:00Z" },
    ]);
    const result = measuredIndicesByScope(coll);
    expect(result.size).toBe(2);
    expect(result.has("Dakar system")).toBe(true);
    expect(result.has("National total")).toBe(true);
  });

  it("sorts each scope's series oldest to newest by period start", () => {
    const coll = makeCollection([
      { event_id: "e-newer", confidence: "measured", saifi: 2, scope: "Dakar system", period: "2024 H2", start: "2024-07-01T00:00:00Z" },
      { event_id: "e-older", confidence: "measured", saifi: 1, scope: "Dakar system", period: "2024 H1", start: "2024-01-01T00:00:00Z" },
    ]);
    const series = measuredIndicesByScope(coll).get("Dakar system")!;
    expect(series[0].period).toBe("2024 H1");
    expect(series[1].period).toBe("2024 H2");
  });
});
