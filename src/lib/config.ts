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
