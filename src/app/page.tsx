"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { Info, Layers, CalendarClock } from "lucide-react";
import type { GridStats } from "@/components/map/GridMap";
import { ContextPanel, Legend, ReliabilityLegend, MeasuredIndicesPanel } from "@/components/ui/panels";
import { ViewToggle } from "@/components/ui/ViewToggle";
import { GridActivityFeed, type FeedStrings } from "@/components/ui/GridActivityFeed";
import type { EventConfidence, EventSeverity } from "@/types/grid";
import type { MeasuredIndex } from "@/lib/reliability";
import { GridDataProvider, useGridData } from "@/lib/GridDataContext";
import { useUrlState, type UrlState } from "@/lib/useUrlState";
import { summarizeActivity } from "@/lib/feed";
import { getTranslations } from "@/lib/translations";
import { POLL_INTERVAL_MS } from "@/lib/GridDataContext";

const GridMap = dynamic(() => import("@/components/map/GridMap"), {
  ssr: false,
});

// Canonical definitions now live in @/types/grid so shared modules can reference
// them without importing from a route file. Re-exported here for existing imports.
export type { GridFilter, ViewMode } from "@/types/grid";
import type { GridFilter, ViewMode } from "@/types/grid";

// Defaults, also used to keep the URL clean (a value equal to its default is
// omitted from the query string).
const URL_DEFAULTS: UrlState = { lang: "EN", filter: "ALL", view: "reliability" };

// Severity → badge color, matching the feed's own severity palette.
const BADGE_COLOR: Record<EventSeverity, string> = {
  low: "#FACC15",
  medium: "#F59E0B",
  high: "#F97316",
  critical: "#EF4444",
};

// Count pill on the Activity button. Rendered only when something is actually in
// progress, so an empty badge never implies activity that isn't there.
//
// `severity` is null when everything currently in progress is a persistent
// constraint. In that case the badge stays neutral graphite and does not pulse:
// the count is still worth showing, but a long-standing structural limit should
// not be dressed up as a live alarm.
// Animated dot indicating live-data status next to the Activity button.
//   green + pulse  → data is fresh (updated within the last poll window)
//   amber          → last poll failed; events may be stale
//   hidden         → data not yet loaded
function LivePulse({ lastUpdated, eventsError }: { lastUpdated: Date | null; eventsError: boolean }) {
  if (!lastUpdated) return null;
  if (eventsError) {
    return (
      <span
        className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] shrink-0"
        title="Event data may be stale"
        aria-hidden="true"
      />
    );
  }
  return (
    <span
      className="w-1.5 h-1.5 rounded-full bg-[#22C55E] shrink-0"
      style={{ animation: "live-pulse 2.8s ease-in-out infinite" }}
      aria-hidden="true"
    />
  );
}

