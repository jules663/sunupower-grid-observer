#!/usr/bin/env node
// Fetch recent Senegal power-outage reports and Internet-outage signals,
// then append new events to public/data/outage-events.json.
//
// USAGE
//   node scripts/fetch-outages.mjs [--dry-run] [--days=7] [--debug]
//
//   --dry-run   Print events that would be added; do NOT write the file.
//   --days=N    Look back N days (default 7).
//   --debug     Print every article title + whether it passed the filter.
//
// SETUP
//   No API key required. Both sources are public and free.
//
// HOW IT WORKS — two independent sources:
//
//   SOURCE 1 — Senegalese RSS feeds (confidence: "reported")
//     Fetches senenews.com, lequotidien.sn, rewmi.com, seneweb.com, actusen.sn.
//     Each article must pass two local filters before an asset match is attempted:
//       1. POWER SIGNAL  — title/description contains a power-outage term.
//       2. SENEGAL CONTEXT — title/description mentions a Senegal city/region.
//     Severity is estimated from text heuristics. Duration is unknown (null).
//
//   SOURCE 2 — IODA Internet Outage API (confidence: "modeled")
//     Georgia Tech's IODA project (ioda.inetintel.cc.gatech.edu) detects
//     Internet connectivity drops via BGP routing changes, active probing,
//     and network telescope data. These are NOT direct power-outage readings —
//     an Internet drop is a *proxy* for a power or telecom disruption — but
//     they are machine-measured, timestamped, and carry exact duration.
//     Events are fetched at region level (e.g. "Dakar") and mapped to the
//     nearest grid asset via ASSET_MAP.
//     IMPORTANT: IODA events are tagged confidence="modeled" and the cause
//     field always states "Internet connectivity drop (IODA/datasource)" so
//     the UI never implies a confirmed power failure.
//
// INTEGRATION
//   Replace readEventFile() in src/lib/eventStore.ts with a database query and
//   have this script write to the DB instead — the frontend never needs changing.
//   See the comment block at the top of src/lib/eventStore.ts for details.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUTAGE_FILE = join(ROOT, "public", "data", "outage-events.json");

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const DEBUG = args.includes("--debug");
const daysArg = args.find((a) => a.startsWith("--days="));
const LOOKBACK_DAYS = daysArg ? parseInt(daysArg.split("=")[1], 10) : 7;

// ---------------------------------------------------------------------------
// RSS sources — Senegalese outlets with consistent délestage/SENELEC coverage.
// All URLs verified live. Unreachable feeds are skipped gracefully at runtime.
// To add a new source: append its RSS URL here — no other code changes needed.
// ---------------------------------------------------------------------------
const RSS_FEEDS = [
  "https://www.senenews.com/feed",       // verified ✓
  "https://www.rewmi.com/feed/",         // verified ✓
  "https://www.seneweb.com/feed/",       // verified ✓
  "https://www.actusen.sn/feed/",        // verified ✓
  // lequotidien.sn removed — returns HTTP 403 for all automated requests
];

