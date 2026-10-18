import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * The catalog's smaller forms as the panel draws them (admin audit, catalog
 * package 5c): the menu item form, the photo uploader and the category
 * form.
 *
 * - Menu tags were free text ("signature, new, iced, nuts, IGP"); the app
 *   drops every word outside its four, so an allergen typed another way
 *   was never shown (CAT-10, decision D21).
 * - The menu photo uploader sat inside a <label>: a click on the caption,
 *   the hint or the URL line opened the file picker (CAT-15).
 * - On a phone the uploader's footer pushed × out of the card; the arrows
 *   said "Yukarı / Aşağı taşı" and every × just "Sil" (CAT-12, CAT-23).
 * - "+ Yeni kategori" could only make a twin of a seeded slug, and the copy
 *   said the page drove the shop's filter bar, which is fixed (CAT-06, D18).
 * - "Vazgeç" was a button inside a link (CAT-22).
 */

const h = vi.hoisted(() => ({
  listCategories: vi.fn(),
  requireRole: vi.fn(async () => ({ email: "patron@laffogato.net" })),
}));

vi.mock("@/lib/admin/store", () => ({
  MENU_CATEGORY_KEYS: ["matcha", "frozen"],
  MENU_CATEGORY_LABELS: { matcha: "Matcha", frozen: "Frozen" },
  slugify: (s: string) => s.toLowerCase(),
  listCategories: h.listCategories,
}));
vi.mock("@/lib/admin/auth", () => ({ requireRole: h.requireRole }));
vi.mock("@/app/admin/kategoriler/actions", () => ({
  createCategoryAction: vi.fn(),
}));

const { MenuItemForm } = await import("@/components/admin/menu-item-form");
const { ImageUpload } = await import("@/components/admin/image-upload");
const { CategoryForm } = await import("@/components/admin/category-form");
const { menuTagsFromForm, unknownMenuTags, MENU_TAG_OPTIONS } =
  await import("@/lib/admin/menu-item-schema");
const { freeCategorySlugs, categorySlugTaken } =
  await import("@/lib/admin/category-schema");
const { PRODUCT_TAG_VALUES } = await import("@/lib/admin/product-schema");

const noop = async () => ({ ok: true as const, message: "" });

const ITEM = {
  id: "mnu-0042",
  categoryKey: "matcha",
  name: "Fıstıklı Frappe",
  desc: "Antep fıstığı ezmesi",
  priceMinor: 24_500,
  priceMinorL: 0,
  hue: "pistachio",
  image: "",
  tags: ["iced", "nuts", "igp"],
  isActive: true,
  sortOrder: 0,
  updatedAt: "2026-10-01T10:00:00.000Z",
  backdrop: null,
  backdropSource: "auto",
  backdropHex: null,
  photoCutout: false,
  vessel: null,
} as never;

/** The opening tag of each element matching `re`. */
const tags = (html: string, re: RegExp) => html.match(re) ?? [];

describe("menu tags", () => {
  it("offers the app's whole vocabulary, nothing more", () => {
    expect(MENU_TAG_OPTIONS.map(([v]) => v)).toEqual([...PRODUCT_TAG_VALUES]);
    for (const [, label] of MENU_TAG_OPTIONS) {
      expect(label).not.toMatch(/signature|iced|nuts/i);
    }
  });

  it("reads ticked boxes and old comma lists into the vocabulary", () => {
    expect(menuTagsFromForm(["nuts", "signature"])).toEqual([
      "signature",
      "nuts",
    ]);
    expect(menuTagsFromForm(["NUTS , IGP, fındık", "nuts", 3])).toEqual([
      "nuts",
    ]);
    expect(menuTagsFromForm([])).toEqual([]);
    expect(unknownMenuTags(["iced", "igp", "nut"])).toEqual(["igp", "nut"]);
  });

  it("the form draws four boxes, ticks the stored ones and names what a save drops", () => {
    const html = renderToStaticMarkup(
      createElement(MenuItemForm, {
        action: noop,
        item: ITEM,
        submitLabel: "Kaydet",
        cancelHref: "/admin/menu",
      }),
    );
    const boxes = tags(html, /<input[^>]*name="tags"[^>]*>/g);
    expect(boxes).toHaveLength(4);
    for (const box of boxes) expect(box).toContain('type="checkbox"');
    const checked = boxes.filter((b) => /\schecked=""/.test(b));
    expect(checked.map((b) => /value="([^"]+)"/.exec(b)?.[1])).toEqual([
      "iced",
      "nuts",
    ]);
    expect(html).toContain("Sert kabuklu yemiş");
    expect(html).not.toContain("IGP");
    // The stored word the boxes cannot hold is named before it goes.
    expect(html).toMatch(/tanımadığı bir etiket var: <strong>igp<\/strong>/);
    // A new item has no notice.
    const fresh = renderToStaticMarkup(
      createElement(MenuItemForm, {
        action: noop,
        submitLabel: "Menüye ekle",
        cancelHref: "/admin/menu",
      }),
    );
    expect(fresh).not.toContain("tanımadığı");
    expect(tags(fresh, /<input[^>]*name="tags"[^>]*checked=""/g)).toHaveLength(
      0,
    );
  });
});

