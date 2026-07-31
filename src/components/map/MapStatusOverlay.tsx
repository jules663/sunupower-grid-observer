"use client";

// Loading and failure states drawn over the map canvas.
//
// The map renders its basemap immediately, so without these an empty Senegal
// looks like a grid with no infrastructure rather than a grid that hasn't
// arrived yet — a misleading state for a tool whose whole claim is coverage.

import type { MapStrings } from "@/lib/mapStrings";

export function MapStatusOverlay({
  loading, error, s,
}: {
  loading: boolean;
  error: boolean;
  s: MapStrings;
}) {
  if (error) {
    return (
      <div
        className="absolute inset-0 z-[1500] flex flex-col items-center justify-center bg-[#121212]/90 px-8 text-center"
        role="alert"
      >
        <span className="text-sm font-bold text-sunu-cloud">{s.errorTitle}</span>
        <span className="mt-2 text-[11px] text-sunu-space max-w-sm leading-relaxed">{s.errorHint}</span>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className="absolute inset-0 z-[1500] flex flex-col items-center justify-center bg-[#121212]/80 pointer-events-none"
        role="status"
        aria-live="polite"
      >
        <div className="w-8 h-8 rounded-full border-2 border-white/15 border-t-sunu-blue animate-spin" aria-hidden="true" />
        <span className="mt-4 text-[11px] uppercase tracking-widest font-bold text-sunu-space">
          {s.loading}
        </span>
      </div>
    );
  }

  return null;
}