// ---------------------------------------------------------------------------
// Known asset map: city/region keywords → { id, coordinates }
// Coordinates match public/data/senegal-plants.json exactly.
// ---------------------------------------------------------------------------
const ASSET_MAP = [
  { id: "hann-substation",           coords: [-17.4375, 14.7318], keywords: ["dakar", "hann", "médina", "medina", "plateau", "almadies", "yoff", "ngor", "rufisque", "mermoz", "fann", "liberté", "liberte", "grand yoff", "parcelles", "cambérène", "camberene", "ouest foire", "ouest-foire", "dalifort"] },
  { id: "bel-air-substation",        coords: [-17.458,  14.678],  keywords: ["bel-air", "bel air", "grand-dakar"] },
  { id: "patte-d-oie-hub",           coords: [-17.405,  14.758],  keywords: ["patte d'oie", "patte-d-oie", "guédiawaye", "guediawaye", "pikine"] },
  { id: "cap-des-biches",            coords: [-17.324,  14.734],  keywords: ["cap des biches", "cap-des-biches", "mbao"] },
  { id: "kounoune-power-station",    coords: [-17.266,  14.743],  keywords: ["kounoune"] },
  { id: "sendou-power",              coords: [-17.228,  14.692],  keywords: ["sendou"] },
  { id: "diamniadio-tech-hub",       coords: [-17.28,   14.72],   keywords: ["diamniadio"] },
  { id: "thies-substation",          coords: [-16.45,   15.05],   keywords: ["thiès", "thies", "thiess"] },
  { id: "tivaouane-substation",      coords: [-16.95,   14.85],   keywords: ["tivaouane"] },
  { id: "kayar-substation",          coords: [-17.118,  14.912],  keywords: ["kayar"] },
  { id: "mbour-substation",          coords: [-16.75,   14.65],   keywords: ["mbour", "saly", "joal"] },
  { id: "diourbel-substation",       coords: [-15.98,   14.75],   keywords: ["diourbel"] },
  { id: "kaolack-substation",        coords: [-16.03,   14.15],   keywords: ["kaolack"] },
  { id: "kahone-solar",              coords: [-15.95,   14.43],   keywords: ["kahone"] },
  { id: "nioro-substation",          coords: [-16.05,   13.65],   keywords: ["nioro"] },
  { id: "merina-dakhar",             coords: [-15.52,   13.78],   keywords: ["mérina", "merina", "dakhar"] },
  { id: "saint-louis-substation",    coords: [-15.65,   16.21],   keywords: ["saint-louis", "saint louis"] },
  { id: "ross-bethio-substation",    coords: [-16.15,   16.45],   keywords: ["ross-béthio", "ross bethio"] },
  { id: "richard-toll-hub",          coords: [-16.35,   16.15],   keywords: ["richard-toll", "richard toll"] },
  { id: "dagana-substation",         coords: [-15.25,   16.55],   keywords: ["dagana"] },
  { id: "podor-substation",          coords: [-14.95,   16.65],   keywords: ["podor"] },
  { id: "matam-hub",                 coords: [-13.25,   16.15],   keywords: ["matam"] },
  { id: "bakel-substation",          coords: [-13.15,   14.45],   keywords: ["bakel"] },
  { id: "tambacounda-substation",    coords: [-13.75,   13.75],   keywords: ["tambacounda", "tamba"] },
  { id: "kedougou-substation",       coords: [-12.65,   12.55],   keywords: ["kédougou", "kedougou"] },
  { id: "koungheul-substation",      coords: [-14.25,   14.65],   keywords: ["koungheul"] },
  { id: "kaffrine-substation",       coords: [-14.65,   14.15],   keywords: ["kaffrine"] },
  { id: "linguere-substation",       coords: [-15.35,   15.45],   keywords: ["linguère", "linguere"] },
  { id: "dara-substation",           coords: [-15.85,   15.15],   keywords: ["dara"] },
  { id: "santhiou-mekhe",            coords: [-16.48,   15.65],   keywords: ["mékhé", "mekhe", "santhiou"] },
  { id: "tobene-power",              coords: [-16.857,  15.111],  keywords: ["tobène", "tobene"] },
  { id: "malicounda",                coords: [-16.921,  14.456],  keywords: ["malicounda", "mballing"] },
  { id: "taiba-n-diaye-wind",        coords: [-16.883,  15.166],  keywords: ["taiba", "taïba", "n'diaye"] },
  { id: "bokhol-solar",              coords: [-16.25,   15.75],   keywords: ["bokhol"] },
  { id: "kolda-solar-bess",          coords: [-14.85,   13.15],   keywords: ["kolda"] },
  { id: "sedhiou-substation",        coords: [-15.75,   12.85],   keywords: ["sédhiou", "sedhiou"] },
  { id: "velingara-substation",      coords: [-15.12,   12.98],   keywords: ["vélingara", "velingara"] },
  { id: "ziguinchor-substation",     coords: [-16.25,   12.55],   keywords: ["ziguinchor", "casamance"] },
  { id: "sambangalou-hydro-planned", coords: [-12.21,   13.15],   keywords: ["sambangalou"] },
  { id: "kedougou-gold-grid",        coords: [-12.15,   12.95],   keywords: ["sabodala", "massawa", "niakafiri"] },
];

