// Event data store — server-side only (Node.js).
//
// This module is the single seam between the API routes and the event data
// source. It reads the event GeoJSON files from /event-data — a non-public
// directory at the project root, deliberately OUTSIDE /public so the files are
// not statically served (there is no /data/*-events.json route). The API route
// in front of them applies the G2 containment guard before any read.
// To connect a live source (Supabase, a scraper, a Google Sheet export, etc.)
// replace readEventFile() here — the API routes and the frontend never change.
//
// Imported only by src/app/api/events/*/route.ts (server-side routes).
// Never import this from client components; they talk to the API routes instead.

import { readFile } from "fs/promises";
import path from "path";

// Resolve relative to the project root, not the module's location.
// Non-public: next.config.mjs outputFileTracingIncludes bundles this for routes.
const DATA_DIR = path.join(process.cwd(), "event-data");

/**
 * Read a GeoJSON event file from public/data and parse it.
 * `filename` should be "outage-events.json" or "maintenance-events.json".
 *
 * To swap the backend: replace this function's body. Keep the return type as
 * `Promise<unknown>` — the API route calls NextResponse.json() on the result,
 * so the shape is validated by the TypeScript types on the client side.
 */
export async function readEventFile(filename: string): Promise<unknown> {
  const filePath = path.join(DATA_DIR, filename);
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw);
}
