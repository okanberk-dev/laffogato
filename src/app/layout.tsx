import type { Metadata, Viewport } from "next";
import {
  DM_Sans,
  DM_Serif_Display,
  JetBrains_Mono,
  Marcellus,
  Pinyon_Script,
  Playfair_Display,
} from "next/font/google";

import { SITE } from "@/lib/seo/site";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin", "latin-ext"],
  variable: "--font-playfair",
  style: ["normal", "italic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const dmSerif = DM_Serif_Display({
  subsets: ["latin", "latin-ext"],
  variable: "--font-dm-serif",
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-dm-sans",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const pinyon = Pinyon_Script({
  subsets: ["latin"],
  variable: "--font-pinyon",
  weight: "400",
  display: "swap",
});

const marcellus = Marcellus({
  subsets: ["latin"],
  variable: "--font-marcellus",
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
    { media: "(prefers-color-scheme: light)", color: "#FAF6EE" },
    { media: "(prefers-color-scheme: dark)", color: "#14100B" },
  ],
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — Caffè · Gelato · Dolci · Maltepe Park, İstanbul`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.shortDescription,
  applicationName: SITE.name,
  generator: "Next.js",
  referrer: "origin-when-cross-origin",
  keywords: [...SITE.keywords],
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
    title: `${SITE.name} — Caffè · Gelato · Dolci · Maltepe Park, İstanbul`,
    description: SITE.longDescription,
    images: [
      {
        url: SITE.ogImage,
        width: SITE.ogImageWidth,
        height: SITE.ogImageHeight,
        alt: `${SITE.name} — ${SITE.tagline}`,
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: SITE.twitter,
    creator: SITE.twitter,
    title: `${SITE.name} — Caffè · Gelato · Dolci · Maltepe Park, İstanbul`,
    description: SITE.shortDescription,
    images: [SITE.ogImage],
  },
  robots: {
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
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
    ],
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
    "msapplication-TileColor": "#14100B",
  },
};

const fontVariables = [
  playfair.variable,
  dmSerif.variable,
  dmSans.variable,
  pinyon.variable,
  marcellus.variable,
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
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
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
      <body>{children}</body>
    </html>
  );
}
