import type { Metadata, Viewport } from "next";
import { Inter, Poppins } from "next/font/google";

import { GoogleTagManager } from "@next/third-parties/google";

import { CookieConsent } from "@/components/laffogato/cookie-consent";
import { RevealMotion } from "@/components/laffogato/reveal-motion";
import { CONSENT_COOKIE, CONSENT_VERSION } from "@/lib/consent/cookie";
import { CONSENT_BOOTSTRAP } from "@/lib/consent/script";
import { IS_PRODUCTION_DEPLOY, SITE } from "@/lib/seo/site";
import "./globals.css";

// Google Tag Manager container - all analytics/marketing tags (GA4, Meta Pixel,
// conversions, …) are managed inside GTM, not in code. Override the public
// container id with NEXT_PUBLIC_GTM_ID; empty value disables the integration.
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID || "GTM-KZ2QCHTT";

// Two voices, the app's (lafmobil BRAND-IDENTITY §2, karar 311): Poppins is
// the display voice - titles, names, prices, buttons, chips - and Inter the
// reading voice - sentences, captions, help and legal text, field text. The
// site followed the app's palette on 25 Eyl 2026 and its type with it, so one
// brand reads the same on the phone and in the browser. Inter ships as a
// variable font (every weight from one file); Poppins in the three cuts the
// app draws (500 / 600 / 700). Turkish via latin-ext on both.
const displayFont = Poppins({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});
const textFont = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-text",
  display: "swap",
});

export const viewport: Viewport = {
  // The porcelain the glass header sits on. The site, like the app
  // (userInterfaceStyle "light"), has one appearance: declaring "light dark"
  // let a dark-mode browser paint its own dark form controls and scrollbars
  // onto a page that has no dark styles.
  themeColor: "#fbf8f4",
  colorScheme: "light",
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
        // Preview / development deployment - keep search engines out so they
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
    // Geo meta - legacy but still consumed by some local search engines
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
    "msapplication-TileColor": "#1d6d56",
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

/**
 * Marks <html data-consent="set"> before the first paint when the visitor
 * has already answered the cookie banner. The banner is server-rendered (so
 * it paints with the page instead of seconds later), and this is what keeps
 * it from flashing for someone who answered it last week. Same validity test
 * as `readConsent`: the cookie parses and carries the current version.
 */
const CONSENT_SEEN = `(function(){try{var m=document.cookie.split('; ').find(function(c){return c.indexOf('${CONSENT_COOKIE}=')===0});if(!m)return;var p=JSON.parse(decodeURIComponent(m.slice(${CONSENT_COOKIE.length + 1})));if(p&&p.version===${CONSENT_VERSION})document.documentElement.setAttribute('data-consent','set')}catch(e){}})();`;

const fontVariables = `${displayFont.variable} ${textFont.variable}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: CONSENT_SEEN sets data-consent on <html>
    // before React hydrates it.
    <html
      lang={SITE.language}
      className={fontVariables}
      suppressHydrationWarning
    >
      <head>
        <script
          id="consent-seen"
          dangerouslySetInnerHTML={{ __html: CONSENT_SEEN }}
        />
        {/* Consent Mode v2 defaults - must be on the dataLayer before the GTM
            container initialises, otherwise the first tag fires with no
            consent signal at all. Everything except strictly-necessary storage
            starts denied and is only raised by an explicit choice. */}
        {GTM_ID ? (
          <script
            id="consent-bootstrap"
            dangerouslySetInnerHTML={{ __html: CONSENT_BOOTSTRAP }}
          />
        ) : null}
        {/* next/font self-hosts the fonts - no Google Fonts origin is hit at
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
