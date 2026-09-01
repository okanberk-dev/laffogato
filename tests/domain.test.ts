import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, it, expect } from "vitest";

import { SITE } from "@/lib/seo/site";
import { LEGAL_ENTITY } from "@/lib/legal/entity";
import { LEGAL_DOCS } from "@/lib/legal/documents";

describe("Canonical domain — laffogato.net", () => {
  it("SITE.url no longer points at the old .com.tr placeholder", () => {
    expect(SITE.url).not.toMatch(/laffogato\.com\.tr/);
    expect(SITE.url).toMatch(/^https?:\/\//);
  });

  it("legal entity mirrors the tax certificate (vergi levhası)", () => {
    expect(LEGAL_ENTITY.legalName).toBe(
      "NEXTGEN YAZILIM EĞİTİM İNŞAAT SANAYİ VE TİCARET LİMİTED ŞİRKETİ",
    );
    expect(LEGAL_ENTITY.taxNo).toBe("6312110904");
    expect(LEGAL_ENTITY.taxOffice).toBe("Tuzla Vergi Dairesi");
    expect(LEGAL_ENTITY.email).toBe("info@nextgenlab.com.tr");
  });

  it("carries the MERSİS number the company actually holds", () => {
    // From the trade registry record. A MERSİS number is exactly 16 digits.
    expect(LEGAL_ENTITY.mersisNo).toBe("0734069467300012");
    expect(LEGAL_ENTITY.mersisNo).toMatch(/^\d{16}$/);
  });

  it("publishes nothing the company has not given us", () => {
    // The trade registry number is withheld by the owner's choice; the KEP
    // address and bank account do not exist yet. All three stay empty so the
    // renderer drops their rows — an invented KEP would say tebligat can be
    // served there, an invented IBAN that a refund can be sent to it.
    expect(LEGAL_ENTITY.tradeRegistryNo).toBe("");
    expect(LEGAL_ENTITY.kep).toBe("");
    expect(LEGAL_ENTITY.bank.iban).toBe("");
  });

  it("legal documents reference laffogato.net, never .com.tr", () => {
    const all = JSON.stringify(LEGAL_DOCS);
    expect(all).not.toMatch(/laffogato\.com\.tr/);
    expect(all).toMatch(/laffogato\.net/);
  });

  it("the public AI-crawler file (llms-full.txt) uses laffogato.net only", () => {
    const txt = readFileSync(
      resolve(process.cwd(), "public/llms-full.txt"),
      "utf8",
    );
    expect(txt).not.toMatch(/laffogato\.com\.tr/);
    expect(txt).toMatch(/laffogato\.net/);
  });
});
