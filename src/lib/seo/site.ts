/**
 * Site-wide SEO constants for L'Affogato.
 *
 * These values feed metadata, JSON-LD structured data, sitemap, robots, and
 * llms.txt. Edit here once; downstream files import from this module so the
 * canonical brand information stays in one place.
 */

/**
 * Resolves the public base URL across local, Vercel preview, and Vercel
 * production deployments. Priority:
 *
 *   1. NEXT_PUBLIC_SITE_URL — explicit override (production custom domain)
 *   2. VERCEL_PROJECT_PRODUCTION_URL — Vercel's canonical production URL
 *   3. VERCEL_URL — the per-deployment URL (used on preview deploys)
 *   4. https://laffogato.net — local-build fallback (canonical domain)
 *
 * Always ends without a trailing slash.
 */
function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProd)
    return `https://${vercelProd.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl)
    return `https://${vercelUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;

  return "https://laffogato.net";
}

const SITE_URL = resolveSiteUrl();

/**
 * `true` when the build is running on a Vercel preview/development deployment.
 * Used to disable indexing on non-production deployments so previews don't
 * compete with the canonical domain in search results.
 */
export const IS_PRODUCTION_DEPLOY =
  process.env.VERCEL_ENV === "production" || !process.env.VERCEL_ENV;

export const SITE = {
  url: SITE_URL,
  name: "L'Affogato",
  legalName: "L'Affogato Italia",
  brand: "L'Affogato — Caffè · Gelato · Dolci",
  descriptor: "Coffee Italiano",
  tagline: "Drink it. Eat the cup.",
  shortDescription:
    "Bologna 1987'den İstanbul'a. Yenilebilir waffle kupada espresso ve gelato. Tuzla'da 200 yıllık, Rum'lardan kalma restore bir köşkte.",
  longDescription:
    "L'Affogato, 1987'de Bologna'da Giancarlo Mancuso tarafından kurulan ve 2026'da İstanbul Tuzla'da — 200 yıllık, Rum'lardan kalma restore edilmiş bir köşkte — ilk yurt dışı şubesini açan İtalyan kahve ve gelato barıdır. İmza ritüelimiz: yenilebilir waffle kupa içinde Sirena espresso ve fior di latte gelato. Drink it. Eat the cup.",
  founded: "1987",
  openedTurkey: "2026",
  locale: "tr_TR",
  language: "tr",
  alternateLocale: [],
  email: "info@nextgenlab.com.tr",
  phone: "+90 536 429 09 19",
  phoneE164: "+905364290919",
  address: {
    streetAddress: "Postane Mah. 29 Ekim Cd. No: 28",
    addressLocality: "Tuzla",
    addressRegion: "İstanbul",
    postalCode: "34940",
    addressCountry: "TR",
    venue: "200 yıllık restore Rum köşkü",
    /** Nearest well-known landmark — how locals actually give directions. */
    landmark: "Menemenci Cumhur’un yanı",
  },
  geo: {
    latitude: 40.8165716,
    longitude: 29.3032493,
    placename: "Tuzla",
    region: "TR-34",
    countryCode: "TR",
  },
  /**
   * 09:00–01:00, every day.
   *
   * The close is on the FOLLOWING day. schema.org accepts this form, and
   * anything computing an open/closed state from it must treat the window as
   * wrapping rather than comparing the two times numerically.
   */
  openingHours: [
    {
      days: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"],
      opens: "09:00",
      closes: "01:00",
    },
  ],
  parent: {
    name: "L'Affogato Italia",
    address: "İtalya merkez",
  },
  social: {
    instagram: "https://instagram.com/laffogatto",
    tiktok: "https://tiktok.com/@laffogatto",
    youtube: "https://youtube.com/@laffogatto",
  },
  priceRange: "₺₺",
  cuisine: ["Italian", "Coffee", "Gelato", "Dessert"],
  paymentAccepted: ["Cash", "Credit Card", "Apple Pay", "Google Pay"],
  currencies: ["TRY"],
  ogImage: "/opengraph-image",
  ogImageWidth: 1200,
  ogImageHeight: 630,
  twitter: "@laffogatto",
  /**
   * Search engine verification tokens. Set the corresponding env var on
   * Vercel/CI to emit the verification meta tag; otherwise leave as empty
   * string and Next.js skips it.
   */
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ?? "",
    yandex: process.env.NEXT_PUBLIC_YANDEX_VERIFICATION ?? "",
    bing: process.env.NEXT_PUBLIC_BING_VERIFICATION ?? "",
    pinterest: process.env.NEXT_PUBLIC_PINTEREST_VERIFICATION ?? "",
    facebook: process.env.NEXT_PUBLIC_FACEBOOK_DOMAIN_VERIFICATION ?? "",
  },
  keywords: [
    "L'Affogato",
    "Tuzla kafe",
    "Tuzla affogato",
    "İtalyan kahve İstanbul",
    "gelato İstanbul",
    "yenilebilir kup",
    "matcha bar Tuzla",
    "Tuzla köşk kafe",
    "espresso Tuzla",
  ],
} as const;
