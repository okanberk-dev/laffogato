import { describe, expect, it, vi } from "vitest";

import { LEGAL_CONTENT } from "@/lib/legal/content";
import { findLegalDoc } from "@/lib/legal/documents";
import { COMMERCIAL_CONSENT_UPDATED } from "@/lib/legal/meta";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ TABLES: {}, getDb: () => ({}) }));

/**
 * What the legal texts say about İYS against what the code does since the
 * İYS sync (22 Ekim 2026, src/lib/iys, docs/IYS.md, LEGAL-REDLINES §31):
 *
 *   - a consent obtained here is registered in İYS within three business
 *     days (uploaded on İYS Web), and no commercial mail goes to a consent
 *     İYS does not hold (the audience requires it);
 *   - a refusal is applied here at once and reaches İYS within three
 *     business days, not "at once";
 *   - İYS's own refusals are checked before every send (the check may be at
 *     most three business days old) and applied here.
 *
 * Sentences that promised İYS at once are pinned out; the ones that say
 * the process are pinned in.
 */

function textOf(slug: string): string {
  const doc = LEGAL_CONTENT.find((d) => d.slug === slug);
  if (!doc) throw new Error(slug);
  return JSON.stringify(doc);
}

describe("the İYS sentences match the İYS sync", () => {
  it("no text says a refusal reaches İYS the moment it arrives", () => {
    const all = JSON.stringify(LEGAL_CONTENT);
    expect(all).not.toContain(
      "Ret talebiniz alındığı anda uygulanır ve İYS kaydına işlenir.",
    );
    expect(all).not.toContain(
      "ret talebiniz gecikmeksizin işleme alınır ve İYS üzerinden de kaydedilir",
    );
    expect(textOf("sikayet-ve-uyusmazlik")).toContain(
      "Ret talebiniz alındığı anda uygulanır ve en geç üç iş günü içinde İYS kaydına işlenir.",
    );
    expect(textOf("satis-politikasi")).toContain(
      "ret talebiniz gecikmeksizin işleme alınır ve en geç üç iş günü içinde İYS'ye de bildirilir.",
    );
    expect(textOf("mobil-uygulama-kosullari")).toContain(
      "İYS'ye kaydedilmiş bir ticari elektronik ileti onayı bulunuyorsa ret kaydı en geç üç iş günü içinde İYS üzerine işlenir.",
    );
  });

  it("the İYS Aydınlatması says the three business days and the check before every send", () => {
    const iys = textOf("ticari-elektronik-ileti");
    expect(iys).toContain(
      "verildiği tarihten itibaren en geç üç iş günü içinde İYS'ye kaydedilir; İYS'ye kaydedilmemiş bir onaya dayanılarak ticari elektronik ileti gönderilmez.",
    );
    expect(iys).toContain(
      "bize ulaşan her ret bildirimi, ulaştığı tarihten itibaren en geç üç iş günü içinde İYS'ye bildirilir.",
    );
    expect(iys).toContain(
      "Gönderim listesine yalnızca onayı İYS'ye kaydedilmiş adresler alınır.",
    );
    expect(iys).toContain(
      "İYS'deki kayıtlar son üç iş günü içinde kontrol edilmişse gönderilir",
    );
    // A refusal read from İYS has no IP or browser of the person's.
    expect(iys).toContain("varsa IP adresi ile tarayıcı veya uygulama bilgisi");
  });

  it("a commercial consent records the İYS Aydınlatması's own day", async () => {
    const { COMMERCIAL_CONSENT_TEXT_VERSION } =
      await import("@/lib/customer/consent-ledger");
    const doc = findLegalDoc("ticari-elektronik-ileti");
    expect(doc?.updatedAt).toBe(COMMERCIAL_CONSENT_UPDATED);
    expect(COMMERCIAL_CONSENT_TEXT_VERSION).toBe(
      `ticari-elektronik-ileti@${doc?.updatedAt}`,
    );
  });
});
