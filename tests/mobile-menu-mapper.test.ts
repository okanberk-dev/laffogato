import { describe, expect, it } from "vitest";

import type { AdminMenuItem, AdminProduct } from "@/lib/admin/store";

import type { WeeklyHours } from "@/lib/admin/days";
import { imageVersion } from "@/lib/admin/image-bytes";
import {
  DEFAULT_MOBILE_APP_CONFIG,
  normalizeMobileAppConfig,
} from "@/lib/mobile/app-config";
import {
  absoluteImageUrl,
  BEAN_GRINDS,
  buildBootstrap,
  buildMobileMenuCategories,
  COURIER_ETA_MINUTES,
  HAPPY_HOUR_CATEGORIES,
  happyHourFor,
  hoursLabel,
  istanbulDay,
  latestUpdatedAt,
  toMobileMenuItem,
  toMobileShopProduct,
  weeklyHoursRows,
} from "@/lib/mobile/menu-mapper";

const SITE_URL = "https://laffogato.net";

function menuItem(over: Partial<AdminMenuItem> = {}): AdminMenuItem {
  return {
    id: "mnu-0007",
    categoryKey: "espresso",
    name: "Cappuccino",
    desc: "Espresso, buharlı süt ve kalın köpük.",
    priceMinor: 19500,
    priceMinorL: 21000,
    hue: "caramel",
    image: "",
    tags: ["signature"],
    isActive: true,
    sortOrder: 3,
    backdrop: null,
    backdropSource: "auto",
    backdropHex: null,
    photoCutout: false,
    vessel: null,
    updatedAt: "2026-08-20T10:00:00.000Z",
    ...over,
  };
}

function product(over: Partial<AdminProduct> = {}): AdminProduct {
  return {
    id: "prd-0001",
    name: "Sirena — Espresso Blend",
    slug: "sirena-espresso-blend",
    sku: "SIR-250",
    tag: "Çekirdek · 250g",
    priceMinor: 32000,
    compareAtPriceMinor: 0,
    costMinor: 12000,
    desc: "Bologna kavurma profili.",
    cat: "beans",
    img: "caramel",
    images: [],
    tags: [],
    brand: "",
    notes: [],
    backdrop: null,
    backdropSource: "auto",
    backdropHex: null,
    photoCutout: false,
    vessel: null,
    stock: 12,
    lowStockThreshold: 3,
    weightGrams: 250,
    featured: true,
    isNew: false,
    isActive: true,
    seoTitle: "Sirena",
    seoDescription: "Sirena çekirdek",
    variants: [
      {
        id: "var-250",
        name: "250 g",
        priceDeltaMinor: 0,
        stock: 12,
        sku: "SIR-250",
        isActive: true,
      },
      {
        id: "var-1kg",
        name: "1 kg",
        priceDeltaMinor: 77000,
        stock: 0,
        sku: "SIR-1KG",
        isActive: true,
      },
      {
        id: "var-old",
        name: "500 g",
        priceDeltaMinor: 30000,
        stock: 5,
        sku: "SIR-500",
        isActive: false,
      },
    ],
    updatedAt: "2026-08-20T10:00:00.000Z",
    ...over,
  };
}

function everyDay(open: string, close: string): WeeklyHours {
  const d = { open, close, closed: false };
  return {
    mon: { ...d },
    tue: { ...d },
    wed: { ...d },
    thu: { ...d },
    fri: { ...d },
    sat: { ...d },
    sun: { ...d },
  };
}

describe("absoluteImageUrl", () => {
  it("prefixes a served path with the site URL, once", () => {
    expect(absoluteImageUrl("/gorsel/menu/mnu-0007", SITE_URL)).toBe(
      "https://laffogato.net/gorsel/menu/mnu-0007",
    );
    expect(absoluteImageUrl("/x", "https://laffogato.net/")).toBe(
      "https://laffogato.net/x",
    );
  });
  it("passes an https URL through and maps anything else to null", () => {
    expect(absoluteImageUrl("https://cdn.example/a.webp", SITE_URL)).toBe(
      "https://cdn.example/a.webp",
    );
    expect(absoluteImageUrl("", SITE_URL)).toBeNull();
    expect(absoluteImageUrl("data:image/png;base64,AAAA", SITE_URL)).toBeNull();
  });
});

