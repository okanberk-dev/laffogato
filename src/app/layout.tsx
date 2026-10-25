import type { Metadata, Viewport } from "next";
import { Gabarito, Poppins } from "next/font/google";

import { MetaPixel } from "@/components/laffogato/meta-pixel";
import { RevealMotion } from "@/components/laffogato/reveal-motion";
import {
  ConsentScripts,
  CookieBanner,
  TagManager,
} from "@/components/laffogato/site-tags";
import { metaPixelId } from "@/lib/consent/meta-pixel";
import { siteTagManagerId } from "@/lib/consent/script";
import { IS_PRODUCTION_DEPLOY, SITE } from "@/lib/seo/site";
import "./globals.css";

// Google Tag Manager container - all analytics/marketing tags (GA4,
// conversions, ...) would be managed inside GTM, not in code. Off since
// 19 Ekim 2026 (no Google standard contract for the transfer, KVKK m.9):
// `siteTagManagerId` returns "" while the legal texts say the site runs no
// analytics or ad tags, whatever NEXT_PUBLIC_GTM_ID holds, and there is no
// built-in container id any more. Empty, the banner offers only the
// necessary and preference cookies.
const GTM_ID = siteTagManagerId(process.env.NEXT_PUBLIC_GTM_ID);

// The Meta Pixel ("LAF Pixel"), 25 Ekim 2026: marketing category only, loaded
// after the visitor's yes (src/lib/consent/meta-pixel.ts, docs/META-PIXEL.md).
// `metaPixelId` returns "" when the legal texts do not describe the pixel or
// NEXT_PUBLIC_META_PIXEL_ID is set to an empty string. With no id there is no
// marketing switch and no tracker.
const META_PIXEL_ID = metaPixelId(process.env.NEXT_PUBLIC_META_PIXEL_ID);

// Two voices (operator, 14 Eki 2026: "sitede yapay zeka gibi duruyor, yazı
// tipleri poppins ve biennale vs kullan"; docs/BRAND.md §2).
//
// Poppins reads and works the controls: sentences, captions, help, legal
// and field text, buttons, chips, labels, product names and list prices
// (operator, 11 Eki 2026: "sitede poppins fontu olsun"). Six static cuts:
// 300 for the large statement copy, 400 to read, 500 and 600 for labels and
// controls, 700 and 800 where a figure or a label must stand out. Turkish
// via latin-ext.
const brandFont = Poppins({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

// Gabarito sets the headlines - page, section and card titles and the
// display figures (`--headline` in globals.css). It stands in for Biennale
// (Latinotype), the face the operator named: Biennale is sold per licence
// and none is held, and Gabarito (SIL OFL, on Google Fonts) is its nearest
// free kin - geometric, a large x-height, built for headlines and brands,
// with clean Turkish marks. A licensed Biennale replaces it here and in the
// `--headline` stack and nowhere else. Three cuts: 600 for card titles, 700
// for headings, 800 for the display moments.
const headlineFont = Gabarito({
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700", "800"],
  variable: "--font-headline",
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
  // No site-wide `alternates`: a canonical here is inherited by every page
  // that does not set its own, and pointed /uye/giris, /odeme and the like at
  // the home page. Each indexable page declares its own canonical. hreflang
  // is omitted - one language, and "tr-TR: /" on every page named the home
  // page as each page's Turkish version.
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
    "msapplication-TileColor": "#1d6d56",
    "msapplication-config": "/browserconfig.xml",
    // Pinterest + Facebook domain verification (env-driven, optional)
    ...(SITE.verification.pinterest
      ? { "p:domain_verify": SITE.verification.pinterest }
      : {}),
    ...(SITE.verification.facebook
      ? { "facebook-domain-verification": SITE.verification.facebook }
      : {}),
    // (rating / distribution / revisit-after / HandheldFriendly /
    // MobileOptimized are gone: no engine reads them, and three duplicated
    // tags Next already emits from `formatDetection` and `appleWebApp`.)
  },
};

const fontVariables = `${brandFont.variable} ${headlineFont.variable}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: CONSENT_SEEN sets data-consent on <html>
    // before React hydrates it. data-scroll-behavior: globals.css scrolls
    // <html> smoothly for in-page links; Next 16 no longer turns that off
    // for a route change unless asked, so every new page glided up to its
    // top (and the dev console warned on every page).
    <html
      lang={SITE.language}
      className={fontVariables}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        {/* The consent scripts, GTM and the cookie banner render in every
            document but the checkout's and the admin panel's
            (site-tags.tsx): the card is typed on /odeme under a policy that
            admits no third party, and the panel shows customer data under
            an admin session. The Consent Mode defaults stay ahead of the
            GTM container. */}
        <ConsentScripts withTagManager={!!GTM_ID} />
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
      {GTM_ID ? <TagManager gtmId={GTM_ID} /> : null}
      <body>
        {children}
        <CookieBanner tagManager={!!GTM_ID} metaPixel={!!META_PIXEL_ID} />
        {META_PIXEL_ID ? <MetaPixel /> : null}
        <RevealMotion />
      </body>
    </html>
  );
}
