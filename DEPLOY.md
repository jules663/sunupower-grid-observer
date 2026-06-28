# Grid Observer — Deployment & Operations

SunuPower Grid Observer is a Next.js 14 (App Router) single-page app that renders
an interactive Leaflet map of Senegal's electricity transmission network.

- **Production:** https://sunupower-grid-observer.vercel.app (Vercel)
- **Stack:** Next.js 14.2.3 · React 18 · TypeScript 5 · Tailwind 3.4 · Leaflet 1.9 / react-leaflet 4.2

---

## Quick commands

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server at http://localhost:3000 |
| `npm run build` | Production build (**the pre-ship gate** — must pass) |
| `npm run start` | Serve the production build locally |
| `npm run lint` | Next.js ESLint |
| `npm run validate-data` | Validate all served GeoJSON, incl. reliability events (geometry, voltages, coords in-bbox, event refs/dates/enums) |
| `npm run dedupe-grid` | Remove duplicate/parallel transmission lines from senegal-grid.json |
| `npm run add-asset-ids` | Add stable slug `id`s to node features (idempotent) |
| `npx tsc --noEmit` | Type-check with zero emit (fast correctness gate) |

---

## Deploying

The app is connected to Vercel. A normal deploy is just a push:

```bash
git add -A
git commit -m "..."
git push           # Vercel auto-builds and deploys the connected branch
```

Or deploy on demand from the project root:

```bash
vercel --prod
```

> **Metadata / SEO changes** (title, Open Graph, favicons in `src/app/layout.tsx`)
> only take effect on the **next build**, so redeploy after editing them.

### Pre-ship checklist

Run these locally before promoting a change to production:

1. `npx tsc --noEmit` — must report zero errors.
2. `npm run validate-data` — must report **0 errors, 0 warnings**.
3. `npm run build` — must complete successfully.
   - Note: the build fetches the Manrope web font from Google at build time. On a
     network that blocks Google Fonts the build will hang after the Next.js banner.
     Vercel and normal networks are fine; if you hit this locally, see
     "Self-hosting the font" below.
4. Spot-check the map after deploy: filters toggle, popups open above the panels,
   the Hann/Dakar corridors render as clean single lines, and the context-panel
   stats populate (they compute from the data at runtime).
5. Keyboard pass: Tab to the "Skip to map" link, confirm focus rings on the
   filter/language buttons, and that the map zooms with `+`/`-` and the on-screen
   zoom control.

---

## Data

All map data is static GeoJSON in `public/data/` (fetched on load, parallelized).
These files are served:

| File | Contents |
|---|---|
| `senegal-grid.json` | National transmission lines (225 / 90 / 30 kV) — **canonical** |
| `senegal-plants.json` | Power plants & substations |
| `regional-interconnections.json` | OMVG / cross-border 225 kV lines |
| `regional-nodes.json` | Regional grid nodes |
| `infrastructure-tie-lines.json` | Injection / feeder tie-lines |
| `industrial-consumers.json` | Industrial off-takers |
| `outage-events.json` | Reliability layer — outage & constraint events |
| `maintenance-events.json` | Reliability layer — maintenance events |
| `senegal-border.json` | National boundary outline (decorative; loaded non-blocking) |

Every node feature carries a stable `id` (slug of its name, e.g. `hann-substation`).
Reliability events reference assets by that `id` (`asset_ref`), never by
coordinates — so relocating a node never orphans its history.

Superseded/backup data (`senegal-grid-existing.json`, `*.bak`) and parked data
(`sunupower-esi-sites.json`) live in `../_archive/` and must **not** be placed
back under `public/` — anything in `public/` is publicly fetchable. (See
"ESI sites — parked" below for the ESI re-enable steps.)

### Editing grid data

After any change to the line data, re-run the data pipeline so the map stays
faithful:

```bash
npm run dedupe-grid     # collapses exact + near-parallel duplicate lines
npm run validate-data   # confirms geometry/voltage/coords are sane
```

`dedupe-grid` writes a one-time `senegal-grid.json.bak` next to the file — move
or delete it before committing so it isn't served from `public/`.

If you add new nodes/substations, run `npm run add-asset-ids` to give them stable
ids (existing ids are preserved), then `npm run validate-data`.

### Reliability events (Phase 1)

