"use client";

// Grid Activity Feed — a tall, toggleable right-side panel that surfaces grid
// maintenance and reliability events chronologically (Ahead / Current / Past).
// Maintenance-led: the planned-maintenance schedule is the primary content;
// outage/constraint incidents are present but visually secondary and can be
// collapsed. Search + filters answer "query old events".
//
// The panel fetches the same static event files the map uses (browser-cached),
// plus the node/plant files to resolve asset_ref → display name, so a card never
// shows a bare slug. Honest-provenance posture is preserved: every card shows the
// confidence tier and source verbatim.

import { useEffect, useMemo, useState, useCallback } from "react";
import { X, Search, CalendarClock, Radio, History, Wrench, Zap, ChevronDown } from "lucide-react";
import type {
  EventCollection, EventType, EventSeverity, EventConfidence, NodeCollection,
} from "@/types/grid";
import {
  buildFeedEvents, buildFeedSections, defaultFilters,
  type FeedEvent, type FeedFilters,
} from "@/lib/feed";

export interface FeedStrings {
  feedTitle: string;
  feedSubtitle: string;
  searchPlaceholder: string;
  ahead: string;
  current: string;
  past: string;
  noEvents: string;
  noMatch: string;
  showIncidents: string;       // toggle label for the secondary outage section
  hideIncidents: string;
  typeMaintenance: string;
  typeOutage: string;
  typeConstraint: string;
  ongoing: string;
  plannedTag: string;
  customersAffected: string;
  filtersLabel: string;
  closeLabel: string;
  confMeasured: string;
  confReported: string;
  confModeled: string;
  locale: string;              // "en-US" | "fr-FR" for date formatting
}

const SEVERITY_COLOR: Record<EventSeverity, string> = {
  low: "#FACC15",
  medium: "#F59E0B",
  high: "#F97316",
  critical: "#EF4444",
};

const CONFIDENCE_COLOR: Record<EventConfidence, string> = {
  measured: "#22C55E",
  reported: "#F59E0B",
  modeled: "#9DA2B3",
};

// Format an event's time range for display. Single-day events show the date and
// a start→end time; multi-day show date→date. All in UTC to match the data.
function formatRange(startMs: number, endMs: number | null, locale: string, ongoing: string): string {
  const start = new Date(startMs);
  const dateOpts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" };
  const timeOpts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", timeZone: "UTC", hour12: false };
  const startDate = start.toLocaleDateString(locale, dateOpts);
  if (endMs == null) {
    return `${startDate} · ${start.toLocaleTimeString(locale, timeOpts)} → ${ongoing}`;
  }
  const end = new Date(endMs);
  const sameDay = start.toISOString().slice(0, 10) === end.toISOString().slice(0, 10);
  if (sameDay) {
    return `${startDate} · ${start.toLocaleTimeString(locale, timeOpts)}–${end.toLocaleTimeString(locale, timeOpts)} UTC`;
  }
  return `${startDate} → ${end.toLocaleDateString(locale, dateOpts)}`;
}

function typeLabel(t: EventType, s: FeedStrings): string {
  if (t === "maintenance") return s.typeMaintenance;
  if (t === "outage") return s.typeOutage;
  return s.typeConstraint;
}

// One event card. Maintenance and incidents share the card but differ in accent:
// maintenance uses a neutral wrench accent; incidents use the severity color.
function EventCard({ e, s, onFocus }: { e: FeedEvent; s: FeedStrings; onFocus?: (assetRef: string) => void }) {
  const p = e.props;
  const isMaint = p.event_type === "maintenance";
  const accent = isMaint ? "#9DA2B3" : SEVERITY_COLOR[p.severity];
  const confColor = CONFIDENCE_COLOR[p.confidence];

  return (
    <button
      type="button"
      onClick={() => onFocus?.(p.asset_ref)}
      className="w-full text-left rounded-lg border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/15 transition-all px-3.5 py-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-sunu-blue/60"
    >
      <div className="flex items-start gap-2.5">
        <span
          className="mt-1 w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: accent, boxShadow: `0 0 7px ${accent}99` }}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            {isMaint
              ? <Wrench className="w-3 h-3 text-sunu-space shrink-0" aria-hidden="true" />
              : <Zap className="w-3 h-3 shrink-0" style={{ color: accent }} aria-hidden="true" />}
            <span className="text-[10px] uppercase tracking-[0.14em] font-bold text-sunu-space truncate">
              {typeLabel(p.event_type, s)}
            </span>
            {p.planned && (
              <span className="text-[8.5px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-white/[0.06] text-sunu-space shrink-0">
                {s.plannedTag}
              </span>
            )}
          </div>
          <div className="text-[13px] font-semibold text-sunu-cloud leading-tight truncate">{e.assetName}</div>
          {p.cause && <div className="text-[12px] text-sunu-space leading-snug mt-0.5">{p.cause}</div>}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-[10.5px] text-sunu-graphite font-mono">
              {formatRange(e.startMs, e.endMs, s.locale, s.ongoing)}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span
              className="text-[8.5px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider"
              style={{ background: `${confColor}22`, color: confColor }}
            >
              {p.confidence === "measured" ? s.confMeasured : p.confidence === "reported" ? s.confReported : s.confModeled}
            </span>
            {typeof p.customers_affected === "number" && (
              <span className="text-[10px] text-sunu-graphite">
                {p.customers_affected.toLocaleString(s.locale)} {s.customersAffected}
              </span>
            )}
            {p.source && <span className="text-[10px] text-sunu-graphite/80 italic truncate">{p.source}</span>}
          </div>
        </div>
      </div>
    </button>
  );
}

