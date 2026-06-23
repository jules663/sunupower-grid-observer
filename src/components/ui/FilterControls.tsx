"use client";

import type { GridFilter } from "@/app/page";

interface FilterStrings {
  backbone: string;
  subBackbone: string;
  mv: string;
}

interface FilterDef {
  value: Exclude<GridFilter, "ALL">;
  labelKey: keyof FilterStrings;
  dotClass: string;
  activeText: string;
  activeShadow: string;
  idleShadow: string;
}

const FILTERS: FilterDef[] = [
  { value: "225", labelKey: "backbone", dotClass: "bg-sunu-blue", activeText: "text-sunu-blue", activeShadow: "scale-125 shadow-[0_0_12px_#2579fc]", idleShadow: "shadow-[0_0_12px_rgba(37,121,252,0.8)]" },
  { value: "90", labelKey: "subBackbone", dotClass: "bg-sunu-orange", activeText: "text-sunu-orange", activeShadow: "scale-125 shadow-[0_0_12px_#FDA206]", idleShadow: "shadow-[0_0_12px_rgba(253,162,6,0.8)]" },
  { value: "MV", labelKey: "mv", dotClass: "bg-[#00F2FF]", activeText: "text-[#00F2FF]", activeShadow: "scale-125 shadow-[0_0_12px_#00F2FF]", idleShadow: "shadow-[0_0_10px_rgba(0,242,255,0.7)]" },
];

// Voltage-level filter toggles, shared between the desktop header and the
// mobile strip. Each toggle is a real button with aria-pressed reflecting the
// active state, so screen-reader and keyboard users get correct semantics.
export function FilterControls({
  t,
  filter,
  setFilter,
  variant,
}: {
  t: FilterStrings;
  filter: GridFilter;
  setFilter: (f: GridFilter) => void;
  variant: "desktop" | "mobile";
}) {
  const gap = variant === "desktop" ? "gap-2.5" : "gap-2";
  return (
    <>
      {FILTERS.map((f) => {
        const active = filter === f.value;
        const dimmed = filter !== "ALL" && !active;
        const label = t[f.labelKey];
        return (
          <button
            key={f.value}
            type="button"
            aria-pressed={active}
            aria-label={label}
            onClick={() => setFilter(active ? "ALL" : f.value)}
            className={`flex items-center ${gap} transition-all cursor-pointer rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-sunu-blue/70 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent ${dimmed ? "opacity-30" : "opacity-100"}`}
          >
            <span className={`w-2 h-2 rounded-full ${f.dotClass} transition-all ${active ? f.activeShadow : f.idleShadow}`} aria-hidden="true" />
            <span className={`text-[11px] uppercase tracking-widest font-bold ${active ? f.activeText : "text-sunu-space"}`}>{label}</span>
          </button>
        );
      })}
    </>
  );
}
