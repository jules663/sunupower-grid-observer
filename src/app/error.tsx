"use client";

// Route-level error boundary: a friendly, branded fallback shown if a render
// crashes (the map already handles data-fetch failures with its own visible
// error state; this catches everything else). Client component per Next.js
// requirements; `reset` re-attempts the render.

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surface the error to the console for diagnostics; no external reporting.
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-col items-center justify-center h-screen w-full bg-sunu-phantom px-8 text-center">
      <div className="max-w-md">
        <div className="text-[10px] uppercase tracking-[0.3em] font-bold text-sunu-space mb-4">Grid Observer</div>
        <h1 className="text-lg font-bold text-sunu-cloud mb-3">Something went wrong.</h1>
        <p className="text-[13px] text-sunu-space leading-relaxed mb-8">
          The map could not be displayed. This is usually temporary. Try again, or reload the page.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="px-5 py-2.5 rounded-lg bg-sunu-blue/15 border border-sunu-blue/40 text-sunu-blue text-[13px] font-bold uppercase tracking-wider hover:bg-sunu-blue/25 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sunu-blue/70"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 rounded-lg bg-white/[0.03] border border-white/10 text-sunu-cloud text-[13px] font-bold uppercase tracking-wider hover:border-white/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sunu-blue/70"
          >
            Reload
          </button>
        </div>
      </div>
    </main>
  );
}
