// Reliability Intelligence Layer — scoring & aggregation (Phase 2).
// Pure functions: given reliability events, produce per-asset profiles. Kept
// separate from the map component so the methodology is documented and testable.

import type {
  EventCollection, EventProps, EventSeverity, EventConfidence, ReliabilityProfile,
} from "@/types/grid";

// Severity weighting for the composite score. Tunable — documented here so the
// methodology is explicit rather than buried in the UI.
const SEVERITY_WEIGHT: Record<EventSeverity, number> = {
  low: 1,
  medium: 2,
  high: 4,
  critical: 7,
};

// Confidence ordering, lowest (most uncertain) first. A profile's confidence is
// the lowest tier among its contributing events, so a score built on any modeled
// data is visibly flagged as modeled.
const CONFIDENCE_RANK: Record<EventConfidence, number> = {
  modeled: 0,
  reported: 1,
  measured: 2,
};

function lowestConfidence(a: EventConfidence, b: EventConfidence): EventConfidence {
  return CONFIDENCE_RANK[a] <= CONFIDENCE_RANK[b] ? a : b;
}

function severityRank(s: EventSeverity): number {
  return SEVERITY_WEIGHT[s] ?? 0;
}

// Raw "stress" contribution of one event: outage/constraint events count for
// more than maintenance, weighted by severity and (for outages) duration.
function eventStress(p: EventProps): number {
  const sev = SEVERITY_WEIGHT[p.severity] ?? 1;
  const hours = p.duration_min != null ? p.duration_min / 60 : 0;
  // Constraints are persistent conditions, not point incidents — give them a
  // baseline stress independent of duration. Maintenance contributes lightly.
  if (p.event_type === "constraint") return sev * 3;
  if (p.event_type === "maintenance") return sev * 0.5 + hours * 0.1;
  // outage: severity plus a duration term (diminishing) so a long critical
  // outage scores high but duration doesn't run away.
  let stress = sev * 2 + Math.min(hours, 48) * 0.5;
  // SAIFI (interruption frequency) adds a frequency term for measured system
  // indicators, so a high outage-count period registers even if each outage is
  // short. Capped so it complements rather than dominates.
  if (p.saifi != null) stress += Math.min(p.saifi, 12) * 0.6;
  return stress;
}

export interface ReliabilityResult {
  profiles: Map<string, ReliabilityProfile>;
  maxScore: number; // for normalizing the heat scale in the UI
}

// Aggregate all events into per-asset reliability profiles. `windowYears`
// Year filter for the time slider. "all" aggregates the full history; a number
// restricts to events that started in that calendar year. Constraint events are
// persistent grid conditions (not point-in-time incidents), so they are always
// included regardless of the selected year.
export type YearFilter = number | "all";

export function computeReliability(
  outage: EventCollection | null,
  maintenance: EventCollection | null,
  year: YearFilter = "all",
  confidence?: Set<EventConfidence>,
): ReliabilityResult {
  const all: EventProps[] = [
    ...(outage?.features ?? []).map((f) => f.properties),
    ...(maintenance?.features ?? []).map((f) => f.properties),
  ];

  const inYear = (p: EventProps): boolean => {
    if (year === "all") return true;
    if (p.event_type === "constraint") return true; // persistent condition
    const d = new Date(p.start);
    return !isNaN(d.getTime()) && d.getUTCFullYear() === year;
  };

  // Data-confidence filter: when provided, only events whose confidence tier is
  // in the set contribute to the heat. Lets a viewer strip the map down to hard
  // (measured) evidence, or exclude modeled estimates. Undefined = include all.
  const inConfidence = (p: EventProps): boolean =>
    !confidence || confidence.has(p.confidence);

  const acc = new Map<string, {
    count: number; hours: number; stress: number;
    worst: EventSeverity | null; conf: EventConfidence;
  }>();

  for (const p of all) {
    if (!p.asset_ref) continue;
    if (!inYear(p)) continue;
    if (!inConfidence(p)) continue;

    const cur = acc.get(p.asset_ref) ?? {
      count: 0, hours: 0, stress: 0, worst: null as EventSeverity | null, conf: "measured" as EventConfidence,
    };
    cur.count += 1;
    if (p.event_type === "outage" && p.duration_min != null) cur.hours += p.duration_min / 60;
    cur.stress += eventStress(p);
    if (cur.worst == null || severityRank(p.severity) > severityRank(cur.worst)) cur.worst = p.severity;
    cur.conf = cur.count === 1 ? p.confidence : lowestConfidence(cur.conf, p.confidence);
    acc.set(p.asset_ref, cur);
  }

  // Normalize stress to a 0–100 score using a soft curve so a single bad asset
  // doesn't flatten everything else. The max raw stress maps near 100.
  const maxStress = Math.max(1, ...Array.from(acc.values()).map((a) => a.stress));
  const profiles = new Map<string, ReliabilityProfile>();
  Array.from(acc.entries()).forEach(([ref, a]) => {
    const score = Math.round((a.stress / maxStress) * 100);
    profiles.set(ref, {
      asset_ref: ref,
      event_count: a.count,
      total_outage_hours: Math.round(a.hours * 10) / 10,
      reliability_score: score,
      worst_severity: a.worst,
      confidence: a.conf,
    });
  });

  const maxScore = Math.max(0, ...Array.from(profiles.values()).map((p) => p.reliability_score));
  return { profiles, maxScore };
}

