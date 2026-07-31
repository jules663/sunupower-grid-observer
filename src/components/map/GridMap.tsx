"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { MapContainer, TileLayer, GeoJSON, ZoomControl, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { GridFilter, ViewMode } from "@/app/page";
import type {
  LineFeature, LineProps, NodeFeature, NodeProps,
  EsiProps, Coordinate, LineCollection, EventCollection, ReliabilityProfile, EventConfidence,
} from "@/types/grid";
import { computeReliability, heatColor, heatRadius, availableYears, measuredIndicesByScope, type YearFilter, type MeasuredIndex } from "@/lib/reliability";
import { SHOW_ESI_SITES } from "@/lib/config";
import { useGridData } from "@/lib/GridDataContext";

// Popups live in a pane that is a direct child of .leaflet-container, NOT inside
// .leaflet-map-pane. Reason: .leaflet-map-pane has a CSS transform which creates
// its own stacking context at z-index 400, trapping popup z-index below the glass
// overlay panels (z-index 2000). By parenting this pane to the container at
// z-index 3000, popups escape that stacking context and render above panels.
//
// Positioning correctness: Leaflet pans by applying transform:translate(dx,dy) to
// .leaflet-map-pane. Our pane does not receive that transform automatically.
// We mirror the map-pane transform here on every 'move' and 'viewreset' so that
// latLngToLayerPoint coordinates placed inside our pane land at the same screen
// position as they would inside the map-pane.
function PopupPaneSetup() {
  const map = useMap();
  useEffect(() => {
    if (!map.getPane('popupAboveAll')) {
      const pane = map.createPane('popupAboveAll', map.getContainer());
      pane.style.zIndex = '3000';
    }

    const pane = map.getPane('popupAboveAll')!;
    const mapPane = map.getPanes().mapPane;

    const syncTransform = () => {
      L.DomUtil.setPosition(pane, L.DomUtil.getPosition(mapPane));
    };

    map.on('move viewreset', syncTransform);
    syncTransform();

    return () => {
      map.off('move viewreset', syncTransform);
    };
  }, [map]);
  return null;
}

// Creates a dedicated pane for place-name label tiles, sitting above the grid
// overlays (default overlayPane = 400) so labels stay legible over the network.
function LabelPaneSetup() {
  const map = useMap();
  useEffect(() => {
    if (!map.getPane('labels')) {
      const pane = map.createPane('labels');
      // Above the grid-line overlay pane (400) but BELOW the marker pane (600),
      // so region labels stay legible over the lines yet never cover the nodes.
      pane.style.zIndex = '550';
      pane.style.pointerEvents = 'none';
    }
  }, [map]);
  return null;
}

// Pans the map to a node marker and opens its popup when a feed card is clicked.
// Keyed off `nonce` so re-selecting the same asset re-triggers the focus. Markers
// are looked up in the shared registry populated by pointToLayer; if the asset
// has no marker yet (layers mid-remount), the effect is a no-op and the next
// click will find it.
function MapFocusController({
  markersRef, focusAsset, nonce,
}: {
  markersRef: React.MutableRefObject<Map<string, L.Marker>>;
  focusAsset?: string | null;
  nonce?: number;
}) {
  const map = useMap();
  useEffect(() => {
    if (!focusAsset) return;
    const marker = markersRef.current.get(focusAsset);
    if (!marker) return;
    const latlng = marker.getLatLng();
    map.flyTo(latlng, Math.max(map.getZoom(), 9), { duration: 0.6 });
    // Open the popup after the fly animation settles so it anchors correctly.
    const t = setTimeout(() => marker.openPopup(), 650);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, focusAsset]);
  return null;
}

