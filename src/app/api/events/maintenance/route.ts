// API route: GET /api/events/maintenance
//
// Serves the maintenance-events dataset. Same architecture and caching
// rationale as /api/events/outages — see that file for the full comment.

import { NextResponse } from "next/server";
import { readEventFile } from "@/lib/eventStore";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await readEventFile("maintenance-events.json");
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    console.error("[/api/events/maintenance] read failed:", err);
    return NextResponse.json({ error: "Failed to load maintenance events" }, { status: 500 });
  }
}