describe("toMobileMenuItem (contract §1)", () => {
  it("emits exactly the contract fields - no updatedAt, isActive, sortOrder", () => {
    const out = toMobileMenuItem(menuItem(), SITE_URL);
    expect(Object.keys(out).sort()).toEqual(
      [
        "id",
        "categoryKey",
        "name",
        "description",
        "priceMinor",
        "priceLargeMinor",
        "tags",
        "hue",
        "image",
        // 24 Eyl 2026, additive: the scene family, cutout and vessel.
        "backdrop",
        "photoCutout",
        "vessel",
      ].sort(),
    );
    expect(out).not.toHaveProperty("updatedAt");
    expect(out).not.toHaveProperty("isActive");
    expect(out).not.toHaveProperty("sortOrder");
    expect(out).not.toHaveProperty("desc");
    expect(out).not.toHaveProperty("backdropSource");
    expect(out).not.toHaveProperty("backdropHex");
  });

  it("renames desc → description and priceMinorL → priceLargeMinor", () => {
    const out = toMobileMenuItem(menuItem(), SITE_URL);
    expect(out.description).toBe("Espresso, buharlı süt ve kalın köpük.");
    expect(out.priceMinor).toBe(19500);
    expect(out.priceLargeMinor).toBe(21000);
  });

  it("sends null, not 0, for a single-size item", () => {
    expect(
      toMobileMenuItem(menuItem({ priceMinorL: 0 }), SITE_URL).priceLargeMinor,
    ).toBeNull();
  });

  it("turns an uploaded data: image into an absolute served URL", () => {
    const out = toMobileMenuItem(
      menuItem({ image: "data:image/webp;base64,AAAA" }),
      SITE_URL,
    );
    // The `?v=` is the photo's own content stamp - tests/image-version.test.ts
    // holds it to its promise. Here only the shape matters.
    expect(out.image).toBe(
      `https://laffogato.net/gorsel/menu/mnu-0007?v=${imageVersion("data:image/webp;base64,AAAA")}`,
    );
    expect(out.image).toMatch(/\?v=[0-9a-f]{12}$/);
  });

  it("keeps a bundled site-relative photo absolute and an empty one null", () => {
    expect(
      toMobileMenuItem(menuItem({ image: "/menu/cappuccino.webp" }), SITE_URL)
        .image,
    ).toBe("https://laffogato.net/menu/cappuccino.webp");
    expect(
      toMobileMenuItem(menuItem({ image: "" }), SITE_URL).image,
    ).toBeNull();
  });

  it("copies tags so the nuts flag reaches the app", () => {
    const src = menuItem({ tags: ["iced", "nuts"] });
    const out = toMobileMenuItem(src, SITE_URL);
    expect(out.tags).toEqual(["iced", "nuts"]);
    expect(out.tags).not.toBe(src.tags);
  });
});

