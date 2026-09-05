/**
 * Rehber — the site's editorial content hub.
 *
 * Why it exists: the brand's own terms are among the largest low-difficulty
 * queries in the Turkish market, and the site had nothing to answer them with.
 * Search volumes below are Semrush, Türkiye database, and drive what each page
 * is written to cover — they are recorded here so a later edit can see what the
 * page was aiming at rather than guessing.
 *
 *   affogato-nedir            ~27.000/ay  (affogato 18.1k · "dondurmalı kahve" 2.4k)
 *   matcha-nedir              ~53.000/ay  (matcha nedir 27.1k · matcha latte 12.1k)
 *   espresso-cesitleri        ~78.000/ay  (flat white 27.1k · türk kahvesi 27.1k · cortado 22.2k)
 *   san-sebastian-cheesecake  ~18.000/ay
 *   yenilebilir-kahve-fincani    ~800/ay  (küçük, ama imza ürün ve rakipsiz)
 *
 * Content lives in `guide-content.ts` as plain data so it can move to the
 * database later without touching the route.
 */

import { GUIDE_CONTENT, type GuideSource } from "./guide-content";

export interface GuideSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  ordered?: string[];
  table?: { key: string; value: string }[];
}

export interface GuideRecipe {
  name: string;
  description: string;
  prepMinutes: number;
  yield: string;
  ingredients: string[];
  steps: string[];
}

export interface Guide {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  excerpt: string;
  primaryKeyword: string;
  keywords: string[];
  readingMinutes: number;
  updatedAt: string;
  sections: GuideSection[];
  faq: { q: string; a: string }[];
  recipe?: GuideRecipe;
  related: string[];
}

export type { GuideSource };

/** Publication order — the hub lists them by how much they can win. */
const ORDER = [
  "affogato-nedir",
  "matcha-nedir",
  "espresso-cesitleri",
  "san-sebastian-cheesecake",
  "yenilebilir-kahve-fincani",
];

function rank(slug: string): number {
  const i = ORDER.indexOf(slug);
  return i === -1 ? ORDER.length : i;
}

export const GUIDES: Guide[] = [...GUIDE_CONTENT]
  .map((g) => g as Guide)
  .sort((a, b) => rank(a.slug) - rank(b.slug));

export function findGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}

/** Guides this one points at, resolved and de-duplicated. */
export function relatedGuides(guide: Guide): Guide[] {
  return guide.related
    .filter((slug) => slug !== guide.slug)
    .map((slug) => findGuide(slug))
    .filter((g): g is Guide => Boolean(g));
}

/** Lightweight rows for the hub and for the footer/nav link lists. */
export const GUIDE_LINKS: Array<{ slug: string; title: string }> = GUIDES.map(
  (g) => ({ slug: g.slug, title: g.title }),
);