function ActivityBadge({ count, severity }: { count: number; severity: EventSeverity | null }) {
  if (count <= 0) return null;
  const color = severity ? BADGE_COLOR[severity] : "#9DA2B3";
  const urgent = severity === "high" || severity === "critical";
  return (
    <span
      aria-hidden="true"
      className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full text-[10px] font-bold leading-none tabular-nums"
      style={{
        background: color,
        color: "#0E0E12",
        boxShadow: `0 0 10px ${color}99`,
        animation: urgent ? "activity-badge-pulse 2.4s ease-in-out infinite" : undefined,
      }}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

// The provider wraps the page so GridMap and GridActivityFeed share one fetch of
// the static datasets instead of each running their own waterfall.
export default function Home() {
  return (
    <GridDataProvider>
      <HomeContent />
    </GridDataProvider>
  );
}

function HomeContent() {
  const [lang, setLang] = useState<"EN" | "FR">(URL_DEFAULTS.lang);
  const [filter, setFilter] = useState<GridFilter>(URL_DEFAULTS.filter);
  const [view, setView] = useState<ViewMode>(URL_DEFAULTS.view);

  // Persist view/filter/lang in the query string so a refresh keeps the current
  // view and a shared link opens the same one.
  const applyUrlState = useCallback((s: Partial<UrlState>) => {
    if (s.lang) setLang(s.lang);
    if (s.filter) setFilter(s.filter);
    if (s.view) setView(s.view);
  }, []);
  useUrlState({ lang, filter, view }, applyUrlState, URL_DEFAULTS);

  // Live-event count + polling state for the Activity button.
  const { data: gridData, lastUpdated, eventsError } = useGridData();
  const activity = useMemo(
    () => summarizeActivity(gridData.outageEvents ?? null, gridData.maintenanceEvents ?? null),
    [gridData.outageEvents, gridData.maintenanceEvents],
  );

  const [mobilePanel, setMobilePanel] = useState<null | "context" | "legend">(null);
  const [stats, setStats] = useState<GridStats | null>(null);
  const [feedOpen, setFeedOpen] = useState(false);
  // The activity feed runs on its own Ahead/Current/Past time axis (relative to
  // now) and is intentionally decoupled from the map's year slider — the slider
  // filters the map heat by calendar year, a different time model. Coupling the
  // two made past-year events appear under "Current", which was misleading.
  // Feed card → map focus: the asset to pan to, with a nonce so clicking the same
  // card again re-triggers the focus animation.
  const [focusAsset, setFocusAsset] = useState<string | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);
  const handleFocusAsset = useCallback((assetRef: string) => {
    setFocusAsset(assetRef);
    setFocusNonce((n) => n + 1);
    // On mobile the Activity panel is full-width and covers the map, so closing
    // it on selection reveals the focused node + its popup. On desktop (lg+) the
    // panel is a side column with the map beside it, so keep it open for browsing.
    if (typeof window !== "undefined" && !window.matchMedia("(min-width: 1024px)").matches) {
      setFeedOpen(false);
    }
  }, []);

  const handleStats = useCallback((s: GridStats) => setStats(s), []);

  // Data-confidence filter (reliability view): which tiers heat the map. All on
  // by default; toggling lets a viewer strip to measured evidence. Guarded so the
  // last active tier can't be turned off (an empty map is not a useful state).
  const [confidenceFilter, setConfidenceFilter] = useState<Set<EventConfidence>>(
    new Set<EventConfidence>(["measured", "reported", "modeled"]),
  );
  const handleToggleConfidence = useCallback((tier: EventConfidence) => {
    setConfidenceFilter((prev) => {
      const next = new Set(prev);
      if (next.has(tier)) next.delete(tier); else next.add(tier);
      if (next.size === 0) next.add(tier); // never allow an empty set
      return next;
    });
  }, []);

  // Measured SAIFI/SAIDI indices emitted by the map once events load.
  const [indices, setIndices] = useState<Map<string, MeasuredIndex[]>>(new Map());
  const handleIndices = useCallback((m: Map<string, MeasuredIndex[]>) => setIndices(m), []);
  // First scope's series for the indicator panel (currently the Dakar system).
  const indexSeries = Array.from(indices.values())[0] ?? [];

  // Localized display strings for the computed stats; em dash while loading.
  const kmDisplay = stats ? stats.totalKm.toLocaleString(lang === "EN" ? "en-US" : "fr-FR") : "…";
  const nodeDisplay = stats ? String(stats.nodeCount) : "…";

  // Close the mobile bottom sheet on Escape for keyboard users.
  useEffect(() => {
    if (!mobilePanel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobilePanel(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobilePanel]);

  const t = getTranslations(lang);

  const loading = stats === null;

  const feedStrings: FeedStrings = {
    feedTitle: t.feedTitle,
    feedSubtitle: t.feedSubtitle,
    searchPlaceholder: t.searchPlaceholder,
    ahead: t.feedAhead,
    current: t.feedCurrent,
    past: t.feedPast,
    noEvents: t.feedNoEvents,
    noMatch: t.feedNoMatch,
    showIncidents: t.showIncidents,
    hideIncidents: t.hideIncidents,
    typeMaintenance: t.typeMaintenance,
    typeOutage: t.typeOutage,
    typeConstraint: t.typeConstraint,
    ongoing: t.feedOngoing,
    plannedTag: t.plannedTag,
    customersAffected: t.customersAffected,
    filtersLabel: t.filtersLabel,
    closeLabel: t.feedClose,
    confMeasured: t.confMeasured,
    confReported: t.confReported,
    confModeled: t.confModeled,
    locale: lang === "EN" ? "en-US" : "fr-FR",
    updatedLabel: t.feedUpdated,
    staleLabel: t.feedStale,
    lastUpdated,
    eventsError,
  };

  return (
    <main className="flex flex-col h-screen w-full bg-sunu-phantom overflow-hidden">
      {/* Keyframes for badge urgency pulse and live-data dot. Both respect
          prefers-reduced-motion: the color carries the meaning; motion is extra. */}
      <style jsx global>{`
        @keyframes activity-badge-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50%      { transform: scale(1.14); opacity: 0.82; }
        }
        @keyframes live-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.4; transform: scale(0.75); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes activity-badge-pulse { 0%, 100% { transform: none; opacity: 1; } }
          @keyframes live-pulse           { 0%, 100% { opacity: 1; } }
        }
      `}</style>

      {/* Skip link for keyboard users */}
      <a
        href="#grid-map"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[5000] focus:top-3 focus:left-3 focus:px-4 focus:py-2 focus:rounded focus:bg-sunu-arsenic focus:text-sunu-cloud focus:ring-2 focus:ring-sunu-blue"
      >
        {t.skipToMap}
      </a>

      {/* Header Trace - Canonical Branding with Interactive Filters.
          Three zones: title (left), controls (centered at page midpoint via
          absolute positioning), logo (alone on the far right). */}
      <header className="relative h-[72px] border-b border-white/[0.08] flex items-center justify-between px-4 sm:px-8 z-[2000] gap-3" style={{background: 'rgba(14,14,18,0.55)', backdropFilter: 'blur(16px) saturate(160%)', WebkitBackdropFilter: 'blur(16px) saturate(160%)'}}>
        {/* Title — desktop only. On mobile it truncated and crowded the header,
            so the SunuPower logo (far right) is the sole brand element there. */}
        <div className="hidden md:flex items-center gap-6 min-w-0">
          <div className="flex flex-col min-w-0">
            <span className="text-sm uppercase tracking-[0.3em] font-bold text-sunu-cloud leading-tight truncate">{t.title}</span>
            <span className="text-[11px] uppercase tracking-[0.2em] text-sunu-space font-bold truncate">{t.subtitle}</span>
          </div>
        </div>

        {/* Mobile-only controls cluster, left side (replaces the title slot).
            Activity + a minimalist EN/FR text toggle. View toggle lives in the
            strip below. */}
        <div className="md:hidden flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setFeedOpen((v) => !v)}
            aria-expanded={feedOpen}
            aria-label={activity.count > 0 ? `${t.feedTitle} — ${activity.count} ${t.activeNow}` : t.feedTitle}
            className={`relative flex items-center justify-center w-10 h-10 rounded border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-sunu-blue/70 ${
              feedOpen
                ? "bg-sunu-blue/15 border-sunu-blue/50 text-sunu-blue"
                : "bg-white/[0.03] border-white/10 text-sunu-cloud hover:border-sunu-blue"
            }`}
          >
            <CalendarClock className="w-4 h-4 text-sunu-blue" aria-hidden="true" />
            <LivePulse lastUpdated={lastUpdated} eventsError={eventsError} />
            <ActivityBadge count={activity.count} severity={activity.worstSeverity} />
          </button>
          <button
            type="button"
            onClick={() => setLang(lang === "EN" ? "FR" : "EN")}
            aria-label={t.langSwitch}
            className="flex items-center gap-1 px-1.5 py-1.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-sunu-blue/70"
          >
            <span className={`text-[13px] font-bold tracking-wider px-1.5 py-0.5 rounded transition-all ${lang === "EN" ? "bg-sunu-blue/20 text-sunu-blue" : "text-sunu-space/50"}`}>EN</span>
            <span className={`text-[13px] font-bold tracking-wider px-1.5 py-0.5 rounded transition-all ${lang === "FR" ? "bg-sunu-blue/20 text-sunu-blue" : "text-sunu-space/50"}`}>FR</span>
          </button>
        </div>

        {/* Centered controls — absolutely centered on the page midpoint so the
            title (left) and logo (right) widths never shift them off-center.
            Centered on md+; on small screens it falls back to flowing next to
            the logo (the mobile view toggle lives in the strip below). */}
        <div className="hidden md:flex items-center gap-5 absolute left-1/2 -translate-x-1/2">
          <ViewToggle t={t} view={view} setView={setView} />
          <button
            type="button"
            onClick={() => setFeedOpen((v) => !v)}
            aria-expanded={feedOpen}
            aria-label={activity.count > 0 ? `${t.feedTitle} — ${activity.count} ${t.activeNow}` : t.feedTitle}
            className={`relative flex items-center gap-2 px-4 py-2 rounded border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-sunu-blue/70 ${
              feedOpen
                ? "bg-sunu-blue/15 border-sunu-blue/50 text-sunu-blue"
                : "bg-white/[0.03] border-white/10 text-sunu-cloud hover:border-sunu-blue hover:bg-white/[0.08]"
            }`}
          >
            <CalendarClock className="w-4 h-4 text-sunu-blue" aria-hidden="true" />
            <span className="text-[11px] font-bold uppercase tracking-wider">{t.activityBtn}</span>
            <LivePulse lastUpdated={lastUpdated} eventsError={eventsError} />
            <ActivityBadge count={activity.count} severity={activity.worstSeverity} />
          </button>
          <button
            type="button"
            onClick={() => setLang(lang === "EN" ? "FR" : "EN")}
            aria-label={t.langSwitch}
            className="flex items-center gap-1 px-1.5 py-1.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-sunu-blue/70"
          >
            <span className={`text-[13px] font-bold tracking-wider px-1.5 py-0.5 rounded transition-all ${lang === "EN" ? "bg-sunu-blue/20 text-sunu-blue" : "text-sunu-space/50"}`}>EN</span>
            <span className={`text-[13px] font-bold tracking-wider px-1.5 py-0.5 rounded transition-all ${lang === "FR" ? "bg-sunu-blue/20 text-sunu-blue" : "text-sunu-space/50"}`}>FR</span>
          </button>
        </div>

        <div className="flex items-center shrink-0">
          {/* Logo: original asset, unaltered. Sized up for visibility only.
              No backing plate, no recolor, gold accent bar untouched.
              Links to the SunuPower corporate site (external, new tab). */}
          <a
            href="https://sunupower-corporate-v2.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="SunuPower corporate website (opens in a new tab)"
            className="flex items-center shrink-0 rounded transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-sunu-blue/70"
          >
            <Image src="/brand/logo-light-text.png" alt="SunuPower" width={180} height={36} priority className="object-contain h-6 sm:h-7 w-auto" />
          </a>
        </div>
      </header>

      {/* Mobile view toggle strip — only on small screens (header holds the
          toggle at md+). The voltage filter now lives in the interactive legend
          (Infrastructure view), so it is no longer in the header or this strip. */}
      <div className="md:hidden shrink-0 flex justify-center px-6 py-3 border-b border-white/[0.08]" style={{background: 'rgba(14,14,18,0.55)', backdropFilter: 'blur(16px) saturate(160%)', WebkitBackdropFilter: 'blur(16px) saturate(160%)'}}>
        <ViewToggle t={t} view={view} setView={setView} />
      </div>

      {/* Main Map Content */}
      <div id="grid-map" className="flex-1 relative min-h-0" role="region" aria-label={t.mapLabel}>
        <GridMap
          lang={lang}
          filter={filter}
          view={view}
          onStats={handleStats}
          focusAsset={focusAsset}
          focusNonce={focusNonce}
          confidenceFilter={confidenceFilter}
          onIndices={handleIndices}
        />

        {/* Grid Activity Feed — toggleable right panel (maintenance-led, all sizes).
            year="all" by design: the feed's time axis is Ahead/Current/Past, not
            the map's calendar-year slider. */}
        <GridActivityFeed
          open={feedOpen}
          onClose={() => setFeedOpen(false)}
          year="all"
          strings={feedStrings}
          onFocusAsset={handleFocusAsset}
        />

        {/* Meta Stats Panel — desktop only. Reliability view adds the measured
            SAIFI/SAIDI indicator below the regional context. Both sections share
            one glass panel so there is no visible seam between them. */}
        <div className="hidden lg:block absolute top-8 left-8 z-[2000] w-[340px] pointer-events-none max-h-[calc(100vh-4rem)] overflow-y-auto no-scrollbar">
          <div className="glass-panel rounded-xl pointer-events-auto">
            <div className="p-7">
              <ContextPanel t={t} kmDisplay={kmDisplay} nodeDisplay={nodeDisplay} loading={loading} />
            </div>
            {view === "reliability" && (
              <div className="border-t border-white/[0.06] p-7">
                <MeasuredIndicesPanel t={t} series={indexSeries} />
              </div>
            )}
          </div>
        </div>

        {/* Legend Overlay — desktop only */}
        <div className="hidden lg:block absolute bottom-12 right-8 z-[2000] p-6 glass-panel rounded-xl text-left pointer-events-auto w-[280px]">
          {view === "reliability"
            ? <ReliabilityLegend t={t} confidenceFilter={confidenceFilter} onToggleConfidence={handleToggleConfidence} />
            : <Legend t={t} filter={filter} setFilter={setFilter} />}
        </div>

        {/* Mobile panel toggle buttons — bottom-left (Info) and bottom-right (Legend).
            Sits above the centered attribution strip; the year slider sits above this. */}
        <div className="lg:hidden absolute bottom-9 left-0 right-0 z-[2000] flex justify-between px-6 pointer-events-none">
          <button
            type="button"
            aria-expanded={mobilePanel === "context"}
            aria-label={t.infoBtn}
            onClick={() => setMobilePanel(mobilePanel === "context" ? null : "context")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl glass-panel pointer-events-auto transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-sunu-blue/70 ${mobilePanel === "context" ? "!border-sunu-blue/50" : ""}`}
          >
            <Info className="w-4 h-4 text-sunu-blue shrink-0" aria-hidden="true" />
            <span className="text-[10px] uppercase tracking-widest font-bold text-sunu-cloud">{t.infoBtn}</span>
          </button>
          <button
            type="button"
            aria-expanded={mobilePanel === "legend"}
            aria-label={t.legendBtn}
            onClick={() => setMobilePanel(mobilePanel === "legend" ? null : "legend")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl glass-panel pointer-events-auto transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-sunu-orange/70 ${mobilePanel === "legend" ? "!border-sunu-orange/50" : ""}`}
          >
            <Layers className="w-4 h-4 text-sunu-orange shrink-0" aria-hidden="true" />
            <span className="text-[10px] uppercase tracking-widest font-bold text-sunu-cloud">{t.legendBtn}</span>
          </button>
        </div>

        {/* Mobile bottom sheet — tap backdrop or press Escape to dismiss */}
        {mobilePanel && (
          <div className="lg:hidden fixed inset-0 z-[4000]" onClick={() => setMobilePanel(null)}>
            <div
              role="dialog"
              aria-modal="true"
              aria-label={mobilePanel === "context" ? t.contextTitle : t.legendBtn}
              className="absolute inset-x-0 bottom-0 max-h-[65vh] overflow-y-auto rounded-t-2xl"
              style={{background: 'rgba(14,14,18,0.70)', backdropFilter: 'blur(16px) saturate(160%)', WebkitBackdropFilter: 'blur(16px) saturate(160%)', borderTop: '1px solid rgba(255,255,255,0.10)', boxShadow: '0 -8px 32px rgba(0,0,0,0.35)'}}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 rounded-full bg-white/20" aria-hidden="true" />
              </div>
              {mobilePanel === "context" ? (
                <div className="px-7 pb-8 space-y-7">
                  <ContextPanel t={t} kmDisplay={kmDisplay} nodeDisplay={nodeDisplay} loading={loading} />
                  {view === "reliability" && (
                    <div className="border-t border-white/10 pt-6">
                      <MeasuredIndicesPanel t={t} series={indexSeries} />
                    </div>
                  )}
                </div>
              ) : (
                <div className="px-6 pb-8">
                  {view === "reliability"
                    ? <ReliabilityLegend t={t} confidenceFilter={confidenceFilter} onToggleConfidence={handleToggleConfidence} />
                    : <Legend t={t} filter={filter} setFilter={setFilter} />}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