Outage, constraint, and maintenance events live in `outage-events.json` and
`maintenance-events.json`. Each event:

- references an asset by its stable `id` via `asset_ref` (must resolve);
- carries a `confidence` tier — `measured` (utility/ESI telemetry), `reported`
  (press/CRSE/World Bank), or `modeled` (topology-derived). Keep these honest:
  modeled is an estimate, not a measurement;
- includes `event_type` (`outage` | `constraint` | `maintenance`), `severity`
  (`low` | `medium` | `high` | `critical`), ISO `start`/`end`, `source`, and a
  Point geometry matching the referenced asset.

The seed data is `reported` + `modeled` only. As SunuPower ESI sites and any
SENELEC feed come online, append `measured` events in the same shape — no schema
or UI change is needed (Phase 2 aggregates events generically).

After editing event files:

```bash
npm run validate-data   # checks refs resolve, dates/enums valid, ids unique
```

### Faithful-rendering guarantees (do not regress)

These were deliberate fixes; keep them in mind when touching data or the map:

- **Snapping is metric, 3 km max.** `GridMap` snaps a line endpoint to the
  nearest node only within 3 km (haversine). Don't widen this — a large radius
  drags endpoints across the map (the original bug relocated some up to 38.5 km).
- **Node coordinates must be on land / on the corridor.** A mislocated node acts
  as a magnet: every line endpoint within 3 km snaps to it. The Hann Substation
  fan-into-the-bay artifact was a single bad coordinate. If a node looks like it's
  pulling lines, check its location first.
- **Stats are computed, not hardcoded.** The context-panel "km" and "nodes" come
  from the loaded GeoJSON via `onStats`. They will move when the data changes —
  that's correct.
- **Provenance text must match reality.** The on-screen attribution reflects the
  real sources (2005 WB archive, OpenStreetMap, SOMELEC/ECREEE). Update it if the
  underlying data sources change.

### Basemap & views

- **Basemap:** CARTO Dark Matter (`basemaps.cartocdn.com`, no API key) — a
  `dark_nolabels` base plus a `dark_only_labels` layer on a dedicated label pane
  so place names stay legible over the grid. Chosen over Esri Dark Gray because
  its water tone keeps the coastline and islands (e.g. Gorée) readable without
  brightness/contrast filter hacks. CARTO renders admin-1 region lines faintly,
  so no separate regions overlay is needed.
- **Pane ordering (z-index) matters — don't regress.** The label pane is set to
  **550**: above the grid-line overlay pane (400) so region names read over the
  lines, but below the marker pane (600) so node markers are never covered by
  labels. If labels start hiding markers again, check this value in
  `LabelPaneSetup`.
- **Default view is Reliability.** The app opens on the reliability heat-map —
  where SunuPower has leverage. Infrastructure is the secondary/reference view.
- **Reliability view styling:** in reliability mode the network keeps its true
  voltage colors (225 kV blue / cross-border purple, 90 kV orange, MV cyan) but
  at ~30% opacity and reduced weight, so HV/MV stay distinguishable while the
  node heat-map dominates. (There is intentionally **no** corridor line
  recoloring — an earlier attempt produced tangles in dense MV clusters and
  flicker between years; it was removed.)
- **Reliability scoring lives in `src/lib/reliability.ts`** — a documented, pure,
  tunable function (severity weights; constraint/outage/maintenance handling;
  `year` filter for the time slider; `availableYears()` for the ticks).
  Edit it there, not inline in the map.

### ESI sites — parked (transparency posture)

The SunuPower ESI sites are **hidden** on this public map. The existing site
data was **simulated** placeholders used by the operational SunuPower
Intelligence (Live Agent) app, not real deployed assets. Showing simulated
sites as if real would undercut SunuPower's public-interest / data-transparency
posture, so the layer is parked until real sites exist.

What "parked" means here (stronger than just hiding):

- A single flag, `SHOW_ESI_SITES` in `src/lib/config.ts`, is `false`. It gates
  the map layer, the legend swatch, the node-count contribution, **and the data
  fetch** — so nothing ESI renders or loads.
- The simulated data file was moved out of `public/` to
  `../_archive/parked-data/sunupower-esi-sites.json`, so it is **not served**
  publicly (anything under `public/` is fetchable). The node count reflects this
  (52 served nodes, not 56).