// Renders ESI site markers only when map zoom >= 8 (region-level detail).
// Below that threshold returns null — sites are too dense to read at country zoom.
function EsiLayerManager({ data }: { data: import("@/types/grid").EsiCollection | null }) {
  const [zoom, setZoom] = useState<number>(7);

  useMapEvents({
    zoomend: (e) => setZoom((e.target as L.Map).getZoom()),
  });

  if (!data || zoom < 8) return null;

  const esiPointToLayer = (_feat: GeoJSON.Feature, latlng: L.LatLng) => {
    const html = `<div style="width:16px;height:16px;filter:drop-shadow(0 0 6px #F59E0BCC) drop-shadow(0 0 1.5px rgba(255,255,255,0.55));"><div style="background-color:#F59E0B;width:100%;height:100%;clip-path:polygon(50% 0%,100% 50%,50% 100%,0% 50%);"></div></div>`;
    return L.marker(latlng, {
      icon: L.divIcon({ className: 'custom-div-icon', html, iconSize: [16, 16], iconAnchor: [8, 8], popupAnchor: [0, -8] }),
    });
  };

  const escHtml = (val: unknown): string =>
    String(val ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const esiOnEachFeature = (feature: GeoJSON.Feature, layer: L.Layer) => {
    const p = (feature.properties ?? {}) as EsiProps;
    const capacityMwh = (Number(p.capacity_kwh) / 1000).toFixed(1);
    layer.bindPopup(`
      <div class="font-sans p-2">
        <div class="text-[10px] uppercase tracking-widest font-bold text-sunu-graphite mb-2 border-b border-white/5 pb-1">ESI ASSET</div>
        <div class="text-sm font-bold text-[#EDEFF7]">${escHtml(p.name)}</div>
        <div class="text-[11px] mt-1 font-bold" style="color:#F59E0B;">${escHtml(p.state)}</div>
        <div class="mt-3 space-y-2 border-t border-white/5 pt-2">
          <div class="flex justify-between text-[10px]">
            <span class="text-sunu-graphite uppercase font-bold">Capacity</span>
            <span class="text-sunu-cloud font-mono">${capacityMwh} MWh</span>
          </div>
          <div class="text-[10px]">
            <span class="text-sunu-graphite uppercase font-bold">Design Intent</span>
            <div class="text-sunu-cloud mt-1 leading-relaxed">${escHtml(p.intent)}</div>
          </div>
        </div>
      </div>
    `, { className: 'custom-popup', pane: 'popupAboveAll' });
  };

  return (
    <GeoJSON
      key="esi-sites"
      data={data as unknown as GeoJSON.GeoJsonObject}
      pointToLayer={esiPointToLayer}
      onEachFeature={esiOnEachFeature}
    />
  );
}

const setupIcons = () => {
  if (typeof window === "undefined") return;
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  });
};

export interface GridStats {
  totalKm: number;
  nodeCount: number;
}

interface Props {
    lang: "EN" | "FR";
    filter: GridFilter;
    view: ViewMode;
    onStats?: (stats: GridStats) => void;
    // Asset to pan to + highlight (set when a feed card is clicked). The nonce
    // changes on every click so re-selecting the same asset re-triggers the focus.
    focusAsset?: string | null;
    focusNonce?: number;
    // Data-confidence filter (reliability view): which confidence tiers heat the
    // map. Undefined = all tiers. Lets the viewer strip to measured evidence.
    confidenceFilter?: Set<EventConfidence>;
    // Emits the measured SAIFI/SAIDI indicator series (per scope) once events
    // load, so the page can render the indices panel without re-fetching.
    onIndices?: (indices: Map<string, MeasuredIndex[]>) => void;
}

