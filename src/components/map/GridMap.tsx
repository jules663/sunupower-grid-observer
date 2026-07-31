"use client";

// Grid Observer map — composition root.
//
// This component owns only what genuinely has to live at the top: the datasets,
// the derived reliability model, the year selection, and the marker registry
// that lets the activity feed fly the camera to an asset. Everything else is
// delegated:
//
//   lib/gridGeometry   endpoint snapping
//   lib/gridStyle      voltage colors, line weights, the voltage filter
//   lib/mapStrings     all localized copy
//   ./markers          divIcon construction for both views
//   ./popupContent     popup + tooltip HTML
//   ./GridLayers       the GeoJSON layer stack and its interaction wiring
//   ./mapControllers   Leaflet pane setup, camera focus, ESI layer
//   ./MapStyles        global Leaflet CSS overrides
//   ./YearSlider       reliability time scrubber
//   ./MapStatusOverlay loading + error states

import { useEffect, useState, useMemo, useRef } from "react";
import { MapContainer, TileLayer, GeoJSON, ZoomControl } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import type { GridFilter, ViewMode, Lang, LineFeature, LineCollection, EventConfidence } from "@/types/grid";
import {
  computeReliability, availableYears, measuredIndicesByScope,
  type YearFilter, type MeasuredIndex,
} from "@/lib/reliability";
import { SHOW_ESI_SITES } from "@/lib/config";
import { useGridData } from "@/lib/GridDataContext";
import { snapGridToNodes } from "@/lib/gridGeometry";
import { mapStrings } from "@/lib/mapStrings";

import { setupDefaultIcons } from "./markers";
import type { AssetIndex } from "./popupContent";
import { GridLayers } from "./GridLayers";
import { PopupPaneSetup, LabelPaneSetup, MapFocusController, EsiLayer } from "./mapControllers";
import { MapStyles } from "./MapStyles";
import { YearSlider } from "./YearSlider";
import { MapStatusOverlay } from "./MapStatusOverlay";

export interface GridStats {
  totalKm: number;
  nodeCount: number;
}

interface Props {
  lang: Lang;
  filter: GridFilter;
  view: ViewMode;
  onStats?: (stats: GridStats) => void;
  // Asset to pan to (set when a feed card is clicked). The nonce changes on
  // every click, so re-selecting the same asset re-triggers the flight.
  focusAsset?: string | null;
  focusNonce?: number;
  // Which confidence tiers heat the map in reliability view. Undefined = all.
  confidenceFilter?: Set<EventConfidence>;
  // Emits the measured SAIFI/SAIDI series (per scope) once events load, so the
  // page can render the indices panel without re-deriving them.
  onIndices?: (indices: Map<string, MeasuredIndex[]>) => void;
}