- All ESI rendering code (`EsiLayerManager`, popups, legend entry, translations)
  remains in place — nothing was deleted.

To re-enable when real ESI sites are published:

1. Put the real site data at `public/data/sunupower-esi-sites.json` (same schema
   as the archived file: `id`, `name`, `state`, `capacity_kwh`, `intent`).
2. Set `SHOW_ESI_SITES = true` in `src/lib/config.ts` (or wire it to an env var).
3. Add `sunupower-esi-sites.json` back to `POINT_FILES` and `ID_FILES` in
   `scripts/validate-data.mjs`, then run `npm run validate-data`.

The layer, legend, popups, and node count all light up automatically.

---

## Project layout

```
gridobserver-v1/
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx          # metadata / SEO / fonts
│  │  └─ page.tsx            # header, filters, panels, mobile sheet
│  ├─ components/
│  │  ├─ map/GridMap.tsx     # map, data load, snapping, styling, popups
│  │  └─ ui/                 # ContextPanel, Legend, ReliabilityLegend,
│  │                         #   FilterControls, ViewToggle
│  ├─ lib/
│  │  ├─ reliability.ts      # reliability scoring & aggregation (pure)
│  │  └─ config.ts           # feature flags (SHOW_ESI_SITES)
│  └─ types/grid.ts          # GeoJSON + reliability-event interfaces
├─ public/
│  ├─ data/                  # served GeoJSON (network + events + border)
│  └─ brand/                 # logos / share image
├─ scripts/
│  ├─ validate-data.mjs      # npm run validate-data
│  ├─ dedupe-grid.mjs        # npm run dedupe-grid
│  └─ add-asset-ids.mjs      # npm run add-asset-ids
└─ DEPLOY.md                 # this file
```

---

## Known follow-ups (optional, not blockers)

- **Self-host the Manrope font** — switch `next/font/google` to a local font to
  remove the build-time Google dependency, speed first paint, and avoid the
  offline-build hang.
- **Security headers / CSP** — add `headers()` in `next.config.mjs`. The app loads
  external CARTO tiles (`basemaps.cartocdn.com`) + a Google font, so scope a CSP
  accordingly.
- **Error boundary** — add `src/app/error.tsx` for a friendly fallback if a render
  crashes (the map already handles data-fetch failures with a visible error state).
- **Node-location validation** — extend `validate-data.mjs` to flag nodes that sit
  in water or implausibly far from the lines connecting to them, to catch the next
  Hann-style mislocation automatically.

## Reliability Intelligence Layer — roadmap

**Phase 1 (data model) — done.** Stable asset ids, the event schema/types, seed
`outage-events.json` + `maintenance-events.json`, and event validation. SunuPower
can log real events now in the correct shape.

**Phase 2 (reliability view) — done.** Default "Reliability" view mode with
heat-mapped nodes by stress score (color + size), reliability-profile popups,
the score scale + data-confidence legend, and a dimmed network context layer.
Scoring is in `src/lib/reliability.ts`.

**Phase 3 (time dimension) — done.** A "Period" slider (All + each event year)
re-scores and re-heats the nodes per calendar year, so you can scrub the history
and watch bottlenecks move. Constraint events are year-agnostic (always shown);
only dated outages/maintenance are year-scoped. Note: the originally-planned
constrained-corridor line styling was implemented then removed — it tangled in
dense MV clusters and flickered between years. The grid stays as dimmed
voltage-colored context instead.

Remaining (see the full spec, `Grid_Observer_Reliability_Layer_Spec.docx`):

- **Phase 4** — ingest first-party ESI telemetry / optional SENELEC feed as
  `measured` events; same UI, upgraded data.

---

## Grid Activity Feed + UI pass (2026-06)

A "when" surface to complement the map's "where", plus a header cleanup and a
mobile responsiveness pass. Shipped to production.

### Grid Activity Feed

A toggleable right-side panel (the **Activity** button in the header) that lists
maintenance and reliability events chronologically, grouped relative to *now*
into **Ahead / Current / Past**. It is **maintenance-led**: planned maintenance
is the primary content; outage/constraint incidents are secondary and collapse
behind an "Incidents" toggle. A search box plus type filters answer "query old
events".

