"use client";

import { Network, Activity } from "lucide-react";
import type { ViewMode } from "@/app/page";

interface ViewStrings {
  viewInfra: string;
  viewReliability: string;
}

// Segmented control switching between the Infrastructure trace and the
// Reliability intelligence view. Each segment is a real button with aria-pressed
// so keyboard/SR users get correct semantics.
export function ViewToggle({
  t, view, setView,
}: {
  t: ViewStrings;
  view: ViewMode;
  setView: (v: ViewMode) => void;
}) {
  const segs: { value: ViewMode; label: string; Icon: typeof Network }[] = [
    { value: "infrastructure", label: t.viewInfra, Icon: Network },
    { value: "reliability", label: t.viewReliability, Icon: Activity },
  ];
  return (
    <div className="flex items-center p-0.5 rounded-lg bg-white/[0.04] border border-white/10" role="group" aria-label="View mode">
      {segs.map(({ value, label, Icon }) => {
        const active = view === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => setView(value)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-sunu-blue/70 ${
              active ? "bg-white/[0.10] text-sunu-cloud" : "text-sunu-space hover:text-sunu-cloud"
            }`}
          >
            <Icon className={`w-3.5 h-3.5 ${active && value === "reliability" ? "text-[#F97316]" : active ? "text-sunu-blue" : ""}`} aria-hidden="true" />
            <span className="text-[11px] uppercase tracking-widest font-bold">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
