import { describe, it, expect } from "vitest";
import {
  isCrossBorder,
  lineColor,
  lineStyle,
  passesVoltageFilter,
  VOLTAGE_COLOR,
} from "@/lib/gridStyle";
import type { LineProps } from "@/types/grid";

// --- helpers -----------------------------------------------------------------

function line(overrides: Partial<LineProps> = {}): LineProps {
  return { voltage_kV: 225, ...overrides };
}

// --- isCrossBorder -----------------------------------------------------------

describe("isCrossBorder", () => {
  it("returns true when cross_border flag is explicitly true", () => {
    expect(isCrossBorder(line({ cross_border: true }))).toBe(true);
  });

  it("returns false when cross_border flag is explicitly false", () => {
    expect(isCrossBorder(line({ cross_border: false, voltage_kV: 225 }))).toBe(false);
  });

  it("detects OMVG operator", () => {
    expect(isCrossBorder(line({ operator: "OMVG" }))).toBe(true);
  });

  it("detects OMVS operator (case-insensitive)", () => {
    expect(isCrossBorder(line({ operator: "omvs" }))).toBe(true);
  });

  it("detects WAPP operator", () => {
    expect(isCrossBorder(line({ operator: "WAPP" }))).toBe(true);
  });

  it("returns true for a non-Senegal country", () => {
    expect(isCrossBorder(line({ country: "Guinea" }))).toBe(true);
  });

  it("returns false for a Senegal country", () => {
    expect(isCrossBorder(line({ country: "Senegal" }))).toBe(false);
  });

  it("detects OMVG in the line name as fallback", () => {
    expect(isCrossBorder(line({ name: "OMVG Kaolack–Tambacounda" }))).toBe(true);
  });

  it("detects TransGambia in the line name (with hyphen)", () => {
    expect(isCrossBorder(line({ name: "Trans-Gambia 225kV" }))).toBe(true);
  });

  it("detects TransGambia in the line name (no hyphen)", () => {
    expect(isCrossBorder(line({ name: "TransGambia line" }))).toBe(true);
  });

  it("detects EDM in the line name", () => {
    expect(isCrossBorder(line({ name: "EDM–Tobene interconnect" }))).toBe(true);
  });

  it("returns false for a plain domestic line with no cross-border signals", () => {
    expect(isCrossBorder(line({
      cross_border: false,
      operator: "SENELEC",
      country: "Senegal",
      name: "Tobene–Hann 225kV",
    }))).toBe(false);
  });

  it("handles null/undefined optional fields without throwing", () => {
    expect(() => isCrossBorder(line({ name: null, operator: null, country: null }))).not.toThrow();
  });
});

// --- lineColor ---------------------------------------------------------------

describe("lineColor", () => {
  it("returns domestic HV color for a 225kV domestic line", () => {
    expect(lineColor(line({ voltage_kV: 225, country: "Senegal" }))).toBe(VOLTAGE_COLOR.hv225);
  });

  it("returns cross-border color for a 225kV OMVG line", () => {
    expect(lineColor(line({ voltage_kV: 225, operator: "OMVG" }))).toBe(VOLTAGE_COLOR.hv225CrossBorder);
  });

  it("returns hv90 color for a 90kV line", () => {
    expect(lineColor(line({ voltage_kV: 90 }))).toBe(VOLTAGE_COLOR.hv90);
  });

  it("returns mv color for a 33kV line", () => {
    expect(lineColor(line({ voltage_kV: 33 }))).toBe(VOLTAGE_COLOR.mv);
  });

  it("returns mv color for any voltage below 90kV", () => {
    expect(lineColor(line({ voltage_kV: 30 }))).toBe(VOLTAGE_COLOR.mv);
  });
});

// --- lineStyle ---------------------------------------------------------------

describe("lineStyle", () => {
  it("returns full opacity in infrastructure view", () => {
    const style = lineStyle(line({ voltage_kV: 225 }), "infrastructure");
    expect(style.opacity).toBe(0.9);
  });

  it("reduces opacity to 30% of nominal in reliability view", () => {
    // 225kV nominal opacity = 0.9; reliability multiplier = 0.3 → 0.27
    const style = lineStyle(line({ voltage_kV: 225 }), "reliability");
    expect(style.opacity).toBeCloseTo(0.9 * 0.3, 5);
  });

  it("applies a voltage glow class in infrastructure view", () => {
    expect(lineStyle(line({ voltage_kV: 225 }), "infrastructure").className).toBe("hv-225-line");
    expect(lineStyle(line({ voltage_kV: 90  }), "infrastructure").className).toBe("hv-90-line");
    expect(lineStyle(line({ voltage_kV: 33  }), "infrastructure").className).toBe("mv-line");
  });

  it("clears className in reliability view (no glow on dimmed lines)", () => {
    expect(lineStyle(line({ voltage_kV: 225 }), "reliability").className).toBe("");
    expect(lineStyle(line({ voltage_kV: 90  }), "reliability").className).toBe("");
    expect(lineStyle(line({ voltage_kV: 33  }), "reliability").className).toBe("");
  });

  it("uses the cross-border class for an OMVG 225kV line in infra view", () => {
    const style = lineStyle(line({ voltage_kV: 225, operator: "OMVG" }), "infrastructure");
    expect(style.className).toBe("hv-225-intl-line");
    expect(style.color).toBe(VOLTAGE_COLOR.hv225CrossBorder);
  });

  it("reduces weight in reliability view", () => {
    const infra = lineStyle(line({ voltage_kV: 225 }), "infrastructure");
    const rel   = lineStyle(line({ voltage_kV: 225 }), "reliability");
    expect(rel.weight).toBeCloseTo(infra.weight * 0.7, 5);
  });
});

// --- passesVoltageFilter -----------------------------------------------------

describe("passesVoltageFilter", () => {
  it("ALL filter passes every line", () => {
    expect(passesVoltageFilter(line({ voltage_kV: 225 }), "ALL")).toBe(true);
    expect(passesVoltageFilter(line({ voltage_kV: 90  }), "ALL")).toBe(true);
    expect(passesVoltageFilter(line({ voltage_kV: 33  }), "ALL")).toBe(true);
  });

  it("225 filter passes only 225kV lines", () => {
    expect(passesVoltageFilter(line({ voltage_kV: 225 }), "225")).toBe(true);
    expect(passesVoltageFilter(line({ voltage_kV: 90  }), "225")).toBe(false);
    expect(passesVoltageFilter(line({ voltage_kV: 33  }), "225")).toBe(false);
  });

  it("90 filter passes only 90kV lines", () => {
    expect(passesVoltageFilter(line({ voltage_kV: 90  }), "90")).toBe(true);
    expect(passesVoltageFilter(line({ voltage_kV: 225 }), "90")).toBe(false);
    expect(passesVoltageFilter(line({ voltage_kV: 33  }), "90")).toBe(false);
  });

  it("MV filter passes any line below 90kV", () => {
    expect(passesVoltageFilter(line({ voltage_kV: 33  }), "MV")).toBe(true);
    expect(passesVoltageFilter(line({ voltage_kV: 30  }), "MV")).toBe(true);
    expect(passesVoltageFilter(line({ voltage_kV: 11  }), "MV")).toBe(true);
    expect(passesVoltageFilter(line({ voltage_kV: 90  }), "MV")).toBe(false);
    expect(passesVoltageFilter(line({ voltage_kV: 225 }), "MV")).toBe(false);
  });
});
