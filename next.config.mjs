/** @type {import('next').NextConfig} */

// Content-Security-Policy scoped to what the app actually loads:
//  - CARTO basemap tiles (basemaps.cartocdn.com) as images
//  - the self-hosted Manrope font (font-src 'self')
//  - local static GeoJSON under /data (connect-src 'self')
// script/style keep 'unsafe-inline' because Next's hydration and Leaflet inject
// inline script/style; 'unsafe-eval' covers dev/runtime chunk eval. Tightening to
// a nonce-based policy is a future step, not required for this public map.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://basemaps.cartocdn.com https://*.basemaps.cartocdn.com",
  "font-src 'self' data:",
  "connect-src 'self' https://basemaps.cartocdn.com https://*.basemaps.cartocdn.com",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Explicit same-origin CORS posture: cross-origin scripts cannot read responses.
  // Matches the app's design (all data is fetched by its own client bundle, not by
  // third-party origins). Tighten to a named allow-list if an external consumer
  // ever needs programmatic access to the /data files.
  { key: "Access-Control-Allow-Origin", value: "https://sunupower-grid-observer.vercel.app" },
];

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