// ---------------------------------------------------------------------------
// IODA region name → asset_ref. Maps IODA's Senegal administrative region
// names to the best-matching grid node. Unmapped regions are skipped.
// ---------------------------------------------------------------------------
const IODA_REGION_MAP = {
  "Dakar":        "hann-substation",
  "Thiès":        "thies-substation",
  "Thies":        "thies-substation",
  "Kaolack":      "kaolack-substation",
  "Saint-Louis":  "saint-louis-substation",
  "Tambacounda":  "tambacounda-substation",
  "Ziguinchor":   "ziguinchor-substation",
  "Matam":        "matam-hub",
  "Diourbel":     "diourbel-substation",
  "Fatick":       "kaolack-substation",   // no direct asset; nearest hub
  "Kaffrine":     "kaffrine-substation",
  "Kédougou":     "kedougou-substation",
  "Kedougou":     "kedougou-substation",
  "Kolda":        "kolda-solar-bess",
  "Louga":        "linguere-substation",  // no direct asset; nearest hub
  "Sédhiou":      "sedhiou-substation",
  "Sedhiou":      "sedhiou-substation",
  "Vélingara":    "velingara-substation",
  "Velingara":    "velingara-substation",
};

// IODA score threshold: events below this are noise (brief BGP flaps, etc.).
// Empirically, scores > 500 correspond to meaningful connectivity drops.
const IODA_MIN_SCORE = 500;

// ---------------------------------------------------------------------------
// Relevance filters — both must pass.
//
//   POWER SIGNAL:    article is about electricity disruption.
//   SENEGAL CONTEXT: safety net for non-Senegal feeds added in the future.
// ---------------------------------------------------------------------------
const OUTAGE_SIGNALS =
  /d[eé]lestage|coupure.*courant|coupures?.*[eé]lectri|panne.*[eé]lectri|manque.*[eé]lectri|electricity.{0,10}(cut|outage|fail)|power.{0,6}(outage|cut|fail|shed)|load.?shedding|blackout|black-out|senelec/i;

const SENEGAL_SIGNALS =
  /s[eé]n[eé]gal|senelec|dakar|thiès|thies|kaolack|ziguinchor|saint.louis|tambacounda|touba|mbour|casamance/i;

function isOutageArticle(title, description) {
  const text = `${title} ${description ?? ""}`;
  return OUTAGE_SIGNALS.test(text) && SENEGAL_SIGNALS.test(text);
}

// ---------------------------------------------------------------------------
// Planned-maintenance detector.
// Returns true when the article describes a scheduled/programmed cut rather
// than an unplanned outage. Used to set planned:true and cap severity.
//
// Deliberately narrow — only match terms that unambiguously assert a schedule:
//   - programm[eé] / planifi[eé]: "coupures programmées", "travaux planifiés"
//   - calendrier de (travaux|coupures): explicit schedule reference
//   - "scheduled" (English)
//
// Excluded intentionally:
//   - "travaux" alone — appears in questions ("s'agit-il de travaux?") and
//     unconfirmed speculation, producing false positives.
//   - "maintenance" alone — too generic; "maintenance" in English often appears
//     in unrelated contexts.
// ---------------------------------------------------------------------------
const PLANNED_SIGNALS =
  /programm[eé]|planifi[eé]|calendrier\s+de\s+(travaux|coupures?)|coupures?\s+programm|scheduled\s+(outage|cut|maintenance)/i;

function isPlanned(text) {
  return PLANNED_SIGNALS.test(text);
}

// ---------------------------------------------------------------------------
// Severity heuristics.
// "capitale" removed — it refers to the city Dakar, not outage magnitude.
// Planned events are capped at "medium" by the caller.
// ---------------------------------------------------------------------------
function estimateSeverity(text) {
  const t = text.toLowerCase();
  if (/black.?out|total(e)? (panne|délestage)|nationwide|nation.wide|whole (city|country)/.test(t)) return "critical";
  if (/plusieurs (heures|jours)|many hours|multiple (days|hours)|grande partie|large parts?|widespread/.test(t)) return "high";
  if (/quelques heures|few hours|partial|partiel/.test(t)) return "medium";
  return "low";
}

