// Visual language of the network layers: which color a circuit is, how heavy it
// draws, and which circuits a voltage filter admits.
//
// Kept separate from the map component so the palette and the filter rule are
// stated once. The line colors here are the same ones the Legend advertises —
// when they lived inline in the component it was easy for the two to drift.

import type { LineProps, GridFilter, ViewMode } from "@/types/grid";

export const VOLTAGE_COLOR = {
  hv225: "#2579fc",
  hv225CrossBorder: "#A78BFA",
  hv90: "#FDA206",
  mv: "#00F2FF",
} as const;

/**
 * Cross-border / OMVG detection.
 *
 * Prefers explicit data attributes (the cross_border flag, operator, or a
 * non-Senegal country) and only falls back to matching the free-text name. That
 * ordering keeps styling correct when a line's `name` is null, instead of
 * silently treating an interconnector as domestic.
 */
export function isCrossBorder(props: LineProps): boolean {
  if (props.cross_border === true) return true;
  const operator = String(props.operator || "");
  if (/OMVG|OMVS|WAPP/i.test(operator)) return true;
  const country = String(props.country || "");
  if (country && country.toLowerCase() !== "senegal") return true;
  const name = String(props.name || "");
  return /OMVG|EDM|Trans-?Gambia/i.test(name);
}

/** The stroke color a circuit draws in, by voltage tier. */
export function lineColor(props: LineProps): string {
  const v = Number(props.voltage_kV);
  if (v === 225) return isCrossBorder(props) ? VOLTAGE_COLOR.hv225CrossBorder : VOLTAGE_COLOR.hv225;
  if (v === 90) return VOLTAGE_COLOR.hv90;
  return VOLTAGE_COLOR.mv;
}

export interface LineStyle {
  color: string;
  weight: number;
  opacity: number;
  className: string;
}

/**
 * Style for one line feature.
 *
 * In reliability view the network stays as subtle context: circuits keep their
 * true voltage colors (so HV and MV remain distinguishable) but drop to reduced
 * opacity and weight, letting the node heat-map dominate. The glow classes are
 * also dropped there — a dimmed line with a bright drop-shadow reads as an
 * artifact rather than as recession.
 */
export function lineStyle(props: LineProps, view: ViewMode): LineStyle {
  const relMode = view === "reliability";
  const op = relMode ? 0.3 : 1;
  const wMul = relMode ? 0.7 : 1;
  const v = Number(props.voltage_kV);

  if (v === 225) {
    const intl = isCrossBorder(props);
    return {
      color: intl ? VOLTAGE_COLOR.hv225CrossBorder : VOLTAGE_COLOR.hv225,
      weight: 3.5 * wMul,
      opacity: 0.9 * op,
      className: relMode ? "" : intl ? "hv-225-intl-line" : "hv-225-line",
    };
  }
  if (v === 90) {
    return {
      color: VOLTAGE_COLOR.hv90,
      weight: 2.2 * wMul,
      opacity: 0.85 * op,
      className: relMode ? "" : "hv-90-line",
    };
  }
  return {
    color: VOLTAGE_COLOR.mv,
    weight: 1.5 * wMul,
    opacity: 0.7 * op,
    className: relMode ? "" : "mv-line",
  };
}

/**
 * Does this circuit pass the active voltage filter?
 *
 * "MV" is defined as anything below 90kV rather than as an explicit 30 so that
 * any other distribution voltage present in the data is included rather than
 * silently dropped from the map.
 */
export function passesVoltageFilter(props: LineProps, filter: GridFilter): boolean {
  if (filter === "ALL") return true;
  const v = Number(props.voltage_kV);
  if (filter === "225") return v === 225;
  if (filter === "90") return v === 90;
  if (filter === "MV") return v < 90;
  return true;
}