describe("menu photo uploader", () => {
  const html = renderToStaticMarkup(
    createElement(MenuItemForm, {
      action: noop,
      item: ITEM,
      submitLabel: "Kaydet",
      cancelHref: "/admin/menu",
    }),
  );

  it("sits in a fieldset, so no label wraps the file input", () => {
    // Every <label> in the form closes before the next file input opens.
    for (const m of html.matchAll(/<label\b[\s\S]*?<\/label>/g)) {
      expect(m[0]).not.toContain('type="file"');
    }
    expect(html).toMatch(/<fieldset[^>]*>\s*<legend[^>]*>Fotoğraf<\/legend>/);
  });

  it("'Vazgeç' is one link, not a button inside a link", () => {
    const link = /<a[^>]*href="\/admin\/menu"[^>]*>([\s\S]*?)<\/a>/.exec(html);
    expect(link?.[1]).toBe("Vazgeç");
    expect(html).not.toMatch(/<a[^>]*>\s*<button/);
  });

  it("uses Turkish names for the tones", () => {
    expect(html).not.toContain(">Pistachio<");
    expect(html).not.toContain(">Rose<");
    expect(html).toContain(">Antep fıstığı<");
  });
});

describe("the photo grid", () => {
  const two = renderToStaticMarkup(
    createElement(ImageUpload, {
      name: "images",
      initial: [
        "https://cdn.example.com/a.jpg",
        "https://cdn.example.com/b.jpg",
      ],
    }),
  );

  it("names the photo each control acts on, and the arrows move sideways", () => {
    for (const label of [
      "Sola taşı: görsel 1",
      "Sağa taşı: görsel 1",
      "Sil: görsel 1",
      "Sola taşı: görsel 2",
      "Sil: görsel 2",
      "Birincil yap: görsel 2",
    ]) {
      expect(two).toContain(`aria-label="${label}"`);
    }
    expect(two).not.toContain('aria-label="Yukarı taşı"');
    expect(two).not.toContain('aria-label="Aşağı taşı"');
    expect(two).not.toContain('aria-label="Sil"');
    // The primary photo has no "Birincil yap".
    expect(two).not.toContain('aria-label="Birincil yap: görsel 1"');
    expect(two).toContain('aria-label="Görsel bağlantısı"');
  });

  it("wraps its footer and keeps × a fixed 44 px target", () => {
    const footers = tags(
      two,
      /<div class="[^"]*border-t border-neutral-100 px-1\.5[^"]*"/g,
    );
    expect(footers).toHaveLength(2);
    for (const f of footers) expect(f).toContain("flex-wrap");
    const removes = tags(two, /<button[^>]*aria-label="Sil: görsel \d"[^>]*>/g);
    expect(removes).toHaveLength(2);
    for (const r of removes) {
      expect(r).toContain("h-11");
      expect(r).toContain("w-11");
      expect(r).toContain("shrink-0");
    }
  });

  it("says plainly what to do when the limit is reached", () => {
    const full = renderToStaticMarkup(
      createElement(ImageUpload, {
        name: "image",
        max: 1,
        initial: ["https://cdn.example.com/a.jpg"],
      }),
    );
    expect(full).toContain("Sınır doldu: 1 görsel");
    expect(full).toContain("Değiştirmek için aşağıdakini kaldır.");
    expect(full).not.toContain("Limit doldu");
  });
});

describe("categories", () => {
  const BEANS = { id: "cat-1", slug: "beans", label: "Çekirdek" };

  it("knows which of the five slugs are still free", () => {
    expect(freeCategorySlugs([BEANS, { ...BEANS, id: "cat-2" }])).toEqual([
      "gift",
      "gear",
      "merch",
      "pantry",
    ]);
    expect(categorySlugTaken("beans", [BEANS])).toContain('"Çekirdek"');
    expect(categorySlugTaken("beans", [BEANS], "cat-1")).toBeNull();
    expect(categorySlugTaken("gift", [BEANS])).toBeNull();
  });

  it("the new form offers only the free slugs, and no form when none is", async () => {
    const { default: NewCategoryPage } =
      await import("@/app/admin/kategoriler/yeni/page");
    h.listCategories.mockResolvedValue([
      BEANS,
      { id: "cat-2", slug: "gift", label: "Hediye" },
    ]);
    const some = renderToStaticMarkup(await NewCategoryPage());
    const options = [...some.matchAll(/<option value="([^"]+)"/g)].map(
      (m) => m[1],
    );
    expect(options).toEqual(["gear", "merch", "pantry"]);
    expect(some).not.toContain("Mağaza sidebar");

    h.listCategories.mockResolvedValue(
      ["beans", "gift", "gear", "merch", "pantry"].map((slug, i) => ({
        id: `cat-${i}`,
        slug,
        label: slug,
      })),
    );
    const none = renderToStaticMarkup(await NewCategoryPage());
    expect(none).not.toContain("<form");
    expect(none).toContain("Beş kategorinin hepsi listede");
  });

  it("says what the page changes, and 'Vazgeç' is one link", () => {
    const html = renderToStaticMarkup(
      createElement(CategoryForm, {
        action: noop,
        submitLabel: "Kaydet",
        cancelHref: "/admin/kategoriler",
      }),
    );
    expect(html).not.toContain("Shop ürün filtresinde");
    expect(html).toContain("sabittir");
    const link = /<a[^>]*href="\/admin\/kategoriler"[^>]*>([\s\S]*?)<\/a>/.exec(
      html,
    );
    expect(link?.[1]).toBe("Vazgeç");
  });
});
