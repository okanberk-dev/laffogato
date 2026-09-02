import { describe, it, expect } from "vitest";

import {
  guideArticleLd,
  guideFaqLd,
  guideGraphLd,
  guideRecipeLd,
} from "@/lib/seo/guide-structured-data";
import { GUIDE_LINKS } from "@/lib/seo/guide-nav";
import { GUIDES, findGuide, relatedGuides } from "@/lib/seo/guides";

/**
 * The guides exist to earn search traffic, so the things a search engine
 * actually truncates or rejects are the things worth asserting: meta lengths,
 * valid internal links, structured data that does not claim more than the page
 * delivers, and — because this is a food business — no health claims.
 */

const ALL_TEXT = (slug: string) => {
  const g = findGuide(slug)!;
  const parts: string[] = [g.title, g.metaTitle, g.metaDescription, g.excerpt];
  for (const s of g.sections) {
    parts.push(s.heading);
    for (const k of ["paragraphs", "bullets", "ordered"] as const) {
      parts.push(...(s[k] ?? []));
    }
    for (const r of s.table ?? []) parts.push(r.key, r.value);
  }
  for (const f of g.faq) parts.push(f.q, f.a);
  return parts.join("\n");
};

describe("rehber registry", () => {
  it("publishes every guide the footer links to", () => {
    for (const link of GUIDE_LINKS) {
      const g = findGuide(link.slug);
      expect(g, `eksik rehber: ${link.slug}`).toBeDefined();
      expect(g!.title, `${link.slug} başlığı footer ile uyuşmuyor`).toBe(
        link.title,
      );
    }
    // The footer list is a hand-maintained copy kept out of the client bundle;
    // it must not drift from the registry in either direction.
    expect(GUIDE_LINKS.length).toBe(GUIDES.length);
  });

  it("has unique slugs", () => {
    const slugs = GUIDES.map((g) => g.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("links only to guides that exist, and never to itself", () => {
    for (const g of GUIDES) {
      for (const slug of g.related) {
        expect(slug, `${g.slug} → ${slug}`).not.toBe(g.slug);
        expect(findGuide(slug), `${g.slug} → ${slug} yok`).toBeDefined();
      }
      expect(
        relatedGuides(g).length,
        `${g.slug} ilgili sayfası yok`,
      ).toBeGreaterThan(0);
    }
  });
});

describe("rehber — SERP'in kestiği alanlar", () => {
  it("keeps metaTitle inside what a result shows", () => {
    for (const g of GUIDES) {
      expect(
        g.metaTitle.length,
        `${g.slug}: "${g.metaTitle}"`,
      ).toBeGreaterThanOrEqual(30);
      expect(
        g.metaTitle.length,
        `${g.slug}: "${g.metaTitle}"`,
      ).toBeLessThanOrEqual(62);
    }
  });

  it("keeps metaDescription inside what a result shows", () => {
    for (const g of GUIDES) {
      expect(g.metaDescription.length, `${g.slug}`).toBeGreaterThanOrEqual(110);
      expect(g.metaDescription.length, `${g.slug}`).toBeLessThanOrEqual(170);
    }
  });

  it("carries enough body to answer the query", () => {
    for (const g of GUIDES) {
      expect(
        g.sections.length,
        `${g.slug} bölüm sayısı`,
      ).toBeGreaterThanOrEqual(6);
      expect(g.faq.length, `${g.slug} SSS sayısı`).toBeGreaterThanOrEqual(5);
      expect(
        ALL_TEXT(g.slug).split(/\s+/).length,
        `${g.slug} kelime`,
      ).toBeGreaterThan(900);
    }
  });

  it("gives every section real content", () => {
    for (const g of GUIDES) {
      for (const s of g.sections) {
        const filled =
          (s.paragraphs?.length ?? 0) +
          (s.bullets?.length ?? 0) +
          (s.ordered?.length ?? 0) +
          (s.table?.length ?? 0);
        expect(filled, `${g.slug} · "${s.heading}" boş`).toBeGreaterThan(0);
      }
    }
  });

  it("offers at least one table per guide — a snippet surface", () => {
    for (const g of GUIDES) {
      const tables = g.sections.filter((s) => s.table?.length).length;
      expect(tables, `${g.slug} tablosuz`).toBeGreaterThan(0);
    }
  });

  it("renders as plain text, not markdown", () => {
    for (const g of GUIDES) {
      const text = ALL_TEXT(g.slug);
      expect(text, g.slug).not.toMatch(/\*\*/);
      expect(text, g.slug).not.toMatch(/^#{1,6}\s/m);
    }
  });
});

describe("rehber — bir gıda işletmesinin söyleyemeyecekleri", () => {
  it("makes no health claims", () => {
    // A cafe may say matcha contains antioxidants. It may not say it cures,
    // prevents, detoxes or slims — those are regulated claims.
    //
    // A guide is allowed to *name* such a phrase in order to reject it (the
    // matcha page says these claims "bu sayfada yer almaz"), and those mentions
    // are quoted — so the check runs on the text with quoted spans removed.
    const banned =
      /zayıflat|kilo verdir|hastalığı önler|tedavi eder|detoks|kanseri|bağışıklığı güçlendirir/i;
    for (const g of GUIDES) {
      const asserted = ALL_TEXT(g.slug).replace(/'[^'\n]{2,60}'/g, " ");
      expect(asserted, `${g.slug} sağlık iddiası`).not.toMatch(banned);
    }
  });

  it("does not name competitors comparatively", () => {
    for (const g of GUIDES) {
      const text = ALL_TEXT(g.slug);
      for (const name of [
        "Starbucks",
        "Kahve Dünyası",
        "Gloria Jean",
        "Espressolab",
      ]) {
        expect(text, `${g.slug}: ${name}`).not.toContain(name);
      }
    }
  });

  it("carries no stale contact detail", () => {
    for (const g of GUIDES) {
      const text = ALL_TEXT(g.slug);
      expect(text).not.toContain("tuzla@laffogato.it");
      expect(text).not.toContain("hello@laffogato.net");
      expect(text).not.toMatch(/@laffogato(?!t)/);
    }
  });
});

describe("rehber yapısal verisi", () => {
  it("emits an Article per guide, dated and attributed", () => {
    for (const g of GUIDES) {
      const ld = guideArticleLd(g) as Record<string, unknown>;
      expect(ld["@type"]).toBe("Article");
      expect(ld.headline).toBe(g.title);
      expect(ld.datePublished).toBe(g.updatedAt);
      expect(ld.dateModified).toBe(g.updatedAt);
      expect(String(ld.url)).toContain(`/rehber/${g.slug}`);
      expect(Number(ld.wordCount)).toBeGreaterThan(500);
    }
  });

  it("emits a FAQPage whose questions match the rendered list", () => {
    for (const g of GUIDES) {
      const ld = guideFaqLd(g) as Record<string, unknown> | null;
      expect(ld, g.slug).not.toBeNull();
      const entities = ld!.mainEntity as Array<{ name: string }>;
      expect(entities.length).toBe(g.faq.length);
      expect(entities.map((e) => e.name)).toEqual(g.faq.map((f) => f.q));
    }
  });

  it("claims a Recipe only where the guide actually gives one", () => {
    for (const g of GUIDES) {
      const ld = guideRecipeLd(g);
      if (g.recipe) {
        expect(ld, `${g.slug} tarif var ama LD yok`).not.toBeNull();
        const r = ld as Record<string, unknown>;
        expect(r["@type"]).toBe("Recipe");
        expect(r.prepTime).toMatch(/^PT\d+M$/);
        expect((r.recipeIngredient as string[]).length).toBeGreaterThan(1);
        expect((r.recipeInstructions as unknown[]).length).toBeGreaterThan(2);
      } else {
        // A comparison page is not a recipe; claiming one would be a false
        // rich-result signal.
        expect(ld, `${g.slug} tarifi yokken Recipe iddia ediyor`).toBeNull();
      }
    }
  });

  it("walks the breadcrumb from the root to this page only", () => {
    for (const g of GUIDES) {
      const graph = guideGraphLd(g) as {
        "@graph": Array<Record<string, unknown>>;
      };
      const crumbs = graph["@graph"].find(
        (n) => n["@type"] === "BreadcrumbList",
      );
      expect(crumbs, g.slug).toBeDefined();
      const items = crumbs!.itemListElement as Array<{
        name: string;
        position: number;
      }>;
      expect(items.map((i) => i.name)).toEqual([
        "Ana Sayfa",
        "Rehber",
        g.title,
      ]);
      expect(items.map((i) => i.position)).toEqual([1, 2, 3]);
    }
  });
});
