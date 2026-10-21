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

/*
 * UI-20: the same rules on the İçerik and Yönetim pages. A merged item's
 * pages say the nav word of the item or of their tab; Slaytlar says
 * "Slaytlar" on all three of its tabs, Ayarlar "Ayarlar" on both.
 */
const CONTENT_PAGES: ReadonlyArray<readonly [string, string]> = [
  ["anasayfa-hero", "Slaytlar"],
  ["magaza-hero", "Slaytlar"],
  ["mobil/slaytlar", "Slaytlar"],
  ["icerik", "Site metinleri"],
  ["hikaye", "Hikaye"],
  ["basin", "Basın"],
  ["mobil/duyurular", "Duyurular"],
  ["mobil/gonderiler", "Gönderiler"],
  ["mobil/fal-bildirimleri", "fA'L bildirimleri"],
  ["raporlar", "Raporlar"],
  ["masalar", "Masalar"],
  ["ayarlar", "Ayarlar"],
  ["mobil/ayarlar", "Ayarlar"],
  ["kullanicilar", "Kullanıcılar"],
  ["hukuk", "Yasal belgeler"],
  ["olay-kaydi", "Olay kaydı"],
];

describe("İçerik and Yönetim pages say the nav's word", () => {
  for (const [route, label] of CONTENT_PAGES) {
    it(`/admin/${route}: h1 "${label}", PageShell, no eyebrow, no "+" glyph`, () => {
      expect(layout).toContain(`label: "${label}"`);
      const page = source(route);
      expect(page).toContain(`title="${label}"`);
      expect(page).not.toMatch(/\beyebrow=/);
      expect(page).toContain("<PageShell");
      expect(page).not.toMatch(/<main\b/);
      expect(page).not.toMatch(/label: "\+ /);
      expect(page).not.toMatch(/>\s*\+ [A-ZÇĞİÖŞÜ]/);
    });
  }

  it("the dashboard says Genel bakış and greets in its description", () => {
    const page = readFileSync("src/app/admin/page.tsx", "utf8");
    expect(layout).toContain('label: "Genel bakış"');
    expect(page).toContain('title="Genel bakış"');
    expect(page).not.toMatch(/\beyebrow=/);
    expect(page).toContain("<PageShell");
    expect(page).not.toMatch(/<main\b/);
  });
});

describe("policy text moved into help, not deleted (İçerik and Yönetim)", () => {
  const MOVED: ReadonlyArray<readonly [string, string]> = [
    ["anasayfa-hero", "Kaydettiğin değişiklik siteye hemen yansır"],
    ["magaza-hero", "Kaydettiğin değişiklik mağazaya hemen yansır"],
    ["mobil/slaytlar", "birkaç dakika"],
    ["icerik", "günde bir yenilediği için"],
    ["hikaye", "uygulamanın Hikâye"],
    ["basin", "Yalnız gerçekten yayımlanmış alıntılar girilir"],
    ["mobil/duyurular", "tarih aralığı verirsen kendiliğinden"],
    ["mobil/gonderiler", "Tarih aralığı verirsen"],
    ["mobil/fal-bildirimleri", "Kayıtlar 90 gün sonra silinir"],
    ["raporlar", "İade, siparişin verildiği dönemden düşülür"],
    ["masalar", "Ödeme her zaman sipariş verilirken"],
    ["ayarlar", "Her sekme kendi Kaydet düğmesiyle"],
    ["mobil/ayarlar", "Uygulama bunları açılışta okur"],
    ["kullanicilar", "Kasiyer rolü yalnız Kasa sayfasını açar"],
    ["hukuk", "Değiştirilen ve kaldırılan metinler arşivde kalır"],
    ["olay-kaydi", "Kayıtlar değiştirilemez ve on yıl saklanır"],
  ];
  for (const [route, text] of MOVED) {
    it(`/admin/${route} keeps "${text}" inside help={...}`, () => {
      const page = source(route).replace(/\s+/g, " ");
      const help = page.slice(page.indexOf("help={"));
      expect(page).toContain("help={");
      expect(help.slice(0, 900)).toContain(text);
    });
  }

  it("descriptions are one line of at most 12 words", () => {
    for (const [route] of CONTENT_PAGES) {
      const page = source(route).replace(/\s+/g, " ");
      const header = page.slice(page.indexOf("<PageHeader"));
      const m = header.match(/description="([^"]+)"/);
      if (!m) continue;
      expect(m[1].split(" ").length, route).toBeLessThanOrEqual(12);
    }
  });
});

describe("Basın and Hikaye create in a Yeni dialog", () => {
  const CASES: ReadonlyArray<readonly [string, string, string[]]> = [
    ["basin", "createPressAction", ["name", "quote", "sortOrder", "isActive"]],
    [
      "hikaye",
      "createStoryAction",
      ["year", "title", "body", "sortOrder", "isActive"],
    ],
  ];
  for (const [route, action, names] of CASES) {
    it(`/admin/${route}: the old form's action and field names live in an ActionModal`, () => {
      const page = source(route);
      expect(page).toContain("<ActionModal");
      expect(page).toContain(`action={${action}}`);
      expect(page).not.toContain("resetOnSuccess");
      expect(page).not.toMatch(/<h2[^>]*>\+ /);
      // The fields are the same components with the same names: the
      // shared field block carries the first ones, the dialog the rest.
      const modal = page.slice(page.indexOf("<ActionModal"));
      for (const name of names) {
        expect(page, name).toMatch(new RegExp(`name="${name}"`));
      }
      expect(modal).toContain('name="sortOrder"');
      expect(modal).toContain('name="isActive"');
      expect(modal).toContain("modal");
    });
  }
});

describe("Yasal belgeler: one text action per row", () => {
  const page = source("hukuk");

  it("the title opens Düzenle; the published page is an icon link with a label", () => {
    expect(page).toMatch(
      /href=\{`\/admin\/hukuk\/\$\{doc\.slug\}`\}\s+className="font-medium/,
    );
    expect(page).toContain("BUTTON.icon");
    expect(page).toContain("Yayındakini aç: ${doc.title} (yeni sekme)");
    expect(page).not.toContain("Yayındakini aç ↗");
  });

  it("the draft preview and the reset sit in the row's ⋯ menu", () => {
    const row = page.slice(page.indexOf("<ActionMenu "));
    expect(row).toContain("Taslağı önizle");
    expect(row).toContain("Varsayılana döndür");
    expect(row).toContain('variant="menuDanger"');
    // Outside the menu, only Düzenle is a text button.
    const outside = page.slice(0, page.indexOf("<ActionMenu "));
    expect(
      outside.match(/className=\{BUTTON\.(ghost|primary)\}/g),
    ).toHaveLength(1);
  });
});
