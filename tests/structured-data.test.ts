import { describe, it, expect } from "vitest";

import { MENU, PRODUCTS } from "@/components/laffogato/data";
import { DAYS_OF_WEEK, type WeeklyHours } from "@/lib/admin/days";
import { LEGAL_ENTITY } from "@/lib/legal/entity";
import { serializeJsonLd } from "@/lib/seo/json-ld";
import {
  menuLd,
  menuSectionLd,
  productListLd,
  siteGraphLd,
} from "@/lib/seo/structured-data";

const graph = JSON.stringify(siteGraphLd(MENU, PRODUCTS));

const TEST_HOURS = Object.fromEntries(
  DAYS_OF_WEEK.map((d) => [
    d,
    { open: "10:00", close: "23:00", closed: false },
  ]),
) as WeeklyHours;

describe("JSON-LD structured data — SEO audit fixes", () => {
  it("emits no franchise markup (franchise fully removed from the site)", () => {
    expect(graph).not.toMatch(/franchise/i);
    expect(graph).not.toContain("/#franchise");
  });

  it("emits no fabricated VideoObject markup", () => {
    expect(graph).not.toContain("VideoObject");
  });

  it("drops the invalid `referencePrice` property", () => {
    expect(graph).not.toContain("referencePrice");
  });

  it("publishes the 09:00–02:00 window, with the close on the following day", () => {
    // schema.org expresses a past-midnight close by letting `closes` be earlier
    // than `opens`; no encoding trick is needed. "24:00" is not a valid Time and
    // "00:00" would read as closed, so neither may appear.
    expect(graph).not.toContain('"closes":"24:00"');
    expect(graph).not.toContain('"closes":"00:00"');
    expect(graph).toContain('"opens":"09:00"');
    expect(graph).toContain('"closes":"02:00"');
  });

  it("lists the karaoke room as an amenity", () => {
    expect(graph).toContain("Karaoke odası");
  });

  it("drops the misleading nuts -> LowCalorieDiet diet claim", () => {
    expect(JSON.stringify(menuLd(MENU))).not.toContain("LowCalorieDiet");
  });

  it("has clean, non-garbled brand text (no escaping artifact, no Maltepe)", () => {
    expect(graph).not.toContain("L'''Affogato");
    expect(graph).not.toMatch(/maltepe/i);
  });

  it("carries consistent NAP (phone + tax-certificate street address)", () => {
    // Reservation line moved to the operator's mobile; the tax-certificate
    // street address stays as the identity backfill established it.
    expect(graph).toContain("+905364290919");
    expect(graph).not.toContain("+902164593060");
    expect(graph).toContain("Atatürk Cad.");
    expect(graph).not.toContain("29 Ekim");
  });

  it("declares the real legal entity and tax number on the Organization node", () => {
    expect(graph).toContain(
      "NEXTGEN YAZILIM EĞİTİM İNŞAAT SANAYİ VE TİCARET LİMİTED ŞİRKETİ",
    );
    expect(graph).toContain('"taxID":"6312110904"');
  });

  it("lists every official social profile under sameAs", () => {
    for (const url of [
      "https://instagram.com/laffogatto",
      "https://tiktok.com/@laffogatto",
      "https://youtube.com/@laffogatto",
      "https://x.com/laffogatto",
    ]) {
      expect(graph).toContain(url);
    }
  });

  it("uses the real /icon-512.png logo asset (not the missing /icon.png)", () => {
    expect(graph).toContain("/icon-512.png");
    expect(graph).not.toContain('"url":"https://laffogato.net/icon.png"');
  });

  it("points product entries at real PDP URLs, not the /#shop hash anchor", () => {
    expect(graph).not.toContain("/#shop");
    expect(graph).toContain("/magaza/urun/");
  });

  it("drops the non-functional WebSite SearchAction (no URL-based search)", () => {
    expect(graph).not.toContain("SearchAction");
    expect(graph).not.toContain("{search_term_string}");
  });
});

describe("JSON-LD serialization", () => {
  it("escapes anything that could close the script element", () => {
    const payload = serializeJsonLd({
      name: "Latte </script><script>alert(1)</script>",
    });
    expect(payload).not.toContain("</script>");
    expect(payload).not.toContain("<");
    expect(payload).not.toContain(">");
    expect(payload).toContain("\\u003c");
    // Still the same data once parsed.
    expect(JSON.parse(payload).name).toBe(
      "Latte </script><script>alert(1)</script>",
    );
  });

  it("escapes the line separators that break JSON in a script context", () => {
    const payload = serializeJsonLd({ note: "a\u2028b\u2029c" });
    expect(payload).not.toContain("\u2028");
    expect(payload).not.toContain("\u2029");
    expect(JSON.parse(payload).note).toBe("a\u2028b\u2029c");
  });
});

