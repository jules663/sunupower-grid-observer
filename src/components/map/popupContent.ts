// Popup and tooltip markup for every map layer.
//
// Leaflet binds popups as HTML strings, so this is unavoidably string-built
// rather than JSX. Collecting the builders here keeps that boundary in one file:
// everything below returns a trusted HTML string, and every interpolated value
// passes through esc() on the way in.

import type { LineProps, NodeProps, EsiProps, Lang, ReliabilityProfile } from "@/types/grid";
import type { MapStrings } from "@/lib/mapStrings";
import { isCrossBorder, lineColor } from "@/lib/gridStyle";
import { heatColor } from "@/lib/reliability";

/**
 * Escape a value before it is interpolated into popup innerHTML.
 *
 * Defends against malformed markup characters in data fields today, and against
 * stored XSS if any of these datasets later becomes user-supplied or fetched
 * from a live API rather than shipped as a static file.
 */
export function esc(val: unknown): string {
  return String(val ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const CONFIDENCE_COLOR: Record<string, string> = {
  measured: "#22C55E",
  reported: "#F59E0B",
  modeled: "#9DA2B3",
};

// Label/value row. Both arguments are interpolated raw — callers pass either a
// string from MapStrings, a number we formatted ourselves, or a value already
// through esc(). Anything originating in a data file must be esc()'d first.
const row = (k: string, v: string) =>
  `<div class="flex justify-between text-[10px]"><span class="text-sunu-graphite uppercase font-bold">${k}</span><span class="text-sunu-cloud font-mono">${v}</span></div>`;

const head = (text: string) =>
  `<div class="text-[10px] uppercase tracking-widest font-bold text-sunu-graphite mb-2 border-b border-white/5 pb-1">${text}</div>`;

// --- Lines ------------------------------------------------------------------

/**
 * Display title for a circuit. When `name` is null — true for most of the World
 * Bank archive features — fall back to describing the circuit by voltage tier
 * rather than a generic "Transmission Line", so the popup still says something.
 */
export function lineTitle(props: LineProps, s: MapStrings): string {
  const v = Number(props.voltage_kV);
  const tier =
    v === 225
      ? isCrossBorder(props) ? s.lineTier225CrossBorder : s.lineTier225Domestic
      : v === 90
        ? s.lineTier90
        : s.lineTierMv;
  return esc(props.name || tier);
}

/** Length in km to one decimal, or "N/A" when the source has no usable value. */
export function lineLengthDisplay(props: LineProps): string {
  const n = Number(props.length_km);
  return !isNaN(n) && n > 0 ? n.toFixed(1) : "N/A";
}

export function linePopupHtml(props: LineProps, s: MapStrings): string {
  return `
    <div class="text-sunu-arsenic font-sans p-2">
      ${head(lineTitle(props, s))}
      <div class="text-sm font-bold text-[#EDEFF7]">${esc(props.voltage_kV)} kV Circuit</div>
      <div class="text-[11px] mt-2.5 text-sunu-graphite font-medium">
        ${s.length}: <span class="text-sunu-cloud">${lineLengthDisplay(props)} km</span>
      </div>
    </div>`;
}

/**
 * Hover tooltip for a circuit — deliberately terser than the popup. Enough to
 * trace a route at a glance without clicking through every segment.
 */
export function lineTooltipHtml(props: LineProps, s: MapStrings): string {
  const dot = lineColor(props);
  const route = props.from && props.to ? `${esc(props.from)} → ${esc(props.to)}` : "";
  return `
    <span class="grid-line-tooltip-dot" style="background:${dot};box-shadow:0 0 6px ${dot}AA;"></span>
    <span class="grid-line-tooltip-body">
      <span class="grid-line-tooltip-title">${lineTitle(props, s)}</span>
      ${route ? `<span class="grid-line-tooltip-meta">${route}</span>` : ""}
      <span class="grid-line-tooltip-meta">${esc(props.voltage_kV)} kV · ${lineLengthDisplay(props)} km</span>
    </span>`;
}

// --- Nodes (infrastructure view) --------------------------------------------

export function nodePopupHtml(p: NodeProps, s: MapStrings): string {
  const isSub = p.fuel === "Substation";
  const isCon = p.demand_profile !== undefined;
  const label = isCon ? s.nodeConsumer : isSub ? s.nodeSubstation : s.nodePlant;

  const cap = Number(p.capacity_mw);
  const capDisplay = !isNaN(cap) && cap > 0 ? ` · ${cap} MW` : "";

  const storage = p.storage_mwh
    ? `<div class="mt-1"><span class="bg-sunu-blue/20 text-sunu-blue text-[9px] px-1.5 py-0.5 rounded font-bold">BESS: ${esc(p.storage_mwh)} MWh</span></div>`
    : "";

  // Consumers get demand attributes; plants get operating attributes. Network
  // nodes (substations) carry neither, so they render with no metadata block
  // rather than a section of empty rows.
  let metadata = "";
  if (isCon) {
    metadata = `<div class="mt-3 space-y-1.5 border-t border-white/5 pt-2">
      ${row(s.sector, esc(p.sector))}
      ${row(s.demandProfile, esc(p.demand_profile))}
    </div>`;
  } else if (!isSub) {
    const rows = [
      p.operator ? row(s.operator, esc(p.operator)) : "",
      p.commissioned ? row(s.commissioned, esc(p.commissioned)) : "",
      p.annual_gen ? row(s.annualGen, esc(p.annual_gen)) : "",
    ].join("");
    if (rows) metadata = `<div class="mt-3 space-y-1.5 border-t border-white/5 pt-2">${rows}</div>`;
  }

  const country = p.country
    ? `<div class="text-[9px] text-sunu-space uppercase mt-2 opacity-60">${esc(p.country)}</div>`
    : "";

  return `<div class="text-sunu-arsenic font-sans p-2">
    ${head(label)}
    <div class="text-sm font-bold text-[#EDEFF7]">${esc(p.name)}</div>
    <div class="text-[11px] mt-2.5 text-sunu-graphite uppercase font-bold tracking-wider">${esc(p.fuel || p.type)}${capDisplay}</div>
    ${storage}${metadata}${country}
  </div>`;
}

// --- Nodes (reliability view) -----------------------------------------------

export interface AssetIndex {
  saifi?: number;
  saidi_min?: number;
  scope?: string;
  period?: string;
  start: string;
}

export function reliabilityPopupHtml(
  p: NodeProps,
  profile: ReliabilityProfile | undefined,
  index: AssetIndex | undefined,
  s: MapStrings,
): string {
  if (!profile) {
    return `<div class="font-sans p-2">
      ${head(s.reliabilityHead)}
      <div class="text-sm font-bold text-[#EDEFF7]">${esc(p.name)}</div>
      <div class="text-[11px] mt-2 text-sunu-space">${s.noEvents}</div>
    </div>`;
  }

  const rowsHtml = [
    row(s.stressScore, `${profile.reliability_score}/100`),
    row(s.eventCount, String(profile.event_count)),
    row(s.outageHours, String(profile.total_outage_hours)),
    row(s.worstSeverity, profile.worst_severity ? s.severity[profile.worst_severity] : "n/a"),
  ].join("");

  const c = profile.confidence;
  const badge = `<span style="background:${CONFIDENCE_COLOR[c]}22;color:${CONFIDENCE_COLOR[c]};" class="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase">${s.confidenceTier[c]}</span>`;
  const scoreColor = heatColor(profile.reliability_score);

  // SAIFI/SAIDI block — shown only when the asset carries measured system
  // indices. Always labeled with its scope and period, so an aggregate
  // system-level figure never reads as a node-specific measurement.
  let indexHtml = "";
  if (index && (index.saifi != null || index.saidi_min != null)) {
    const saidiTxt =
      index.saidi_min != null
        ? `${Math.floor(index.saidi_min / 60)}h${String(Math.round(index.saidi_min % 60)).padStart(2, "0")}`
        : "n/a";
    const scopeTxt = `${esc(index.scope ?? "")}${index.period ? " · " + esc(index.period) : ""}`;
    indexHtml = `
      <div class="mt-3 pt-2 border-t border-white/5">
        <div class="text-[9px] uppercase tracking-widest font-bold text-sunu-graphite mb-1.5">${s.systemIndicator}</div>
        ${row("SAIFI", index.saifi != null ? esc(index.saifi) : "n/a")}
        ${row("SAIDI", saidiTxt)}
        <div class="text-[9px] text-sunu-space mt-1.5 italic">${scopeTxt}</div>
      </div>`;
  }

  return `<div class="font-sans p-2">
    ${head(s.reliabilityHead)}
    <div class="flex items-center justify-between">
      <div class="text-sm font-bold text-[#EDEFF7]">${esc(p.name)}</div>
      <div style="width:10px;height:10px;border-radius:50%;background:${scoreColor};box-shadow:0 0 8px ${scoreColor}AA;"></div>
    </div>
    <div class="mt-3 space-y-1.5 border-t border-white/5 pt-2">${rowsHtml}</div>
    ${indexHtml}
    <div class="mt-3 pt-2 border-t border-white/5 flex items-center justify-between">
      <span class="text-[9px] text-sunu-graphite uppercase font-bold">${s.confidence}</span>${badge}
    </div>
  </div>`;
}

// --- ESI sites --------------------------------------------------------------

export function esiPopupHtml(p: EsiProps, _lang: Lang): string {
  const capacityMwh = (Number(p.capacity_kwh) / 1000).toFixed(1);
  return `
    <div class="font-sans p-2">
      ${head("ESI ASSET")}
      <div class="text-sm font-bold text-[#EDEFF7]">${esc(p.name)}</div>
      <div class="text-[11px] mt-1 font-bold" style="color:#F59E0B;">${esc(p.state)}</div>
      <div class="mt-3 space-y-2 border-t border-white/5 pt-2">
        ${row("Capacity", `${capacityMwh} MWh`)}
        <div class="text-[10px]">
          <span class="text-sunu-graphite uppercase font-bold">Design Intent</span>
          <div class="text-sunu-cloud mt-1 leading-relaxed">${esc(p.intent)}</div>
        </div>
      </div>
    </div>`;
}
