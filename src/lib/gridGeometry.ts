// Geometry helpers for the grid layers: distance, and endpoint snapping.
//
// Pulled out of the map component so the snapping rule — the one piece of the
// render path that actually modifies source coordinates — is isolated, readable
// and testable rather than buried inside a useMemo.

import type { Coordinate, LineFeature, NodeFeature, LineCollection, GridData } from "@/types/grid";

// Never relocate a line endpoint farther than this. Endpoints land on their
// substation marker without the routes themselves being distorted; a line whose
// true terminus is 20km from any known node stays where the data put it.
export const SNAP_TOLERANCE_KM = 3;

/** Great-circle distance in km between two [lon, lat] points. */
export function haversineKm(a: Coordinate, b: Coordinate): number {
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
}

/**
 * Move a line's first and last coordinate onto the nearest node, but only when
 * that node is within SNAP_TOLERANCE_KM. Interior vertices are never touched.
 */
function snapLine(line: LineFeature, nodeCoords: Coordinate[]): LineFeature {
  if (line.geometry.type !== "LineString") return line;

  const coords: Coordinate[] = [...line.geometry.coordinates];
  [0, coords.length - 1].forEach((idx) => {
    const pt = coords[idx];
    let closest: Coordinate | null = null;
    let minDist = SNAP_TOLERANCE_KM;
    for (const node of nodeCoords) {
      const d = haversineKm(pt, node);
      if (d < minDist) { minDist = d; closest = node; }
    }
    if (closest) coords[idx] = closest;
  });

  return { ...line, geometry: { ...line.geometry, coordinates: coords } } as LineFeature;
}

const snapCollection = (fc: LineCollection | null, nodes: Coordinate[]): LineCollection | null =>
  fc ? { ...fc, features: fc.features.map((f) => snapLine(f, nodes)) } : null;

/**
 * Apply endpoint snapping across every line collection, using all point layers
 * (plants, regional nodes, consumers) as snap targets. Returns the input
 * unchanged if the datasets needed to snap against haven't loaded yet.
 */
export function snapGridToNodes(data: GridData): GridData {
  if (!data.grid || !data.plants) return data;

  const nodeCoords: Coordinate[] = [
    ...(data.plants?.features ?? []),
    ...(data.regionalNodes?.features ?? []),
    ...(data.consumers?.features ?? []),
  ].map((n: NodeFeature) => n.geometry.coordinates as Coordinate);

  return {
    ...data,
    grid: snapCollection(data.grid, nodeCoords),
    regionalGrid: snapCollection(data.regionalGrid, nodeCoords),
    tieLines: snapCollection(data.tieLines, nodeCoords),
  };
}