export default function GridMap({ lang, filter, view, onStats, focusAsset, focusNonce, confidenceFilter, onIndices }: Props) {
  // Datasets come from the shared provider (see src/lib/GridDataContext.tsx) so
  // the map and the activity feed read the same objects from a single fetch.
  const { data, border: senegalBorder, error: loadError } = useGridData();

  useEffect(() => { setupIcons(); }, []);

  // Compute headline stats from the loaded data so the context panel can never
  // drift from what is actually rendered. Total trace km = sum of length_km
  // across all rendered line layers; node count = all rendered point features.
  useEffect(() => {
    if (!onStats || !data.grid) return;

    const sumLineKm = (fc: LineCollection | null): number =>
      (fc?.features ?? []).reduce((acc: number, f: LineFeature) => {
        if (f?.geometry?.type !== "LineString") return acc;
        const n = Number(f.properties?.length_km);
        return acc + (isNaN(n) ? 0 : n);
      }, 0);

    const totalKm = sumLineKm(data.grid) + sumLineKm(data.regionalGrid) + sumLineKm(data.tieLines);

    const countPts = (fc: { features: unknown[] } | null): number => (fc?.features ?? []).length;
    const nodeCount =
      countPts(data.plants) +
      countPts(data.regionalNodes) +
      countPts(data.consumers) +
      (SHOW_ESI_SITES ? countPts(data.esiSites) : 0);

    onStats({ totalKm: Math.round(totalKm), nodeCount });
  }, [data, onStats]);

  // Time slider (Phase 3): which calendar year of events to show, or "all".
  const [year, setYear] = useState<YearFilter>("all");
  const years = useMemo(
    () => availableYears(data.outageEvents ?? null, data.maintenanceEvents ?? null),
    [data.outageEvents, data.maintenanceEvents],
  );
  // Registry of node markers by stable asset id, populated as markers are built
  // in pointToLayer. Used by MapFocusController to pan + open a popup when a feed
  // card is clicked. Rebuilt whenever the GeoJSON layers re-render (view/lang/year
  // changes remount them), so it always reflects the markers currently on the map.
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

  // Reliability profiles: aggregate events per asset for the selected year
  // window. Keyed by asset id for O(1) lookup during render.
  const reliability = useMemo(
    () => computeReliability(data.outageEvents ?? null, data.maintenanceEvents ?? null, year, confidenceFilter),
    [data.outageEvents, data.maintenanceEvents, year, confidenceFilter],
  );
  const isReliability = view === "reliability";

  // Emit measured SAIFI/SAIDI indicators to the page once events load (year- and
  // confidence-independent — these are utility-grade reported indices).
  useEffect(() => {
    if (!onIndices || !data.outageEvents) return;
    onIndices(measuredIndicesByScope(data.outageEvents));
  }, [data.outageEvents, onIndices]);

  // Latest SAIFI/SAIDI system indicator per asset (Phase 4) — for surfacing the
  // raw measured indices in popups. Keyed by asset_ref, keeping the most recent
  // period's values among events that carry them.
  const indexByAsset = useMemo(() => {
    const m = new Map<string, { saifi?: number; saidi_min?: number; scope?: string; period?: string; start: string }>();
    (data.outageEvents?.features ?? []).forEach((f) => {
      const p = f.properties;
      if (p.saifi == null && p.saidi_min == null) return;
      const prev = m.get(p.asset_ref);
      if (!prev || Date.parse(p.start) > Date.parse(prev.start)) {
        m.set(p.asset_ref, { saifi: p.saifi, saidi_min: p.saidi_min, scope: p.scope, period: p.period, start: p.start });
      }
    });
    return m;
  }, [data.outageEvents]);

  // Escape interpolated values before they are injected into popup innerHTML.
  // Defends against malformed/markup characters in data fields now, and against
  // stored-XSS if any dataset later becomes user-supplied or API-sourced.
  const esc = (val: unknown): string =>
    String(val ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  // --- SNAPPING & FILTERING ENGINE ---
  // Connects line endpoints to the nearest node ONLY when it is within a tight
  // metric tolerance, so endpoints meet markers without distorting real routes.
  const SNAP_TOLERANCE_KM = 3; // faithful: never relocate an endpoint farther than this

  // Haversine great-circle distance in km between two [lon, lat] points.
  const haversineKm = (a: Coordinate, b: Coordinate) => {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const [lon1, lat1] = a;
    const [lon2, lat2] = b;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };

  const processedData = useMemo(() => {
    if (!data.grid || !data.plants) return data;

    const allNodes = [
        ...(data.plants?.features || []),
        ...(data.regionalNodes?.features || []),
        ...(data.consumers?.features || [])
    ];
    const nodeCoords = allNodes.map((n: NodeFeature) => ({
      coords: n.geometry.coordinates as Coordinate
    }));

    const processLine = (lineFeature: LineFeature): LineFeature => {
      if (lineFeature.geometry.type !== "LineString") return lineFeature;

      const coords: Coordinate[] = [...lineFeature.geometry.coordinates];
      [0, coords.length - 1].forEach(idx => {
        const pt = coords[idx] as Coordinate;
        let closestNode: Coordinate | null = null;
        let minDist = SNAP_TOLERANCE_KM;
        nodeCoords.forEach(node => {
          const d = haversineKm(pt, node.coords);
          if (d < minDist) { minDist = d; closestNode = node.coords; }
        });
        if (closestNode) coords[idx] = closestNode;
      });

      return {
        ...lineFeature,
        geometry: { ...lineFeature.geometry, coordinates: coords }
      } as LineFeature;
    };

    return {
      ...data,
      grid: data.grid ? { ...data.grid, features: data.grid.features.map(processLine) } : null,
      regionalGrid: data.regionalGrid ? { ...data.regionalGrid, features: data.regionalGrid.features.map(processLine) } : null,
      tieLines: data.tieLines ? { ...data.tieLines, features: data.tieLines.features.map(processLine) } : null
    };
  }, [data]);

  const geoJsonFilter = (feature: GeoJSON.Feature): boolean => {
    if (filter === "ALL") return true;
    const v = Number((feature.properties as LineProps)?.voltage_kV);
    if (filter === "225") return v === 225;
    if (filter === "90") return v === 90;
    if (filter === "MV") return v < 90;
    return true;
  };

  // Cross-border / OMVG detection. Prefers explicit data attributes
  // (cross_border flag, operator, or a non-Senegal country) and only falls
  // back to matching the free-text name. This keeps styling correct even when
  // a line's name field is null, instead of silently treating it as domestic.
  const isCrossBorder = (props: LineProps): boolean => {
    if (props.cross_border === true) return true;
    const operator = String(props.operator || '');
    if (/OMVG|OMVS|WAPP/i.test(operator)) return true;
    const country = String(props.country || '');
    if (country && country.toLowerCase() !== 'senegal') return true;
    const name = String(props.name || '');
    return /OMVG|EDM|Trans-?Gambia/i.test(name);
  };

  const gridStyle = (feature?: GeoJSON.Feature) => {
    const props = (feature?.properties ?? {}) as LineProps;
    const voltage = Number(props.voltage_kV);
    // In reliability mode the network stays as subtle context: lines keep their
    // true voltage colors (so HV/MV remain distinguishable) but at reduced
    // opacity and weight, letting the node heat-map dominate.
    const relMode = isReliability;
    const op = relMode ? 0.3 : 1;
    const wMul = relMode ? 0.7 : 1;
    if (voltage === 225) {
      const intl = isCrossBorder(props);
      return {
        color: intl ? "#A78BFA" : "#2579fc",
        weight: 3.5 * wMul,
        opacity: 0.9 * op,
        className: relMode ? "" : (intl ? "hv-225-intl-line" : "hv-225-line"),
      };
    }
    if (voltage === 90) return { color: "#FDA206", weight: 2.2 * wMul, opacity: 0.85 * op, className: relMode ? "" : "hv-90-line" };
    return { color: "#00F2FF", weight: 1.5 * wMul, opacity: 0.7 * op, className: relMode ? "" : "mv-line" };
  };

  // Hover affordance for lines. Leaflet gives no default hover feedback on
  // polylines, so a 250-point circuit and a 2-point stub read identically until
  // clicked. On mouseover the line thickens, goes fully opaque, and is raised
  // above its neighbours; a lightweight tooltip names the circuit so the network
  // can be traced without opening a popup on every segment.
  const HOVER_WEIGHT_BOOST = 2.5;

  const attachHoverHighlight = (
    layer: L.Layer, feature: GeoJSON.Feature, tooltipHtml: string,
  ) => {
    const path = layer as L.Path;
    if (typeof path.setStyle !== "function") return;

    const base = gridStyle(feature);

    path.bindTooltip(tooltipHtml, {
      sticky: true,
      direction: "top",
      opacity: 1,
      className: "grid-line-tooltip",
    });

    path.on("mouseover", () => {
      path.setStyle({
        weight: (base.weight ?? 2) + HOVER_WEIGHT_BOOST,
        opacity: 1,
      });
      // Raise above sibling lines so the highlight isn't hidden at crossings.
      if (typeof path.bringToFront === "function") path.bringToFront();
    });

    path.on("mouseout", () => {
      path.setStyle({ weight: base.weight, opacity: base.opacity });
    });

    // A popup opening moves focus to the popup; reset the highlight so a line
    // isn't left permanently thickened after the pointer has gone.
    path.on("popupclose", () => {
      path.setStyle({ weight: base.weight, opacity: base.opacity });
    });
  };

  const onEachGridFeature = (feature: GeoJSON.Feature, layer: L.Layer) => {
    if (feature.properties) {
      const props = feature.properties as LineProps;
      const { voltage_kV, length_km, name } = props;
      const v = Number(voltage_kV);
      // Meaningful fallback title when name is null: describe the circuit by
      // voltage tier rather than a generic "Transmission Line".
      const tier = v === 225
        ? (isCrossBorder(props)
            ? (lang === "EN" ? "Cross-border 225kV Circuit" : "Circuit transfrontalier 225kV")
            : (lang === "EN" ? "SENELEC 225kV Circuit" : "Circuit SENELEC 225kV"))
        : v === 90
          ? (lang === "EN" ? "90kV Sub-backbone" : "Sous-dorsale 90kV")
          : (lang === "EN" ? "MV Distribution Line" : "Ligne de distribution MT");
      const title = esc(name || tier);
      const unit = "kV Circuit";
      const lengthLabel = lang === "EN" ? "Length" : "Longueur";
      const lenNum = Number(length_km);
      const lengthDisplay = !isNaN(lenNum) && lenNum > 0 ? lenNum.toFixed(1) : "N/A";

      layer.bindPopup(`
        <div class="text-sunu-arsenic font-sans p-2">
          <div class="text-[10px] uppercase tracking-widest font-bold text-sunu-graphite mb-2 border-b border-white/5 pb-1">${title}</div>
          <div class="text-sm font-bold text-[#EDEFF7]">${esc(voltage_kV)} ${unit}</div>
          <div class="text-[11px] mt-2.5 text-sunu-graphite font-medium">
            ${lengthLabel}: <span class="text-sunu-cloud">${lengthDisplay} km</span>
          </div>
        </div>
      `, { className: 'custom-popup', pane: 'popupAboveAll' });

      // Hover tooltip: voltage tier + the route where from/to are known, plus
      // length. Deliberately terser than the popup — enough to trace a circuit
      // at a glance without clicking.
      const dot = v === 225 ? (isCrossBorder(props) ? "#A78BFA" : "#2579fc") : v === 90 ? "#FDA206" : "#00F2FF";
      const route = props.from && props.to ? `${esc(props.from)} → ${esc(props.to)}` : "";
      const tooltipHtml = `
        <span class="grid-line-tooltip-dot" style="background:${dot};box-shadow:0 0 6px ${dot}AA;"></span>
        <span class="grid-line-tooltip-body">
          <span class="grid-line-tooltip-title">${title}</span>
          ${route ? `<span class="grid-line-tooltip-meta">${route}</span>` : ""}
          <span class="grid-line-tooltip-meta">${esc(voltage_kV)} kV · ${lengthDisplay} km</span>
        </span>`;
      attachHoverHighlight(layer, feature, tooltipHtml);
    }
  };

  const pointToLayer = (feature: GeoJSON.Feature, latlng: L.LatLng) => {
    const p = (feature.properties ?? {}) as NodeProps;
    const isConsumer = p.demand_profile !== undefined;

    // RELIABILITY MODE: size + color the node by its reliability stress score.
    // Color and size are both driven by the score (redundant channel for
    // color-blind safety). Assets with no events render as the calm baseline.
    if (isReliability) {
      const profile = p.id ? reliability.profiles.get(p.id) : undefined;
      const score = profile?.reliability_score ?? 0;
      const color = heatColor(score);
      const d = heatRadius(score);
      const ring = score > 0 ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.45)";
      const html = `<div style="background-color:${color};width:${d}px;height:${d}px;border:2px solid ${ring};border-radius:50%;box-shadow:0 0 ${Math.round(d * 0.9)}px ${color}AA;"></div>`;
      const relMarker = L.marker(latlng, { icon: L.divIcon({ className: "custom-div-icon", html, iconSize: [d, d], iconAnchor: [d / 2, d / 2] }) });
      if (p.id) markersRef.current.set(p.id, relMarker);
      return relMarker;
    }

    let color = "#2579fc";
    if (p.fuel === "Wind") color = "#66BB6A";
    if (p.fuel === "Solar") color = "#FDA206";
    if (p.fuel === "Coal") color = "#EF5350";
    if (p.fuel === "Hydro") color = "#42A5F5";
    if (p.fuel === "Substation") color = "#6E7180";
    if (isConsumer) color = "#E91E63";

    const isSubstation = p.fuel === "Substation";
    const size = isConsumer ? 14 : (isSubstation ? 8 : 12);
    // Consumer hex: border+clip-path deforms at vertices — use wrapper+drop-shadow instead
    const iconHtml = isConsumer
        ? `<div style="width:${size}px;height:${size}px;filter:drop-shadow(0 0 5px ${color}CC) drop-shadow(0 0 1px rgba(255,255,255,0.65));"><div style="background-color:${color};width:100%;height:100%;clip-path:polygon(25% 0%,75% 0%,100% 50%,75% 100%,25% 100%,0% 50%);"></div></div>`
        : `<div style="background-color: ${color}; width: ${size}px; height: ${size}px; border: 2px solid rgba(255,255,255,1); border-radius: 50%; box-shadow: 0 0 15px ${color}CC;"></div>`;

    const infraMarker = L.marker(latlng, { icon: L.divIcon({ className: "custom-div-icon", html: iconHtml, iconSize: [size, size], iconAnchor: [size/2, size/2] }) });
    if (p.id) markersRef.current.set(p.id, infraMarker);
    return infraMarker;
  };

  // Localized reliability-profile popup for a node in reliability mode.
  const reliabilityPopupHtml = (p: NodeProps): string => {
    const profile = p.id ? reliability.profiles.get(p.id) : undefined;
    const confLabel: Record<string, string> = lang === "EN"
      ? { measured: "Measured", reported: "Reported", modeled: "Modeled" }
      : { measured: "Mesuré", reported: "Rapporté", modeled: "Modélisé" };
    const confColor: Record<string, string> = { measured: "#22C55E", reported: "#F59E0B", modeled: "#9DA2B3" };
    const sevLabel = (s: string | null) => {
      if (!s) return "n/a";
      const en: Record<string, string> = { low: "Low", medium: "Medium", high: "High", critical: "Critical" };
      const fr: Record<string, string> = { low: "Faible", medium: "Moyen", high: "Élevé", critical: "Critique" };
      return (lang === "EN" ? en : fr)[s] ?? s;
    };
    const head = lang === "EN" ? "RELIABILITY PROFILE" : "PROFIL DE FIABILITÉ";
    if (!profile) {
      const none = lang === "EN" ? "No recorded events" : "Aucun évènement enregistré";
      return `<div class="font-sans p-2"><div class="text-[10px] uppercase tracking-widest font-bold text-sunu-graphite mb-2 border-b border-white/5 pb-1">${head}</div><div class="text-sm font-bold text-[#EDEFF7]">${esc(p.name)}</div><div class="text-[11px] mt-2 text-sunu-space">${none}</div></div>`;
    }
    const c = profile.confidence;
    const rows = [
      [lang === "EN" ? "Stress score" : "Score de stress", `${profile.reliability_score}/100`],
      [lang === "EN" ? "Events" : "Évènements", String(profile.event_count)],
      [lang === "EN" ? "Outage hours" : "Heures de coupure", String(profile.total_outage_hours)],
      [lang === "EN" ? "Worst severity" : "Sévérité max", sevLabel(profile.worst_severity)],
    ];
    const rowsHtml = rows.map(([k, v]) =>
      `<div class="flex justify-between text-[10px]"><span class="text-sunu-graphite uppercase font-bold">${k}</span><span class="text-sunu-cloud font-mono">${esc(v)}</span></div>`
    ).join("");
    const badge = `<span style="background:${confColor[c]}22;color:${confColor[c]};" class="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase">${confLabel[c]}</span>`;
    const scoreColor = heatColor(profile.reliability_score);

    // SENELEC SAIFI/SAIDI block — shown only when the asset carries measured
    // system indices. Clearly labeled with its system-level scope and period so
    // it never reads as a node-specific measurement.
    const idx = p.id ? indexByAsset.get(p.id) : undefined;
    let indexHtml = "";
    if (idx && (idx.saifi != null || idx.saidi_min != null)) {
      const saidiTxt = idx.saidi_min != null
        ? `${Math.floor(idx.saidi_min / 60)}h${String(Math.round(idx.saidi_min % 60)).padStart(2, "0")}`
        : "n/a";
      const scopeLabel = lang === "EN" ? "System indicator" : "Indicateur système";
      const scopeTxt = `${esc(idx.scope ?? "")}${idx.period ? " · " + esc(idx.period) : ""}`;
      indexHtml = `
        <div class="mt-3 pt-2 border-t border-white/5">
          <div class="text-[9px] uppercase tracking-widest font-bold text-sunu-graphite mb-1.5">${scopeLabel}</div>
          <div class="flex justify-between text-[10px]"><span class="text-sunu-graphite uppercase font-bold">SAIFI</span><span class="text-sunu-cloud font-mono">${idx.saifi != null ? esc(idx.saifi) : "n/a"}</span></div>
          <div class="flex justify-between text-[10px]"><span class="text-sunu-graphite uppercase font-bold">SAIDI</span><span class="text-sunu-cloud font-mono">${saidiTxt}</span></div>
          <div class="text-[9px] text-sunu-space mt-1.5 italic">${scopeTxt}</div>
        </div>`;
    }

    return `<div class="font-sans p-2">
      <div class="text-[10px] uppercase tracking-widest font-bold text-sunu-graphite mb-2 border-b border-white/5 pb-1">${head}</div>
      <div class="flex items-center justify-between"><div class="text-sm font-bold text-[#EDEFF7]">${esc(p.name)}</div><div style="width:10px;height:10px;border-radius:50%;background:${scoreColor};box-shadow:0 0 8px ${scoreColor}AA;"></div></div>
      <div class="mt-3 space-y-1.5 border-t border-white/5 pt-2">${rowsHtml}</div>
      ${indexHtml}
      <div class="mt-3 pt-2 border-t border-white/5 flex items-center justify-between"><span class="text-[9px] text-sunu-graphite uppercase font-bold">${lang === "EN" ? "Confidence" : "Confiance"}</span>${badge}</div>
    </div>`;
  };

  const onEachPlantFeature = (feature: GeoJSON.Feature, layer: L.Layer) => {
    if (feature.properties) {
      const p = feature.properties as NodeProps;

      // Reliability mode: show the aggregated reliability profile instead of the
      // infrastructure detail popup.
      if (isReliability) {
        layer.bindPopup(reliabilityPopupHtml(p), { className: 'custom-popup', pane: 'popupAboveAll' });
        return;
      }

      const isSub = p.fuel === "Substation";
      const isCon = p.demand_profile !== undefined;
      const label = lang === "EN" ? (isCon ? "Industrial Off-taker" : (isSub ? "Network Node" : "Power Plant")) : (isCon ? "Consommateur Industriel" : (isSub ? "Nœud du Réseau" : "Centrale Électrique"));
      const cap = Number(p.capacity_mw);
      const capDisplay = !isNaN(cap) && cap > 0 ? ` · ${cap} MW` : "";
      const storage = p.storage_mwh ? `<div class="mt-1"><span class="bg-sunu-blue/20 text-sunu-blue text-[9px] px-1.5 py-0.5 rounded font-bold">BESS: ${esc(p.storage_mwh)} MWh</span></div>` : "";
      let metadata = isCon ? `
        <div class="mt-3 space-y-1.5 border-t border-white/5 pt-2">
            <div class="flex justify-between text-[10px]"><span class="text-sunu-graphite uppercase font-bold">${lang === 'EN' ? 'Sector' : 'Secteur'}</span><span class="text-sunu-cloud">${esc(p.sector)}</span></div>
            <div class="flex justify-between text-[10px]"><span class="text-sunu-graphite uppercase font-bold">${lang === 'EN' ? 'Profile' : 'Profil'}</span><span class="text-sunu-cloud">${esc(p.demand_profile)}</span></div>
        </div>` : (!isSub ? `
        <div class="mt-3 space-y-1.5 border-t border-white/5 pt-2">
          ${p.operator ? `<div class="flex justify-between text-[10px]"><span class="text-sunu-graphite uppercase font-bold">${lang === 'EN' ? 'Operator' : 'Opérateur'}</span><span class="text-sunu-cloud">${esc(p.operator)}</span></div>` : ''}
          ${p.commissioned ? `<div class="flex justify-between text-[10px]"><span class="text-sunu-graphite uppercase font-bold">${lang === 'EN' ? 'Commissioned' : 'Mise en service'}</span><span class="text-sunu-cloud">${esc(p.commissioned)}</span></div>` : ''}
          ${p.annual_gen ? `<div class="flex justify-between text-[10px]"><span class="text-sunu-graphite uppercase font-bold">${lang === 'EN' ? 'Annual Gen' : 'Prod. Annuelle'}</span><span class="text-sunu-cloud font-mono">${esc(p.annual_gen)}</span></div>` : ''}
        </div>` : '');

      layer.bindPopup(`<div class="text-sunu-arsenic font-sans p-2"><div class="text-[10px] uppercase tracking-widest font-bold text-sunu-graphite mb-2 border-b border-white/5 pb-1">${label}</div><div class="text-sm font-bold text-[#EDEFF7]">${esc(p.name)}</div><div class="text-[11px] mt-2.5 text-sunu-graphite uppercase font-bold tracking-wider">${esc(p.fuel || p.type)}${capDisplay}</div>${storage}${metadata}${p.country ? `<div class="text-[9px] text-sunu-space uppercase mt-2 opacity-60">${esc(p.country)}</div>` : ""}</div>`, { className: 'custom-popup', pane: 'popupAboveAll' });
    }
  };

  return (
    <div className="w-full h-full relative bg-[#121212]">
      <style jsx global>{`
        /* CARTO Dark Matter renders water as a distinct dark blue-grey and land
           a touch lighter, so coastline and islands (e.g. Gorée) stay readable
           without filter hacks. Background matches the theme's water tone. */
        .leaflet-container { background: #1B2026 !important; }
        .basemap-tiles { filter: saturate(1.05); }
        /* Glass-panel zoom control to match the app's dark frosted aesthetic
           (overrides Leaflet's default white buttons). */
        .leaflet-control-zoom {
          border: 1px solid rgba(255,255,255,0.10) !important;
          border-radius: 12px !important;
          overflow: hidden !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.07) !important;
          backdrop-filter: blur(14px) saturate(160%) brightness(0.96);
          -webkit-backdrop-filter: blur(14px) saturate(160%) brightness(0.96);
        }
        .leaflet-control-zoom a {
          background: rgba(14,14,18,0.48) !important;
          color: #EDEFF7 !important;
          border: none !important;
          border-bottom: 1px solid rgba(255,255,255,0.08) !important;
          width: 32px !important;
          height: 32px !important;
          line-height: 30px !important;
          font-size: 17px !important;
          transition: background 0.15s ease, color 0.15s ease;
        }
        .leaflet-control-zoom a:last-child { border-bottom: none !important; }
        .leaflet-control-zoom a:hover {
          background: rgba(255,255,255,0.10) !important;
          color: #FFFFFF !important;
        }
        .leaflet-control-zoom a.leaflet-disabled {
          background: rgba(14,14,18,0.40) !important;
          color: rgba(157,162,179,0.45) !important;
        }
        .hv-225-line { filter: drop-shadow(0 0 4px #2579fcCC); }
        .hv-225-intl-line { filter: drop-shadow(0 0 4px #A78BFACC); }
        .hv-90-line { filter: drop-shadow(0 0 3px #FDA206CC); }
        .mv-line { filter: drop-shadow(0 0 2px #00F2FF99); }
        .custom-popup .leaflet-popup-content-wrapper { background: rgba(14, 14, 18, 0.48) !important; backdrop-filter: blur(14px) saturate(160%) brightness(0.96) !important; -webkit-backdrop-filter: blur(14px) saturate(160%) brightness(0.96) !important; color: #EDEFF7 !important; border-radius: 12px !important; border: 1px solid rgba(255, 255, 255, 0.10) !important; box-shadow: 0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.07) !important; }
        .custom-popup .leaflet-popup-tip { background: rgba(14, 14, 18, 0.48) !important; backdrop-filter: blur(14px) !important; border: 1px solid rgba(255, 255, 255, 0.10) !important; box-shadow: none !important; }
        .leaflet-popup-content { margin: 16px 20px !important; width: auto !important; min-width: 220px; }
        /* Line hover tooltip — same frosted-glass language as the popups but
           lighter, so tracing a circuit never feels as heavy as clicking one. */
        .grid-line-tooltip {
          background: rgba(14,14,18,0.60) !important;
          backdrop-filter: blur(12px) saturate(160%);
          -webkit-backdrop-filter: blur(12px) saturate(160%);
          border: 1px solid rgba(255,255,255,0.10) !important;
          border-radius: 8px !important;
          box-shadow: 0 6px 22px rgba(0,0,0,0.35) !important;
          color: #EDEFF7 !important;
          padding: 7px 10px !important;
          font-family: inherit !important;
          white-space: nowrap;
          pointer-events: none;
        }
        .grid-line-tooltip::before { display: none !important; }
        .grid-line-tooltip-dot {
          display: inline-block; width: 7px; height: 7px; border-radius: 50%;
          margin-right: 7px; vertical-align: 3px;
        }
        .grid-line-tooltip-body { display: inline-flex; flex-direction: column; gap: 1px; vertical-align: middle; }
        .grid-line-tooltip-title {
          font-size: 9px; text-transform: uppercase; letter-spacing: 0.14em;
          font-weight: 700; color: #9DA2B3;
        }
        .grid-line-tooltip-meta { font-size: 11px; color: #EDEFF7; font-weight: 600; }
      `}</style>
      {/* keyboard enables arrow-key pan and +/- zoom for non-mouse users */}
      <MapContainer center={[13.8, -13.5] as any} zoom={7} scrollWheelZoom={true} keyboard={true} zoomControl={false} zoomSnap={0.25} zoomDelta={0.5} wheelDebounceTime={40} wheelPxPerZoomLevel={100} className="w-full h-full">
        <PopupPaneSetup />
        <ZoomControl position="bottomleft" />
        <LabelPaneSetup />
        {/* CARTO Dark Matter (no labels) — clean dark base with readable water */}
        <TileLayer className="basemap-tiles" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>' url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png" subdomains="abcd" maxZoom={20} />
        {/* Soft national boundary — solid, thin, recessive (no longer dashed) */}
        {senegalBorder && <GeoJSON key={`sn-border-${view}`} data={senegalBorder} style={{ color: "#5B6472", weight: 1, opacity: 0.6, fill: false } as any} interactive={false} />}
        {/* Place labels on a high pane so they stay legible over the grid lines */}
        <TileLayer pane="labels" url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png" subdomains="abcd" maxZoom={20} />
        {processedData.grid && <GeoJSON key={`grid-${filter}-${view}`} data={processedData.grid} filter={geoJsonFilter} style={gridStyle} onEachFeature={onEachGridFeature} />}
        {processedData.regionalGrid && <GeoJSON key={`reg-${filter}-${view}`} data={processedData.regionalGrid} filter={geoJsonFilter} style={gridStyle} onEachFeature={onEachGridFeature} />}
        {processedData.tieLines && <GeoJSON key={`tie-${filter}-${view}`} data={processedData.tieLines} filter={geoJsonFilter} style={gridStyle} onEachFeature={onEachGridFeature} />}
        {processedData.plants && <GeoJSON key={`plants-${view}-${lang}-${year}`} data={processedData.plants} pointToLayer={pointToLayer} onEachFeature={onEachPlantFeature} />}
        {processedData.regionalNodes && <GeoJSON key={`rnodes-${view}-${lang}-${year}`} data={processedData.regionalNodes} pointToLayer={pointToLayer} onEachFeature={onEachPlantFeature} />}
        {processedData.consumers && <GeoJSON key={`cons-${view}-${lang}-${year}`} data={processedData.consumers} pointToLayer={pointToLayer} onEachFeature={onEachPlantFeature} />}
        {/* ESI sites parked until real assets exist — see src/lib/config.ts */}
        {SHOW_ESI_SITES && <EsiLayerManager data={processedData.esiSites} />}
        <MapFocusController markersRef={markersRef} focusAsset={focusAsset} nonce={focusNonce} />
      </MapContainer>

      {/* Time slider — reliability mode only. Scrubs events by calendar year;
          "All" aggregates the full history. Constraints (persistent) always show. */}
      {isReliability && years.length > 0 && (
        <div className="absolute bottom-28 lg:bottom-6 left-1/2 -translate-x-1/2 z-[2000] glass-panel rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 pointer-events-auto max-w-[calc(100vw-2rem)]" role="group" aria-label={lang === "EN" ? "Filter events by year" : "Filtrer les évènements par année"}>
          <div className="flex items-center gap-2 sm:gap-2.5 overflow-x-auto no-scrollbar">
            <span className="text-[9px] uppercase tracking-widest font-bold text-sunu-space mr-1 shrink-0">{lang === "EN" ? "Period" : "Période"}</span>
            {(["all", ...years] as YearFilter[]).map((y) => {
              const active = year === y;
              const label = y === "all" ? (lang === "EN" ? "All" : "Tout") : String(y);
              return (
                <button
                  key={String(y)}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setYear(y)}
                  className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-sunu-blue/70 ${
                    active ? "bg-white/[0.12] text-sunu-cloud" : "text-sunu-space hover:text-sunu-cloud"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Loading state — shown until the grid layer has data */}
      {!loadError && !data.grid && (
        <div className="absolute inset-0 z-[1500] flex flex-col items-center justify-center bg-[#121212]/80 pointer-events-none" role="status" aria-live="polite">
          <div className="w-8 h-8 rounded-full border-2 border-white/15 border-t-sunu-blue animate-spin" aria-hidden="true" />
          <span className="mt-4 text-[11px] uppercase tracking-widest font-bold text-sunu-space">
            {lang === "EN" ? "Loading grid data…" : "Chargement du réseau…"}
          </span>
        </div>
      )}

      {/* Error state — shown if any dataset fails to load */}
      {loadError && (
        <div className="absolute inset-0 z-[1500] flex flex-col items-center justify-center bg-[#121212]/90 px-8 text-center" role="alert">
          <span className="text-sm font-bold text-sunu-cloud">
            {lang === "EN" ? "Grid data could not be loaded." : "Impossible de charger les données du réseau."}
          </span>
          <span className="mt-2 text-[11px] text-sunu-space max-w-sm leading-relaxed">
            {lang === "EN"
              ? "Check your connection and try refreshing the page."
              : "Vérifiez votre connexion et actualisez la page."}
          </span>
        </div>
      )}
    </div>
  );
}
