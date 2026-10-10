import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";

import { RELIABILITY_CONTAINED } from "@/lib/config";
import {
  containmentGuard,
  resolvePublicView,
  isReliabilityContained,
  CONTAINMENT_BODY,
  CONTAINMENT_HTTP_STATUS,
} from "@/lib/containment";
import { readEventFile } from "@/lib/eventStore";
import { GET as outagesGET } from "@/app/api/events/outages/route";
import { GET as maintenanceGET } from "@/app/api/events/maintenance/route";

const ROOT = process.cwd();

// G2 Strict Public Containment (founder authorization 2026-10-10).
// These tests demonstrate that the pre-containment behavior (serving the
// unqualified reliability outputs and RSS-classified events) violates
// containment, and that the containment closes every public delivery path.

describe("containment flag is fail-closed", () => {
  it("defaults to contained", () => {
    expect(RELIABILITY_CONTAINED).toBe(true);
    expect(isReliabilityContained()).toBe(true);
  });
});

describe("containmentGuard (public event API decision)", () => {
  it("withholds (503) while contained", () => {
    const g = containmentGuard(true);
    expect(g).not.toBeNull();
    expect(g!.status).toBe(CONTAINMENT_HTTP_STATUS);
    expect(g!.status).toBe(503);
    expect(g!.body.status).toBe("withheld");
    expect(g!.body).toBe(CONTAINMENT_BODY);
    // The neutral body must not imply a verified grid condition.
    expect(JSON.stringify(g!.body).toLowerCase()).not.toContain("outage");
  });

  it("OLD BEHAVIOR (not contained) would serve data — this is the violation being contained", () => {
    const g = containmentGuard(false);
    expect(g).toBeNull(); // null means: caller proceeds to read and serve the raw events
  });

  it("uses the live flag by default (currently withheld)", () => {
    expect(containmentGuard()).not.toBeNull();
  });
});

describe("resolvePublicView (UI / URL view coercion)", () => {
  it("forces infrastructure while contained, even if reliability is requested", () => {
    expect(resolvePublicView("reliability", true)).toBe("infrastructure");
    expect(resolvePublicView("infrastructure", true)).toBe("infrastructure");
    expect(resolvePublicView("reliability")).toBe("infrastructure"); // live flag
  });

  it("OLD BEHAVIOR (not contained) would honor the reliability view", () => {
    expect(resolvePublicView("reliability", false)).toBe("reliability");
  });
});

describe("public event API routes are fail-closed", () => {
  it("GET /api/events/outages returns 503 withheld, never a FeatureCollection", async () => {
    const res = await outagesGET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe("withheld");
    expect(body.type).not.toBe("FeatureCollection");
    expect(body.features).toBeUndefined();
  });

  it("GET /api/events/maintenance returns 503 withheld, never a FeatureCollection", async () => {
    const res = await maintenanceGET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe("withheld");
    expect(body.features).toBeUndefined();
  });
});

describe("alternative public delivery paths are closed", () => {
  it("event files are NOT present under public/ (no static /data/*-events.json route)", () => {
    const publicData = path.join(ROOT, "public", "data");
    const offenders = readdirSync(publicData).filter((f) => /events.*\.json$/i.test(f));
    expect(offenders).toEqual([]);
  });

  it("historical event datasets are preserved under /event-data (not deleted)", () => {
    expect(existsSync(path.join(ROOT, "event-data", "outage-events.json"))).toBe(true);
    expect(existsSync(path.join(ROOT, "event-data", "maintenance-events.json"))).toBe(true);
  });
});

describe("what containment withholds (evidence preserved, not served)", () => {
  it("the preserved outage dataset still contains the unqualified RSS-classified events", async () => {
    // Demonstrates the content that WOULD be served if containment were lifted:
    // reported, RSS-sourced (http) events classified as outages. Containment
    // keeps this data intact but prevents its public delivery.
    const data = (await readEventFile("outage-events.json")) as {
      type: string;
      features: { properties: { confidence: string; source?: string } }[];
    };
    expect(data.type).toBe("FeatureCollection");
    expect(data.features.length).toBeGreaterThan(0);
    const rssReported = data.features.filter(
      (f) => f.properties.confidence === "reported" && String(f.properties.source ?? "").startsWith("http"),
    );
    expect(rssReported.length).toBeGreaterThan(0);
  });
});