- **Logic is pure and testable** in `src/lib/feed.ts` (`buildFeedEvents`,
  `buildFeedSections`, `defaultFilters`). Classification: `start > now` →
  Ahead; `start <= now <= end` (or no end) → Current; `end < now` → Past.
  Constraints (no end) read as ongoing/Current.
- **Panel component** is `src/components/ui/GridActivityFeed.tsx`. It fetches the
  same static event files the map uses (browser-cached) plus the node/plant files
  to resolve `asset_ref` → display name, so a card never shows a bare slug.
- **Posture preserved:** every card shows the `confidence` tier and `source`
  verbatim. The feed never infers, predicts, or upgrades confidence.
- **Look-ahead seed:** `maintenance-events.json` carries a few honestly-labeled
  future planned-maintenance entries (`planned: true`, `reported`) so Ahead /
  Current populate. The mechanism is dynamic — it will fill from real future
  events as they are added.

### Card → map focus

Clicking a feed card flies the map to that asset and opens its popup. Markers are
registered by stable `id` in a registry inside `GridMap` as they are drawn; a
small `MapFocusController` (same `useMap()` pattern as the pane-setup helpers)
watches a `focusAsset` + nonce and does the `flyTo` + `openPopup`. The nonce lets
clicking the same card re-trigger the animation.

- **Mobile:** the panel is full-width, so on selection it auto-closes (below the
  `lg` breakpoint) to reveal the focused node + popup. On desktop the panel is a
  side column with the map beside it, so it stays open for browsing.

### Feed time axis is decoupled from the year slider (do not re-couple)

The feed runs on its own Ahead/Current/Past axis (relative to now) and always
uses all years. The map's **Period** slider filters only the map heat by calendar
year — a different time model. Coupling the two made past-year events appear
under "Current", which was misleading. `page.tsx` and `GridActivityFeed` carry
comments marking this as intentional.

### Header cleanup + interactive legend

The voltage selector (225 / 90 / MV) was removed from the header (and the mobile
strip) to keep the header clean. The filter now lives **in the legend, in
Infrastructure view only**:

- **Reliability view (default):** no voltage filter UI — voltage-colored lines
  render as dimmed map context only. The legend is the reliability legend (stress
  scale + confidence).
- **Infrastructure view:** the legend's "Networks" section is interactive —
  clicking 225 / 90 / MV sets the single active filter (clicking the active one
  clears to All), the same single-select logic the header used to host. OMVG
  cross-border is a **reference line** (dimmed, non-clickable) because it is a
  225kV subset, not a separate filterable voltage. Logic lives in
  `src/components/ui/panels.tsx` (`Legend`); the old `FilterControls` is no
  longer wired in.

### Sticky section header — frosted, no ghosting (do not regress)

The Ahead/Current/Past section headers are `sticky top-0`. The scroll container
uses `pt-0 pb-4` (not `py-4`) so the header pins flush to the true top edge with
no dead space above it, and the header background is a strong frosted glass
(`blur(16px) saturate(160%)` at `0.82` opacity, extended edge-to-edge with
`-mx-5 px-5`) so cards scrolling underneath blur into it rather than ghosting
through as legible text. Both conditions are required — a translucent header or a
top-padded container reintroduces the bleed-through.

### Mobile bottom + header layout (do not regress)

The bottom-edge controls stack without overlap on mobile:

- Year slider raised to `bottom-28` (and horizontally scrollable with a clamped
  width); Info / Legend row at `bottom-9`; Leaflet attribution pinned to a thin
  centered strip at `bottom: 0` (themed in `globals.css`).
- The Leaflet **zoom control is hidden on mobile** (`display: none` on
  `.leaflet-bottom.leaflet-left`, restored at `lg`) — it collided with the Info
  button, and pinch-to-zoom is the native touch gesture. Desktop keeps the +/−
  buttons.
- Header padding/gaps are responsive and the subtitle is hidden below `sm` so the
  logo is never squeezed.

### Logo + cross-link

The header logo is the original `logo-light-text.png` asset, unaltered (no
backing plate, no recolor, gold accent bar untouched), sized for visibility
(`h-6 sm:h-7`). It links to the SunuPower corporate site
(`https://sunupower-corporate-v2.vercel.app/`, new tab). The corporate site's
footer carries the reciprocal link — "Network Map" / "Carte du réseau" in the
Resources group — pointing back to the Grid Observer production URL
(`https://sunupower-grid-observer.vercel.app/`).
