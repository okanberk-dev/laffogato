import { existsSync, readFileSync, readdirSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { menuItemGuide } from "@/components/laffogato/menu-guides";
import {
  guideArticleLd,
  guideImages,
  guideRecipeLd,
  recipeStepId,
} from "@/lib/seo/guide-structured-data";
import { GUIDES, findGuide } from "@/lib/seo/guides";
import { SITE } from "@/lib/seo/site";

/**
 * 25 Ekim 2026, from Search Console: the three recipe pages were refused
 * rich results ("image" eksik), the recipe they marked up was not on the page
 * at all, and the author was a bare reference Google could not read. Every
 * guide now carries a photograph, prints its recipe, and names its publisher.
 */

describe("rehber fotoğrafları", () => {
  it("every guide has a 3:2 photograph in public/rehber with a real alt text", () => {
    for (const g of GUIDES) {
      expect(g.image, `${g.slug} fotoğrafsız`).toBeDefined();
      const img = g.image!;
      expect(img.src).toBe(`/rehber/${g.slug}.webp`);
      expect(existsSync(`public${img.src}`), img.src).toBe(true);
      expect(img.width / img.height).toBeCloseTo(1.5, 2);
      expect(img.alt.length, `${g.slug} alt`).toBeGreaterThan(25);
      // A stock photograph names its photographer and links the photo:
      // Unsplash with its profile, a public-domain (CC0) one with its page.
      if (img.credit?.source === "Unsplash") {
        expect(img.credit.url).toMatch(/^https:\/\/unsplash\.com\/@/);
        expect(img.credit.photoUrl).toMatch(
          /^https:\/\/unsplash\.com\/photos\//,
        );
      } else if (img.credit) {
        expect(img.credit.license).toBe("CC0 1.0");
        expect(img.credit.photoUrl).toMatch(
          /^https:\/\/(commons\.wikimedia\.org|www\.rawpixel\.com)\//,
        );
      }
    }
  });

  it("carries its credit inside the file, where Google Images reads it", () => {
    for (const g of GUIDES) {
      const file = readFileSync(`public${g.image!.src}`);
      const creator = g.image!.credit?.name ?? "L'Affogato";
      expect(
        file.includes(`<dc:creator><rdf:Seq><rdf:li>${creator}</rdf:li>`),
        `${g.slug}: npm run seo:photo`,
      ).toBe(true);
    }
  });

  it("ships no photograph that no guide uses", () => {
    const used = new Set(GUIDES.map((g) => `${g.slug}.webp`));
    for (const file of readdirSync("public/rehber")) {
      expect(used.has(file), file).toBe(true);
    }
  });

  it("puts the photograph first in the Article and the Recipe", () => {
    for (const g of GUIDES) {
      const images = guideImages(g);
      expect(images[0]).toBe(`${SITE.url}${g.image!.src}`);
      expect(images.at(-1)).toBe(
        `${SITE.url}/rehber/${g.slug}/opengraph-image`,
      );
      expect((guideArticleLd(g) as { image: string[] }).image).toEqual(images);
    }
  });
});

describe("rehber tarifleri", () => {
  const page = readFileSync("src/app/rehber/[slug]/page.tsx", "utf8");

  it("prints the recipe the page marks up, each step at the anchor its url names", () => {
    expect(page).toContain('id="tarif"');
    expect(page).toContain("guide.recipe.ingredients.map");
    expect(page).toContain("id={recipeStepId(i)}");
    expect(recipeStepId(0)).toBe("tarif-adim-1");
  });

  it("gives Google an image, a typed author, keywords and the dish's own category", () => {
    for (const g of GUIDES.filter((x) => x.recipe)) {
      const ld = guideRecipeLd(g) as Record<string, unknown>;
      expect((ld.image as string[]).length, g.slug).toBeGreaterThan(0);
      expect(ld.author).toMatchObject({
        "@type": "Organization",
        name: SITE.name,
      });
      expect(String(ld.keywords).length).toBeGreaterThan(10);
      expect(ld.recipeCategory).toBe(g.recipe!.category);
      expect(ld.recipeCuisine).toBe(g.recipe!.cuisine);
      const steps = ld.recipeInstructions as Array<{ url: string }>;
      steps.forEach((s, i) =>
        expect(s.url).toBe(`${SITE.url}/rehber/${g.slug}#${recipeStepId(i)}`),
      );
    }
    // A cheesecake is a dessert from the Basque Country, not an Italian
    // drink (what every recipe was labelled before).
    expect(findGuide("san-sebastian-cheesecake")!.recipe).toMatchObject({
      category: "Tatlı",
      cuisine: "Bask",
    });
  });
});

describe("menüden rehbere", () => {
  it("links each dish that has a guide to it", () => {
    expect(menuItemGuide("Tiramisu")).toBe("tiramisu-tarifi");
    expect(menuItemGuide("Cold Brew")).toBe("cold-brew-nedir");
    expect(menuItemGuide("Karamel Frappe")).toBe("frappe-nedir");
    expect(menuItemGuide("Mocha Frappe")).toBe("frappe-nedir");
    expect(menuItemGuide("İspanyol Latte")).toBe("spanish-latte-nedir");
    expect(menuItemGuide("Buzlu İspanyol Latte")).toBe("spanish-latte-nedir");
    expect(menuItemGuide("Chai Latte")).toBe("chai-tea-latte");
    expect(menuItemGuide("Buzlu Chai")).toBe("chai-tea-latte");
    expect(menuItemGuide("Matcha Latte")).toBe("matcha-nedir");
    // The narrower name wins: a matcha affogato is an affogato.
    expect(menuItemGuide("Matcha Affogato")).toBe("affogato-nedir");
    expect(menuItemGuide("Yaban Mersinli San Sebastian")).toBe(
      "san-sebastian-cheesecake",
    );
    expect(menuItemGuide("Cortado")).toBe("espresso-cesitleri");
    expect(menuItemGuide("Brownie")).toBe("brownie-tarifi");
    expect(menuItemGuide("Çilek Magnolia")).toBe("magnolia-tarifi");
    expect(menuItemGuide("Lotus Magnolia")).toBe("magnolia-tarifi");
    expect(menuItemGuide("Cookie Aşkı (Dondurmalı)")).toBeNull();
    expect(menuItemGuide("Karamel Latte")).toBeNull();
  });

  it("never links to a guide that does not exist", () => {
    const src = readFileSync("src/components/laffogato/menu-guides.ts", "utf8");
    const slugs = [...src.matchAll(/"([a-z-]+)"\]/g)].map((m) => m[1]);
    expect(slugs.length).toBeGreaterThan(5);
    for (const slug of slugs) expect(findGuide(slug), slug).toBeDefined();
  });

  it("the menu card renders the link", () => {
    const menu = readFileSync("src/components/laffogato/menu-page.tsx", "utf8");
    expect(menu).toContain("menuItemGuide(it.name)");
    expect(menu).toContain('className="menu-card-guide"');
  });
});

describe("IndexNow", () => {
  it("serves the key the script submits with", () => {
    const script = readFileSync("scripts/indexnow.mjs", "utf8");
    const key = /const KEY = "([0-9a-f]{32})";/.exec(script)?.[1];
    expect(key).toBeDefined();
    expect(readFileSync(`public/${key}.txt`, "utf8").trim()).toBe(key);
    expect(script).toContain('const HOST = "laffogato.net";');
  });
});

describe("site haritası", () => {
  it("carries each guide's photograph as an image entry", () => {
    const src = readFileSync("src/app/sitemap.ts", "utf8");
    expect(src).toContain("images: [`${SITE.url}${g.image.src}`]");
  });
});
