import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";

import { GoogleTagManager } from "@next/third-parties/google";

import { CookieConsent } from "@/components/laffogato/cookie-consent";
import { RevealMotion } from "@/components/laffogato/reveal-motion";
import { CONSENT_BOOTSTRAP } from "@/lib/consent/script";
import { IS_PRODUCTION_DEPLOY, SITE } from "@/lib/seo/site";
import "./globals.css";

// Google Tag Manager container — all analytics/marketing tags (GA4, Meta Pixel,
// conversions, …) are managed inside GTM, not in code. Override the public
// container id with NEXT_PUBLIC_GTM_ID; empty value disables the integration.
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID || "GTM-KZ2QCHTT";

// One family for the whole site.
//
// Montserrat, set by the operator's reference design (6 Eyl 2026). The
// reference is drawn in Sofia Pro, which is licensed; Montserrat is the
// closest thing on Google Fonts and matches the two letterforms that carry
// that look — the near-circular `C`/`o` and the wide double-storey `a` — at
// close to the same width, which Plus Jakarta Sans (narrower, more humanist)
// did not. Weight does all the differentiating: there is no serif and no
// mono, so the eyebrow style is uppercase + tracking in the same face and
// prices lean on `font-variant-numeric: tabular-nums`. Turkish via latin-ext.
const brandFont = Montserrat({
  subsets: ["latin", "latin-ext"],
  variable: "--font-brand",
  style: ["normal", "italic"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#143d2b" },
  ],
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} - Caffè · Gelato · Dolci · Tuzla, İstanbul`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.shortDescription,
  applicationName: SITE.name,
  generator: "Next.js",
  referrer: "origin-when-cross-origin",
  authors: [{ name: SITE.legalName, url: SITE.url }],
  creator: SITE.legalName,
  publisher: SITE.legalName,
  category: "food",
  classification: "Cafe, Coffee Shop, Italian Restaurant",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: "/",
    languages: {
      "tr-TR": "/",
      "x-default": "/",
    },
  },
  openGraph: {
    type: "website",
    locale: SITE.locale,
    alternateLocale: [...SITE.alternateLocale],
    url: SITE.url,
    siteName: SITE.name,
    title: `${SITE.name} - Caffè · Gelato · Dolci · Tuzla, İstanbul`,
    description: SITE.shortDescription,
    // og:image is auto-discovered from src/app/opengraph-image.tsx
  },
  twitter: {
    card: "summary_large_image",
    site: SITE.twitter,
    creator: SITE.twitter,
    title: `${SITE.name} - Caffè · Gelato · Dolci · Tuzla, İstanbul`,
    description: SITE.shortDescription,
    // twitter:image is auto-discovered from src/app/twitter-image.tsx
  },
  robots: IS_PRODUCTION_DEPLOY
    ? {
        index: true,
        follow: true,
        nocache: false,
        googleBot: {
          index: true,
          follow: true,
          "max-image-preview": "large",
          "max-snippet": -1,
          "max-video-preview": -1,
        },
      }
    : {
        // Preview / development deployment — keep search engines out so they
        // don't index transient URLs.
        index: false,
        follow: false,
        nocache: true,
        googleBot: { index: false, follow: false },
      },
  verification: {
    ...(SITE.verification.google ? { google: SITE.verification.google } : {}),
    ...(SITE.verification.yandex ? { yandex: SITE.verification.yandex } : {}),
    ...(SITE.verification.bing
      ? { other: { "msvalidate.01": SITE.verification.bing } }
      : {}),
  },
  icons: {
    icon: [{ url: "/favicon.ico", sizes: "any" }],
    apple: [{ url: "/favicon.ico" }],
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: SITE.name,
  },
  other: {
    // Geo meta — legacy but still consumed by some local search engines
    "geo.region": SITE.geo.region,
    "geo.placename": SITE.geo.placename,
    "geo.position": `${SITE.geo.latitude};${SITE.geo.longitude}`,
    ICBM: `${SITE.geo.latitude}, ${SITE.geo.longitude}`,
    // Dublin Core
    "DC.title": SITE.brand,
    "DC.language": SITE.locale,
    "DC.publisher": SITE.legalName,
    // Misc
    "format-detection": "telephone=no",
    "apple-mobile-web-app-title": SITE.name,
    "msapplication-TileColor": "#143d2b",
    "msapplication-config": "/browserconfig.xml",
    // Pinterest + Facebook domain verification (env-driven, optional)
    ...(SITE.verification.pinterest
      ? { "p:domain_verify": SITE.verification.pinterest }
      : {}),
    ...(SITE.verification.facebook
      ? { "facebook-domain-verification": SITE.verification.facebook }
      : {}),
    // Editorial / brand metadata
    rating: "General",
    distribution: "Global",
    "revisit-after": "7 days",
    // Mobile + theme defaults
    "mobile-web-app-capable": "yes",
    HandheldFriendly: "true",
    MobileOptimized: "width",
  },
};

const fontVariables = brandFont.variable;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang={SITE.language} className={fontVariables}>
      <head>
        {/* Consent Mode v2 defaults — must be on the dataLayer before the GTM
            container initialises, otherwise the first tag fires with no
            consent signal at all. Everything except strictly-necessary storage
            starts denied and is only raised by an explicit choice. */}
        {GTM_ID ? (
          <script
            id="consent-bootstrap"
            dangerouslySetInnerHTML={{ __html: CONSENT_BOOTSTRAP }}
          />
        ) : null}
        {/* next/font self-hosts the fonts — no Google Fonts origin is hit at
            runtime, so preconnect/dns-prefetch hints would be dead weight. */}
        <link
          rel="alternate"
          type="text/plain"
          href="/llms.txt"
          title="LLM index"
        />
        <link
          rel="alternate"
          type="text/plain"
          href="/llms-full.txt"
          title="LLM full content"
        />
      </head>
      {GTM_ID ? <GoogleTagManager gtmId={GTM_ID} /> : null}
      <body>
        {children}
        <CookieConsent />
        <RevealMotion />
      </body>
    </html>
  );
}