// A time section (Ahead / Current / Past) with its icon, count, and cards.
// Within a section, maintenance cards render first (maintenance-led), then any
// incidents under a collapsible sub-header.
function FeedSection({
  title, icon, events, s, showIncidents, onFocus, accent,
}: {
  title: string;
  icon: React.ReactNode;
  events: FeedEvent[];
  s: FeedStrings;
  showIncidents: boolean;
  onFocus?: (assetRef: string) => void;
  accent: string;
}) {
  const maintenance = events.filter((e) => e.props.event_type === "maintenance");
  const incidents = events.filter((e) => e.props.event_type !== "maintenance");
  if (events.length === 0) return null;

  return (
    <section className="mb-6" aria-label={title}>
      <div className="flex items-center gap-2 mb-3 sticky top-0 z-10 pt-3 pb-2 -mx-5 px-5" style={{ background: "rgba(19,19,26,0.82)", backdropFilter: "blur(16px) saturate(160%)", WebkitBackdropFilter: "blur(16px) saturate(160%)" }}>
        <span style={{ color: accent }} aria-hidden="true">{icon}</span>
        <h3 className="text-[11px] uppercase tracking-[0.18em] font-bold text-sunu-cloud">{title}</h3>
        <span className="text-[10px] font-mono text-sunu-graphite ml-auto">{events.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {maintenance.map((e) => <EventCard key={e.props.event_id} e={e} s={s} onFocus={onFocus} />)}
        {showIncidents && incidents.map((e) => <EventCard key={e.props.event_id} e={e} s={s} onFocus={onFocus} />)}
        {!showIncidents && incidents.length > 0 && (
          <div className="text-[10.5px] text-sunu-graphite/70 italic px-1 pt-0.5">
            +{incidents.length} {s.typeOutage.toLowerCase()} / {s.typeConstraint.toLowerCase()} ({s.showIncidents.toLowerCase()})
          </div>
        )}
      </div>
    </section>
  );
}

export function GridActivityFeed({
  open, onClose, year, strings, onFocusAsset,
}: {
  open: boolean;
  onClose: () => void;
  year: number | "all";
  strings: FeedStrings;
  onFocusAsset?: (assetRef: string) => void;
}) {
  const s = strings;
  const [outage, setOutage] = useState<EventCollection | null>(null);
  const [maintenance, setMaintenance] = useState<EventCollection | null>(null);
  const [assetNames, setAssetNames] = useState<Map<string, string>>(new Map());
  const [filters, setFilters] = useState<FeedFilters>(defaultFilters());
  const [showIncidents, setShowIncidents] = useState(true);

  // Load events + asset-name lookup once (browser-cached from the map's own fetch).
  useEffect(() => {
    let cancelled = false;
    const nameFiles = [
      "/data/senegal-plants.json",
      "/data/regional-nodes.json",
      "/data/industrial-consumers.json",
    ];
    Promise.all([
      fetch("/data/outage-events.json").then((r) => r.json()).catch(() => null),
      fetch("/data/maintenance-events.json").then((r) => r.json()).catch(() => null),
      ...nameFiles.map((u) => fetch(u).then((r) => r.json()).catch(() => null)),
    ]).then(([o, m, ...nodeColls]) => {
      if (cancelled) return;
      setOutage(o as EventCollection | null);
      setMaintenance(m as EventCollection | null);
      const names = new Map<string, string>();
      (nodeColls as (NodeCollection | null)[]).forEach((fc) => {
        (fc?.features ?? []).forEach((f) => {
          const p = f.properties;
          if (p.id && p.name) names.set(p.id, p.name);
        });
      });
      setAssetNames(names);
    });
    return () => { cancelled = true; };
  }, []);

  // Keep the feed's year scope in sync with the map's time slider.
  useEffect(() => {
    setFilters((prev) => (prev.year === year ? prev : { ...prev, year }));
  }, [year]);

  const allEvents = useMemo(
    () => buildFeedEvents(outage, maintenance, assetNames),
    [outage, maintenance, assetNames],
  );
  const sections = useMemo(() => buildFeedSections(allEvents, filters), [allEvents, filters]);

  const setQuery = useCallback((q: string) => setFilters((p) => ({ ...p, query: q })), []);

  const toggleType = useCallback((t: EventType) => {
    setFilters((p) => {
      const next = new Set(p.types);
      if (next.has(t)) next.delete(t); else next.add(t);
      if (next.size === 0) next.add(t); // never allow an empty type set
      return { ...p, types: next };
    });
  }, []);

  const typeChips: { t: EventType; label: string }[] = [
    { t: "maintenance", label: s.typeMaintenance },
    { t: "outage", label: s.typeOutage },
    { t: "constraint", label: s.typeConstraint },
  ];

  const empty = sections.totalMatched === 0;
  const hasFilterOrQuery = filters.query.trim().length > 0 || filters.types.size < 3;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={s.feedTitle}
      aria-hidden={!open}
      className={`absolute top-0 right-0 h-full z-[2500] w-full max-w-[400px] transition-transform duration-300 ease-out ${open ? "translate-x-0" : "translate-x-full"}`}
      style={{
        background: "rgba(14,14,18,0.75)",
        backdropFilter: "blur(18px) saturate(160%)",
        WebkitBackdropFilter: "blur(18px) saturate(160%)",
        borderLeft: "1px solid rgba(255,255,255,0.10)",
        boxShadow: "-8px 0 32px rgba(0,0,0,0.40)",
      }}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="shrink-0 px-5 pt-5 pb-4 border-b border-white/[0.08]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm uppercase tracking-[0.22em] font-bold text-sunu-cloud leading-tight">{s.feedTitle}</h2>
              <p className="text-[11px] text-sunu-space mt-1 leading-snug">{s.feedSubtitle}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={s.closeLabel}
              className="shrink-0 p-1.5 rounded-lg hover:bg-white/[0.08] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sunu-blue/60"
            >
              <X className="w-4 h-4 text-sunu-space" aria-hidden="true" />
            </button>
          </div>

          {/* Search */}
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-sunu-graphite" aria-hidden="true" />
            <input
              type="text"
              value={filters.query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={s.searchPlaceholder}
              aria-label={s.searchPlaceholder}
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-[13px] text-sunu-cloud placeholder:text-sunu-graphite/70 focus:outline-none focus:border-sunu-blue/60 transition-colors"
            />
          </div>

          {/* Type filter chips */}
          <div className="flex items-center gap-1.5 mt-3" role="group" aria-label={s.filtersLabel}>
            {typeChips.map(({ t, label }) => {
              const active = filters.types.has(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleType(t)}
                  aria-pressed={active}
                  className={`text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded border transition-all ${
                    active
                      ? "bg-sunu-blue/15 border-sunu-blue/40 text-sunu-blue"
                      : "bg-white/[0.02] border-white/10 text-sunu-graphite hover:border-white/20"
                  }`}
                >
                  {label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setShowIncidents((v) => !v)}
              aria-pressed={showIncidents}
              className="ml-auto flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-sunu-graphite hover:text-sunu-space transition-colors"
            >
              <ChevronDown className={`w-3 h-3 transition-transform ${showIncidents ? "" : "-rotate-90"}`} aria-hidden="true" />
              {showIncidents ? s.hideIncidents : s.showIncidents}
            </button>
          </div>
        </div>

        {/* Scrollable feed */}
        <div className="flex-1 overflow-y-auto px-5 pt-0 pb-4 min-h-0">
          {empty ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <CalendarClock className="w-8 h-8 text-sunu-graphite/50 mb-3" aria-hidden="true" />
              <p className="text-[12px] text-sunu-space">{hasFilterOrQuery ? s.noMatch : s.noEvents}</p>
            </div>
          ) : (
            <>
              <FeedSection title={s.ahead} icon={<CalendarClock className="w-3.5 h-3.5" />} events={sections.ahead} s={s} showIncidents={showIncidents} onFocus={onFocusAsset} accent="#2579fc" />
              <FeedSection title={s.current} icon={<Radio className="w-3.5 h-3.5" />} events={sections.current} s={s} showIncidents={showIncidents} onFocus={onFocusAsset} accent="#22C55E" />
              <FeedSection title={s.past} icon={<History className="w-3.5 h-3.5" />} events={sections.past} s={s} showIncidents={showIncidents} onFocus={onFocusAsset} accent="#9DA2B3" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
