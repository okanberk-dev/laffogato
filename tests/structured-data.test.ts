import { describe, it, expect } from "vitest";

import { MENU, PRODUCTS } from "@/components/laffogato/data";
import { menuLd, siteGraphLd } from "@/lib/seo/structured-data";

const graph = JSON.stringify(siteGraphLd(MENU, PRODUCTS));

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

  it("publishes the 09:00–01:00 window, with the close on the following day", () => {
    // schema.org expresses a past-midnight close by letting `closes` be earlier
    // than `opens`; no encoding trick is needed. "24:00" is not a valid Time and
    // "00:00" would read as closed, so neither may appear.
    expect(graph).not.toContain('"closes":"24:00"');
    expect(graph).not.toContain('"closes":"00:00"');
    expect(graph).toContain('"opens":"09:00"');
    expect(graph).toContain('"closes":"01:00"');
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

  it("carries consistent NAP (phone + new street address)", () => {
    expect(graph).toContain("+905364290919");
    expect(graph).toContain("29 Ekim");
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
