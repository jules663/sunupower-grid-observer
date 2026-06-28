"use client";

import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { Info, Layers, CalendarClock } from "lucide-react";
import type { GridStats } from "@/components/map/GridMap";
import { ContextPanel, Legend, ReliabilityLegend } from "@/components/ui/panels";
import { ViewToggle } from "@/components/ui/ViewToggle";
import { GridActivityFeed, type FeedStrings } from "@/components/ui/GridActivityFeed";

const GridMap = dynamic(() => import("@/components/map/GridMap"), {
  ssr: false,
});

export type GridFilter = "ALL" | "225" | "90" | "MV";
export type ViewMode = "infrastructure" | "reliability";

export default function Home() {
  const [lang, setLang] = useState<"EN" | "FR">("EN");
  const [filter, setFilter] = useState<GridFilter>("ALL");
  const [view, setView] = useState<ViewMode>("reliability");
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

  // Localized display strings for the computed stats; em dash while loading.
  const kmDisplay = stats ? stats.totalKm.toLocaleString(lang === "EN" ? "en-US" : "fr-FR") : "—";
  const nodeDisplay = stats ? String(stats.nodeCount) : "—";

  // Close the mobile bottom sheet on Escape for keyboard users.
  useEffect(() => {
    if (!mobilePanel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobilePanel(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobilePanel]);

  const t = {
    EN: {
      title: "Grid Observer",
      subtitle: "Unified Infrastructure Advisor v1.4",
      backbone: "225kV Backbone",
      subBackbone: "90kV Sub-backbone",
      mv: "MV Grid",
      contextTitle: "Regional Context: ECOWAS/Senegal",
      trace: "Transmission Trace",
      nodes: "Registered Nodes",
      legal: "Grid trace compiled from World Bank map archives (IBRD #33982, 2005), OpenStreetMap, and SOMELEC/ECREEE references. Indicative routing — advisory posture maintained.",
      fuelTitle: "Asset Diversity",
      thermal: "Thermal/Oil",
      solar: "Solar",
      wind: "Wind",
      coal: "Coal",
      hydro: "Hydro",
      industrial: "Industrial Off-taker",
      substation: "Network Node",
      senelec225: "SENELEC 225kV",
      omvg225: "OMVG / Cross-border",
      esiSite: "ESI Site",
      langSwitch: "Switch language to French",
      skipToMap: "Skip to map",
      infoBtn: "Info",
      legendBtn: "Legend",
      mapLabel: "Senegal electricity transmission network map",
      viewInfra: "Infrastructure",
      viewReliability: "Reliability",
      reliabilityTitle: "Reliability Index",
      relScale: "Stress Score",
      relLow: "Low",
      relHigh: "High",
      relBaseline: "No events",
      confidenceTitle: "Data Confidence",
      confMeasured: "Measured",
      confReported: "Reported",
      confModeled: "Modeled",
      relLegalNote: "Reliability index is indicative — seeded from public & modeled data. Measured utility/ESI telemetry supersedes it as available.",
      activityBtn: "Activity",
      feedTitle: "Grid Activity",
      feedSubtitle: "Maintenance schedule and reliability events, ahead to past.",
      searchPlaceholder: "Search events, assets, causes",
      feedAhead: "Ahead",
      feedCurrent: "Current",
      feedPast: "Past",
      feedNoEvents: "No recorded events",
      feedNoMatch: "No events match the current filters",
      showIncidents: "Incidents",
      hideIncidents: "Incidents",
      typeMaintenance: "Maintenance",
      typeOutage: "Outage",
      typeConstraint: "Constraint",
      feedOngoing: "ongoing",
      plannedTag: "Planned",
      customersAffected: "customers",
      filtersLabel: "Filter events by type",
      feedClose: "Close activity feed",
    },
    FR: {
      title: "Observateur de Réseau",
      subtitle: "Conseiller en Infrastructures Unifiées v1.4",
      backbone: "Dorsale 225kV",
      subBackbone: "Sous-dorsale 90kV",
      mv: "Réseau MT",
      contextTitle: "Contexte Régional : CEDEAO/Sénégal",
      trace: "Tracé de Transmission",
      nodes: "Nœuds Enregistrés",
      legal: "Tracé du réseau compilé à partir des archives cartographiques de la Banque Mondiale (IBRD #33982, 2005), d'OpenStreetMap et des références SOMELEC/ECREEE. Tracé indicatif — posture consultative maintenue.",
      fuelTitle: "Diversité des Actifs",
      thermal: "Thermique/Fioul",
      solar: "Solaire",
      wind: "Éolien",
      coal: "Charbon",
      hydro: "Hydro",
      industrial: "Consommateur Industriel",
      substation: "Nœud de Réseau",
      senelec225: "SENELEC 225kV",
      omvg225: "OMVG / Transfrontalier",
      esiSite: "Site ESI",
      langSwitch: "Passer la langue en anglais",
      skipToMap: "Aller à la carte",
      infoBtn: "Info",
      legendBtn: "Légende",
      mapLabel: "Carte du réseau de transport d'électricité du Sénégal",
      viewInfra: "Infrastructure",
      viewReliability: "Fiabilité",
      reliabilityTitle: "Indice de Fiabilité",
      relScale: "Score de Stress",
      relLow: "Faible",
      relHigh: "Élevé",
      relBaseline: "Aucun évènement",
      confidenceTitle: "Confiance des Données",
      confMeasured: "Mesuré",
      confReported: "Rapporté",
      confModeled: "Modélisé",
      relLegalNote: "L'indice de fiabilité est indicatif — basé sur des données publiques et modélisées. La télémétrie mesurée (réseau/ESI) le remplace dès que disponible.",
      activityBtn: "Activité",
      feedTitle: "Activité du Réseau",
      feedSubtitle: "Calendrier de maintenance et évènements de fiabilité, à venir et passés.",
      searchPlaceholder: "Rechercher évènements, actifs, causes",
      feedAhead: "À venir",
      feedCurrent: "En cours",
      feedPast: "Passé",
      feedNoEvents: "Aucun évènement enregistré",
      feedNoMatch: "Aucun évènement ne correspond aux filtres",
      showIncidents: "Incidents",
      hideIncidents: "Incidents",
      typeMaintenance: "Maintenance",
      typeOutage: "Panne",
      typeConstraint: "Contrainte",
      feedOngoing: "en cours",
      plannedTag: "Planifié",
      customersAffected: "clients",
      filtersLabel: "Filtrer les évènements par type",
      feedClose: "Fermer le flux d'activité",
    },
  }[lang];

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
  };

  return (
    <main className="flex flex-col h-screen w-full bg-sunu-phantom overflow-hidden">
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
            aria-label={t.feedTitle}
            className={`flex items-center justify-center w-10 h-10 rounded border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-sunu-blue/70 ${
              feedOpen
                ? "bg-sunu-blue/15 border-sunu-blue/50 text-sunu-blue"
                : "bg-white/[0.03] border-white/10 text-sunu-cloud hover:border-sunu-blue"
            }`}
          >
            <CalendarClock className="w-4 h-4 text-sunu-blue" aria-hidden="true" />
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
            aria-label={t.feedTitle}
            className={`flex items-center gap-2 px-4 py-2 rounded border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-sunu-blue/70 ${
              feedOpen
                ? "bg-sunu-blue/15 border-sunu-blue/50 text-sunu-blue"
                : "bg-white/[0.03] border-white/10 text-sunu-cloud hover:border-sunu-blue hover:bg-white/[0.08]"
            }`}
          >
            <CalendarClock className="w-4 h-4 text-sunu-blue" aria-hidden="true" />
            <span className="text-[11px] font-bold uppercase tracking-wider">{t.activityBtn}</span>
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

        {/* Meta Stats Panel — desktop only */}
        <div className="hidden lg:block absolute top-8 left-8 z-[2000] w-[340px] space-y-4 pointer-events-none">
          <div className="glass-panel p-7 rounded-xl pointer-events-auto">
            <ContextPanel t={t} kmDisplay={kmDisplay} nodeDisplay={nodeDisplay} loading={loading} />
          </div>
        </div>

        {/* Legend Overlay — desktop only */}
        <div className="hidden lg:block absolute bottom-12 right-8 z-[2000] p-6 glass-panel rounded-xl text-left pointer-events-auto w-[280px]">
          {view === "reliability" ? <ReliabilityLegend t={t} /> : <Legend t={t} filter={filter} setFilter={setFilter} />}
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
                <div className="px-7 pb-8">
                  <ContextPanel t={t} kmDisplay={kmDisplay} nodeDisplay={nodeDisplay} loading={loading} />
                </div>
              ) : (
                <div className="px-6 pb-8">
                  {view === "reliability" ? <ReliabilityLegend t={t} /> : <Legend t={t} filter={filter} setFilter={setFilter} />}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