// ---------------------------------------------------------------------------
// Asset matcher.
// ---------------------------------------------------------------------------
function matchAsset(text) {
  const t = text.toLowerCase();
  for (const asset of ASSET_MAP) {
    if (asset.keywords.some((kw) => t.includes(kw))) return asset;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Minimal RSS parser — extracts <item> fields without any external dependency.
// Handles CDATA, HTML-encoded entities, and strips HTML tags from descriptions.
// ---------------------------------------------------------------------------
function stripHtml(s) {
  return s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function extractField(xml, tag) {
  // Match <tag>…</tag> or <tag><![CDATA[…]]></tag>
  const re = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([^<]*))</${tag}>`, "i");
  const m = xml.match(re);
  if (!m) return "";
  return decodeEntities(stripHtml(m[1] ?? m[2] ?? "")).trim();
}

function parseRss(xml) {
  const items = [];
  // Split on <item> boundaries.
  const parts = xml.split(/<item[\s>]/i);
  for (let i = 1; i < parts.length; i++) {
    const chunk = parts[i];
    const title       = extractField(chunk, "title");
    const link        = extractField(chunk, "link") || extractField(chunk, "guid");
    const description = extractField(chunk, "description");
    const pubDate     = extractField(chunk, "pubDate");
    if (!title || !link) continue;
    items.push({ title, url: link, description, publishedAt: pubDate });
  }
  return items;
}

// ---------------------------------------------------------------------------
// IODA: fetch Internet-outage events for Senegal (country + region level).
// Returns an array of GeoJSON features ready to merge, deduplicating against
// existingSourceUrls by a stable "ioda:<location>:<start>" source key.
// ---------------------------------------------------------------------------
async function fetchIodaFeatures(existingSourceUrls) {
  const until = Math.floor(Date.now() / 1000);
  const from  = until - LOOKBACK_DAYS * 86_400;
  const API   = "https://api.ioda.inetintel.cc.gatech.edu/v2/outages/events";

  // Fetch both country-level and region-level events in parallel.
  const urls = [
    `${API}?entityType=country&entityCode=SN&from=${from}&until=${until}&limit=100`,
    `${API}?entityType=region&relatedTo=country/SN&from=${from}&until=${until}&limit=100`,
  ];

  let rawEvents = [];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "GridObserver-fetch-outages/1.0" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      rawEvents.push(...(json.data ?? []));
    } catch (e) {
      console.warn(`  ⚠ IODA ${url}: ${e.message} — skipped`);
    }
  }

  console.log(`  IODA: ${rawEvents.length} raw event(s) retrieved.`);

  const features = [];
  let skippedScore = 0, skippedNoRegion = 0, skippedDupe = 0;

  for (const ev of rawEvents) {
    if ((ev.score ?? 0) < IODA_MIN_SCORE) { skippedScore++; continue; }

    // Resolve to an asset. Country-level events map to the capital hub.
    // Region-level events use IODA_REGION_MAP.
    const regionName = ev.location_name ?? "";
    let assetId;
    if (ev.location?.startsWith("country/")) {
      assetId = "hann-substation"; // national-level → Dakar hub
    } else {
      assetId = IODA_REGION_MAP[regionName];
    }
    if (!assetId) { skippedNoRegion++; continue; }

    const asset = ASSET_MAP.find((a) => a.id === assetId);
    if (!asset) { skippedNoRegion++; continue; }

    // Stable dedup key — not a URL but treated identically by the dedup set.
    const sourceKey = `ioda:${ev.location}:${ev.start}:${ev.datasource}`;
    if (existingSourceUrls.has(sourceKey)) { skippedDupe++; continue; }

    const startIso = new Date(ev.start * 1000).toISOString();
    const endIso   = ev.duration ? new Date((ev.start + ev.duration) * 1000).toISOString() : null;
    const duration_min = ev.duration ? Math.round(ev.duration / 60) : null;

    // Severity from score thresholds (empirically tuned against known events).
    let severity;
    if      (ev.score >= 5000) severity = "critical";
    else if (ev.score >= 2000) severity = "high";
    else if (ev.score >= 1000) severity = "medium";
    else                       severity = "low";

    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: asset.coords },
      properties: {
        event_id:          null,
        asset_ref:         assetId,
        asset_type:        "node",
        event_type:        "outage",
        start:             startIso,
        end:               endIso,
        duration_min,
        cause:             `Internet connectivity drop (IODA/${ev.datasource})`,
        severity,
        planned:           false,
        source:            sourceKey,
        confidence:        "modeled",
      },
    });
  }

  console.log(
    `  IODA: ${features.length} event(s) accepted. ` +
    `Skipped: ${skippedScore} below score threshold, ` +
    `${skippedNoRegion} unmapped region, ${skippedDupe} already ingested.`
  );
  return features;
}

// ---------------------------------------------------------------------------
// Fetch and parse all RSS feeds, applying the lookback window.
// ---------------------------------------------------------------------------
async function fetchArticles() {
  const cutoff = Date.now() - LOOKBACK_DAYS * 86_400_000;
  const articles = [];
  const seen = new Set();

  for (const feedUrl of RSS_FEEDS) {
    let xml;
    try {
      const res = await fetch(feedUrl, {
        headers: { "User-Agent": "GridObserver-fetch-outages/1.0" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      xml = await res.text();
    } catch (e) {
      console.warn(`  ⚠ ${feedUrl}: ${e.message} — skipped`);
      continue;
    }

    const items = parseRss(xml);
    let added = 0;
    for (const item of items) {
      if (seen.has(item.url)) continue;
      seen.add(item.url);
      // Apply lookback filter if the date parses; keep if unparseable (safe).
      const ts = Date.parse(item.publishedAt);
      if (!isNaN(ts) && ts < cutoff) continue;
      articles.push(item);
      added++;
    }
    console.log(`  ${feedUrl}: ${added} article(s) within lookback window`);
  }

  return articles;
}

// ---------------------------------------------------------------------------
// Convert one article to a GeoJSON feature, or return null with a reason.
// ---------------------------------------------------------------------------
function articleToFeature(article, existingSourceUrls) {
  const { title = "", description = "", url, publishedAt } = article;

  if (existingSourceUrls.has(url)) return { feature: null, skipReason: "duplicate" };

  if (DEBUG) {
    const match = isOutageArticle(title, description);
    console.log(`\n  TITLE: ${title}`);
    console.log(`  DESC:  ${(description ?? "").slice(0, 120)}`);
    console.log(`  SIGNAL_MATCH: ${match}`);
  }

  if (!isOutageArticle(title, description)) {
    return { feature: null, skipReason: "no-power-signal" };
  }

  const fullText = `${title} ${description}`;
  const asset = matchAsset(fullText);
  if (!asset) {
    if (DEBUG) console.log(`  NO-ASSET-MATCH: ${title}`);
    return { feature: null, skipReason: "no-asset-match" };
  }

  const planned = isPlanned(fullText);
  let severity = estimateSeverity(fullText);
  // Planned cuts are operational — never escalate beyond medium.
  if (planned && (severity === "high" || severity === "critical")) severity = "medium";

  const isoStart = isNaN(Date.parse(publishedAt))
    ? new Date().toISOString()
    : new Date(publishedAt).toISOString();

  return {
    feature: {
      type: "Feature",
      geometry: { type: "Point", coordinates: asset.coords },
      properties: {
        event_id: null, // assigned after deduplication
        asset_ref: asset.id,
        asset_type: "node",
        event_type: planned ? "maintenance" : "outage",
        start: isoStart,
        end: null,
        duration_min: null,
        cause: title.slice(0, 120) || "Power outage (press report)",
        severity,
        planned,
        source: url,
        confidence: "reported",
      },
    },
    skipReason: null,
  };
}

// ---------------------------------------------------------------------------
// Sequential event_id assignment.
// ---------------------------------------------------------------------------
function nextEventId(features) {
  let max = 0;
  for (const f of features) {
    const m = (f.properties?.event_id ?? "").match(/^evt-(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return (n) => `evt-${String(max + n).padStart(4, "0")}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`fetch-outages — lookback ${LOOKBACK_DAYS} day(s)${DRY_RUN ? " [DRY RUN]" : ""}`);

  const existing = JSON.parse(readFileSync(OUTAGE_FILE, "utf-8"));
  const existingFeatures = existing.features ?? [];

  const existingSourceUrls = new Set(
    existingFeatures
      .map((f) => f.properties?.source)
      .filter((s) => typeof s === "string" && (s.startsWith("http") || s.startsWith("ioda:")))
  );

  console.log("\n[Source 1] Fetching RSS feeds…");
  const articles = await fetchArticles();
  console.log(`  ${articles.length} article(s) total within lookback window.`);

  const newFeatures = [];
  const skipCounts = { duplicate: 0, "no-power-signal": 0, "no-asset-match": 0 };
  for (const article of articles) {
    const { feature, skipReason } = articleToFeature(article, existingSourceUrls);
    if (feature) {
      newFeatures.push(feature);
    } else {
      skipCounts[skipReason] = (skipCounts[skipReason] ?? 0) + 1;
    }
  }
  console.log(`  ${newFeatures.length} new event(s) from RSS.`);
  console.log(
    `  Skipped: ${skipCounts["no-power-signal"]} not about power outages, ` +
    `${skipCounts["no-asset-match"]} no grid asset matched, ` +
    `${skipCounts["duplicate"]} already ingested.`
  );

  // ---------------------------------------------------------------------------
  // Density escalation — recurrence is itself the severity signal.
  //
  // When the same asset accumulates ≥ DENSITY_THRESHOLD new open-ended outage
  // events in this fetch run, each of those events' severity is floored to
  // DENSITY_FLOOR. Rationale: a press scraper cannot reliably detect "widespread"
  // or "nationwide" from a single article headline, but the sheer volume of
  // independent reports about the same node within a short window *is* a
  // population-impact signal. We escalate only to "medium" (not "high") so the
  // confidence posture stays honest — this is still inferred, not confirmed.
  //
  // Only applies to:
  //   - outage events (not maintenance, not constraint)
  //   - open-ended events (end: null) — an article with no stated end duration
  //     is the clearest signal of an ongoing disruption
  //   - RSS-derived features (IODA events already carry measured duration)
  // ---------------------------------------------------------------------------
  const DENSITY_THRESHOLD = 3;
  const DENSITY_FLOOR = "medium";

  // Count open outages per asset in this batch (RSS features only, added above).
  const openOutageCount = new Map();
  for (const f of newFeatures) {
    const p = f.properties;
    if (p.event_type !== "outage" || p.end !== null) continue;
    openOutageCount.set(p.asset_ref, (openOutageCount.get(p.asset_ref) ?? 0) + 1);
  }

  // Also count open outages already in the existing file for the same assets
  // so a persistent crisis across multiple fetch runs is still captured.
  for (const f of existingFeatures) {
    const p = f.properties;
    if (p.event_type !== "outage" || p.end !== null) continue;
    if (!openOutageCount.has(p.asset_ref)) continue; // only care about assets in this batch
    openOutageCount.set(p.asset_ref, (openOutageCount.get(p.asset_ref) ?? 0) + 1);
  }

  let escalated = 0;
  const SEVERITY_ORDER = ["low", "medium", "high", "critical"];
  for (const f of newFeatures) {
    const p = f.properties;
    if (p.event_type !== "outage" || p.end !== null) continue;
    if ((openOutageCount.get(p.asset_ref) ?? 0) < DENSITY_THRESHOLD) continue;
    // Floor to DENSITY_FLOOR only if the current severity is below it.
    if (SEVERITY_ORDER.indexOf(p.severity) < SEVERITY_ORDER.indexOf(DENSITY_FLOOR)) {
      p.severity = DENSITY_FLOOR;
      escalated++;
    }
  }
  if (escalated > 0) {
    console.log(
      `  Density escalation: ${escalated} event(s) floored to "${DENSITY_FLOOR}" ` +
      `(≥${DENSITY_THRESHOLD} open outages on the same asset).`
    );
  }

  console.log("\n[Source 2] Fetching IODA Internet-outage events…");
  const iodaFeatures = await fetchIodaFeatures(existingSourceUrls);
  newFeatures.push(...iodaFeatures);

  console.log(`\n  Total new event(s): ${newFeatures.length}`);

  if (newFeatures.length === 0) {
    console.log("Nothing to add. Exiting.");
    return;
  }

  const makeId = nextEventId(existingFeatures);
  newFeatures.forEach((f, i) => { f.properties.event_id = makeId(i + 1); });

  if (DRY_RUN) {
    console.log("\nNew events (dry run — file not modified):");
    for (const f of newFeatures) {
      const p = f.properties;
      console.log(
        `  [${p.event_id}] ${p.asset_ref} | ${p.severity} | ${p.start}\n` +
        `    cause: ${p.cause}\n` +
        `    source: ${p.source}`
      );
    }
    return;
  }

  const updated = { ...existing, features: [...existingFeatures, ...newFeatures] };
  writeFileSync(OUTAGE_FILE, JSON.stringify(updated, null, 2) + "\n", "utf-8");
  console.log(`✓ Appended ${newFeatures.length} event(s) to ${OUTAGE_FILE}`);
  console.log("  Run `npm run validate-data` to verify the updated file.");
}

main().catch((err) => {
  console.error("✗", err.message);
  process.exit(1);
});
