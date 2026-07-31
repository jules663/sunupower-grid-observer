// Localized strings for everything the map renders.
//
// These previously lived as inline `lang === "EN" ? ... : ...` ternaries spread
// across popup builders, the year slider and the status overlays, which made it
// impossible to see the map's full copy in one place or to audit a translation.
// Collecting them here means adding a language is a single edit, and a missing
// key is a compile error rather than an English string leaking into the French UI.

import type { Lang, EventSeverity, EventConfidence } from "@/types/grid";

export interface MapStrings {
  // Line popups / tooltips
  lineTier225Domestic: string;
  lineTier225CrossBorder: string;
  lineTier90: string;
  lineTierMv: string;
  length: string;

  // Node popups
  nodePlant: string;
  nodeSubstation: string;
  nodeConsumer: string;
  sector: string;
  demandProfile: string;
  operator: string;
  commissioned: string;
  annualGen: string;

  // Reliability popup
  reliabilityHead: string;
  noEvents: string;
  stressScore: string;
  eventCount: string;
  outageHours: string;
  worstSeverity: string;
  confidence: string;
  systemIndicator: string;

  // Year slider
  period: string;
  allYears: string;
  yearFilterLabel: string;

  // Status overlays
  loading: string;
  errorTitle: string;
  errorHint: string;

  severity: Record<EventSeverity, string>;
  confidenceTier: Record<EventConfidence, string>;
}

const EN: MapStrings = {
  lineTier225Domestic: "SENELEC 225kV Circuit",
  lineTier225CrossBorder: "Cross-border 225kV Circuit",
  lineTier90: "90kV Sub-backbone",
  lineTierMv: "MV Distribution Line",
  length: "Length",

  nodePlant: "Power Plant",
  nodeSubstation: "Network Node",
  nodeConsumer: "Industrial Off-taker",
  sector: "Sector",
  demandProfile: "Profile",
  operator: "Operator",
  commissioned: "Commissioned",
  annualGen: "Annual Gen",

  reliabilityHead: "RELIABILITY PROFILE",
  noEvents: "No recorded events",
  stressScore: "Stress score",
  eventCount: "Events",
  outageHours: "Outage hours",
  worstSeverity: "Worst severity",
  confidence: "Confidence",
  systemIndicator: "System indicator",

  period: "Period",
  allYears: "All",
  yearFilterLabel: "Filter events by year",

  loading: "Loading grid data…",
  errorTitle: "Grid data could not be loaded.",
  errorHint: "Check your connection and try refreshing the page.",

  severity: { low: "Low", medium: "Medium", high: "High", critical: "Critical" },
  confidenceTier: { measured: "Measured", reported: "Reported", modeled: "Modeled" },
};

const FR: MapStrings = {
  lineTier225Domestic: "Circuit SENELEC 225kV",
  lineTier225CrossBorder: "Circuit transfrontalier 225kV",
  lineTier90: "Sous-dorsale 90kV",
  lineTierMv: "Ligne de distribution MT",
  length: "Longueur",

  nodePlant: "Centrale Électrique",
  nodeSubstation: "Nœud du Réseau",
  nodeConsumer: "Consommateur Industriel",
  sector: "Secteur",
  demandProfile: "Profil",
  operator: "Opérateur",
  commissioned: "Mise en service",
  annualGen: "Prod. Annuelle",

  reliabilityHead: "PROFIL DE FIABILITÉ",
  noEvents: "Aucun évènement enregistré",
  stressScore: "Score de stress",
  eventCount: "Évènements",
  outageHours: "Heures de coupure",
  worstSeverity: "Sévérité max",
  confidence: "Confiance",
  systemIndicator: "Indicateur système",

  period: "Période",
  allYears: "Tout",
  yearFilterLabel: "Filtrer les évènements par année",

  loading: "Chargement du réseau…",
  errorTitle: "Impossible de charger les données du réseau.",
  errorHint: "Vérifiez votre connexion et actualisez la page.",

  severity: { low: "Faible", medium: "Moyen", high: "Élevé", critical: "Critique" },
  confidenceTier: { measured: "Mesuré", reported: "Rapporté", modeled: "Modélisé" },
};

export function mapStrings(lang: Lang): MapStrings {
  return lang === "FR" ? FR : EN;
}
