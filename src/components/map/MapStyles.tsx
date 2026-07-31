"use client";

// Global CSS for the Leaflet surface: basemap tone, glass zoom control, line
// glows, and the popup/tooltip chrome.
//
// This has to be global rather than scoped because Leaflet builds its controls,
// popups and tooltips as detached DOM outside the React tree, so a scoped class
// never reaches them. Isolating it here keeps ~90 lines of override CSS out of
// the map component's render.

export function MapStyles() {
  return (
    <style jsx global>{`
      /* CARTO Dark Matter renders water as a distinct dark blue-grey and land a
         touch lighter, so coastline and islands (e.g. Gorée) stay readable
         without filter hacks. Background matches the theme's water tone. */
      .leaflet-container { background: #1B2026 !important; }
      .basemap-tiles { filter: saturate(1.05); }

      /* Glass zoom control, overriding Leaflet's default white buttons. */
      .leaflet-control-zoom {
        border: 1px solid rgba(255,255,255,0.10) !important;
        border-radius: 12px !important;
        overflow: hidden !important;
        box-shadow: 0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.07) !important;
        backdrop-filter: blur(14px) saturate(160%) brightness(0.96);
        -webkit-backdrop-filter: blur(14px) saturate(160%) brightness(0.96);
      }
      .leaflet-control-zoom a {
        background: rgba(14,14,18,0.48) !important;
        color: #EDEFF7 !important;
        border: none !important;
        border-bottom: 1px solid rgba(255,255,255,0.08) !important;
        width: 32px !important;
        height: 32px !important;
        line-height: 30px !important;
        font-size: 17px !important;
        transition: background 0.15s ease, color 0.15s ease;
      }
      .leaflet-control-zoom a:last-child { border-bottom: none !important; }
      .leaflet-control-zoom a:hover {
        background: rgba(255,255,255,0.10) !important;
        color: #FFFFFF !important;
      }
      .leaflet-control-zoom a.leaflet-disabled {
        background: rgba(14,14,18,0.40) !important;
        color: rgba(157,162,179,0.45) !important;
      }

      /* Voltage-tier glows. Applied via className from lineStyle(), and dropped
         in reliability view where a dimmed line with a bright shadow reads as
         an artifact rather than as recession. */
      .hv-225-line { filter: drop-shadow(0 0 4px #2579fcCC); }
      .hv-225-intl-line { filter: drop-shadow(0 0 4px #A78BFACC); }
      .hv-90-line { filter: drop-shadow(0 0 3px #FDA206CC); }
      .mv-line { filter: drop-shadow(0 0 2px #00F2FF99); }

      /* Popup chrome — frosted glass matching the overlay panels. */
      .custom-popup .leaflet-popup-content-wrapper { background: rgba(14, 14, 18, 0.48) !important; backdrop-filter: blur(14px) saturate(160%) brightness(0.96) !important; -webkit-backdrop-filter: blur(14px) saturate(160%) brightness(0.96) !important; color: #EDEFF7 !important; border-radius: 12px !important; border: 1px solid rgba(255, 255, 255, 0.10) !important; box-shadow: 0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.07) !important; }
      .custom-popup .leaflet-popup-tip { background: rgba(14, 14, 18, 0.48) !important; backdrop-filter: blur(14px) !important; border: 1px solid rgba(255, 255, 255, 0.10) !important; box-shadow: none !important; }
      .leaflet-popup-content { margin: 16px 20px !important; width: auto !important; min-width: 220px; }

      /* Line hover tooltip — same frosted language as the popups but lighter,
         so tracing a circuit never feels as heavy as clicking one. */
      .grid-line-tooltip {
        background: rgba(14,14,18,0.60) !important;
        backdrop-filter: blur(12px) saturate(160%);
        -webkit-backdrop-filter: blur(12px) saturate(160%);
        border: 1px solid rgba(255,255,255,0.10) !important;
        border-radius: 8px !important;
        box-shadow: 0 6px 22px rgba(0,0,0,0.35) !important;
        color: #EDEFF7 !important;
        padding: 7px 10px !important;
        font-family: inherit !important;
        white-space: nowrap;
        pointer-events: none;
      }
      .grid-line-tooltip::before { display: none !important; }
      .grid-line-tooltip-dot {
        display: inline-block; width: 7px; height: 7px; border-radius: 50%;
        margin-right: 7px; vertical-align: 3px;
      }
      .grid-line-tooltip-body { display: inline-flex; flex-direction: column; gap: 1px; vertical-align: middle; }
      .grid-line-tooltip-title {
        font-size: 9px; text-transform: uppercase; letter-spacing: 0.14em;
        font-weight: 700; color: #9DA2B3;
      }
      .grid-line-tooltip-meta { font-size: 11px; color: #EDEFF7; font-weight: 600; }
    `}</style>
  );
}
