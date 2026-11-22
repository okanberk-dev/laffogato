/**
 * Site-wide SEO constants for L'Affogato.
 *
 * These values feed metadata, JSON-LD structured data, sitemap, robots, and
 * llms.txt. Edit here once; downstream files import from this module so the
 * canonical brand information stays in one place.
 */

import { LEGAL_ENTITY } from "@/lib/legal/entity";

/**
 * Resolves the public base URL across local, Vercel preview, and Vercel
 * production deployments. Priority:
 *
 *   1. NEXT_PUBLIC_SITE_URL - explicit override (production custom domain)
 *   2. VERCEL_PROJECT_PRODUCTION_URL - Vercel's canonical production URL
 *   3. VERCEL_URL - the per-deployment URL (used on preview deploys)
 *   4. https://laffogato.net - local-build fallback (canonical domain)
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
  /**
   * The registered company behind the brand, taken from the tax certificate.
   * Used wherever a *publisher* is named (metadata, Dublin Core, JSON-LD) -
   * the site used to publish "L'Affogato Italia" here, which is a brand line
   * and not a legal person, so the pages contradicted the contracts.
   */
  legalName: LEGAL_ENTITY.legalName,
  /** Brand alternate - descriptive, deliberately not a registered entity. */
  tradeName: "L'Affogato Italia",
  brand: "L'Affogato - Caffè · Gelato · Dolci",
  descriptor: "Coffee Italiano",
  tagline: "Drink it. Eat the cup.",
  shortDescription:
    "Bologna 1897'den İstanbul'a. Yenilebilir waffle kupada espresso ve gelato. Tuzla'da 200 yıllık, Rum'lardan kalma restore bir köşkte.",
  longDescription:
    "L'Affogato, 1897'de Bologna'da Giancarlo Mancuso tarafından kurulan ve 2026'da İstanbul Tuzla'da - 200 yıllık, Rum'lardan kalma restore edilmiş bir köşkte - ilk yurt dışı şubesini açan İtalyan kahve ve gelato barıdır. İmza ritüelimiz: yenilebilir waffle kupa içinde Sirena espresso ve fior di latte gelato. Drink it. Eat the cup.",
  founded: "1897",
  openedTurkey: "2026",
  locale: "tr_TR",
  language: "tr",
  alternateLocale: [],
  email: "info@nextgenlab.com.tr",
  phone: "+90 536 429 09 19",
  phoneE164: "+905364290919",
  address: {
    streetAddress: "Postane Mah. Atatürk Cad. No: 28 İç Kapı No: 1",
    addressLocality: "Tuzla",
    addressRegion: "İstanbul",
    postalCode: "34940",
    addressCountry: "TR",
    venue: "200 yıllık restore Rum köşkü",
    /** Nearest well-known landmark - how locals actually give directions. */
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
   * 09:00-01:00, every day.
   *
   * The close is on the FOLLOWING day. schema.org accepts this form, and
   * anything computing an open/closed state from it must treat the window as
   * wrapping rather than comparing the two times numerically.
   */
  openingHours: [
    {
      days: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"],
      // Türetilmiş, kopyalanmış değil: saat iki yerde yazılıysa biri
      // güncellenmeden kalır - /hukuk/sirket-bilgileri tam olarak böyle
      // eskimişti.
      opens: LEGAL_ENTITY.cafeHours.opens,
      closes: LEGAL_ENTITY.cafeHours.closes,
    },
  ],
  parent: {
    name: "L'Affogato Italia",
    address: "İtalya merkez",
  },
  /**
   * Resmî sosyal medya hesapları. Hepsinin kullanıcı adı `@laffogatto`.
   * JSON-LD `sameAs`, footer'daki `@laffogatto` satırı ve ağ adlarını
   * yazan metin düğmeleri buradan okur (footer'da ikon yok).
   */
  social: {
    handle: "@laffogatto",
    instagram: "https://instagram.com/laffogatto",
    tiktok: "https://tiktok.com/@laffogatto",
    youtube: "https://youtube.com/@laffogatto",
    x: "https://x.com/laffogatto",
  },
  priceRange: "₺₺",
  cuisine: ["Italian", "Coffee", "Gelato", "Dessert"],
  paymentAccepted: ["Cash", "Credit Card", "Debit Card"],
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

/**
 * The Open Graph fields every page has to re-declare.
 *
 * Next shallow-merges `openGraph` across segments: a page that sets its own
 * `openGraph` block replaces the layout's entirely, so `og:site_name`,
 * `og:locale` and the default image vanish unless they are repeated. Spread
 * this first, then override `title`/`description`/`url`.
 */
export function openGraphDefaults() {
  return {
    ...openGraphBase(),
    images: [
      {
        url: SITE.ogImage,
        width: SITE.ogImageWidth,
        height: SITE.ogImageHeight,
      },
    ],
  };
}

/**
 * `openGraphDefaults()` without the image, for a page whose segment draws
 * its own card (an `opengraph-image.tsx` beside its `page.tsx`, built on
 * `src/lib/seo/og-card.tsx`). Next lets that file fill `og:image` only when
 * the page's `openGraph` has no `images` key at all: naming the default
 * image here would hide the page's card behind the generic one.
 */
export function openGraphBase() {
  return {
    siteName: SITE.name,
    locale: SITE.locale,
  };
}

/** The brand suffix the root layout's title template appends. */
export const TITLE_SUFFIX = " · L'Affogato";

/**
 * A `{ absolute }` title with the brand appended only when the whole still
 * fits a search result (~60 characters). The layout template appended it
 * unconditionally, so every guide title ran to 66-72 and was cut mid-word.
 */
export function brandedTitle(base: string, max = 60): { absolute: string } {
  const t = base.trim();
  return {
    absolute: t.length + TITLE_SUFFIX.length <= max ? t + TITLE_SUFFIX : t,
  };
}

/**
 * A meta description cut to what a result shows (~158 characters), at a
 * word boundary, with an ellipsis. The legal pages published 214-292
 * character summaries and Google truncated them wherever it liked.
 */
export function metaDescription(text: string, max = 158): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:·-]+$/, "")}…`;
}
