import { describe, it, expect } from "vitest";

import { MENU, PRODUCTS } from "@/components/laffogato/data";
import {
  franchiseServiceLd,
  menuLd,
  siteGraphLd,
} from "@/lib/seo/structured-data";

const graph = JSON.stringify(siteGraphLd(MENU, PRODUCTS));

describe("JSON-LD structured data — SEO audit fixes", () => {
  it("does not advertise a €0 franchise (price '0' is guarded out)", () => {
    expect(JSON.stringify(franchiseServiceLd())).not.toContain('"price":"0"');
  });

  it("emits no fabricated VideoObject markup", () => {
    expect(graph).not.toContain("VideoObject");
  });

  it("drops the invalid `referencePrice` property", () => {
    expect(graph).not.toContain("referencePrice");
  });

  it("represents a midnight close as 23:59 (24:00 invalid; 00:00 reads as closed)", () => {
    expect(graph).not.toContain('"closes":"24:00"');
    expect(graph).not.toContain('"closes":"00:00"');
    expect(graph).toContain('"closes":"23:59"');
  });

  it("drops the misleading nuts -> LowCalorieDiet diet claim", () => {
    expect(JSON.stringify(menuLd(MENU))).not.toContain("LowCalorieDiet");
  });

  it("has clean, non-garbled brand text (no escaping artifact, no Maltepe)", () => {
    expect(graph).not.toContain("L'''Affogato");
    expect(graph).not.toMatch(/maltepe/i);
  });

  it("carries consistent NAP (phone + new street address)", () => {
    expect(graph).toContain("+902164593060");
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
