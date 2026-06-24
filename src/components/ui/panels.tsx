"use client";

import { Activity, Shield } from "lucide-react";
import { SHOW_ESI_SITES } from "@/lib/config";

// Shared shape of the localized strings the panels need. page.tsx builds the
// full translation object; these components consume the subset they use.
export interface PanelStrings {
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
  // Reliability mode
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
}

// A single fuel/asset legend swatch. Shape is "dot" | "hex" | "diamond".
function LegendSwatch({ color, shape = "dot", small = false }: { color: string; shape?: "dot" | "hex" | "diamond"; small?: boolean }) {
  if (shape === "hex") {
    return (
      <div style={{ filter: "drop-shadow(0 0 4px rgba(233,30,99,0.5)) drop-shadow(0 0 1px rgba(255,255,255,0.25))" }} aria-hidden="true">
        <div className="w-3 h-3" style={{ backgroundColor: color, clipPath: "polygon(25% 0%,75% 0%,100% 50%,75% 100%,25% 100%,0% 50%)" }} />
      </div>
    );
  }
  if (shape === "diamond") {
    return (
      <div style={{ filter: "drop-shadow(0 0 4px rgba(245,158,11,0.6))" }} aria-hidden="true">
        <div className="w-3 h-3" style={{ backgroundColor: color, clipPath: "polygon(50% 0%,100% 50%,50% 100%,0% 50%)" }} />
      </div>
    );
  }
  const sizeCls = small ? "w-2 h-2" : "w-3 h-3";
  return <div className={`${sizeCls} rounded-full border border-white/20`} style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}66` }} aria-hidden="true" />;
}

// The Regional Context panel: computed stats + provenance note.
// `loading` toggles aria-busy and is reflected by the em-dash placeholders.
export function ContextPanel({ t, kmDisplay, nodeDisplay, loading }: { t: PanelStrings; kmDisplay: string; nodeDisplay: string; loading: boolean }) {
  return (
    <section aria-label={t.contextTitle} aria-busy={loading}>
      <div className="text-[11px] uppercase tracking-[0.3em] text-sunu-space font-bold mb-5 border-b border-white/5 pb-3">{t.contextTitle}</div>
      <div className="space-y-7">
        <div className="flex items-center gap-5">
          <Activity className="w-5 h-5 text-sunu-blue shrink-0" aria-hidden="true" />
          <div className="flex flex-col">
            <span className="text-2xl font-mono text-sunu-cloud">{kmDisplay}<span className="text-sm ml-1 text-sunu-space">km</span></span>
            <span className="text-[10px] uppercase tracking-widest font-bold text-sunu-space">{t.trace}</span>
          </div>
        </div>
        <div className="flex items-center gap-5">
          <Shield className="w-5 h-5 text-sunu-orange shrink-0" aria-hidden="true" />
          <div className="flex flex-col">
            <span className="text-2xl font-mono text-sunu-cloud">{nodeDisplay}<span className="text-sm ml-1 text-sunu-space">nodes</span></span>
            <span className="text-[10px] uppercase tracking-widest font-bold text-sunu-space">{t.nodes}</span>
          </div>
        </div>
        <div className="border-t border-white/5 pt-4">
          <span className="text-[11px] text-sunu-space leading-relaxed italic">{t.legal}</span>
        </div>
      </div>
    </section>
  );
}

// The legend: HV network line styles + fuel/asset swatches.
export function Legend({ t }: { t: PanelStrings }) {
  const fuels: { color: string; label: string; shape?: "dot" | "hex" | "diamond"; small?: boolean }[] = [
    { color: "#2579fc", label: t.thermal },
    { color: "#FDA206", label: t.solar },
    { color: "#66BB6A", label: t.wind },
    { color: "#EF5350", label: t.coal },
    { color: "#42A5F5", label: t.hydro },
    { color: "#E91E63", label: t.industrial, shape: "hex" },
    { color: "#6E7180", label: t.substation, small: true },
    // ESI swatch shown only when the ESI layer is enabled (parked for now).
    ...(SHOW_ESI_SITES ? [{ color: "#F59E0B", label: t.esiSite, shape: "diamond" as const }] : []),
  ];
  return (
    <section aria-label={t.fuelTitle}>
      <div className="text-[10px] uppercase tracking-widest font-bold text-sunu-space mb-3 px-1 border-b border-white/5 pb-3">HV Networks</div>
      <div className="flex flex-col gap-2.5 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-5 h-[2.5px] rounded-full bg-sunu-blue shadow-[0_0_6px_rgba(37,121,252,0.7)]" aria-hidden="true" />
          <span className="text-[11px] uppercase tracking-wider font-bold text-sunu-cloud">{t.senelec225}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-5 h-[2.5px] rounded-full bg-[#A78BFA] shadow-[0_0_6px_rgba(167,139,250,0.7)]" aria-hidden="true" />
          <span className="text-[11px] uppercase tracking-wider font-bold text-sunu-cloud">{t.omvg225}</span>
        </div>
      </div>
      <div className="text-[10px] uppercase tracking-widest font-bold text-sunu-space mb-5 px-1 border-b border-white/5 pb-3">{t.fuelTitle}</div>
      <div className="grid grid-cols-2 gap-x-10 gap-y-4">
        {fuels.map((f) => (
          <div key={f.label} className="flex items-center gap-3">
            <LegendSwatch color={f.color} shape={f.shape} small={f.small} />
            <span className="text-[11px] uppercase tracking-wider font-bold text-sunu-cloud">{f.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// Legend for reliability mode: the stress-score heat scale + the data-confidence
// key, so a measured outage and a modeled constraint are never read as equal.
export function ReliabilityLegend({ t }: { t: PanelStrings }) {
  const confidences: { label: string; color: string }[] = [
    { label: t.confMeasured, color: "#22C55E" },
    { label: t.confReported, color: "#F59E0B" },
    { label: t.confModeled, color: "#9DA2B3" },
  ];
  return (
    <section aria-label={t.reliabilityTitle}>
      <div className="text-[10px] uppercase tracking-widest font-bold text-sunu-space mb-3 px-1 border-b border-white/5 pb-3">{t.relScale}</div>
      <div className="px-1 mb-4">
        <div className="h-2.5 rounded-full" style={{ background: "linear-gradient(90deg,#3B82F6 0%,#FACC15 28%,#F59E0B 52%,#F97316 76%,#EF4444 100%)" }} aria-hidden="true" />
        <div className="flex justify-between mt-1.5">
          <span className="text-[9px] uppercase tracking-wider font-bold text-sunu-space">{t.relLow}</span>
          <span className="text-[9px] uppercase tracking-wider font-bold text-sunu-space">{t.relHigh}</span>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#3B82F6] border border-white/20" aria-hidden="true" />
          <span className="text-[10px] uppercase tracking-wider font-bold text-sunu-space">{t.relBaseline}</span>
        </div>
      </div>
      <div className="text-[10px] uppercase tracking-widest font-bold text-sunu-space mb-3 px-1 border-b border-white/5 pb-3">{t.confidenceTitle}</div>
      <div className="flex flex-col gap-2 mb-3">
        {confidences.map((c) => (
          <div key={c.label} className="flex items-center gap-3">
            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase" style={{ background: `${c.color}22`, color: c.color }}>{c.label}</span>
          </div>
        ))}
      </div>
      <div className="border-t border-white/5 pt-3">
        <span className="text-[10px] text-sunu-space leading-relaxed italic">{t.relLegalNote}</span>
      </div>
    </section>
  );
}
