// Typed shapes for the GeoJSON data served from /public/data.
// These intentionally describe what the app actually reads. Optional fields
// reflect that some attributes (name, operator, length_km, etc.) are absent or
// null in parts of the dataset — encoding that in the types is what catches the
// D-3/D-4 class of bug (e.g. relying on a name that may be null) at compile time.

export type Coordinate = [number, number]; // [lon, lat]

export interface FeatureCollection<G, P> {
  type: "FeatureCollection";
  features: Feature<G, P>[];
}

export interface Feature<G, P> {
  type: "Feature";
  geometry: G;
  properties: P;
}

export interface LineGeometry {
  type: "LineString";
  coordinates: Coordinate[];
}

export interface PointGeometry {
  type: "Point";
  coordinates: Coordinate;
}

// --- Transmission line properties (senegal-grid, regional-interconnections, tie-lines) ---
export interface LineProps {
  voltage_kV: number;
  length_km?: number | string | null;
  name?: string | null;
  from?: string | null;
  to?: string | null;
  operator?: string | null;
  country?: string | null;
  source?: string | null;
  status?: string | null;
  cross_border?: boolean;
}

// --- Plant / substation / regional node properties ---
export interface PlantProps {
  name: string;
  type?: string;
  fuel?: string; // "Solar" | "Wind" | "Hydro" | "Coal" | "Thermal" | "Substation" | ...
  capacity_mw?: number;
  storage_mwh?: number;
  operator?: string;
  commissioned?: string | number;
  annual_gen?: string;
  country?: string;
}

// --- Industrial off-taker properties ---
export interface ConsumerProps {
  name: string;
  type?: string;
  sector?: string;
  demand_profile?: string;
  status?: string;
}

// --- SunuPower ESI site properties ---
export interface EsiProps {
  id?: string;
  name: string;
  type?: string;
  state?: string;
  capacity_kwh: number;
  intent?: string;
}

// A node feature may be a plant/substation or a consumer; both are rendered by
// the same point layer, so the marker code accepts the union.
export type NodeProps = PlantProps & Partial<ConsumerProps>;

export type LineFeature = Feature<LineGeometry, LineProps>;
export type NodeFeature = Feature<PointGeometry, NodeProps>;
export type EsiFeature = Feature<PointGeometry, EsiProps>;

export type LineCollection = FeatureCollection<LineGeometry, LineProps>;
export type NodeCollection = FeatureCollection<PointGeometry, NodeProps>;
export type EsiCollection = FeatureCollection<PointGeometry, EsiProps>;

// The full data bundle loaded by GridMap.
export interface GridData {
  grid: LineCollection | null;
  plants: NodeCollection | null;
  regionalGrid: LineCollection | null;
  regionalNodes: NodeCollection | null;
  tieLines: LineCollection | null;
  consumers: NodeCollection | null;
  esiSites: EsiCollection | null;
}
