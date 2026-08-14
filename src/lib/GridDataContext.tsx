"use client";

// Single source of truth for the static GeoJSON datasets.
//
// Architecture — two fetch strategies:
//
//   TOPOLOGY (grid lines, plants, nodes, consumers) — fetched once at mount.
//   These describe the physical infrastructure, which changes on a timescale of
//   months/years. There is no benefit to re-fetching them on every poll cycle.
//
//   EVENTS (outages, maintenance) — fetched from the /api/events/* routes and
//   then polled every POLL_INTERVAL_MS. This is the "live" layer: events are
//   updated by an editorial process (or eventually a pipeline), and the app
//   should reflect new entries within one poll interval without a page reload.
//   The API routes serve the data with max-age=300 so CDN/browser caching
//   aligns with the client poll interval.
//
// The context exposes:
//   - data          : the full GridData bundle (topology + latest events)
//   - loaded        : true once topology AND first event poll have resolved
//   - error         : true if the topology load fails (hard failure)
//   - eventsError   : true if the most recent event poll failed (soft failure)
//   - lastUpdated   : Date of the most recent successful event poll (for UI)
//   - assetNames    : asset_ref → display name lookup

import {
  createContext, useContext, useEffect, useState, useMemo,
  useCallback, type ReactNode,
} from "react";
import type { GridData, EventCollection } from "@/types/grid";
import { SHOW_ESI_SITES } from "@/lib/config";

// How often the client re-fetches the event files (milliseconds).
// Matches the API route's Cache-Control max-age so polls are served from cache
// between publishes without hammering the server.
export const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Topology-only subset (never re-fetched).
type TopologyData = Omit<GridData, "outageEvents" | "maintenanceEvents">;

const EMPTY_TOPOLOGY: TopologyData = {
  grid: null, plants: null, regionalGrid: null, regionalNodes: null,
  tieLines: null, consumers: null, esiSites: null,
};

export interface GridDataState {
  data: GridData;
  /** National boundary outline — decorative, loaded non-blocking. */
  border: GeoJSON.Feature | null;
  /** True once topology AND the first event poll have both resolved. */
  loaded: boolean;
  /** True if the topology load failed; the map shows its error state. */
  error: boolean;
  /** True if the most recent event poll failed (events may be stale). */
  eventsError: boolean;
  /** Timestamp of the last successful event poll; null before first poll. */
  lastUpdated: Date | null;
  /** asset id → display name, resolved across plants / regional nodes / consumers. */
  assetNames: Map<string, string>;
}

const GridDataCtx = createContext<GridDataState>({
  data: { ...EMPTY_TOPOLOGY, outageEvents: null, maintenanceEvents: null },
  border: null,
  loaded: false,
  error: false,
  eventsError: false,
  lastUpdated: null,
  assetNames: new Map(),
});

export function useGridData(): GridDataState {
  return useContext(GridDataCtx);
}

// ---------------------------------------------------------------------------
// Topology loader — runs once at mount
// ---------------------------------------------------------------------------

function useTopology() {
  const [topology, setTopology] = useState<TopologyData>(EMPTY_TOPOLOGY);
  const [border, setBorder] = useState<GeoJSON.Feature | null>(null);
  const [topologyLoaded, setTopologyLoaded] = useState(false);
  const [topologyError, setTopologyError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const urls: Partial<Record<keyof TopologyData, string>> = {
      grid: "/data/senegal-grid.json",
      plants: "/data/senegal-plants.json",
      regionalGrid: "/data/regional-interconnections.json",
      regionalNodes: "/data/regional-nodes.json",
      tieLines: "/data/infrastructure-tie-lines.json",
      consumers: "/data/industrial-consumers.json",
    };
    if (SHOW_ESI_SITES) urls.esiSites = "/data/sunupower-esi-sites.json";

    Promise.all(
      Object.entries(urls).map(([key, url]) =>
        fetch(url)
          .then((r) => {
            if (!r.ok) throw new Error(`Failed to load ${url}: ${r.status}`);
            return r.json();
          })
          .then((d) => [key, d] as [keyof TopologyData, unknown]),
      ),
    )
      .then((results) => {
        if (cancelled) return;
        const next = { ...EMPTY_TOPOLOGY } as Record<keyof TopologyData, unknown>;
        results.forEach(([k, v]) => { next[k] = v; });
        setTopology(next as unknown as TopologyData);
        setTopologyLoaded(true);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[GridDataContext] topology load failed:", err);
        setTopologyError(true);
      });

    // National boundary — non-blocking; the map works without it.
    fetch("/data/senegal-border.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => { if (b && !cancelled) setBorder(b); })
      .catch(() => { /* boundary is decorative; ignore failure */ });

    return () => { cancelled = true; };
  }, []); // run once

  return { topology, border, topologyLoaded, topologyError };
}

