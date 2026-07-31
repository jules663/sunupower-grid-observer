"use client";

// Single source of truth for the static GeoJSON datasets.
//
// Previously GridMap and GridActivityFeed each ran their own fetch waterfall for
// the same files (events, plants, regional nodes, consumers), so every page load
// issued two parallel sets of requests for identical payloads and the two
// components could briefly disagree about what data they held. This provider
// fetches once at the page root and hands the same object to both.

import { createContext, useContext, useEffect, useState, useMemo, type ReactNode } from "react";
import type { GridData } from "@/types/grid";
import { SHOW_ESI_SITES } from "@/lib/config";

const EMPTY: GridData = {
  grid: null, plants: null, regionalGrid: null, regionalNodes: null,
  tieLines: null, consumers: null, esiSites: null,
  outageEvents: null, maintenanceEvents: null,
};

export interface GridDataState {
  data: GridData;
  /** National boundary outline — decorative, loaded non-blocking. */
  border: GeoJSON.Feature | null;
  /** True once every required dataset has resolved. */
  loaded: boolean;
  /** True if any required dataset failed; the map shows its error state. */
  error: boolean;
  /** asset id → display name, resolved across plants / regional nodes / consumers. */
  assetNames: Map<string, string>;
}

const GridDataCtx = createContext<GridDataState>({
  data: EMPTY, border: null, loaded: false, error: false, assetNames: new Map(),
});

export function useGridData(): GridDataState {
  return useContext(GridDataCtx);
}

export function GridDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<GridData>(EMPTY);
  const [border, setBorder] = useState<GeoJSON.Feature | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const urls: Partial<Record<keyof GridData, string>> = {
      grid: "/data/senegal-grid.json",
      plants: "/data/senegal-plants.json",
      regionalGrid: "/data/regional-interconnections.json",
      regionalNodes: "/data/regional-nodes.json",
      tieLines: "/data/infrastructure-tie-lines.json",
      consumers: "/data/industrial-consumers.json",
      outageEvents: "/data/outage-events.json",
      maintenanceEvents: "/data/maintenance-events.json",
    };
    // ESI sites are simulated placeholders — only fetched when the layer is
    // enabled (see src/lib/config.ts), so simulated data isn't even served.
    if (SHOW_ESI_SITES) urls.esiSites = "/data/sunupower-esi-sites.json";

    Promise.all(
      Object.entries(urls).map(([key, url]) =>
        fetch(url)
          .then((r) => {
            if (!r.ok) throw new Error(`Failed to load ${url}: ${r.status}`);
            return r.json();
          })
          .then((d) => [key, d] as [keyof GridData, unknown]),
      ),
    )
      .then((results) => {
        if (cancelled) return;
        const next = { ...EMPTY } as Record<keyof GridData, unknown>;
        results.forEach(([k, v]) => { next[k] = v; });
        setData(next as unknown as GridData);
        setError(false);
        setLoaded(true);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Grid data load failed:", err);
        setError(true);
      });

    // National boundary — non-blocking; the map works without it.
    fetch("/data/senegal-border.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => { if (b && !cancelled) setBorder(b); })
      .catch(() => { /* boundary is decorative; ignore failure */ });

    return () => { cancelled = true; };
  }, []);

  // asset_ref → display name, so feed cards never show a bare slug. Derived from
  // the same collections the map renders, rather than re-fetching them.
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
    () => ({ data, border, loaded, error, assetNames }),
    [data, border, loaded, error, assetNames],
  );

  return <GridDataCtx.Provider value={value}>{children}</GridDataCtx.Provider>;
}
