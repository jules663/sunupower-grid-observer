"use client";

// Calendar-year scrubber for the reliability heat map.
//
// "All" aggregates the full history. Selecting a year restricts the heat to
// events that started in it — except constraints, which are persistent grid
// conditions rather than point-in-time incidents and are always included (see
// computeReliability). That asymmetry is deliberate: hiding a standing capacity
// limit because you scrubbed to last year would misrepresent the network.

import type { YearFilter } from "@/lib/reliability";
import type { MapStrings } from "@/lib/mapStrings";

export function YearSlider({
  years, year, setYear, s,
}: {
  years: number[];
  year: YearFilter;
  setYear: (y: YearFilter) => void;
  s: MapStrings;
}) {
  if (years.length === 0) return null;

  return (
    <div
      className="absolute bottom-28 lg:bottom-6 left-1/2 -translate-x-1/2 z-[2000] glass-panel rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 pointer-events-auto max-w-[calc(100vw-2rem)]"
      role="group"
      aria-label={s.yearFilterLabel}
    >
      <div className="flex items-center gap-2 sm:gap-2.5 overflow-x-auto no-scrollbar">
        <span className="text-[9px] uppercase tracking-widest font-bold text-sunu-space mr-1 shrink-0">
          {s.period}
        </span>
        {(["all", ...years] as YearFilter[]).map((y) => {
          const active = year === y;
          return (
            <button
              key={String(y)}
              type="button"
              aria-pressed={active}
              onClick={() => setYear(y)}
              className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-sunu-blue/70 ${
                active ? "bg-white/[0.12] text-sunu-cloud" : "text-sunu-space hover:text-sunu-cloud"
              }`}
            >
              {y === "all" ? s.allYears : String(y)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
