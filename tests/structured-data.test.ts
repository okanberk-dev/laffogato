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

  it("represents midnight close as 00:00 (24:00 is invalid schema.org time)", () => {
    expect(graph).not.toContain('"closes":"24:00"');
    expect(graph).toContain('"closes":"00:00"');
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
});
