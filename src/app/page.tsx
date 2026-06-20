"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { Activity, Shield, Database, Globe } from "lucide-react";

const GridMap = dynamic(() => import("@/components/map/GridMap"), {
  ssr: false,
});

export type GridFilter = "ALL" | "225" | "90" | "MV";

export default function Home() {
  const [lang, setLang] = useState<"EN" | "FR">("EN");
  const [filter, setFilter] = useState<GridFilter>("ALL");

  const t = {
    EN: {
      title: "Grid Observer",
      subtitle: "Unified Infrastructure Advisor v1.3",
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
      industrial: "Industrial Off-taker"
    },
    FR: {
      title: "Observateur de Réseau",
      subtitle: "Conseiller en Infrastructures Unifiées v1.2",
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
      industrial: "Consommateur Industriel"
    }
  }[lang];

  return (
    <main className="flex flex-col h-screen w-full bg-sunu-phantom overflow-hidden">
      <header className="h-[72px] border-b border-white/5 flex items-center justify-between px-8 bg-sunu-arsenic/40 backdrop-blur-3xl z-[2000]">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <span className="text-sm uppercase tracking-[0.3em] font-bold text-sunu-cloud leading-tight">{t.title}</span>
            <span className="text-[11px] uppercase tracking-[0.2em] text-sunu-graphite font-bold">{t.subtitle}</span>
          </div>
        </div>
        
        <div className="hidden lg:flex items-center gap-10">
          <button 
            onClick={() => setFilter(filter === "225" ? "ALL" : "225")}
            className={`flex items-center gap-2.5 transition-all ${filter !== "ALL" && filter !== "225" ? "opacity-30" : "opacity-100"}`}
          >
            <div className="w-2 h-2 rounded-full bg-sunu-blue shadow-[0_0_12px_rgba(37,121,252,0.8)]" />
            <span className={`text-[11px] uppercase tracking-widest font-bold ${filter === "225" ? "text-sunu-blue" : "text-sunu-space"}`}>{t.backbone}</span>
          </button>
          
          <button 
            onClick={() => setFilter(filter === "90" ? "ALL" : "90")}
            className={`flex items-center gap-2.5 transition-all ${filter !== "ALL" && filter !== "90" ? "opacity-30" : "opacity-100"}`}
          >
            <div className="w-2 h-2 rounded-full bg-sunu-orange shadow-[0_0_10px_rgba(253,162,6,0.8)]" />
            <span className={`text-[11px] uppercase tracking-widest font-bold ${filter === "90" ? "text-sunu-orange" : "text-sunu-space"}`}>{t.subBackbone}</span>
          </button>
          
          <button 
            onClick={() => setFilter(filter === "MV" ? "ALL" : "MV")}
            className={`flex items-center gap-2.5 transition-all ${filter !== "ALL" && filter !== "MV" ? "opacity-30" : "opacity-100"}`}
          >
            <div className="w-2 h-2 rounded-full bg-[#00F2FF] shadow-[0_0_10px_rgba(0,242,255,0.7)]" />
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

      <div className="flex-1 relative">
        <GridMap lang={lang} filter={filter} />
        
        <div className="absolute top-8 left-8 z-[2000] w-[340px] space-y-4 pointer-events-none">
            <div className="bg-white/[0.03] backdrop-blur-3xl p-7 rounded-xl border border-white/10 pointer-events-auto">
                <div className="text-[11px] uppercase tracking-[0.3em] text-sunu-graphite font-bold mb-5 border-b border-white/5 pb-3">{t.contextTitle}</div>
                <div className="space-y-7">
                    <div className="flex items-start gap-5">
                        <Activity className="w-5 h-5 text-sunu-blue mt-0.5" />
                        <div className="flex flex-col">
                            <span className="text-2xl font-mono text-sunu-cloud">3,200+<span className="text-sm ml-1 text-sunu-graphite">km</span></span>
                            <span className="text-[10px] uppercase tracking-widest font-bold text-sunu-space">{t.trace}</span>
                        </div>
                    </div>
                    <div className="flex items-start gap-5">
                        <Shield className="w-5 h-5 text-sunu-orange mt-0.5" />
                        <div className="flex flex-col">
                            <span className="text-2xl font-mono text-sunu-cloud">51<span className="text-sm ml-1 text-sunu-graphite">nodes</span></span>
                            <span className="text-[10px] uppercase tracking-widest font-bold text-sunu-space">{t.nodes}</span>
                        </div>
                    </div>
                    <div className="flex items-start gap-5 pt-2">
                        <Database className="w-5 h-5 text-sunu-graphite mt-0.5" />
                        <div className="flex flex-col">
                            <span className="text-[11px] text-sunu-space leading-relaxed italic opacity-80">
                                {t.legal}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div className="absolute bottom-12 right-8 z-[2000] p-6 bg-white/[0.03] backdrop-blur-3xl rounded-xl border border-white/10 text-left pointer-events-auto">
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
                    <div className="w-3 h-3 bg-[#E91E63] border border-white/20 shadow-[0_0_8px_rgba(233,30,99,0.4)]" style={{clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)'}} />
                    <span className="text-[11px] uppercase tracking-wider font-bold text-sunu-cloud">{t.industrial}</span>
                </div>
            </div>
        </div>
      </div>
    </main>
  );
}
