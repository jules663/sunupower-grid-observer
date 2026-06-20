"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { Activity, Shield, Globe, Info, Layers } from "lucide-react";

const GridMap = dynamic(() => import("@/components/map/GridMap"), {
  ssr: false,
});

export type GridFilter = "ALL" | "225" | "90" | "MV";

export default function Home() {
  const [lang, setLang] = useState<"EN" | "FR">("EN");
  const [filter, setFilter] = useState<GridFilter>("ALL");
  const [mobilePanel, setMobilePanel] = useState<null | "context" | "legend">(null);

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
      legal: "Regional Grid Trace sourced from World Bank & OMVG Technical Reports (Nov 2025). Advisory posture maintained.",
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
      legal: "Tracé du réseau régional sourcé de World Bank & rapports techniques OMVG (Nov 2025). Posture consultative maintenue.",
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
    }
  }[lang];

  return (
    <main className="flex flex-col h-screen w-full bg-sunu-phantom overflow-hidden">
      {/* Header Trace - Canonical Branding with Interactive Filters */}
      <header className="h-[72px] border-b border-white/[0.08] flex items-center justify-between px-8 z-[2000]" style={{background: 'rgba(14,14,18,0.55)', backdropFilter: 'blur(16px) saturate(160%)', WebkitBackdropFilter: 'blur(16px) saturate(160%)'}}>
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <span className="text-sm uppercase tracking-[0.3em] font-bold text-sunu-cloud leading-tight">{t.title}</span>
            <span className="text-[11px] uppercase tracking-[0.2em] text-sunu-graphite font-bold">{t.subtitle}</span>
          </div>
        </div>
        
        <div className="hidden lg:flex items-center gap-10">
          <button 
            onClick={() => setFilter(filter === "225" ? "ALL" : "225")}
            className={`flex items-center gap-2.5 transition-all cursor-pointer ${filter !== "ALL" && filter !== "225" ? "opacity-30" : "opacity-100"}`}
          >
            <div className={`w-2 h-2 rounded-full bg-sunu-blue transition-all ${filter === "225" ? "scale-125 shadow-[0_0_12px_#2579fc]" : "shadow-[0_0_12px_rgba(37,121,252,0.8)]"}`} />
            <span className={`text-[11px] uppercase tracking-widest font-bold ${filter === "225" ? "text-sunu-blue" : "text-sunu-space"}`}>{t.backbone}</span>
          </button>
          
          <button 
            onClick={() => setFilter(filter === "90" ? "ALL" : "90")}
            className={`flex items-center gap-2.5 transition-all cursor-pointer ${filter !== "ALL" && filter !== "90" ? "opacity-30" : "opacity-100"}`}
          >
            <div className={`w-2 h-2 rounded-full bg-sunu-orange transition-all ${filter === "90" ? "scale-125 shadow-[0_0_12px_#FDA206]" : "shadow-[0_0_12px_rgba(253,162,6,0.8)]"}`} />
            <span className={`text-[11px] uppercase tracking-widest font-bold ${filter === "90" ? "text-sunu-orange" : "text-sunu-space"}`}>{t.subBackbone}</span>
          </button>
          
          <button 
            onClick={() => setFilter(filter === "MV" ? "ALL" : "MV")}
            className={`flex items-center gap-2.5 transition-all cursor-pointer ${filter !== "ALL" && filter !== "MV" ? "opacity-30" : "opacity-100"}`}
          >
            <div className={`w-2 h-2 rounded-full bg-[#00F2FF] transition-all ${filter === "MV" ? "scale-125 shadow-[0_0_12px_#00F2FF]" : "shadow-[0_0_10px_rgba(0,242,255,0.7)]"}`} />
            <span className={`text-[11px] uppercase tracking-widest font-bold ${filter === "MV" ? "text-[#00F2FF]" : "text-sunu-space"}`}>{t.mv}</span>
          </button>
        </div>

        <div className="flex items-center gap-8">
            <button 
                onClick={() => setLang(lang === "EN" ? "FR" : "EN")}
                className="flex items-center gap-2 px-4 py-2 rounded bg-white/[0.03] border border-white/10 hover:border-sunu-blue hover:bg-white/[0.08] transition-all"
            >
                <Globe className="w-4 h-4 text-sunu-blue" />
                <span className="text-[11px] font-bold text-sunu-cloud">{lang}</span>
            </button>
            
            <div className="hover:opacity-100 transition-opacity">
                <Image 
                    src="/brand/logo-light-text.png" 
                    alt="SunuPower" 
                    width={130} 
                    height={26} 
                    className="object-contain opacity-90"
                />
            </div>
        </div>
      </header>

      {/* Mobile filter strip — visible below lg, hidden on desktop */}
      <div className="lg:hidden shrink-0 flex items-center justify-around px-6 py-3 border-b border-white/[0.08]" style={{background: 'rgba(14,14,18,0.55)', backdropFilter: 'blur(16px) saturate(160%)', WebkitBackdropFilter: 'blur(16px) saturate(160%)'}}>
        <button
          onClick={() => setFilter(filter === "225" ? "ALL" : "225")}
          className={`flex items-center gap-2 transition-all cursor-pointer ${filter !== "ALL" && filter !== "225" ? "opacity-30" : "opacity-100"}`}
        >
          <div className={`w-2 h-2 rounded-full bg-sunu-blue transition-all ${filter === "225" ? "scale-125 shadow-[0_0_12px_#2579fc]" : "shadow-[0_0_12px_rgba(37,121,252,0.8)]"}`} />
          <span className={`text-[11px] uppercase tracking-widest font-bold ${filter === "225" ? "text-sunu-blue" : "text-sunu-space"}`}>{t.backbone}</span>
        </button>
        <button
          onClick={() => setFilter(filter === "90" ? "ALL" : "90")}
          className={`flex items-center gap-2 transition-all cursor-pointer ${filter !== "ALL" && filter !== "90" ? "opacity-30" : "opacity-100"}`}
        >
          <div className={`w-2 h-2 rounded-full bg-sunu-orange transition-all ${filter === "90" ? "scale-125 shadow-[0_0_12px_#FDA206]" : "shadow-[0_0_12px_rgba(253,162,6,0.8)]"}`} />
          <span className={`text-[11px] uppercase tracking-widest font-bold ${filter === "90" ? "text-sunu-orange" : "text-sunu-space"}`}>{t.subBackbone}</span>
        </button>
        <button
          onClick={() => setFilter(filter === "MV" ? "ALL" : "MV")}
          className={`flex items-center gap-2 transition-all cursor-pointer ${filter !== "ALL" && filter !== "MV" ? "opacity-30" : "opacity-100"}`}
        >
          <div className={`w-2 h-2 rounded-full bg-[#00F2FF] transition-all ${filter === "MV" ? "scale-125 shadow-[0_0_12px_#00F2FF]" : "shadow-[0_0_10px_rgba(0,242,255,0.7)]"}`} />
          <span className={`text-[11px] uppercase tracking-widest font-bold ${filter === "MV" ? "text-[#00F2FF]" : "text-sunu-space"}`}>{t.mv}</span>
        </button>
      </div>

      {/* Main Map Content */}
      <div className="flex-1 relative min-h-0">
        <GridMap lang={lang} filter={filter} />
        
        {/* Meta Stats Panel — desktop only */}
        <div className="hidden lg:block absolute top-8 left-8 z-[2000] w-[340px] space-y-4 pointer-events-none">
            <div className="glass-panel p-7 rounded-xl pointer-events-auto">
                <div className="text-[11px] uppercase tracking-[0.3em] text-sunu-graphite font-bold mb-5 border-b border-white/5 pb-3">{t.contextTitle}</div>
                <div className="space-y-7">
                    <div className="flex items-center gap-5">
                        <Activity className="w-5 h-5 text-sunu-blue shrink-0" />
                        <div className="flex flex-col">
                            <span className="text-2xl font-mono text-sunu-cloud">3,200+<span className="text-sm ml-1 text-sunu-graphite">km</span></span>
                            <span className="text-[10px] uppercase tracking-widest font-bold text-sunu-space">{t.trace}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-5">
                        <Shield className="w-5 h-5 text-sunu-orange shrink-0" />
                        <div className="flex flex-col">
                            <span className="text-2xl font-mono text-sunu-cloud">51<span className="text-sm ml-1 text-sunu-graphite">nodes</span></span>
                            <span className="text-[10px] uppercase tracking-widest font-bold text-sunu-space">{t.nodes}</span>
                        </div>
                    </div>
                    <div className="border-t border-white/5 pt-4">
                        <span className="text-[11px] text-sunu-space leading-relaxed italic opacity-80">
                            {t.legal}
                        </span>
                    </div>
                </div>
            </div>
        </div>

        {/* Legend Overlay — desktop only */}
        <div className="hidden lg:block absolute bottom-12 right-8 z-[2000] p-6 glass-panel rounded-xl text-left pointer-events-auto">
            <div className="text-[10px] uppercase tracking-widest font-bold text-sunu-graphite mb-3 px-1 border-b border-white/5 pb-3">HV Networks</div>
            <div className="flex flex-col gap-2.5 mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-5 h-[2.5px] rounded-full bg-sunu-blue shadow-[0_0_6px_rgba(37,121,252,0.7)]" />
                    <span className="text-[11px] uppercase tracking-wider font-bold text-sunu-cloud">{t.senelec225}</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-5 h-[2.5px] rounded-full bg-[#A78BFA] shadow-[0_0_6px_rgba(167,139,250,0.7)]" />
                    <span className="text-[11px] uppercase tracking-wider font-bold text-sunu-cloud">{t.omvg225}</span>
                </div>
            </div>
            <div className="text-[10px] uppercase tracking-widest font-bold text-sunu-graphite mb-5 px-1 border-b border-white/5 pb-3">{t.fuelTitle}</div>
            <div className="grid grid-cols-2 gap-x-10 gap-y-4">
                <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-sunu-blue border border-white/20 shadow-[0_0_8px_rgba(37,121,252,0.4)]" />
                    <span className="text-[11px] uppercase tracking-wider font-bold text-sunu-cloud">{t.thermal}</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-sunu-orange border border-white/20 shadow-[0_0_8px_rgba(253,162,6,0.4)]" />
                    <span className="text-[11px] uppercase tracking-wider font-bold text-sunu-cloud">{t.solar}</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-[#66BB6A] border border-white/20 shadow-[0_0_8px_rgba(102,187,106,0.4)]" />
                    <span className="text-[11px] uppercase tracking-wider font-bold text-sunu-cloud">{t.wind}</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-[#EF5350] border border-white/20 shadow-[0_0_8px_rgba(239,83,80,0.4)]" />
                    <span className="text-[11px] uppercase tracking-wider font-bold text-sunu-cloud">{t.coal}</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-[#42A5F5] border border-white/20 shadow-[0_0_8px_rgba(66,165,245,0.4)]" />
                    <span className="text-[11px] uppercase tracking-wider font-bold text-sunu-cloud">{t.hydro}</span>
                </div>
                <div className="flex items-center gap-3">
                    <div style={{filter:'drop-shadow(0 0 4px rgba(233,30,99,0.5)) drop-shadow(0 0 1px rgba(255,255,255,0.25))'}}><div className="w-3 h-3 bg-[#E91E63]" style={{clipPath:'polygon(25% 0%,75% 0%,100% 50%,75% 100%,25% 100%,0% 50%)'}}/></div>
                    <span className="text-[11px] uppercase tracking-wider font-bold text-sunu-cloud">{t.industrial}</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-[#6E7180] border border-white/20 shadow-[0_0_6px_rgba(110,113,128,0.4)]" />
                    <span className="text-[11px] uppercase tracking-wider font-bold text-sunu-cloud">{t.substation}</span>
                </div>
            </div>
        </div>
        {/* Mobile panel toggle buttons — bottom-left (Info) and bottom-right (Legend) */}
        <div className="lg:hidden absolute bottom-6 left-0 right-0 z-[2000] flex justify-between px-6 pointer-events-none">
          <button
            onClick={() => setMobilePanel(mobilePanel === "context" ? null : "context")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl glass-panel pointer-events-auto transition-all ${mobilePanel === "context" ? "!border-sunu-blue/50" : ""}`}
          >
            <Info className="w-4 h-4 text-sunu-blue shrink-0" />
            <span className="text-[10px] uppercase tracking-widest font-bold text-sunu-cloud">Info</span>
          </button>
          <button
            onClick={() => setMobilePanel(mobilePanel === "legend" ? null : "legend")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl glass-panel pointer-events-auto transition-all ${mobilePanel === "legend" ? "!border-sunu-orange/50" : ""}`}
          >
            <Layers className="w-4 h-4 text-sunu-orange shrink-0" />
            <span className="text-[10px] uppercase tracking-widest font-bold text-sunu-cloud">Legend</span>
          </button>
        </div>

        {/* Mobile bottom sheet — tap backdrop to dismiss */}
        {mobilePanel && (
          <div className="lg:hidden fixed inset-0 z-[4000]" onClick={() => setMobilePanel(null)}>
            <div
              className="absolute inset-x-0 bottom-0 max-h-[65vh] overflow-y-auto rounded-t-2xl"
              style={{background: 'rgba(14,14,18,0.70)', backdropFilter: 'blur(16px) saturate(160%)', WebkitBackdropFilter: 'blur(16px) saturate(160%)', borderTop: '1px solid rgba(255,255,255,0.10)', boxShadow: '0 -8px 32px rgba(0,0,0,0.35)'}}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>
              {mobilePanel === "context" ? (
                <div className="px-7 pb-8">
                  <div className="text-[11px] uppercase tracking-[0.3em] text-sunu-graphite font-bold mb-5 border-b border-white/5 pb-3">{t.contextTitle}</div>
                  <div className="space-y-7">
                    <div className="flex items-center gap-5">
                      <Activity className="w-5 h-5 text-sunu-blue shrink-0" />
                      <div className="flex flex-col">
                        <span className="text-2xl font-mono text-sunu-cloud">3,200+<span className="text-sm ml-1 text-sunu-graphite">km</span></span>
                        <span className="text-[10px] uppercase tracking-widest font-bold text-sunu-space">{t.trace}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-5">
                      <Shield className="w-5 h-5 text-sunu-orange shrink-0" />
                      <div className="flex flex-col">
                        <span className="text-2xl font-mono text-sunu-cloud">51<span className="text-sm ml-1 text-sunu-graphite">nodes</span></span>
                        <span className="text-[10px] uppercase tracking-widest font-bold text-sunu-space">{t.nodes}</span>
                      </div>
                    </div>
                    <div className="border-t border-white/5 pt-4">
                      <span className="text-[11px] text-sunu-space leading-relaxed italic opacity-80">{t.legal}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="px-6 pb-8">
                  <div className="text-[10px] uppercase tracking-widest font-bold text-sunu-graphite mb-3 px-1 border-b border-white/5 pb-3">HV Networks</div>
                  <div className="flex flex-col gap-2.5 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-[2.5px] rounded-full bg-sunu-blue shadow-[0_0_6px_rgba(37,121,252,0.7)]" />
                      <span className="text-[11px] uppercase tracking-wider font-bold text-sunu-cloud">{t.senelec225}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-[2.5px] rounded-full bg-[#A78BFA] shadow-[0_0_6px_rgba(167,139,250,0.7)]" />
                      <span className="text-[11px] uppercase tracking-wider font-bold text-sunu-cloud">{t.omvg225}</span>
                    </div>
                  </div>
                  <div className="text-[10px] uppercase tracking-widest font-bold text-sunu-graphite mb-5 px-1 border-b border-white/5 pb-3">{t.fuelTitle}</div>
                  <div className="grid grid-cols-2 gap-x-10 gap-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-sunu-blue border border-white/20 shadow-[0_0_8px_rgba(37,121,252,0.4)]" />
                      <span className="text-[11px] uppercase tracking-wider font-bold text-sunu-cloud">{t.thermal}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-sunu-orange border border-white/20 shadow-[0_0_8px_rgba(253,162,6,0.4)]" />
                      <span className="text-[11px] uppercase tracking-wider font-bold text-sunu-cloud">{t.solar}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-[#66BB6A] border border-white/20 shadow-[0_0_8px_rgba(102,187,106,0.4)]" />
                      <span className="text-[11px] uppercase tracking-wider font-bold text-sunu-cloud">{t.wind}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-[#EF5350] border border-white/20 shadow-[0_0_8px_rgba(239,83,80,0.4)]" />
                      <span className="text-[11px] uppercase tracking-wider font-bold text-sunu-cloud">{t.coal}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-[#42A5F5] border border-white/20 shadow-[0_0_8px_rgba(66,165,245,0.4)]" />
                      <span className="text-[11px] uppercase tracking-wider font-bold text-sunu-cloud">{t.hydro}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div style={{filter:'drop-shadow(0 0 4px rgba(233,30,99,0.5)) drop-shadow(0 0 1px rgba(255,255,255,0.25))'}}><div className="w-3 h-3 bg-[#E91E63]" style={{clipPath:'polygon(25% 0%,75% 0%,100% 50%,75% 100%,25% 100%,0% 50%)'}}/></div>
                      <span className="text-[11px] uppercase tracking-wider font-bold text-sunu-cloud">{t.industrial}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-[#6E7180] border border-white/20 shadow-[0_0_6px_rgba(110,113,128,0.4)]" />
                      <span className="text-[11px] uppercase tracking-wider font-bold text-sunu-cloud">{t.substation}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
