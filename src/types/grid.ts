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
  id?: string; // stable slug id; referenced by reliability events
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

// The full data bundle loaded by GridMap. Event collections are populated for
// the reliability layer (Phase 2) and may be null if not yet present.
export interface GridData {
  grid: LineCollection | null;
  plants: NodeCollection | null;
  regionalGrid: LineCollection | null;
  regionalNodes: NodeCollection | null;
  tieLines: LineCollection | null;
  consumers: NodeCollection | null;
  esiSites: EsiCollection | null;
  outageEvents?: EventCollection | null;
  maintenanceEvents?: EventCollection | null;
}

// ============================================================================
// RELIABILITY INTELLIGENCE LAYER (Phase 1: data model)
// ============================================================================

// Confidence tier of a reliability event, mirroring the source hierarchy in the
// design spec. The UI keeps measured/reported/modeled visually distinct so the
// map never implies certainty it doesn't have.
export type EventConfidence = "measured" | "reported" | "modeled";

export type EventType = "outage" | "constraint" | "maintenance";

export type EventSeverity = "low" | "medium" | "high" | "critical";

// A single reliability event. References the affected asset by its stable id
// (asset_ref) rather than by coordinates, so relocating a node never orphans
// its history. The geometry is carried for direct rendering convenience and
// should match the referenced asset.
export interface EventProps {
  event_id: string;
  asset_ref: string;          // stable id of a node or line
  asset_type: "node" | "line";
  event_type: EventType;
  start: string;              // ISO 8601
  end?: string | null;        // null if ongoing/unknown
  duration_min?: number | null;
  cause?: string;
  customers_affected?: number;
  severity: EventSeverity;
  planned?: boolean;          // true for scheduled maintenance
  source: string;
  confidence: EventConfidence;

  // --- System reliability indices (Phase 4) ---
  // Populated for measured utility indicators (e.g. SENELEC SAIFI/SAIDI). These
  // are aggregate, system-level figures, NOT per-node measurements — `scope`
  // records the area they describe (e.g. "Dakar system") so the UI never
  // implies node-level precision the source doesn't provide.
  saifi?: number;             // System Average Interruption Frequency Index
  saidi_min?: number;         // System Average Interruption Duration Index, minutes
  scope?: string;             // geographic scope of the index (e.g. "Dakar system")
  period?: string;            // reporting period label (e.g. "2024 H2", "2024 annual")
}

export type EventFeature = Feature<PointGeometry, EventProps>;
export type EventCollection = FeatureCollection<PointGeometry, EventProps>;

// Aggregated per-asset reliability profile, computed at runtime from events
// (Phase 2). Defined here so the type contract is fixed from Phase 1.
export interface ReliabilityProfile {
  asset_ref: string;
  event_count: number;
  total_outage_hours: number;
  reliability_score: number;  // 0–100 composite; higher = less reliable / more stressed
  worst_severity: EventSeverity | null;
  confidence: EventConfidence; // lowest tier among contributing events
}