describe("offer prices", () => {
  const withKurus = [
    { ...PRODUCTS[0], name: "Kuruşlu", price: "185₺", priceMinor: 18490 },
  ];

  it("publishes the exact charged price, not the rounded display price", () => {
    const ld = JSON.stringify(siteGraphLd(MENU, withKurus));
    expect(ld).toContain('"price":"184.90"');
    expect(ld).not.toContain('"price":"185"');
  });

  it("omits the offer entirely when there is no real price", () => {
    // What the menu looks like during a database outage.
    const dashed = {
      test: {
        title: "T",
        sub: "",
        italian: "",
        note: "",
        items: [{ name: "Affogato", desc: "", price: "—", hue: "caramel" }],
      },
    } as unknown as typeof MENU;
    const ld = JSON.stringify(menuLd(dashed));
    expect(ld).not.toContain('"price":"0"');
    expect(ld).not.toContain("Offer");
  });

  it("declares an out-of-stock product OutOfStock", () => {
    const sold = [{ ...PRODUCTS[0], stock: 0 }];
    const ld = JSON.stringify(siteGraphLd(MENU, sold));
    expect(ld).toContain("OutOfStock");
  });

  it("omits shipping details rather than inventing a rate", () => {
    const ld = JSON.stringify(siteGraphLd(MENU, PRODUCTS));
    expect(ld).not.toContain("OfferShippingDetails");
  });

  it("takes the shipping rate from the live settings when given", () => {
    const ld = JSON.stringify(
      siteGraphLd(MENU, PRODUCTS, {
        weeklyHours: TEST_HOURS,
        shippingFlatMinor: 6900,
        shippingFreeThresholdMinor: 100000,
      }),
    );
    expect(ld).toContain('"value":"69.00"');
  });
});

describe("declared capabilities", () => {
  it("does not advertise a reservation service the site does not offer", () => {
    expect(graph).toContain('"acceptsReservations":false');
    expect(graph).not.toContain("ReserveAction");
    expect(graph).not.toContain("FoodEstablishmentReservation");
  });

  it("uses a valid BCP-47 language tag", () => {
    expect(graph).not.toContain('"inLanguage":"tr_TR"');
    expect(graph).toContain('"inLanguage":"tr-TR"');
  });
});

describe("company identifiers", () => {
  it("publishes the MERSİS number we hold", () => {
    expect(graph).toContain("MERSİS");
    expect(graph).toContain(LEGAL_ENTITY.mersisNo);
  });

  it("publishes no identifier we were not given", () => {
    // The trade registry number is withheld and the KEP address does not
    // exist; a PropertyValue with an empty value would claim both.
    expect(graph).not.toContain('"value":""');
    expect(graph).not.toContain("Ticaret Sicil No");
    expect(graph).not.toMatch(/kep\.tr/i);
  });
});

describe("listing pages carry the entities they list", () => {
  it("scopes a category product list to its own URL, not the catalogue", () => {
    const scoped = productListLd(PRODUCTS.slice(0, 2), undefined, {
      path: "/magaza/cekirdek",
      name: "Çekirdek Kahve",
      description: "Bologna'da kavrulan tek-origin çekirdek kahve.",
    })!;

    expect(scoped["@type"]).toBe("ItemList");
    expect(scoped["@id"]).toBe(
      "https://laffogato.net/magaza/cekirdek#products",
    );
    expect(scoped.url).toBe("https://laffogato.net/magaza/cekirdek");
    expect(scoped.name).toBe("Çekirdek Kahve");
    expect(scoped.numberOfItems).toBe(2);
  });

  it("keeps the catalogue id when no scope is given (home page)", () => {
    const all = productListLd(PRODUCTS)!;
    expect(all["@id"]).toBe("https://laffogato.net/#products");
    // A scopeless list describes the whole site, so it claims no single URL.
    expect(all.url).toBeUndefined();
    expect(graph).toContain('"@id":"https://laffogato.net/#products"');
  });

  it("publishes a menu category as a MenuSection joined to the full Menu", () => {
    const section = menuSectionLd("matcha", MENU.matcha, "/menu/matcha")!;

    expect(section["@type"]).toBe("MenuSection");
    expect(section["@id"]).toBe("https://laffogato.net/#menu-matcha");
    expect(section.url).toBe("https://laffogato.net/menu/matcha");
    // Same @id the full Menu uses for this section, so the two are one entity.
    expect(section.isPartOf).toEqual({
      "@type": "Menu",
      "@id": "https://laffogato.net/#menu",
    });
    const items = section.hasMenuItem as { name: string }[];
    expect(items.map((i) => i.name)).toEqual(
      MENU.matcha.items.map((i) => i.name),
    );
  });

  it("still emits every section inside the full menu after the split", () => {
    const full = menuLd(MENU);
    const sections = full.hasMenuSection as { "@id": string }[];
    expect(sections).toHaveLength(Object.keys(MENU).length);
    for (const key of Object.keys(MENU)) {
      expect(sections.some((s) => s["@id"].endsWith(`#menu-${key}`))).toBe(
        true,
      );
    }
    // The section node inside the Menu carries no page URL of its own.
    expect(JSON.stringify(sections)).not.toContain('"url"');
  });
});

describe("empty listings say nothing rather than claiming emptiness", () => {
  it("omits the product list when there is nothing to list", () => {
    // What /magaza looks like during a database outage: the shop renders
    // empty on purpose. `numberOfItems: 0` would publish that as a fact.
    expect(productListLd([])).toBeNull();
    expect(
      productListLd([], undefined, {
        path: "/magaza/cekirdek",
        name: "Çekirdek Kahve",
        description: "…",
      }),
    ).toBeNull();
  });

  it("drops the ItemList from the site graph instead of emitting an empty one", () => {
    const outage = JSON.stringify(siteGraphLd(MENU, []));
    // The nav is also an ItemList, so match the products node by its @id.
    expect(outage).not.toContain('"@id":"https://laffogato.net/#products"');
    expect(outage).not.toContain('"numberOfItems":0');
    // The rest of the graph still stands.
    expect(outage).toContain("CafeOrCoffeeShop");
  });

  it("omits a menu section that has no items", () => {
    const empty = {
      ...MENU.matcha,
      items: [],
    };
    expect(menuSectionLd("matcha", empty, "/menu/matcha")).toBeNull();
  });
});