// Map a 0–100 reliability/stress score to a calm green→amber→red heat color.
// Higher score = more stressed = redder. Tuned for the dark Esri canvas.
export function heatColor(score: number): string {
  const s = Math.max(0, Math.min(100, score));
  if (s >= 75) return "#EF4444"; // critical — red
  if (s >= 50) return "#F97316"; // high — orange-red
  if (s >= 25) return "#F59E0B"; // medium — amber
  if (s > 0) return "#FACC15";   // low — yellow
  return "#3B82F6";              // no events — calm blue (baseline)
}

// Marker radius (px) scaled by score so size is a redundant channel alongside
// color (color-blind safety). Baseline assets stay small.
export function heatRadius(score: number): number {
  return 8 + Math.round((Math.max(0, Math.min(100, score)) / 100) * 14); // 8–22px
}

// Distinct calendar years present among outage/maintenance events (constraints
// excluded — they're year-agnostic), ascending. Drives the time-slider ticks.
export function availableYears(
  outage: EventCollection | null,
  maintenance: EventCollection | null,
): number[] {
  const years = new Set<number>();
  const scan = (fc: EventCollection | null) => {
    (fc?.features ?? []).forEach((f) => {
      const p = f.properties;
      if (p.event_type === "constraint") return;
      const d = new Date(p.start);
      if (!isNaN(d.getTime())) years.add(d.getUTCFullYear());
    });
  };
  scan(outage);
  scan(maintenance);
  return Array.from(years).sort((a, b) => a - b);
}

// A measured system reliability indicator (SAIFI / SAIDI) reported for a scope
// (e.g. "Dakar system") over a period. These are aggregate, utility-grade indices
// carried on `measured` events, NOT per-node values — the scope is always shown
// so the map never implies node-level precision the source doesn't provide.
export interface MeasuredIndex {
  scope: string;
  period: string;
  saifi?: number;      // interruptions per customer over the period
  saidi_min?: number;  // interruption minutes per customer over the period
  start: string;       // ISO period start, for ordering
  confidence: EventConfidence;
}

// Extract measured SAIFI/SAIDI indicators, one series per scope, newest first.
// Only `measured` events carrying an index are considered — reported/modeled
// events never produce an "index" (that would overstate certainty). Returns a
// map of scope → chronological series (oldest→newest) so the UI can show the
// latest value plus its trend.
export function measuredIndicesByScope(
  outage: EventCollection | null,
): Map<string, MeasuredIndex[]> {
  const byScope = new Map<string, MeasuredIndex[]>();
  (outage?.features ?? []).forEach((f) => {
    const p = f.properties;
    if (p.confidence !== "measured") return;
    if (p.saifi == null && p.saidi_min == null) return;
    if (!p.scope || !p.period) return;
    const entry: MeasuredIndex = {
      scope: p.scope, period: p.period, saifi: p.saifi,
      saidi_min: p.saidi_min, start: p.start, confidence: p.confidence,
    };
    const arr = byScope.get(p.scope) ?? [];
    arr.push(entry);
    byScope.set(p.scope, arr);
  });
  // Sort each scope's series oldest→newest by period start.
  Array.from(byScope.values()).forEach((arr) =>
    arr.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()));
  return byScope;
}
