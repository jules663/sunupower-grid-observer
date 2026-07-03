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
// NOTE: sunupower-esi-sites.json is intentionally NOT served — the ESI layer is
// parked (simulated data). It lives in ../../_archive/parked-data/ and is added
// back here when real ESI sites are published. See src/lib/config.ts.
const LINE_FILES = ["senegal-grid.json", "regional-interconnections.json", "infrastructure-tie-lines.json"];
const POINT_FILES = ["senegal-plants.json", "regional-nodes.json", "industrial-consumers.json"];
// Reliability-layer event files (Phase 1).
const EVENT_FILES = ["outage-events.json", "maintenance-events.json"];

// Files whose point features carry stable asset ids that events may reference.
const ID_FILES = ["senegal-plants.json", "regional-nodes.json", "industrial-consumers.json"];

const VALID_CONFIDENCE = new Set(["measured", "reported", "modeled"]);
const VALID_EVENT_TYPE = new Set(["outage", "constraint", "maintenance"]);
const VALID_SEVERITY = new Set(["low", "medium", "high", "critical"]);

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
const lineCollections = LINE_FILES.map((file) => ({ file, fc: load(file) }));
for (const { file, fc } of lineCollections) checkCollection(file, fc, "line");
for (const file of POINT_FILES) checkCollection(file, load(file), "point");

// --- Node location sanity (catch the next Hann-style mislocation) ---
// A node far from EVERY transmission line vertex is either genuinely remote or
// grossly mislocated (the Hann bug relocated endpoints up to ~38 km). We flag
// nodes beyond FAR_KM from any line. The threshold sits above the legitimately
// remote sites in the current data (e.g. Matam ~22 km) so real data stays clean
// while a gross displacement is caught. Note: a finer "in water" check (a node
// dropped into the bay near dense Dakar lines) needs a higher-resolution
// coastline than the current decorative border — deferred until that exists.
const FAR_KM = 30;

function haversineKm(lon1, lat1, lon2, lat2) {
  const R = 6371, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const lineVertices = [];
for (const { fc } of lineCollections) {
  for (const f of fc?.features ?? []) {
    if (f.geometry?.type === "LineString") {
      for (const c of f.geometry.coordinates) {
        if (Array.isArray(c) && typeof c[0] === "number" && typeof c[1] === "number") lineVertices.push(c);
      }
    }
  }
}

function checkNodeLocations(file, fc) {
  if (!fc?.features || lineVertices.length === 0) return;
  fc.features.forEach((f, i) => {
    const g = f.geometry;
    if (g?.type !== "Point") return;
    const [lon, lat] = g.coordinates;
    if (typeof lon !== "number" || typeof lat !== "number") return;
    let min = Infinity;
    for (const v of lineVertices) {
      const d = haversineKm(lon, lat, v[0], v[1]);
      if (d < min) min = d;
      if (min <= FAR_KM) break; // close enough; stop early
    }
    if (min > FAR_KM) {
      const name = f.properties?.name ?? `feature ${i}`;
      warn(`${file}[${i}] "${name}": ${min.toFixed(1)} km from the nearest transmission line (> ${FAR_KM} km) — verify location or that it belongs on the map`);
    }
  });
}

for (const file of POINT_FILES) checkNodeLocations(file, load(file));

// --- Reliability events (Phase 1) ---
// Collect the set of known asset ids so event asset_refs can be resolved.
const knownIds = new Set();
for (const file of ID_FILES) {
  const fc = load(file);
  for (const f of fc?.features ?? []) {
    if (f.properties?.id) knownIds.add(f.properties.id);
  }
}

function checkEvents(file, fc) {
  if (!fc) { console.log(`\n${file} — not present (skipped)`); return; }
  if (fc.type !== "FeatureCollection" || !Array.isArray(fc.features)) { err(`${file}: not a FeatureCollection`); return; }
  console.log(`\n${file} — ${fc.features.length} events`);
  const ids = new Set();
  fc.features.forEach((f, i) => {
    const p = f.properties ?? {};
    if (!p.event_id) err(`${file}[${i}]: missing event_id`);
    else if (ids.has(p.event_id)) err(`${file}[${i}]: duplicate event_id "${p.event_id}"`);
    else ids.add(p.event_id);

    if (!p.asset_ref) err(`${file}[${i}]: missing asset_ref`);
    else if (!knownIds.has(p.asset_ref)) err(`${file}[${i}]: asset_ref "${p.asset_ref}" does not resolve to a known asset id`);

    if (!VALID_EVENT_TYPE.has(p.event_type)) err(`${file}[${i}]: invalid event_type "${p.event_type}"`);
    if (!VALID_SEVERITY.has(p.severity)) err(`${file}[${i}]: invalid severity "${p.severity}"`);
    if (!VALID_CONFIDENCE.has(p.confidence)) err(`${file}[${i}]: invalid confidence "${p.confidence}"`);
    if (!p.source) warn(`${file}[${i}]: no source given`);

    // System indices (Phase 4): if present, must be sane and carry a scope so
    // they're never read as node-level measurements.
    if (p.saifi != null && (typeof p.saifi !== "number" || p.saifi < 0)) err(`${file}[${i}]: saifi must be a non-negative number`);
    if (p.saidi_min != null && (typeof p.saidi_min !== "number" || p.saidi_min < 0)) err(`${file}[${i}]: saidi_min must be a non-negative number (minutes)`);
    if ((p.saifi != null || p.saidi_min != null) && !p.scope) warn(`${file}[${i}]: SAIFI/SAIDI present without a 'scope' — should state the aggregate area`);

    // Date sanity
    const start = Date.parse(p.start);
    if (isNaN(start)) err(`${file}[${i}]: start "${p.start}" is not a valid ISO date`);
    if (p.end != null) {
      const end = Date.parse(p.end);
      if (isNaN(end)) err(`${file}[${i}]: end "${p.end}" is not a valid ISO date`);
      else if (!isNaN(start) && end < start) err(`${file}[${i}]: end is before start`);
    }

    // Geometry should match the referenced asset location (Point in bbox)
    const g = f.geometry;
    if (g?.type !== "Point") err(`${file}[${i}]: event geometry must be a Point`);
    else if (!inBbox(g.coordinates[0], g.coordinates[1])) warn(`${file}[${i}]: event point outside region bbox`);
  });
}

for (const file of EVENT_FILES) checkEvents(file, load(file));

console.log(`\n${errors === 0 ? "✓" : "✗"} Done — ${errors} error(s), ${warnings} warning(s).`);
process.exit(errors > 0 ? 1 : 0);
