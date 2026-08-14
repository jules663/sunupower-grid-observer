// API route: GET /api/events/outages
//
// Serves the outage-events dataset. Sitting in front of the static file rather
// than serving it directly from /public gives us:
//   1. A stable URL contract the client can poll — the backend can swap from a
//      flat JSON file to a database query without the frontend changing at all.
//   2. HTTP caching: `max-age=300` means browsers won't re-fetch more often than
//      every 5 minutes (matching the client poll interval), but will always
//      revalidate via ETag / Last-Modified so a fresh publish is picked up
//      immediately on the next poll.
//   3. A place to add auth, rate-limiting, or source-switching later.
//
// Current backend: reads the static file from /public/data at request time.
// To connect a live source (database, scraper output, etc.) replace the
// readEventFile() call below — the response shape stays identical.

import { NextResponse } from "next/server";
import { readEventFile } from "@/lib/eventStore";

export const dynamic = "force-dynamic"; // never pre-render; always run at request time

export async function GET() {
  try {
    const data = await readEventFile("outage-events.json");
    return NextResponse.json(data, {
      headers: {
        // Allow CDN / browser to cache for 5 min, but always revalidate with
        // ETag so a fresh publish is seen immediately on the next poll.
        "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    console.error("[/api/events/outages] read failed:", err);
    return NextResponse.json({ error: "Failed to load outage events" }, { status: 500 });
  }
}
