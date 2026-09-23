/**
 * JSON-LD for the rehber pages.
 *
 * Three types per guide, because they answer three different surfaces:
 *  - `Article` - the page itself, for the standard result and for LLM crawlers.
 *  - `FAQPage` - the accordion at the bottom, eligible for the FAQ rich result.
 *  - `Recipe` - only where the guide really is a recipe (affogato, matcha latte,
 *    cheesecake). A `Recipe` on a comparison page would be a false claim, so
 *    `espresso-cesitleri` deliberately emits none.
 */

import type { Guide } from "./guides";
import { SITE } from "./site";

type Json = Record<string, unknown>;

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
    author: { "@id": `${SITE.url}/#organization` },
    publisher: { "@id": `${SITE.url}/#organization` },
    image: `${SITE.url}${SITE.ogImage}`,
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

export function guideRecipeLd(guide: Guide): Json | null {
  const r = guide.recipe;
  if (!r) return null;
  return {
    "@context": "https://schema.org",
    "@type": "Recipe",
    "@id": `${SITE.url}/rehber/${guide.slug}#recipe`,
    name: r.name,
    description: r.description,
    inLanguage: SITE.language,
    author: { "@id": `${SITE.url}/#organization` },
    datePublished: guide.updatedAt,
    recipeCategory: "İçecek",
    recipeCuisine: "İtalyan",
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
          "Affogato, matcha, espresso çeşitleri, San Sebastian cheesecake ve yenilebilir kahve fincanı üzerine ayrıntılı Türkçe rehberler.",
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