// ---------------------------------------------------------------------------
// Event poller — fetches from API routes, repeats every POLL_INTERVAL_MS
// ---------------------------------------------------------------------------

interface EventsState {
  outageEvents: EventCollection | null;
  maintenanceEvents: EventCollection | null;
  eventsLoaded: boolean;
  eventsError: boolean;
  lastUpdated: Date | null;
}

function useEventPolling(): EventsState {
  const [outageEvents, setOutageEvents]           = useState<EventCollection | null>(null);
  const [maintenanceEvents, setMaintenanceEvents] = useState<EventCollection | null>(null);
  const [eventsLoaded, setEventsLoaded]           = useState(false);
  const [eventsError, setEventsError]             = useState(false);
  const [lastUpdated, setLastUpdated]             = useState<Date | null>(null);

  // Stable fetch function — recreated only if poll interval changes (it won't).
  const fetchEvents = useCallback(async (signal: AbortSignal) => {
    try {
      const [outRes, maintRes] = await Promise.all([
        fetch("/api/events/outages",    { signal }),
        fetch("/api/events/maintenance", { signal }),
      ]);

      // Treat a non-OK response as a soft error: keep showing the last good
      // data, mark eventsError so the UI can show a stale indicator.
      if (!outRes.ok || !maintRes.ok) {
        throw new Error(
          `Event fetch failed — outages: ${outRes.status}, maintenance: ${maintRes.status}`,
        );
      }

      const [outData, maintData] = await Promise.all([
        outRes.json() as Promise<EventCollection>,
        maintRes.json() as Promise<EventCollection>,
      ]);

      setOutageEvents(outData);
      setMaintenanceEvents(maintData);
      setEventsError(false);
      setLastUpdated(new Date());
      setEventsLoaded(true);
    } catch (err) {
      if ((err as Error).name === "AbortError") return; // component unmounted
      console.warn("[GridDataContext] event poll failed:", err);
      setEventsError(true);
      // Don't clear eventsLoaded — keep showing stale data with an indicator.
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    // Immediate first fetch, then repeat.
    fetchEvents(controller.signal);
    const timer = setInterval(() => fetchEvents(controller.signal), POLL_INTERVAL_MS);

    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [fetchEvents]);

  return { outageEvents, maintenanceEvents, eventsLoaded, eventsError, lastUpdated };
}

// ---------------------------------------------------------------------------
// Provider — composes topology + events into the single context value
// ---------------------------------------------------------------------------

export function GridDataProvider({ children }: { children: ReactNode }) {
  const { topology, border, topologyLoaded, topologyError } = useTopology();
  const { outageEvents, maintenanceEvents, eventsLoaded, eventsError, lastUpdated } =
    useEventPolling();

  const data = useMemo<GridData>(
    () => ({ ...topology, outageEvents, maintenanceEvents }),
    [topology, outageEvents, maintenanceEvents],
  );

  const assetNames = useMemo(() => {
    const names = new Map<string, string>();
    [data.plants, data.regionalNodes, data.consumers].forEach((fc) => {
      (fc?.features ?? []).forEach((f) => {
        const p = f.properties;
        if (p.id && p.name) names.set(p.id, p.name);
      });
    });
    return names;
  }, [data.plants, data.regionalNodes, data.consumers]);

  const value = useMemo<GridDataState>(
    () => ({
      data,
      border,
      loaded: topologyLoaded && eventsLoaded,
      error: topologyError,
      eventsError,
      lastUpdated,
      assetNames,
    }),
    [data, border, topologyLoaded, topologyError, eventsLoaded, eventsError, lastUpdated, assetNames],
  );

  return <GridDataCtx.Provider value={value}>{children}</GridDataCtx.Provider>;
}
