// App-level feature flags.

// SunuPower ESI sites.
//
// The ESI sites currently in /public/data/sunupower-esi-sites.json are SIMULATED
// placeholders used by the operational SunuPower Intelligence (Live Agent) app,
// not real deployed assets. To keep this public-facing map aligned with
// SunuPower's transparency posture, the ESI layer is parked (hidden) until real
// sites exist.
//
// To re-enable once real ESI sites are published:
//   1. Replace sunupower-esi-sites.json with the real site data.
//   2. Set SHOW_ESI_SITES = true (or wire this to an env var / build flag).
// All ESI rendering code (layer, popups, legend entry, node count) remains in
// place and will light up automatically.
export const SHOW_ESI_SITES = false;

// ---------------------------------------------------------------------------
// G2 STRICT PUBLIC CONTAINMENT — founder authorization dated 2026-10-10.
//
// FAIL-CLOSED. When true, every public reliability-intelligence output is
// withheld: the reliability heat map (asset stress scores, severity colors,
// reliability interpretations), the SAIDI/SAIFI panel, reliability node popups,
// the Grid Activity Feed, the activity badge, and the public event API. The
// static infrastructure reference map, its legend, and its provenance
// disclosures are preserved.
//
// This is a temporary, reversible containment, not a retirement of the
// reliability capability. It does NOT delete data, nor alter the ingestion
// classifier, the scoring model, or the evidence taxonomy. Historical event
// records are preserved intact under /event-data (moved out of /public so they
// are not statically served); ingestion continues to write there.
//
// To lift containment (requires separate founder authorization):
//   1. Set RELIABILITY_CONTAINED = false.
//   2. Confirm /event-data holds the current event files and that the API route
//      serves them (outputFileTracingIncludes in next.config already bundles
//      /event-data for the serverless routes).
//   3. Re-enable the scheduled trigger in .github/workflows/fetch-outages.yml.
// No other code changes are needed; the reliability UI and API light back up.
export const RELIABILITY_CONTAINED = true;
