// Page-level localized strings for Grid Observer.
//
// Previously the EN and FR translation objects lived inline inside HomeContent
// in src/app/page.tsx, making the component ~150 lines longer than needed and
// preventing auditing of copy in one place. Collected here for the same reasons
// mapStrings.ts exists: a missing key is a compile error, adding a language is a
// single file edit, and the component focuses on layout.

import type { Lang } from "@/types/grid";

export interface PageStrings {
  title: string;
  subtitle: string;
  backbone: string;
  subBackbone: string;
  mv: string;
  contextTitle: string;
  trace: string;
  nodes: string;
  legal: string;
  fuelTitle: string;
  thermal: string;
  solar: string;
  wind: string;
  coal: string;
  hydro: string;
  industrial: string;
  substation: string;
  senelec225: string;
  omvg225: string;
  esiSite: string;
  langSwitch: string;
  skipToMap: string;
  infoBtn: string;
  legendBtn: string;
  mapLabel: string;
  viewInfra: string;
  viewReliability: string;
  reliabilityTitle: string;
  relScale: string;
  relLow: string;
  relHigh: string;
  relBaseline: string;
  confidenceTitle: string;
  confMeasured: string;
  confReported: string;
  confModeled: string;
  relLegalNote: string;
  confMeasuredDesc: string;
  confReportedDesc: string;
  confModeledDesc: string;
  confFilterHint: string;
  indicesTitle: string;
  saifiLabel: string;
  saifiUnit: string;
  saidiLabel: string;
  saidiUnit: string;
  indicesScope: string;
  indicesNote: string;
  indicesEmpty: string;
  methTitle: string;
  methUpdated: string;
  methUpdatedDate: string;
  activityBtn: string;
  feedTitle: string;
  feedSubtitle: string;
  searchPlaceholder: string;
  feedAhead: string;
  feedCurrent: string;
  feedPast: string;
  feedNoEvents: string;
  feedNoMatch: string;
  showIncidents: string;
  hideIncidents: string;
  typeMaintenance: string;
  typeOutage: string;
  typeConstraint: string;
  feedOngoing: string;
  plannedTag: string;
  customersAffected: string;
  filtersLabel: string;
  feedClose: string;
  activeNow: string;
  feedUpdated: string;
  feedStale: string;
}

const EN: PageStrings = {
  title: "Grid Observer",
  subtitle: "Unified Infrastructure Advisor v1.4",
  backbone: "225kV Backbone",
  subBackbone: "90kV Sub-backbone",
  mv: "MV Grid",
  contextTitle: "Regional Context: ECOWAS/Senegal",
  trace: "Transmission Trace",
  nodes: "Registered Nodes",
  legal: "Grid trace compiled from World Bank map archives (IBRD #33982, 2005), OpenStreetMap, and SOMELEC/ECREEE references. Indicative routing. Advisory posture maintained.",
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
  relLegalNote: "Reliability index is indicative, seeded from public and modeled data. Measured utility/ESI telemetry supersedes it as available.",
  confMeasuredDesc: "Utility or ESI telemetry: observed, not estimated.",
  confReportedDesc: "Press, CRSE, or World Bank references.",
  confModeledDesc: "Topology-derived estimate, not a measurement.",
  confFilterHint: "tap to filter",
  indicesTitle: "Measured Reliability Indices",
  saifiLabel: "SAIFI",
  saifiUnit: "interruptions / customer",
  saidiLabel: "SAIDI",
  saidiUnit: "minutes / customer",
  indicesScope: "Scope",
  indicesNote: "Aggregate system-level indices for the stated scope and period, not per-node values. Source: reported utility figures.",
  indicesEmpty: "No measured indices available.",
  methTitle: "Data and Methodology",
  methUpdated: "Data updated",
  methUpdatedDate: "2026-07",
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
  activeNow: "events in progress",
  feedUpdated: "Updated",
  feedStale: "Events may be stale — retrying…",
};

const FR: PageStrings = {
  title: "Observateur de Réseau",
  subtitle: "Conseiller en Infrastructures Unifiées v1.4",
  backbone: "Dorsale 225kV",
  subBackbone: "Sous-dorsale 90kV",
  mv: "Réseau MT",
  contextTitle: "Contexte Régional : CEDEAO/Sénégal",
  trace: "Tracé de Transmission",
  nodes: "Nœuds Enregistrés",
  legal: "Tracé du réseau compilé à partir des archives cartographiques de la Banque Mondiale (IBRD #33982, 2005), d'OpenStreetMap et des références SOMELEC/ECREEE. Tracé indicatif. Posture consultative maintenue.",
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
  relLegalNote: "L'indice de fiabilité est indicatif, basé sur des données publiques et modélisées. La télémétrie mesurée (réseau/ESI) le remplace dès que disponible.",
  confMeasuredDesc: "Télémétrie réseau ou ESI : observée, non estimée.",
  confReportedDesc: "Références presse, CRSE ou Banque Mondiale.",
  confModeledDesc: "Estimation dérivée de la topologie, non une mesure.",
  confFilterHint: "toucher pour filtrer",
  indicesTitle: "Indices de fiabilité mesurés",
  saifiLabel: "SAIFI",
  saifiUnit: "interruptions / client",
  saidiLabel: "SAIDI",
  saidiUnit: "minutes / client",
  indicesScope: "Périmètre",
  indicesNote: "Indices agrégés au niveau du système pour le périmètre et la période indiqués, non des valeurs par nœud. Source : chiffres rapportés du réseau.",
  indicesEmpty: "Aucun indice mesuré disponible.",
  methTitle: "Données et méthodologie",
  methUpdated: "Données mises à jour",
  methUpdatedDate: "2026-07",
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
  activeNow: "évènements en cours",
  feedUpdated: "Mis à jour",
  feedStale: "Données potentiellement obsolètes — nouvelle tentative…",
};

const TRANSLATIONS: Record<Lang, PageStrings> = { EN, FR };

export function getTranslations(lang: Lang): PageStrings {
  return TRANSLATIONS[lang];
}
