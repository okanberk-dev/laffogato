/**
 * JSON-LD for the rehber pages.
 *
 * Three types per guide, because they answer three different surfaces:
 *  - `Article` - the page itself, for the standard result and for LLM crawlers.
 *  - `FAQPage` - the accordion at the bottom, eligible for the FAQ rich result.
 *  - `Recipe` - only where the guide really is a recipe (affogato, matcha latte,
 *    cheesecake). A `Recipe` on a comparison page would be a false claim, so
 *    `espresso-cesitleri` deliberately emits none.
 *
 * The recipe is also printed on the page (the "Tarif" card in
 * `src/app/rehber/[slug]/page.tsx`): Google reads structured data that
 * describes content a reader cannot see as spam, and until 25 Ekim 2026 the
 * ingredients and steps lived only here. Search Console also refused all
 * three recipes for a missing `image`.
 */

import type { Guide } from "./guides";
import { SITE } from "./site";

type Json = Record<string, unknown>;

/** The guide's own link-preview card, drawn at build time. */
function guideCardUrl(guide: Guide): string {
  return `${SITE.url}/rehber/${guide.slug}/opengraph-image`;
}

/**
 * The images a guide's Recipe and Article carry, best first: the photograph
 * of the dish (Google wants a real image of it on a recipe), then the card.
 */
export function guideImages(guide: Guide): string[] {
  return [
    ...(guide.image ? [`${SITE.url}${guide.image.src}`] : []),
    guideCardUrl(guide),
  ];
}

/**
 * The publisher, spelled out: a bare `@id` pointing at the home page's
 * Organization node is not resolved on a guide page, and Search Console
 * reported the recipes' `author` as an invalid object type.
 */
function organization(): Json {
  return {
    "@type": "Organization",
    "@id": `${SITE.url}/#organization`,
    name: SITE.name,
    url: SITE.url,
  };
}

/** Flatten a guide's prose into the plain-text body an Article should carry. */
function articleBody(guide: Guide): string {
  const parts: string[] = [];
  for (const s of guide.sections) {
    parts.push(s.heading);
    for (const p of s.paragraphs ?? []) parts.push(p);
    for (const b of s.bullets ?? []) parts.push(b);
    for (const o of s.ordered ?? []) parts.push(o);
    for (const r of s.table ?? []) parts.push(`${r.key}: ${r.value}`);
  }
  return parts.join("\n\n");
}

export function guideArticleLd(guide: Guide): Json {
  const url = `${SITE.url}/rehber/${guide.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${url}#article`,
    headline: guide.title,
    description: guide.metaDescription,
    inLanguage: SITE.language,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    // No fabricated publish date: `updatedAt` is the only date we actually
    // know, so it stands for both rather than inventing a first-published one.
    datePublished: guide.updatedAt,
    dateModified: guide.updatedAt,
    author: organization(),
    publisher: organization(),
    image: guideImages(guide),
    keywords: guide.keywords.join(", "),
    wordCount: articleBody(guide).split(/\s+/).length,
    articleSection: "Rehber",
    articleBody: articleBody(guide),
  };
}

export function guideFaqLd(guide: Guide): Json | null {
  if (guide.faq.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${SITE.url}/rehber/${guide.slug}#faq`,
    mainEntity: guide.faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

/** The anchor of a recipe step on the page (`#tarif-adim-3`). */
export function recipeStepId(index: number): string {
  return `tarif-adim-${index + 1}`;
}

export function guideRecipeLd(guide: Guide): Json | null {
  const r = guide.recipe;
  if (!r) return null;
  const url = `${SITE.url}/rehber/${guide.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "Recipe",
    "@id": `${url}#recipe`,
    name: r.name,
    description: r.description,
    image: guideImages(guide),
    inLanguage: SITE.language,
    author: organization(),
    datePublished: guide.updatedAt,
    keywords: guide.keywords.join(", "),
    recipeCategory: r.category,
    recipeCuisine: r.cuisine,
    // ISO-8601 duration; only prep is known, so totalTime mirrors it rather
    // than inventing a cook time.
    prepTime: `PT${r.prepMinutes}M`,
    totalTime: `PT${r.prepMinutes}M`,
    recipeYield: r.yield,
    recipeIngredient: r.ingredients,
    recipeInstructions: r.steps.map((step, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      text: step,
      // Each step is a list item with this id on the page.
      url: `${url}#${recipeStepId(i)}`,
    })),
  };
}

/** Everything a guide page emits, as one `@graph`. */
export function guideGraphLd(guide: Guide): Json {
  const url = `${SITE.url}/rehber/${guide.slug}`;
  const graph: Json[] = [
    guideArticleLd(guide),
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "@id": `${url}#breadcrumbs`,
      itemListElement: [
        { name: "Ana Sayfa", url: SITE.url },
        { name: "Rehber", url: `${SITE.url}/rehber` },
        { name: guide.title, url },
      ].map((it, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: it.name,
        item: it.url,
      })),
    },
  ];
  const faq = guideFaqLd(guide);
  if (faq) graph.push(faq);
  const recipe = guideRecipeLd(guide);
  if (recipe) graph.push(recipe);
  return { "@context": "https://schema.org", "@graph": graph };
}

/** The hub page: a `CollectionPage` listing every guide. */
export function guideHubLd(guides: Guide[]): Json {
  const url = `${SITE.url}/rehber`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${url}#collection`,
        name: "Rehber",
        description:
          "Tiramisu, cold brew, frappe, spanish latte, chai tea latte, affogato, matcha, espresso çeşitleri, San Sebastian cheesecake ve yenilebilir bardakta kahve üzerine ayrıntılı Türkçe rehberler.",
        inLanguage: SITE.language,
        url,
        isPartOf: { "@id": `${SITE.url}/#website` },
        publisher: { "@id": `${SITE.url}/#organization` },
        mainEntity: {
          "@type": "ItemList",
          itemListElement: guides.map((g, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: g.title,
            url: `${url}/${g.slug}`,
          })),
        },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumbs`,
        itemListElement: [
          { name: "Ana Sayfa", url: SITE.url },
          { name: "Rehber", url },
        ].map((it, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: it.name,
          item: it.url,
        })),
      },
    ],
  };
}
