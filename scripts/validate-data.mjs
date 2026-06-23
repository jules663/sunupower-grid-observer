#!/usr/bin/env node
// Validates the GeoJSON data files in public/data against the assumptions the
// app makes when rendering. Run with: npm run validate-data
// Exits non-zero if any error-level check fails, so it can gate CI / a build.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "public", "data");

// Senegal + immediate region bounding box [lon, lat].
const BBOX = { lonMin: -17.7, lonMax: -10.5, latMin: 11.5, latMax: 17.0 };

// Which files are loaded and rendered by the app (others may exist unused).
const LINE_FILES = ["senegal-grid.json", "regional-interconnections.json", "infrastructure-tie-lines.json"];
const POINT_FILES = ["senegal-plants.json", "regional-nodes.json", "industrial-consumers.json", "sunupower-esi-sites.json"];

let errors = 0;
let warnings = 0;
const err = (m) => { console.error(`  ✗ ${m}`); errors++; };
const warn = (m) => { console.warn(`  ⚠ ${m}`); warnings++; };

function load(file) {
  try {
    return JSON.parse(readFileSync(join(DATA_DIR, file), "utf8"));
  } catch (e) {
    err(`${file}: not readable / invalid JSON (${e.message})`);
    return null;
  }
}

function inBbox(lon, lat) {
  return lon >= BBOX.lonMin && lon <= BBOX.lonMax && lat >= BBOX.latMin && lat <= BBOX.latMax;
}

function checkCollection(file, fc, kind) {
  if (!fc) return;
  if (fc.type !== "FeatureCollection" || !Array.isArray(fc.features)) {
    err(`${file}: not a FeatureCollection`);
    return;
  }
  console.log(`\n${file} — ${fc.features.length} features`);

  fc.features.forEach((f, i) => {
    const g = f.geometry;
    if (!g || !g.coordinates) { err(`${file}[${i}]: missing geometry`); return; }

    if (kind === "line") {
      if (g.type !== "LineString") { err(`${file}[${i}]: expected LineString, got ${g.type}`); return; }
      const v = f.properties?.voltage_kV;
      if (typeof v !== "number") err(`${file}[${i}]: voltage_kV must be a number (got ${JSON.stringify(v)})`);
      // length_km is parsed with Number() in-app; flag values that won't parse.
      const lk = f.properties?.length_km;
      if (lk != null && isNaN(Number(lk))) warn(`${file}[${i}]: length_km "${lk}" is not numeric`);
      g.coordinates.forEach((c) => {
        if (!Array.isArray(c) || c.length < 2) { err(`${file}[${i}]: malformed coordinate`); return; }
        if (!inBbox(c[0], c[1])) warn(`${file}[${i}]: vertex [${c[0]}, ${c[1]}] outside region bbox (possible lat/lon swap)`);
      });
    } else {
      if (g.type !== "Point") { err(`${file}[${i}]: expected Point, got ${g.type}`); return; }
      const [lon, lat] = g.coordinates;
      if (typeof lon !== "number" || typeof lat !== "number") { err(`${file}[${i}]: non-numeric coordinate`); return; }
      if (!inBbox(lon, lat)) warn(`${file}[${i}]: point [${lon}, ${lat}] outside region bbox (possible lat/lon swap)`);
      if (!f.properties?.name) warn(`${file}[${i}]: point has no name`);
    }
  });
}

console.log("Validating GeoJSON data files…");
for (const file of LINE_FILES) checkCollection(file, load(file), "line");
for (const file of POINT_FILES) checkCollection(file, load(file), "point");

console.log(`\n${errors === 0 ? "✓" : "✗"} Done — ${errors} error(s), ${warnings} warning(s).`);
process.exit(errors > 0 ? 1 : 0);
