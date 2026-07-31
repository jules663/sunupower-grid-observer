"use client";

// Headless components that reach into the Leaflet map instance: pane setup and
// imperative camera control. Each renders null and exists only for its effect —
// grouping them keeps that pattern in one place rather than scattered through
// the map component.

import { useEffect, useState } from "react";
import { useMap, useMapEvents, GeoJSON } from "react-leaflet";
import L from "leaflet";
import type { EsiCollection, EsiProps, Lang } from "@/types/grid";
import { esiIcon } from "./markers";
import { esiPopupHtml } from "./popupContent";

/**
 * Creates the pane popups render into.
 *
 * Popups must live in a pane that is a direct child of .leaflet-container, NOT
 * inside .leaflet-map-pane. Reason: .leaflet-map-pane carries a CSS transform,
 * which creates its own stacking context at z-index 400 and traps popup z-index
 * below the glass overlay panels (z-index 2000). Parenting this pane to the
 * container at 3000 lets popups escape that stacking context.
 *
 * Positioning correctness: Leaflet pans by applying transform:translate(dx,dy)
 * to .leaflet-map-pane. Our pane does not inherit that transform, so we mirror
 * it on every 'move' and 'viewreset' — otherwise latLngToLayerPoint coordinates
 * placed inside our pane would drift away from the features they belong to.
 */
export function PopupPaneSetup() {
  const map = useMap();
  useEffect(() => {
    if (!map.getPane("popupAboveAll")) {
      const created = map.createPane("popupAboveAll", map.getContainer());
      created.style.zIndex = "3000";
    }
    const pane = map.getPane("popupAboveAll")!;
    const mapPane = map.getPanes().mapPane;

    const syncTransform = () => {
      L.DomUtil.setPosition(pane, L.DomUtil.getPosition(mapPane));
    };

    map.on("move viewreset", syncTransform);
    syncTransform();
    return () => { map.off("move viewreset", syncTransform); };
  }, [map]);
  return null;
}

/**
 * Dedicated pane for place-name label tiles at z-index 550: above the grid line
 * overlay (default overlayPane, 400) so town names stay legible over the
 * network, but below the marker pane (600) so labels never cover a node.
 */
export function LabelPaneSetup() {
  const map = useMap();
  useEffect(() => {
    if (!map.getPane("labels")) {
      const pane = map.createPane("labels");
      pane.style.zIndex = "550";
      pane.style.pointerEvents = "none";
    }
  }, [map]);
  return null;
}

/**
 * Pans to a node and opens its popup when an activity-feed card is clicked.
 *
 * Keyed off `nonce` so re-selecting the same asset re-triggers the flight.
 * Markers come from the registry that pointToLayer populates; if the asset has
 * no marker yet (layers mid-remount after a view change) this is a no-op and the
 * next click finds it, which is preferable to throwing mid-render.
 */
export function MapFocusController({
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
    map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 9), { duration: 0.6 });
    // Open after the flight settles, so the popup anchors to its final position.
    const t = setTimeout(() => marker.openPopup(), 650);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, focusAsset]);
  return null;
}

/**
 * ESI site markers, rendered only at zoom >= 8 (region-level detail). At country
 * zoom the sites overlap into an unreadable cluster, so they are withheld rather
 * than drawn as noise.
 */
export function EsiLayer({ data, lang }: { data: EsiCollection | null; lang: Lang }) {
  const [zoom, setZoom] = useState<number>(7);
  useMapEvents({ zoomend: (e) => setZoom((e.target as L.Map).getZoom()) });

  if (!data || zoom < 8) return null;

  return (
    <GeoJSON
      key="esi-sites"
      data={data as unknown as GeoJSON.GeoJsonObject}
      pointToLayer={(_f, latlng) => L.marker(latlng, { icon: esiIcon() })}
      onEachFeature={(feature, layer) => {
        const p = (feature.properties ?? {}) as EsiProps;
        layer.bindPopup(esiPopupHtml(p, lang), {
          className: "custom-popup",
          pane: "popupAboveAll",
        });
      }}
    />
  );
}
