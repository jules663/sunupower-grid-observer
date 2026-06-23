#!/usr/bin/env node
// De-duplicates transmission lines in senegal-grid.json. The source (digitized
// from map archives) contains exact-duplicate geometries and near-parallel
// re-digitizations of the same corridor, which render as a tangled "web" of
// overlapping strokes (most visible around Dakar/Rufisque). This collapses each
// cluster of duplicates to a single, most-detailed representative line.
//
// Reviewed data-prep step: run with `npm run dedupe-grid`. Writes the cleaned
// FeatureCollection back to senegal-grid.json (a .bak copy is kept once).

import { readFileSync, writeFileSync, existsSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, "..", "public", "data", "senegal-grid.json");

// Two endpoints are "the same corridor" if the sum of the distance between
// matching endpoints (in either orientation) is under this threshold (~150m).
const ENDPOINT_MATCH_KM = 0.30;

function hav(a, b) {
  const R = 6371, r = (d) => (d * Math.PI) / 180;
  const dLat = r(b[1] - a[1]), dLon = r(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a[1])) * Math.cos(r(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const lineLen = (c) => c.reduce((acc, _, i) => (i ? acc + hav(c[i - 1], c[i]) : 0), 0);
const ends = (f) => { const c = f.geometry.coordinates; return [c[0], c[c.length - 1]]; };

const fc = JSON.parse(readFileSync(FILE, "utf8"));
const feats = fc.features;
const remove = new Set();

// 1) Exact duplicate geometries — keep the first occurrence.
const seen = new Map();
feats.forEach((f, i) => {
  const key = JSON.stringify(f.geometry.coordinates);
  if (seen.has(key)) remove.add(i);
  else seen.set(key, i);
});

// 2) Near-duplicate parallels — union-find cluster by endpoint proximity at the
// same voltage, then keep the most-detailed line (most vertices, then longest).
const parent = feats.map((_, i) => i);
const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
const union = (a, b) => { parent[find(a)] = find(b); };

for (let i = 0; i < feats.length; i++) {
  for (let j = i + 1; j < feats.length; j++) {
    if (feats[i].properties?.voltage_kV !== feats[j].properties?.voltage_kV) continue;
    const [a0, a1] = ends(feats[i]); const [b0, b1] = ends(feats[j]);
    const d = Math.min(hav(a0, b0) + hav(a1, b1), hav(a0, b1) + hav(a1, b0));
    if (d < ENDPOINT_MATCH_KM) union(i, j);
  }
}
const clusters = new Map();
for (let i = 0; i < feats.length; i++) {
  const root = find(i);
  if (!clusters.has(root)) clusters.set(root, []);
  clusters.get(root).push(i);
}
for (const members of clusters.values()) {
  if (members.length < 2) continue;
  const keep = members.reduce((best, i) => {
    const ci = feats[i].geometry.coordinates, cb = feats[best].geometry.coordinates;
    if (ci.length !== cb.length) return ci.length > cb.length ? i : best;
    return lineLen(ci) > lineLen(cb) ? i : best;
  }, members[0]);
  for (const i of members) if (i !== keep) remove.add(i);
}

const kept = feats.filter((_, i) => !remove.has(i));
const before = feats.length, after = kept.length;

if (remove.size === 0) {
  console.log("No duplicate lines found — nothing to do.");
  process.exit(0);
}

if (!existsSync(FILE + ".bak")) copyFileSync(FILE, FILE + ".bak");
fc.features = kept;
writeFileSync(FILE, JSON.stringify(fc, null, 2));

console.log(`De-duplicated senegal-grid.json: ${before} → ${after} lines (removed ${remove.size}).`);
console.log("A one-time backup was written to senegal-grid.json.bak");