describe("scene fields - backdrop · photoCutout · vessel (contract §1, 24 Eyl 2026)", () => {
  const PHOTO = "data:image/webp;base64,AAAA";

  it("publishes a known family, the cutout flag and the vessel", () => {
    const out = toMobileMenuItem(
      menuItem({
        image: PHOTO,
        backdrop: "caramel",
        backdropSource: "manual",
        backdropHex: "#B87333",
        photoCutout: true,
        vessel: "tulip",
      }),
      SITE_URL,
    );
    expect(out).toMatchObject({
      backdrop: "caramel",
      photoCutout: true,
      vessel: "tulip",
    });
  });

  it("sends null / false / null for a row with nothing picked", () => {
    const out = toMobileMenuItem(menuItem(), SITE_URL);
    expect(out.backdrop).toBeNull();
    expect(out.photoCutout).toBe(false);
    expect(out.vessel).toBeNull();
  });

  it("never publishes an unknown family or vessel, nor the app's screen scenes", () => {
    for (const backdrop of ["house", "velvet", "Caramel", "teal", ""]) {
      expect(
        toMobileMenuItem(menuItem({ backdrop }), SITE_URL).backdrop,
      ).toBeNull();
    }
    for (const vessel of ["glass", "Cup", ""]) {
      expect(toMobileMenuItem(menuItem({ vessel }), SITE_URL).vessel).toBeNull();
    }
  });

  it("says cutout only for a photo it publishes, and only for a real true", () => {
    // The column still says true after the photo was removed: no photo, no cutout.
    expect(
      toMobileMenuItem(menuItem({ image: "", photoCutout: true }), SITE_URL)
        .photoCutout,
    ).toBe(false);
    expect(
      toMobileMenuItem(
        menuItem({ image: PHOTO, photoCutout: "true" as unknown as boolean }),
        SITE_URL,
      ).photoCutout,
    ).toBe(false);
  });

  it("degrades to null / false / null while the migration has not run", () => {
    // `select("*")` before the columns exist: the keys are absent, not null.
    const {
      backdrop: _b,
      backdropSource: _s,
      backdropHex: _h,
      photoCutout: _c,
      vessel: _v,
      ...menuBefore
    } = menuItem({ image: PHOTO });
    const item = toMobileMenuItem(menuBefore as AdminMenuItem, SITE_URL);
    expect([item.backdrop, item.photoCutout, item.vessel]).toEqual([
      null,
      false,
      null,
    ]);

    const {
      backdrop: _pb,
      backdropSource: _ps,
      backdropHex: _ph,
      photoCutout: _pc,
      vessel: _pv,
      ...productBefore
    } = product({ images: [PHOTO] });
    const shop = toMobileShopProduct(productBefore as AdminProduct, SITE_URL);
    expect([shop.backdrop, shop.photoCutout, shop.vessel]).toEqual([
      null,
      false,
      null,
    ]);
  });

  it("describes a shop product's first photo the same way", () => {
    const out = toMobileShopProduct(
      product({
        images: [PHOTO],
        backdrop: "espresso",
        photoCutout: true,
        vessel: "pack",
      }),
      SITE_URL,
    );
    expect(out).toMatchObject({
      backdrop: "espresso",
      photoCutout: true,
      vessel: "pack",
    });
    const noPhoto = toMobileShopProduct(
      product({ images: [], backdrop: "latte", photoCutout: true, vessel: "cup" }),
      SITE_URL,
    );
    // A family and a vessel stand without a photo (the operator chose them);
    // a cutout does not.
    expect(noPhoto).toMatchObject({
      backdrop: "latte",
      photoCutout: false,
      vessel: "cup",
    });
    expect(
      toMobileShopProduct(product({ backdrop: "velvet", vessel: "mug" }), SITE_URL),
    ).toMatchObject({ backdrop: null, vessel: null });
  });
});

describe("buildMobileMenuCategories", () => {
  const keys = ["matcha", "espresso"];

  it("groups in key order with seed metadata and subtitle ← sub", () => {
    const cats = buildMobileMenuCategories(
      [
        menuItem({ id: "mnu-0002", categoryKey: "espresso", sortOrder: 2 }),
        menuItem({ id: "mnu-0001", categoryKey: "matcha", sortOrder: 1 }),
        menuItem({ id: "mnu-0003", categoryKey: "espresso", sortOrder: 1 }),
      ],
      keys,
      SITE_URL,
    );
    expect(cats.map((c) => c.key)).toEqual(["matcha", "espresso"]);
    expect(cats[0]).toMatchObject({
      title: "Matcha Bar",
      subtitle: "Strawberry Aşkı",
      italian: "Il banco matcha",
    });
    expect(typeof cats[0].note).toBe("string");
    expect(cats[1].items.map((i) => i.id)).toEqual(["mnu-0003", "mnu-0002"]);
    expect(Object.keys(cats[0]).sort()).toEqual(
      ["key", "title", "subtitle", "italian", "note", "items"].sort(),
    );
  });

  it("drops inactive items but keeps an emptied category", () => {
    const cats = buildMobileMenuCategories(
      [menuItem({ categoryKey: "matcha", isActive: false })],
      keys,
      SITE_URL,
    );
    expect(cats.map((c) => c.items.length)).toEqual([0, 0]);
  });

  it("skips a key the seed does not know", () => {
    expect(
      buildMobileMenuCategories([], ["nope", "espresso"], SITE_URL).map(
        (c) => c.key,
      ),
    ).toEqual(["espresso"]);
  });
});