export default function GridMap({
  lang, filter, view, onStats, focusAsset, focusNonce, confidenceFilter, onIndices,
}: Props) {
  // Datasets come from the shared provider, so the map and the activity feed
  // read the same objects from a single fetch.
  const { data, border: senegalBorder, error: loadError } = useGridData();
  const s = mapStrings(lang);

  useEffect(() => { setupDefaultIcons(); }, []);

  // Endpoint snapping: lines meet their substation markers without their routes
  // being distorted. Recomputed only when the underlying data changes.
  const snapped = useMemo(() => snapGridToNodes(data), [data]);

  // Headline stats, derived from the same collections that render, so the
  // context panel can never drift from what is actually on the map.
  useEffect(() => {
    if (!onStats || !data.grid) return;

    const sumKm = (fc: LineCollection | null): number =>
      (fc?.features ?? []).reduce((acc: number, f: LineFeature) => {
        if (f?.geometry?.type !== "LineString") return acc;
        const n = Number(f.properties?.length_km);
        return acc + (isNaN(n) ? 0 : n);
      }, 0);

    const count = (fc: { features: unknown[] } | null): number => (fc?.features ?? []).length;

    onStats({
      totalKm: Math.round(sumKm(data.grid) + sumKm(data.regionalGrid) + sumKm(data.tieLines)),
      nodeCount:
        count(data.plants) + count(data.regionalNodes) + count(data.consumers) +
        (SHOW_ESI_SITES ? count(data.esiSites) : 0),
    });
  }, [data, onStats]);

  // --- Reliability model ----------------------------------------------------

  const [year, setYear] = useState<YearFilter>("all");
  const years = useMemo(
    () => availableYears(data.outageEvents ?? null, data.maintenanceEvents ?? null),
    [data.outageEvents, data.maintenanceEvents],
  );

  const reliability = useMemo(
    () => computeReliability(data.outageEvents ?? null, data.maintenanceEvents ?? null, year, confidenceFilter),
    [data.outageEvents, data.maintenanceEvents, year, confidenceFilter],
  );

  // Measured SAIFI/SAIDI series for the page's indices panel. Year- and
  // confidence-independent: these are reported utility-grade figures, not
  // something the slider should filter.
  useEffect(() => {
    if (!onIndices || !data.outageEvents) return;
    onIndices(measuredIndicesByScope(data.outageEvents));
  }, [data.outageEvents, onIndices]);

  // Latest system index per asset, for the reliability popup. Keyed by
  // asset_ref, keeping the most recent period among events that carry one.
  const indexByAsset = useMemo(() => {
    const m = new Map<string, AssetIndex>();
    (data.outageEvents?.features ?? []).forEach((f) => {
      const p = f.properties;
      if (p.saifi == null && p.saidi_min == null) return;
      const prev = m.get(p.asset_ref);
      if (!prev || Date.parse(p.start) > Date.parse(prev.start)) {
        m.set(p.asset_ref, {
          saifi: p.saifi, saidi_min: p.saidi_min,
          scope: p.scope, period: p.period, start: p.start,
        });
      }
    });
    return m;
  }, [data.outageEvents]);

  // Registry of node markers by asset id, populated as GridLayers builds them.
  // MapFocusController reads it to fly to an asset when a feed card is clicked.
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

  return (
    <div className="w-full h-full relative bg-[#121212]">
      <MapStyles />

      {/* keyboard enables arrow-key pan and +/- zoom for non-mouse users */}
      <MapContainer
        center={[13.8, -13.5] as [number, number]}
        zoom={7}
        scrollWheelZoom
        keyboard
        zoomControl={false}
        zoomSnap={0.25}
        zoomDelta={0.5}
        wheelDebounceTime={40}
        wheelPxPerZoomLevel={100}
        className="w-full h-full"
      >
        <PopupPaneSetup />
        <ZoomControl position="bottomleft" />
        <LabelPaneSetup />

        {/* CARTO Dark Matter (no labels) — clean dark base with readable water */}
        <TileLayer
          className="basemap-tiles"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={20}
        />

        {/* Soft national boundary — thin and recessive */}
        {senegalBorder && (
          <GeoJSON
            key={`sn-border-${view}`}
            data={senegalBorder}
            style={{ color: "#5B6472", weight: 1, opacity: 0.6, fill: false }}
            interactive={false}
          />
        )}

        {/* Place labels on a high pane so they stay legible over the network */}
        <TileLayer
          pane="labels"
          url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={20}
        />

        <GridLayers
          data={snapped}
          filter={filter}
          view={view}
          lang={lang}
          s={s}
          reliability={reliability}
          indexByAsset={indexByAsset}
          year={year}
          markersRef={markersRef}
        />

        {/* ESI sites parked until real assets exist — see src/lib/config.ts */}
        {SHOW_ESI_SITES && <EsiLayer data={snapped.esiSites} lang={lang} />}

        <MapFocusController markersRef={markersRef} focusAsset={focusAsset} nonce={focusNonce} />
      </MapContainer>

      {view === "reliability" && (
        <YearSlider years={years} year={year} setYear={setYear} s={s} />
      )}

      <MapStatusOverlay loading={!data.grid} error={loadError} s={s} />
    </div>
  );
}
