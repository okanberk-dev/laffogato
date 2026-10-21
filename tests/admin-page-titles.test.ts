import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * Copy rule 1 (admin UI v2, UI-19): the nav label is the page's h1 (or the
 * tab's label on a merged item), in sentence case. The layout's NAV_GROUPS
 * is the one list of names; every list page of Bugün, Katalog and Pazarlama
 * says the same word in its PageHeader, draws no eyebrow that repeats the
 * nav, and sits in a PageShell instead of its own container.
 */

const layout = readFileSync("src/app/admin/layout.tsx", "utf8");

/** page -> the nav item or tab it is. */
const LIST_PAGES: ReadonlyArray<readonly [string, string]> = [
  ["siparisler", "Siparişler"],
  ["mobil/karaoke", "Karaoke"],
  ["kasa", "Kasa"],
  ["menu", "Kafe menüsü"],
  ["urunler", "Ürünler"],
  ["kategoriler", "Kategoriler"],
  ["stok-hareketleri", "Stok"],
  ["musteriler", "Müşteriler"],
  ["promosyon", "Promosyonlar"],
  ["bulten", "Aboneler"],
  ["bulten/kampanya", "Kampanyalar"],
];

const source = (route: string) =>
  readFileSync(`src/app/admin/${route}/page.tsx`, "utf8");

describe("list pages say the nav's word", () => {
  for (const [route, label] of LIST_PAGES) {
    it(`/admin/${route}: h1 "${label}" is a nav item or tab`, () => {
      expect(layout).toContain(`label: "${label}"`);
      const page = source(route);
      expect(page).toContain(`title="${label}"`);
      // Sentence case: no capital after the first word.
      expect(label).not.toMatch(/\s\p{Lu}/u);
    });

    it(`/admin/${route}: no repeated eyebrow, PageShell, no "+" glyph`, () => {
      const page = source(route);
      expect(page).not.toMatch(/\beyebrow=/);
      expect(page).toContain("<PageShell");
      expect(page).not.toMatch(/<main\b/);
      expect(page).not.toMatch(/label: "\+ /);
      expect(page).not.toMatch(/>\s*\+ [A-ZÇĞİÖŞÜ]/);
    });
  }
});

describe("record pages use the kit's header", () => {
  it("an order and a booking are a PageHeader with meta and badges", () => {
    for (const route of ["siparisler/[id]", "mobil/karaoke/[id]"]) {
      const page = source(route);
      expect(page, route).toContain("<PageHeader");
      expect(page, route).toContain("meta={");
      expect(page, route).toContain("badges={");
      expect(page, route).toContain("<PageShell");
      expect(page, route).not.toMatch(/<h1\b/);
    }
  });

  it("the karaoke list offers saved views, like the orders list", () => {
    expect(source("mobil/karaoke")).toContain('views={{ key: "karaoke" }}');
  });
});

describe("policy text moved into the help disclosure, not deleted", () => {
  const MOVED: ReadonlyArray<readonly [string, string]> = [
    ["siparisler", "toplu işlem yapabilirsin"],
    ["mobil/karaoke", "Ödenmişi iptal etmek tutarın tamamını iade eder"],
    ["kasa", "E-postayla damga verilmez"],
    ["menu", "Basılı menünün tamamı"],
    ["urunler", "5 adımlı sihirbazla"],
    ["kategoriler", "İçinde ürün olan kategori"],
    ["musteriler", "iptal edilen siparişler girmez"],
    ["promosyon", "minimum sepet, kullanım limiti"],
    ["bulten", "bağlantıya basınca Aktif olur"],
    ["bulten/kampanya", "eksik kalan partileri günlük görev tamamlar"],
  ];
  for (const [route, text] of MOVED) {
    it(`/admin/${route} keeps "${text}" inside help={...}`, () => {
      const page = source(route).replace(/\s+/g, " ");
      const help = page.slice(page.indexOf("help={"));
      expect(help.slice(0, 900)).toContain(text);
    });
  }
});