describe("latestUpdatedAt", () => {
  it("picks the newest ISO stamp, or the fallback when empty", () => {
    expect(
      latestUpdatedAt(
        [
          { updatedAt: "2026-08-01T00:00:00.000Z" },
          { updatedAt: "2026-08-20T10:00:00.000Z" },
          { updatedAt: "" },
        ],
        "now",
      ),
    ).toBe("2026-08-20T10:00:00.000Z");
    expect(latestUpdatedAt([], "now")).toBe("now");
  });
});

describe("toMobileShopProduct (contract §2)", () => {
  it("emits the contract fields only - no cost, sku, SEO, stock counts", () => {
    const out = toMobileShopProduct(product(), SITE_URL);
    expect(Object.keys(out).sort()).toEqual(
      [
        "id",
        "slug",
        "name",
        "tag",
        "description",
        "priceMinor",
        "compareAtPriceMinor",
        "category",
        "tags",
        // 23 Eyl 2026, additive: the maker's eyebrow and the tasting notes.
        "brand",
        "notes",
        "hue",
        "image",
        // 24 Eyl 2026, additive: the scene family, cutout and vessel.
        "backdrop",
        "photoCutout",
        "vessel",
        "inStock",
        "variants",
        "grinds",
      ].sort(),
    );
    for (const leak of [
      "costMinor",
      "sku",
      "seoTitle",
      "seoDescription",
      "stock",
      "lowStockThreshold",
      "updatedAt",
      "isActive",
      "featured",
      "images",
      "img",
      "cat",
      "desc",
      // The panel's bookkeeping, not the app's business.
      "backdropSource",
      "backdropHex",
    ]) {
      expect(out).not.toHaveProperty(leak);
    }
  });

  it("computes variant prices as base + delta and drops inactive variants", () => {
    const out = toMobileShopProduct(product(), SITE_URL);
    expect(out.variants).toEqual([
      { id: "var-250", name: "250 g", priceMinor: 32000, inStock: true },
      { id: "var-1kg", name: "1 kg", priceMinor: 109000, inStock: false },
    ]);
    expect(out.variants.every((v) => !("priceDeltaMinor" in v))).toBe(true);
    expect(out.variants.every((v) => !("stock" in v))).toBe(true);
  });

  it("offers grinds only on beans", () => {
    expect(toMobileShopProduct(product(), SITE_URL).grinds).toEqual([
      "Çekirdek",
      "Espresso",
      "Filtre",
      "French Press",
    ]);
    expect(BEAN_GRINDS).toHaveLength(4);
    expect(
      toMobileShopProduct(product({ cat: "gift" }), SITE_URL),
    ).not.toHaveProperty("grinds");
  });

  it("maps stock to a boolean and a was-price only when higher", () => {
    expect(toMobileShopProduct(product({ stock: 0 }), SITE_URL).inStock).toBe(
      false,
    );
    expect(
      toMobileShopProduct(product({ compareAtPriceMinor: 39000 }), SITE_URL)
        .compareAtPriceMinor,
    ).toBe(39000);
    expect(
      toMobileShopProduct(product({ compareAtPriceMinor: 30000 }), SITE_URL)
        .compareAtPriceMinor,
    ).toBe(0);
  });

  it("serves the first image as an absolute URL, or null", () => {
    expect(toMobileShopProduct(product(), SITE_URL).image).toBeNull();
    expect(
      toMobileShopProduct(
        product({ images: ["data:image/png;base64,AAAA", "https://b/2.png"] }),
        SITE_URL,
      ).image,
    ).toBe(
      `https://laffogato.net/gorsel/urun/prd-0001/0?v=${imageVersion("data:image/png;base64,AAAA")}`,
    );
    expect(
      toMobileShopProduct(product({ images: ["https://cdn/a.png"] }), SITE_URL)
        .image,
    ).toBe("https://cdn/a.png");
  });
});

