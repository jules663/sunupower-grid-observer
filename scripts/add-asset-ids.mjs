#!/usr/bin/env node
// Adds a stable `id` (slug of the name) to every node feature that lacks one,
// across the node datasets. Events in the reliability layer reference assets by
// this id rather than by coordinates, so moving a node never orphans its
// history. Idempotent: features that already have an id are left untouched.
//
// Run with: npm run add-asset-ids

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, "..", "public", "data");

const NODE_FILES = ["senegal-plants.json", "regional-nodes.json", "industrial-consumers.json"];

function slug(s) {
  return String(s || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

let added = 0;
const allIds = new Set();

for (const file of NODE_FILES) {
  const path = join(DATA, file);
  const fc = JSON.parse(readFileSync(path, "utf8"));
  let changed = false;

  fc.features.forEach((f) => {
    if (!f.properties) f.properties = {};
    if (!f.properties.id) {
      let base = slug(f.properties.name);
      if (!base) base = "node";
      let id = base, n = 2;
      while (allIds.has(id)) id = `${base}-${n++}`; // guarantee uniqueness
      f.properties.id = id;
      added++;
      changed = true;
    }
    allIds.add(f.properties.id);
  });

  if (changed) writeFileSync(path, JSON.stringify(fc, null, 2));
  console.log(`${file}: ${fc.features.length} features, ids present.`);
}

console.log(`\nAdded ${added} new id(s). ${allIds.size} unique asset ids total.`);
