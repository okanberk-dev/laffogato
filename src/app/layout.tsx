import type { Metadata, Viewport } from "next";
import {
  DM_Serif_Display,
  Fraunces,
  Inter,
  JetBrains_Mono,
  Pinyon_Script,
  Playfair_Display,
} from "next/font/google";

import { RevealMotion } from "@/components/laffogato/reveal-motion";
import { IS_PRODUCTION_DEPLOY, SITE } from "@/lib/seo/site";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin", "latin-ext"],
  variable: "--font-playfair",
  style: ["normal", "italic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  variable: "--font-fraunces",
  axes: ["opsz"],
  style: ["normal"],
  display: "swap",
});

const dmSerif = DM_Serif_Display({
  subsets: ["latin", "latin-ext"],
  variable: "--font-dm-serif",
  weight: "400",
  style: ["normal"],
  display: "swap",
});

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  axes: ["opsz"],
  display: "swap",
});

const pinyon = Pinyon_Script({
  subsets: ["latin"],
  variable: "--font-pinyon",
  weight: "400",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  variable: "--font-jetbrains",
  weight: ["400", "500"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FBF4E6" },
    { media: "(prefers-color-scheme: dark)", color: "#20140D" },
  ],
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — Caffè · Gelato · Dolci · Tuzla, İstanbul`,
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
    title: `${SITE.name} — Caffè · Gelato · Dolci · Tuzla, İstanbul`,
    description: SITE.shortDescription,
    // og:image is auto-discovered from src/app/opengraph-image.tsx
  },
  twitter: {
    card: "summary_large_image",
    site: SITE.twitter,
    creator: SITE.twitter,
    title: `${SITE.name} — Caffè · Gelato · Dolci · Tuzla, İstanbul`,
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
    "msapplication-TileColor": "#2C1D11",
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

const fontVariables = [
  playfair.variable,
  fraunces.variable,
  dmSerif.variable,
  inter.variable,
  pinyon.variable,
  jetbrains.variable,
].join(" ");

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang={SITE.language} className={fontVariables}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
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
      <body>
        {children}
        <RevealMotion />
      </body>
    </html>
  );
}
