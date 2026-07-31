"use client";

// The GeoJSON layer stack: transmission lines and network nodes.
//
// Two things here are load-bearing and easy to break:
//
// 1. Layer `key`s. react-leaflet does not diff GeoJSON children — it builds the
//    Leaflet layer once at mount and ignores later prop changes. Changing the
//    key is what forces a remount, so every input that affects rendering must
//    appear in it. Lines depend on filter + view; nodes additionally depend on
//    lang (popup copy) and year (heat scores).
//
// 2. The marker registry. pointToLayer records each marker by asset id so the
//    activity feed can fly to it. Entries are overwritten by id on each remount,
//    so a live lookup always returns the current marker. Ids that disappear from
//    the data are not evicted — harmless here (the node set is static and small)
//    but worth knowing before this is pointed at a changing feed.

import { GeoJSON } from "react-leaflet";
import L from "leaflet";
import type {
  GridData, LineProps, NodeProps, GridFilter, ViewMode, Lang,
} from "@/types/grid";
import type { MapStrings } from "@/lib/mapStrings";
import type { ReliabilityResult, YearFilter } from "@/lib/reliability";
import { lineStyle, passesVoltageFilter } from "@/lib/gridStyle";
import { infrastructureIcon, reliabilityIcon } from "./markers";
import {
  linePopupHtml, lineTooltipHtml, nodePopupHtml, reliabilityPopupHtml,
  type AssetIndex,
} from "./popupContent";

const POPUP_OPTS = { className: "custom-popup", pane: "popupAboveAll" } as const;

// How much a hovered line thickens. Leaflet gives polylines no hover feedback of
// its own, so without this a 250-point circuit and a 2-point stub are
// indistinguishable until clicked.
const HOVER_WEIGHT_BOOST = 2.5;

export function GridLayers({
  data, filter, view, lang, s, reliability, indexByAsset, year, markersRef,
}: {
  data: GridData;
  filter: GridFilter;
  view: ViewMode;
  lang: Lang;
  s: MapStrings;
  reliability: ReliabilityResult;
  indexByAsset: Map<string, AssetIndex>;
  year: YearFilter;
  markersRef: React.MutableRefObject<Map<string, L.Marker>>;
}) {
  const isReliability = view === "reliability";

  // --- Lines ---------------------------------------------------------------

  const styleFor = (feature?: GeoJSON.Feature) =>
    lineStyle((feature?.properties ?? {}) as LineProps, view);

  const filterLine = (feature: GeoJSON.Feature) =>
    passesVoltageFilter((feature.properties ?? {}) as LineProps, filter);

  const onEachLine = (feature: GeoJSON.Feature, layer: L.Layer) => {
    if (!feature.properties) return;
    const props = feature.properties as LineProps;

    layer.bindPopup(linePopupHtml(props, s), POPUP_OPTS);

    const path = layer as L.Path;
    if (typeof path.setStyle !== "function") return;

    const base = lineStyle(props, view);
    path.bindTooltip(lineTooltipHtml(props, s), {
      sticky: true,
      direction: "top",
      opacity: 1,
      className: "grid-line-tooltip",
    });

    const restore = () => path.setStyle({ weight: base.weight, opacity: base.opacity });

    path.on("mouseover", () => {
      path.setStyle({ weight: base.weight + HOVER_WEIGHT_BOOST, opacity: 1 });
      // Raise above siblings so the highlight isn't buried at a crossing.
      if (typeof path.bringToFront === "function") path.bringToFront();
    });
    path.on("mouseout", restore);
    // Opening a popup moves focus away from the line; without this it would stay
    // permanently thickened after the pointer left.
    path.on("popupclose", restore);
  };

  // --- Nodes ---------------------------------------------------------------

  const pointToLayer = (feature: GeoJSON.Feature, latlng: L.LatLng) => {
    const p = (feature.properties ?? {}) as NodeProps;
    const icon = isReliability
      ? reliabilityIcon(p.id ? (reliability.profiles.get(p.id)?.reliability_score ?? 0) : 0)
      : infrastructureIcon(p);
    const marker = L.marker(latlng, { icon });
    if (p.id) markersRef.current.set(p.id, marker);
    return marker;
  };

  const onEachNode = (feature: GeoJSON.Feature, layer: L.Layer) => {
    if (!feature.properties) return;
    const p = feature.properties as NodeProps;
    const html = isReliability
      ? reliabilityPopupHtml(
          p,
          p.id ? reliability.profiles.get(p.id) : undefined,
          p.id ? indexByAsset.get(p.id) : undefined,
          s,
        )
      : nodePopupHtml(p, s);
    layer.bindPopup(html, POPUP_OPTS);
  };

  const lineKey = `${filter}-${view}`;
  const nodeKey = `${view}-${lang}-${year}`;

  return (
    <>
      {data.grid && (
        <GeoJSON key={`grid-${lineKey}`} data={data.grid} filter={filterLine} style={styleFor} onEachFeature={onEachLine} />
      )}
      {data.regionalGrid && (
        <GeoJSON key={`reg-${lineKey}`} data={data.regionalGrid} filter={filterLine} style={styleFor} onEachFeature={onEachLine} />
      )}
      {data.tieLines && (
        <GeoJSON key={`tie-${lineKey}`} data={data.tieLines} filter={filterLine} style={styleFor} onEachFeature={onEachLine} />
      )}
      {data.plants && (
        <GeoJSON key={`plants-${nodeKey}`} data={data.plants} pointToLayer={pointToLayer} onEachFeature={onEachNode} />
      )}
      {data.regionalNodes && (
        <GeoJSON key={`rnodes-${nodeKey}`} data={data.regionalNodes} pointToLayer={pointToLayer} onEachFeature={onEachNode} />
      )}
      {data.consumers && (
        <GeoJSON key={`cons-${nodeKey}`} data={data.consumers} pointToLayer={pointToLayer} onEachFeature={onEachNode} />
      )}
    </>
  );
}
