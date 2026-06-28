import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";

const manrope = Manrope({ subsets: ["latin"], weight: ["200", "300", "400", "500", "600", "700", "800"] });

const SITE_URL = "https://sunupower-grid-observer.vercel.app";
const TITLE = "SunuPower Grid Observer";
const DESCRIPTION =
  "Interactive advisory map of Senegal's electricity transmission network — 225kV and 90kV backbones, MV grid, power plants, and SunuPower ESI sites across ECOWAS/Senegal.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${TITLE} — Unified Infrastructure Advisor`, template: `%s | ${TITLE}` },
  description: DESCRIPTION,
  applicationName: TITLE,
  keywords: ["SunuPower", "Senegal", "electricity grid", "transmission network", "SENELEC", "OMVG", "ECOWAS", "energy infrastructure", "grid map"],
  authors: [{ name: "SunuPower" }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: TITLE,
    title: `${TITLE} — Unified Infrastructure Advisor`,
    description: DESCRIPTION,
    images: [{ url: "/brand/full-logo.png", width: 1200, height: 630, alt: "SunuPower Grid Observer" }],
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: `${TITLE} — Unified Infrastructure Advisor`,
    description: DESCRIPTION,
    images: ["/brand/full-logo.png"],
  },
  icons: { icon: "/icon.png", apple: "/apple-icon.png" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#121212",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={manrope.className}>{children}</body>
    </html>
  );
}