describe("hoursLabel", () => {
  it("collapses an identical week into 'Her gün'", () => {
    expect(hoursLabel(everyDay("09:00", "01:00"))).toBe(
      "Her gün 09:00 - 01:00",
    );
  });

  it("lists consecutive runs and closed days", () => {
    const w = everyDay("09:00", "01:00");
    w.sat = { open: "10:00", close: "02:00", closed: false };
    w.sun = { open: "", close: "", closed: true };
    expect(hoursLabel(w)).toBe(
      "Pzt-Cum 09:00 - 01:00 · Cmt 10:00 - 02:00 · Paz Kapalı",
    );
  });

  it("says Kapalı for a week with no open day", () => {
    const w = everyDay("", "");
    for (const k of Object.keys(w) as (keyof WeeklyHours)[]) {
      w[k] = { open: "", close: "", closed: true };
    }
    expect(hoursLabel(w)).toBe("Kapalı");
  });
});

describe("buildBootstrap (contract §10)", () => {
  const site = {
    name: "L'Affogato",
    phone: "+90 536 429 09 19",
    email: "info@nextgenlab.com.tr",
    address: {
      streetAddress: "Postane Mah. Atatürk Cad. No: 28 İç Kapı No: 1",
      addressLocality: "Tuzla",
      addressRegion: "İstanbul",
      postalCode: "34940",
    },
    geo: { latitude: 40.8165716, longitude: 29.3032493 },
  };
  const settings = {
    phone: "+90 555 000 00 00",
    email: "merhaba@laffogato.net",
    address: "",
    weeklyHours: everyDay("09:00", "01:00"),
    courierFeeMinor: 5500,
    isShopOpen: true,
    mobileApp: DEFAULT_MOBILE_APP_CONFIG,
  };
  // Wednesday 2026-09-02 12:00 in Istanbul (09:00 UTC).
  const WEDNESDAY = new Date("2026-09-02T09:00:00Z");

  it("uses the tax-certificate address split into two lines", () => {
    const b = buildBootstrap(settings, site);
    expect(b.venue.addressLines).toEqual([
      "Postane Mah. Atatürk Cad. No: 28 İç Kapı No: 1",
      "34940 Tuzla / İstanbul",
    ]);
    expect(b.venue).toMatchObject({
      name: "L'Affogato",
      lat: 40.8165716,
      lng: 29.3032493,
    });
  });

  it("puts the admin-edited address on the first line when there is one", () => {
    const b = buildBootstrap(
      { ...settings, address: "  Atatürk Cad. No: 28, Tuzla  " },
      site,
    );
    // The town comes off line 1: it is already line 2, and printing it twice
    // is what the site's footer stopped doing when the landmark was dropped.
    expect(b.venue.addressLines).toEqual([
      "Atatürk Cad. No: 28",
      "34940 Tuzla / İstanbul",
    ]);
  });

  it("drops the landmark and the repeated town from the real settings address", () => {
    // The exact string in production. Before this, the app's Ziyaret screen
    // showed the landmark the operator had asked to be removed and printed
    // "34940 Tuzla / İstanbul" on both lines.
    const b = buildBootstrap(
      {
        ...settings,
        address:
          "Postane Mah. Atatürk Cad. No: 28 İç Kapı No: 1 (Menemenci Cumhur’un yanı), 34940 Tuzla / İstanbul",
      },
      site,
    );
    expect(b.venue.addressLines).toEqual([
      "Postane Mah. Atatürk Cad. No: 28 İç Kapı No: 1",
      "34940 Tuzla / İstanbul",
    ]);
  });

  it("publishes the venue copy from the app config", () => {
    const mobileApp = normalizeMobileAppConfig({
      venue: {
        shortName: "Tuzla",
        landmark: "Postane karşısı",
        mapsQuery: "L'Affogato Tuzla",
      },
    });
    expect(
      buildBootstrap({ ...settings, mobileApp }, site).venue,
    ).toMatchObject({
      shortName: "Tuzla",
      landmark: "Postane karşısı",
      mapsQuery: "L'Affogato Tuzla",
    });
    expect(buildBootstrap(settings, site).venue).toMatchObject({
      shortName: "Tuzla · İstanbul",
      landmark: "Menemenci Cumhur’un yanı",
    });
  });

  it("sends seven ungrouped hour rows, Monday first, and today's open/close", () => {
    const weekly = everyDay("09:00", "01:00");
    weekly.sun = { open: "10:00", close: "22:00", closed: false };
    weekly.mon = { open: "00:00", close: "00:00", closed: true };
    const b = buildBootstrap(
      { ...settings, weeklyHours: weekly },
      site,
      WEDNESDAY,
    );
    expect(b.venue.hours).toHaveLength(7);
    expect(b.venue.hours[0]).toEqual({ label: "Pazartesi", value: "Kapalı" });
    expect(b.venue.hours[2]).toEqual({
      label: "Çarşamba",
      value: "09:00 - 01:00",
    });
    expect(b.venue.hours[6]).toEqual({
      label: "Pazar",
      value: "10:00 - 22:00",
    });
    expect(b.venue.hours.map((h) => h.label)).toEqual([
      "Pazartesi",
      "Salı",
      "Çarşamba",
      "Perşembe",
      "Cuma",
      "Cumartesi",
      "Pazar",
    ]);
    expect(b.venue).toMatchObject({ opensAt: "09:00", closesAt: "01:00" });
    // A closed "today" publishes empty strings, not the previous day's times.
    const monday = new Date("2026-08-31T09:00:00Z");
    expect(
      buildBootstrap({ ...settings, weeklyHours: weekly }, site, monday).venue,
    ).toMatchObject({ opensAt: "", closesAt: "" });
    expect(weeklyHoursRows(weekly)[6].value).toBe("10:00 - 22:00");
  });

  it("resolves the weekday in Istanbul, not UTC", () => {
    // 22:30 UTC on Tuesday is already 01:30 Wednesday in Istanbul (UTC+3).
    expect(istanbulDay(new Date("2026-09-01T22:30:00Z"))).toBe("wed");
    expect(istanbulDay(new Date("2026-09-01T12:00:00Z"))).toBe("tue");
  });

  it("publishes the app config and mirrors its version and ETA at the top level", () => {
    const mobileApp = normalizeMobileAppConfig({
      minSupportedAppVersion: "1.3.0",
      ordering: { cafeEnabled: false, courierEtaMinutes: [30, 45] },
      loyalty: { stampTarget: 8, rewardValueMinor: 5000 },
      karaoke: { maxHours: 2 },
    });
    const b = buildBootstrap({ ...settings, mobileApp }, site);
    expect(b.minSupportedAppVersion).toBe("1.3.0");
    expect(b.courierEtaMinutes).toEqual([30, 45]);
    expect(b.app.minSupportedAppVersion).toBe("1.3.0");
    expect(b.app.ordering).toMatchObject({
      cafeEnabled: false,
      courierEtaMinutes: [30, 45],
    });
    expect(b.app.loyalty).toEqual({
      stampTarget: 8,
      rewardTitle: "Ücretsiz içecek",
      stampMinOrderMinor: 14000,
    });
    expect(b.app.reminders.items.map((i) => i.id)).toEqual([
      "morning",
      "afternoon",
    ]);
    expect(b.app.campaignCards).toEqual({
      loyalty: true,
      invite: true,
      subscription: true,
    });
    // Karaoke rules and coupon economics stay server-side.
    expect(b.app).not.toHaveProperty("karaoke");
    expect(b.app.loyalty).not.toHaveProperty("rewardValueMinor");
    // The wire copy must not alias the settings document.
    expect(b.courierEtaMinutes).not.toBe(mobileApp.ordering.courierEtaMinutes);
    expect(b.app.ordering.courierEtaMinutes).not.toBe(
      mobileApp.ordering.courierEtaMinutes,
    );
  });

  it("prefers the admin-edited contact and falls back to the site's", () => {
    expect(buildBootstrap(settings, site).venue.phone).toBe(
      "+90 555 000 00 00",
    );
    expect(
      buildBootstrap({ ...settings, phone: "  ", email: "" }, site).venue,
    ).toMatchObject({ phone: site.phone, email: site.email });
  });

  it("publishes the shop's own switch, so the phone can say so BEFORE checkout", () => {
    // `finalizeOrder` refuses a cargo basket with `shop_closed` when
    // `settings.isShopOpen` is off - and that setting was never published.
    // The member filled a basket, entered an address, and met a 409 at the
    // last step with nothing on the way there having hinted at it.
    expect(buildBootstrap({ ...settings, isShopOpen: true }, site).app.ordering.shopEnabled).toBe(true);
    expect(buildBootstrap({ ...settings, isShopOpen: false }, site).app.ordering.shopEnabled).toBe(false);

    // It is NOT a second switch in the mobile panel: the cafe's own three are
    // untouched by it, so turning the shop off never closes the cafe.
    const closed = buildBootstrap({ ...settings, isShopOpen: false }, site).app.ordering;
    expect(closed.cafeEnabled).toBe(true);
    expect(closed.pickupEnabled).toBe(true);
  });

  it("carries the fixed app constants and the settings courier fee", () => {
    const b = buildBootstrap({ ...settings, courierFeeMinor: 6000 }, site);
    expect(b).toMatchObject({
      minSupportedAppVersion: "1.0.0",
      hoursLabel: "Her gün 09:00 - 01:00",
      courierFeeMinor: 6000,
      courierEtaMinutes: [25, 35],
      // Not advertised while nothing prices it: the app drew "%25, kod
      // gerekmez" and the till charged full price. Both app screens skip the
      // card when this is null.
      happyHour: null,
    });
    expect(COURIER_ETA_MINUTES).toEqual([25, 35]);
    // The campaign shape is kept for the day it is priced; publishing it
    // again must hand out a copy, not the shared constant.
    // Every drink category, and a fresh array each time so a caller cannot
    // mutate the shared list (operator's rule: "her içecekte").
    expect(HAPPY_HOUR_CATEGORIES).toContain("ice-coffee");
    expect(HAPPY_HOUR_CATEGORIES).toContain("espresso");
    expect(HAPPY_HOUR_CATEGORIES).toContain("hot");
    expect(HAPPY_HOUR_CATEGORIES).not.toContain("dessert");
    const on = happyHourFor({
      enabled: true,
      days: "weekday",
      from: "14:00",
      to: "17:00",
      pct: 25,
    });
    expect(on?.categories).not.toBe(HAPPY_HOUR_CATEGORIES);
    expect(
      happyHourFor({
        enabled: false,
        days: "weekday",
        from: "14:00",
        to: "17:00",
        pct: 25,
      }),
    ).toBeNull();
    expect(Object.keys(b).sort()).toEqual(
      [
        "minSupportedAppVersion",
        "venue",
        "hoursLabel",
        "courierFeeMinor",
        "courierEtaMinutes",
        "happyHour",
        "app",
      ].sort(),
    );
  });
});
