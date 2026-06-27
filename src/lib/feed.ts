// Grid Activity Feed — chronological event organization (pure functions).
// The map answers "where"; this answers "when". Events are classified relative
// to a reference instant (now) into Ahead / Current / Past, then filtered and
// searched. Kept separate from the panel component so the logic is testable and
// the methodology is explicit.
//
// Posture note: the feed reports events exactly as the data states them. It does
// not infer, predict, or upgrade confidence. A "reported" planned-maintenance
// entry stays "reported" in the feed. Future-dated events are shown only because
// they are present in the data with a future `start`, never synthesized here.

import type {
  EventCollection, EventProps, EventType, EventSeverity, EventConfidence,
} from "@/types/grid";

// Where an event sits relative to the reference instant.
export type FeedBucket = "ahead" | "current" | "past";

// One feed-ready event: the raw properties plus the resolved display name of the
// referenced asset and its computed bucket. asset_ref is resolved to a name via
// the lookup passed in from the map data, so the feed never shows a bare slug.
export interface FeedEvent {
  props: EventProps;
  assetName: string;
  bucket: FeedBucket;
  startMs: number;
  endMs: number | null;
}

export interface FeedFilters {
  query: string;                       // free-text over asset name + cause + source
  types: Set<EventType>;               // which event types to include
  severities: Set<EventSeverity>;      // which severities to include
  confidences: Set<EventConfidence>;   // which confidence tiers to include
  year: number | "all";                // calendar-year scope (shared with the map slider)
}

export interface FeedSections {
  ahead: FeedEvent[];
  current: FeedEvent[];
  past: FeedEvent[];
  totalMatched: number;
}

// Classify one event relative to `nowMs`.
//   current: start <= now <= end (or start <= now and no end → treated as ongoing)
//   ahead:   start > now (not yet begun)
//   past:    end < now (fully concluded)
function classify(startMs: number, endMs: number | null, nowMs: number): FeedBucket {
  if (startMs > nowMs) return "ahead";
  // started at or before now
  if (endMs == null) return "current"; // ongoing / open-ended
  if (endMs >= nowMs) return "current";
  return "past";
}

// Build the full feed-ready event list from the raw collections. Constraint
// events are persistent conditions with no meaningful end, so they are treated
// as ongoing (current) unless they carry an explicit end in the past.
export function buildFeedEvents(
  outage: EventCollection | null,
  maintenance: EventCollection | null,
  assetNames: Map<string, string>,
  now: Date = new Date(),
): FeedEvent[] {
  const nowMs = now.getTime();
  const raw: EventProps[] = [
    ...(maintenance?.features ?? []).map((f) => f.properties),
    ...(outage?.features ?? []).map((f) => f.properties),
  ];

  const out: FeedEvent[] = [];
  for (const p of raw) {
    const startDate = new Date(p.start);
    const startMs = startDate.getTime();
    if (isNaN(startMs)) continue; // skip events with an unparseable start
    const endMs = p.end ? (isNaN(new Date(p.end).getTime()) ? null : new Date(p.end).getTime()) : null;
    out.push({
      props: p,
      assetName: assetNames.get(p.asset_ref) ?? p.asset_ref,
      bucket: classify(startMs, endMs, nowMs),
      startMs,
      endMs,
    });
  }
  return out;
}

function matchesFilters(e: FeedEvent, f: FeedFilters): boolean {
  const p = e.props;
  if (!f.types.has(p.event_type)) return false;
  if (!f.severities.has(p.severity)) return false;
  if (!f.confidences.has(p.confidence)) return false;

  // Year scope mirrors the map slider. Constraints are year-agnostic (persistent
  // conditions), so they pass any specific-year filter.
  if (f.year !== "all" && p.event_type !== "constraint") {
    const y = new Date(p.start).getUTCFullYear();
    if (y !== f.year) return false;
  }

  const q = f.query.trim().toLowerCase();
  if (q) {
    const hay = `${e.assetName} ${p.cause ?? ""} ${p.source ?? ""} ${p.event_type}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

// Maintenance-led ordering: within a section, planned maintenance sorts before
// outage/constraint at the same time, so the maintenance schedule reads as the
// primary content and reliability incidents as secondary context.
function typeRank(t: EventType): number {
  if (t === "maintenance") return 0;
  return 1; // outage / constraint
}

// Apply filters and split into the three time sections. Sorting per section:
//   ahead   — soonest first (the next thing coming up is at the top)
//   current — soonest-started first
//   past    — most recent first (reverse chronological history)
// Maintenance-led tiebreak within equal timestamps.
export function buildFeedSections(
  events: FeedEvent[],
  filters: FeedFilters,
): FeedSections {
  const matched = events.filter((e) => matchesFilters(e, filters));

  const ahead = matched.filter((e) => e.bucket === "ahead").sort((a, b) =>
    a.startMs - b.startMs || typeRank(a.props.event_type) - typeRank(b.props.event_type));

  const current = matched.filter((e) => e.bucket === "current").sort((a, b) =>
    a.startMs - b.startMs || typeRank(a.props.event_type) - typeRank(b.props.event_type));

  const past = matched.filter((e) => e.bucket === "past").sort((a, b) =>
    b.startMs - a.startMs || typeRank(a.props.event_type) - typeRank(b.props.event_type));

  return { ahead, current, past, totalMatched: matched.length };
}

// Convenience: the default "everything on" filter state.
export function defaultFilters(): FeedFilters {
  return {
    query: "",
    types: new Set<EventType>(["maintenance", "outage", "constraint"]),
    severities: new Set<EventSeverity>(["low", "medium", "high", "critical"]),
    confidences: new Set<EventConfidence>(["measured", "reported", "modeled"]),
    year: "all",
  };
}
