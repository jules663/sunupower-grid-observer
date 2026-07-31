// Marker icon construction for the point layers.
//
// Both views draw the same set of nodes but encode entirely different things:
// infrastructure encodes asset type (fuel color, consumer hexagon), reliability
// encodes stress (heat color, radius). Keeping both builders side by side here
// makes that divergence explicit instead of hiding it behind a branch halfway
// down a pointToLayer callback.

import L from "leaflet";
import type { NodeProps } from "@/types/grid";
import { heatColor, heatRadius } from "@/lib/reliability";

export const FUEL_COLOR: Record<string, string> = {
  Wind: "#66BB6A",
  Solar: "#FDA206",
  Coal: "#EF5350",
  Hydro: "#42A5F5",
  Substation: "#6E7180",
};
const DEFAULT_FUEL_COLOR = "#2579fc"; // thermal / oil
const CONSUMER_COLOR = "#E91E63";

export const isConsumerNode = (p: NodeProps): boolean => p.demand_profile !== undefined;

/**
 * Infrastructure-view icon: color by fuel, shape by role.
 *
 * Consumers draw as a hexagon via clip-path on an inner element, with the glow
 * applied to a wrapper as a drop-shadow. Applying a border directly to a
 * clip-path element deforms it at the vertices, so the wrapper is load-bearing,
 * not decorative.
 */
export function infrastructureIcon(p: NodeProps): L.DivIcon {
  const consumer = isConsumerNode(p);
  const color = consumer ? CONSUMER_COLOR : (FUEL_COLOR[p.fuel ?? ""] ?? DEFAULT_FUEL_COLOR);
  const size = consumer ? 14 : p.fuel === "Substation" ? 8 : 12;

  const html = consumer
    ? `<div style="width:${size}px;height:${size}px;filter:drop-shadow(0 0 5px ${color}CC) drop-shadow(0 0 1px rgba(255,255,255,0.65));"><div style="background-color:${color};width:100%;height:100%;clip-path:polygon(25% 0%,75% 0%,100% 50%,75% 100%,25% 100%,0% 50%);"></div></div>`
    : `<div style="background-color: ${color}; width: ${size}px; height: ${size}px; border: 2px solid rgba(255,255,255,1); border-radius: 50%; box-shadow: 0 0 15px ${color}CC;"></div>`;

  return L.divIcon({
    className: "custom-div-icon",
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/**
 * Reliability-view icon: color AND size both driven by the stress score, so the
 * signal survives color-blindness. Assets with no events render at the calm
 * baseline rather than disappearing.
 */
export function reliabilityIcon(score: number): L.DivIcon {
  const color = heatColor(score);
  const d = heatRadius(score);
  const ring = score > 0 ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.45)";
  const html = `<div style="background-color:${color};width:${d}px;height:${d}px;border:2px solid ${ring};border-radius:50%;box-shadow:0 0 ${Math.round(d * 0.9)}px ${color}AA;"></div>`;
  return L.divIcon({
    className: "custom-div-icon",
    html,
    iconSize: [d, d],
    iconAnchor: [d / 2, d / 2],
  });
}

/** ESI site icon — amber diamond, distinct from every grid asset shape. */
export function esiIcon(): L.DivIcon {
  const html = `<div style="width:16px;height:16px;filter:drop-shadow(0 0 6px #F59E0BCC) drop-shadow(0 0 1.5px rgba(255,255,255,0.55));"><div style="background-color:#F59E0B;width:100%;height:100%;clip-path:polygon(50% 0%,100% 50%,50% 100%,0% 50%);"></div></div>`;
  return L.divIcon({
    className: "custom-div-icon",
    html,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -8],
  });
}

/**
 * Leaflet's default marker images resolve to bundler-relative paths that break
 * under Next's asset pipeline. Point them at a CDN once, at startup.
 */
export function setupDefaultIcons(): void {
  if (typeof window === "undefined") return;
  delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  });
}
