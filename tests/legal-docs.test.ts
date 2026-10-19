import { readFileSync } from "node:fs";

import { describe, it, expect } from "vitest";

import {
  CHECKOUT_CONSENT_DOCS,
  LEGAL_CATEGORY_ORDER,
  LEGAL_DOCS,
  findLegalDoc,
} from "@/lib/legal/documents";
import { LEGAL_CONTENT } from "@/lib/legal/content";
import {
  LEGAL_ENTITY,
  LEGAL_TOKEN_NAMES,
  fillTokens,
  hasEmptyToken,
} from "@/lib/legal/entity";
import { SAVED_CARDS_IN_LEGAL_TEXTS } from "@/lib/legal/meta";
import { FOOTER_LEGAL_DOCS } from "@/lib/legal/nav";

/**
 * Every `{{TOKEN}}` the entity module knows how to fill.
 *
 * Derived from the entity module rather than hand-copied. A copied list is a
 * third place to forget when a token is added, and the point of this test is
 * to check content.ts against the authority - so it must read the authority.
 */
const KNOWN_TOKENS = new Set(LEGAL_TOKEN_NAMES);

/** Every free-text string in a source document, paired with its locator. */
function sourceStrings(): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const doc of LEGAL_CONTENT) {
    out.push([`${doc.slug}.title`, doc.title]);
    out.push([`${doc.slug}.summary`, doc.summary]);
    for (const r of doc.references ?? []) {
      out.push([`${doc.slug}.references`, r]);
    }
    doc.sections.forEach((s, i) => {
      const at = `${doc.slug}#${i + 1}`;
      out.push([`${at}.heading`, s.heading]);
      for (const t of s.paragraphs ?? []) out.push([`${at}.paragraphs`, t]);
      for (const t of s.bullets ?? []) out.push([`${at}.bullets`, t]);
      for (const t of s.ordered ?? []) out.push([`${at}.ordered`, t]);
      for (const r of s.table ?? []) {
        out.push([`${at}.table.key`, r.key]);
        out.push([`${at}.table.value`, r.value]);
      }
    });
  }
  return out;
}

/** Prose strings - everything except a table's `value`, where empty tokens live. */
function proseStrings(): Array<[string, string]> {
  return sourceStrings().filter(([where]) => !where.endsWith(".table.value"));
}

describe("legal document set", () => {
  it("ships every document the checkout and footer link to", () => {
    for (const slug of [
      ...CHECKOUT_CONSENT_DOCS,
      ...FOOTER_LEGAL_DOCS.map((d) => d.slug),
    ]) {
      expect(findLegalDoc(slug), `eksik belge: ${slug}`).toBeDefined();
    }
  });

  it("has unique slugs and a known category for every document", () => {
    const slugs = LEGAL_DOCS.map((d) => d.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const d of LEGAL_DOCS) {
      expect(
        LEGAL_CATEGORY_ORDER as readonly string[],
        `${d.slug} bilinmeyen kategori: ${d.category}`,
      ).toContain(d.category);
    }
  });

  it("groups documents by category in the canonical order", () => {
    const ranks = LEGAL_DOCS.map((d) =>
      (LEGAL_CATEGORY_ORDER as readonly string[]).indexOf(d.category),
    );
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
  });

  it("renders every document with real content in every section", () => {
    for (const d of LEGAL_DOCS) {
      expect(d.sections.length, `${d.slug} bölümsüz`).toBeGreaterThanOrEqual(8);
      expect(d.summary.length, `${d.slug} özeti kısa`).toBeGreaterThan(60);
      for (const s of d.sections) {
        const filled =
          (s.paragraphs?.length ?? 0) +
          (s.bullets?.length ?? 0) +
          (s.ordered?.length ?? 0) +
          (s.table?.length ?? 0);
        expect(filled, `${d.slug} · "${s.heading}" boş`).toBeGreaterThan(0);
      }
    }
  });
});

describe("legal content - token discipline", () => {
  it("uses only tokens the entity module can fill", () => {
    for (const [where, text] of sourceStrings()) {
      for (const m of text.matchAll(/\{\{([A-Z_]+)\}\}/g)) {
        expect(KNOWN_TOKENS, `${where}: {{${m[1]}}}`).toContain(m[1]);
      }
    }
  });

  it("keeps unknown-value tokens out of prose", () => {
    // MERSİS / sicil / KEP / IBAN are blank; in a sentence they would leave a
    // hole, so they belong only in a table value, where the row is dropped.
    for (const [where, text] of proseStrings()) {
      expect(hasEmptyToken(text), `${where} boş token içeriyor`).toBe(false);
    }
  });

  it("carries no markdown syntax (the renderer emits plain text nodes)", () => {
    for (const [where, text] of sourceStrings()) {
      expect(text, `${where}`).not.toMatch(/\*\*/);
      expect(text, `${where}`).not.toMatch(/^#{1,6}\s/);
    }
  });
});

describe("legal content - identity is the tax certificate, never a placeholder", () => {
  const rendered = JSON.stringify(LEGAL_DOCS);

  it("names the real legal entity and never the old placeholder", () => {
    expect(rendered).toContain(LEGAL_ENTITY.legalName);
    expect(rendered).not.toMatch(/Gıda ve Servis A\.Ş\./);
  });

  it("uses the single contact address everywhere", () => {
    expect(rendered).toContain("info@nextgenlab.com.tr");
    for (const stale of [
      "tuzla@laffogato.it",
      "hello@laffogato.net",
      "kvkk@laffogato.net",
      "operasyon@laffogato.it",
    ]) {
      expect(rendered, `eski adres: ${stale}`).not.toContain(stale);
    }
  });

  it("never invents a registration number, IBAN or KEP address", () => {
    // Placeholder shapes that have shown up in draft contracts before.
    expect(rendered).not.toMatch(/0123-4567-8901-2345/);
    expect(rendered).not.toMatch(/\b1234567890\b/);
    expect(rendered).not.toMatch(/\b\d{4}-\d{4}-\d{4}-\d{4}\b/);
    // The company has no KEP address and no published bank account. An
    // invented KEP would say tebligat can be served there; an invented IBAN
    // would say a refund can be sent to it.
    expect(LEGAL_ENTITY.kep).toBe("");
    expect(LEGAL_ENTITY.bank.iban).toBe("");
    expect(rendered).not.toMatch(/kep\.tr/i);
    expect(rendered).not.toMatch(/\bTR\d{2}[\s\d]{10,}/);
  });

  it("prints the real MERSİS number, and no other of its shape", () => {
    expect(LEGAL_ENTITY.mersisNo).toMatch(/^\d{16}$/);
    expect(rendered).toContain(LEGAL_ENTITY.mersisNo);
    for (const found of rendered.match(/\b\d{16}\b/g) ?? []) {
      expect(found).toBe(LEGAL_ENTITY.mersisNo);
    }
    // The trade registry row is withheld, so it must not be rendered at all.
    expect(rendered).not.toMatch(/Ticaret [Ss]icil [Nn]o[^,.\n]{0,12}\d/);
  });

  it("spells every social handle with the double t", () => {
    expect(rendered).not.toMatch(/@laffogato(?!t)/);
  });

  it("keeps the activity code (NACE) off the public site", () => {
    // The tax certificate says 621000 - software. It is an internal record and
    // is deliberately not published alongside the tax office and VKN.
    expect(rendered).not.toMatch(/621000/);
    expect(rendered).not.toMatch(/NACE/i);
    expect(rendered).not.toMatch(/faaliyet kodu/i);
  });

  it("names the infrastructure and payment provider the project actually uses", () => {
    // The virtual POS is PayNkolay. The data layer is {{DB_PROVIDER}} and the
    // member identity is {{AUTH_PROVIDER}}; both names come from the entity
    // module (tests/legal-single-source.test.ts forbids them in the source).
    expect(rendered).toContain("PayNkolay");
    expect(rendered).toContain(LEGAL_ENTITY.dbProvider);
    expect(rendered).toContain(LEGAL_ENTITY.authProvider);
    expect(rendered).not.toMatch(/PayTR/i);
    expect(rendered).not.toMatch(/Stripe/i);
  });

  it("never names the payment provider that was removed from the code", () => {
    // iyzico left the code on 15 Ekim 2026; 264 passages still named it.
    expect(JSON.stringify(LEGAL_CONTENT)).not.toMatch(/iyzico/i);
  });

  it("prints no long dash or en dash in the legal copy", () => {
    // Operator rule (22 Eylül 2026): a single hyphen. The ranges and
    // parentheticals that used U+2014 / U+2013 read " - " now.
    expect(rendered).not.toMatch(/[\u2013\u2014]/);
  });

  it("does not claim that card data stays away from the seller's servers", () => {
    // The card is typed on the site's own payment page and passes through the
    // server once, on its way to PayNkolay; it is not stored or logged. The
    // old sentences said it never reached the seller's servers.
    const claims = [
      /kart[^.]{0,80}(sunucular\w*|sistem\w*)[^.]{0,40}(geçmez|ulaşmaz|uğramaz)/i,
      /satıcı[^.]{0,60}kart[^.]{0,60}(ulaşmaz|görmez|erişemez)/i,
      /ödeme (kuruluşunun|hizmeti sağlayıcısının) (kendi )?(güvenli )?(sayfasında|ortamında)[^.]{0,60}girilir/i,
    ];
    for (const re of claims) {
      expect(rendered, String(re)).not.toMatch(re);
    }
  });

  it("promises no wallet, gift card or points", () => {
    // None exists. Gift vouchers may be mentioned only as not sold; points
    // were replaced by stamps.
    expect(rendered).not.toMatch(/Ödül puanı|puan bakiye|puan kazan/i);
    for (const d of LEGAL_DOCS) {
      for (const s of d.sections) {
        for (const text of [
          ...(s.paragraphs ?? []),
          ...(s.bullets ?? []),
          ...(s.ordered ?? []),
        ]) {
          if (!/hediye (çeki|kartı)|mağaza kredisi/i.test(text)) continue;
          expect(text, `${d.slug}: ${s.heading}`).toMatch(
            /satılmamakta|yapılmamakta|satılmaz|bulunmamakta|yoktur|sunulmamakta|geçerli değildir|uygulanmaz|yürütülmemekte/i,
          );
        }
      }
    }
  });

  it("takes no table or group bookings: only the karaoke room is booked", () => {
    // 17 Ekim 2026 (#132): the café takes no table or group bookings. A
    // sentence may name one only to say it is not taken.
    expect(rendered).not.toMatch(
      /no-show|masa tutma|minimum harcama|grup ziyareti|Rezervasyon Koşulları/i,
    );
    expect(findLegalDoc("kafe-hizmet-kosullari")?.title).toBe(
      "Kafe Hizmet Koşulları",
    );
    for (const d of LEGAL_DOCS) {
      for (const s of d.sections) {
        for (const text of [
          s.heading,
          ...(s.paragraphs ?? []),
          ...(s.bullets ?? []),
          ...(s.ordered ?? []),
          ...(s.table ?? []).map((r) => `${r.key}: ${r.value}`),
        ]) {
          if (!/masa(\/| )rezervasyon|grup rezervasyon/i.test(text)) continue;
          // Or to say a notice is not one (the access notice, café terms
          // §20, ASK-Y3-6).
          expect(text, `${d.slug}: ${s.heading}`).toMatch(
            /rezervasyonu alınmaz|bir masa rezervasyonu değildir/,
          );
        }
      }
    }
  });

  it("drops table rows whose value is an unknown token", () => {
    // The seller-identity table exists but must not carry an empty MERSİS row.
    for (const d of LEGAL_DOCS) {
      for (const s of d.sections) {
        for (const row of s.table ?? []) {
          expect(row.value.trim(), `${d.slug} · ${row.key}`).not.toBe("");
        }
      }
    }
  });
});

describe("fillTokens", () => {
  it("substitutes known tokens and leaves unknown ones untouched", () => {
    expect(fillTokens("{{TAX_NO}}")).toBe("6312110904");
    expect(fillTokens("{{EMAIL}}")).toBe(LEGAL_ENTITY.email);
    expect(fillTokens("{{NOPE}}")).toBe("{{NOPE}}");
  });

  it("reports tokens whose value is unknown", () => {
    // KEP is the field that is still blank; MERSİS is now known.
    expect(hasEmptyToken("KEP: {{KEP}}")).toBe(true);
    expect(hasEmptyToken("MERSİS: {{MERSIS}}")).toBe(false);
    expect(hasEmptyToken("VKN: {{TAX_NO}}")).toBe(false);
    expect(hasEmptyToken("düz metin")).toBe(false);
  });
});

describe("legal metadata is separable from the contracts", () => {
  it("keeps the checkout constants out of the 1.5 MB registry", () => {
    // The checkout route imports these; pulling them from `documents.ts` would
    // put every contract into the bundle of the hottest route on the site.
    const meta = readFileSync("src/lib/legal/meta.ts", "utf8");
    expect(meta).not.toContain("./content");
    expect(meta).not.toContain("LEGAL_CONTENT");
    const checkout = readFileSync("src/app/odeme/actions.ts", "utf8");
    expect(checkout).toContain('from "@/lib/legal/meta"');
    expect(checkout).not.toContain('from "@/lib/legal/documents"');
  });

  it("names checkout consent documents that actually exist", () => {
    for (const slug of CHECKOUT_CONSENT_DOCS) {
      expect(LEGAL_DOCS.some((d) => d.slug === slug)).toBe(true);
    }
  });

  it("orders categories by a list that covers every document", () => {
    const known = new Set<string>(LEGAL_CATEGORY_ORDER);
    for (const doc of LEGAL_DOCS) {
      expect(known.has(doc.category)).toBe(true);
    }
  });
});

/** Every rendered string of a document, tokens filled, with its locator. */
function docTexts(slug?: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const d of LEGAL_DOCS) {
    if (slug && d.slug !== slug) continue;
    out.push([`${d.slug}.summary`, d.summary]);
    for (const r of d.references ?? []) out.push([`${d.slug}.references`, r]);
    for (const s of d.sections) {
      const at = `${d.slug} · ${s.heading}`;
      out.push([at, s.heading]);
      for (const t of [
        ...(s.paragraphs ?? []),
        ...(s.bullets ?? []),
        ...(s.ordered ?? []),
      ]) {
        out.push([at, t]);
      }
      for (const r of s.table ?? []) out.push([at, `${r.key}: ${r.value}`]);
    }
  }
  return out;
}

function sectionOf(slug: string, heading: string) {
  const s = findLegalDoc(slug)?.sections.find((x) => x.heading === heading);
  expect(s, `${slug} · ${heading}`).toBeDefined();
  return s!;
}

describe("legal content - distance sales after the 1 Ocak 2026 amendment", () => {
  // Mesafeli Sözleşmeler Yönetmeliği as amended (RG 24.05.2025-32909, in
  // force 1.1.2026): the goods go back within 14 days (m.13/1), no return
  // cost may be asked when the pre-information names no carrier (m.12/5),
  // and the pre-information names the mediation step (m.5/1-k). Decided on
  // 18 Ekim 2026 (ASK-OTH-2, OP-RETURN-CARRIER); LEGAL-REDLINES §18.
  const returnContext = /iade|cayma|geri gönder/i;

  it("gives 14 days, never 10, to send the goods back", () => {
    for (const [where, text] of docTexts()) {
      if (!returnContext.test(text)) continue;
      expect(text, where).not.toMatch(/(?<!\d)10 gün|10 \(on\)|on \(10\)/);
      expect(text, where).not.toMatch(/(?<![\p{L}\d])on gün/u);
    }
    const obf = sectionOf(
      "on-bilgilendirme-formu",
      "13. Cayma Sonrası İade Usulü, İade Kargo Masrafı ve Geri Ödeme",
    );
    expect(obf.paragraphs?.[0]).toMatch(
      /^ALICI, cayma bildirimini yaptığı tarihten itibaren 14 \(on dört\) gün içinde malı/,
    );
    expect(obf.table).toContainEqual({
      key: "Malı geri gönderme süresi",
      value: "Cayma bildiriminden itibaren 14 gün",
    });
  });

  it("asks no return shipping cost: no carrier is named", () => {
    const obf = sectionOf(
      "on-bilgilendirme-formu",
      "13. Cayma Sonrası İade Usulü, İade Kargo Masrafı ve Geri Ödeme",
    );
    expect(obf.paragraphs?.[1]).toContain(
      "Bu formda iade için bir taşıyıcı adlandırılmadığından iade kargo bedeli ALICI'dan talep edilmez",
    );
    expect(obf.table).toContainEqual({
      key: "İade taşıyıcısı",
      value:
        "İade kodu cayma bildiriminden sonra e-posta ile bildirilir; iade kargo bedeli ALICI'dan talep edilmez",
    });
    for (const [where, text] of docTexts()) {
      if (!returnContext.test(text)) continue;
      expect(text, where).not.toMatch(/anlaşmalı (olmayan )?taşıyıcı/i);
      expect(text, where).not.toMatch(/Masraf Alıcı'ya aittir/);
      if (/kargo|taşıyıcı|gönderi/i.test(text)) {
        expect(text, where).not.toMatch(/aradaki (masraf )?fark/i);
      }
    }
    // Nor through the back door of a partial return under the free-shipping
    // threshold (m.12/1: every payment, delivery included, comes back).
    for (const [where, text] of docTexts()) {
      if (!/eşi[ğk]/i.test(text) || !/kısmi iade/i.test(text)) continue;
      expect(text, where).not.toMatch(
        /kargo bedeli[^.]{0,60}mahsup edilebilir/,
      );
    }
  });

  it("holds the goods to MSY m.13/2, not to resale, box or invoice", () => {
    for (const [where, text] of docTexts()) {
      expect(text, where).not.toMatch(/satılabilir/i);
      expect(text, where).not.toMatch(
        /ticari değerini yitirmeden|^Kabul edilmez:|ambalajı açılmamış olsa dahi/,
      );
    }
    const obf = sectionOf(
      "on-bilgilendirme-formu",
      "13. Cayma Sonrası İade Usulü, İade Kargo Masrafı ve Geri Ödeme",
    );
    expect(obf.paragraphs?.[0]).toContain(
      "faturanın geri gönderilmesi gerekmez",
    );
    const perishable = sectionOf(
      "on-bilgilendirme-formu",
      "12. Cayma Hakkının Kullanılamayacağı Hâller",
    ).bullets?.[0];
    // A sealed box of waffle cups is not "çabuk bozulabilen" (m.15/1-c).
    expect(perishable).not.toMatch(/waffle/i);
  });

  it("names the mediation step before the consumer court (TKHK m.73/A)", () => {
    const obf = sectionOf(
      "on-bilgilendirme-formu",
      "21. Şikâyet, İtiraz ve Uyuşmazlıkların Çözümü",
    );
    expect(obf.paragraphs?.[1]).toContain(
      "6502 sayılı Kanun'un 73/A maddesi uyarınca dava açmadan önce arabulucuya başvurmak şartıyla tüketici mahkemesine başvurabilir",
    );
    const mss = findLegalDoc("mesafeli-satis-sozlesmesi")!.sections.find((s) =>
      s.heading.startsWith("19."),
    );
    expect(mss?.paragraphs).toContain(
      "Tüketici mahkemesinde dava açmadan önce arabulucuya başvurmak 6502 sayılı Kanun'un 73/A maddesi uyarınca zorunludur; tüketici hakem heyetinin görevine giren uyuşmazlıklarda bu şart aranmaz.",
    );
    expect(JSON.stringify(LEGAL_DOCS)).not.toContain(
      "arabuluculuk kurumu aracılığıyla çözümlenmesi hususunda",
    );
  });

  it("ships only within Türkiye (MSY m.6/2-b)", () => {
    const region = sectionOf("teslimat-ve-kargo", "16. Teslimat Bölgesi");
    expect(region.paragraphs).toEqual([
      "Online mağaza siparişleri yalnızca Türkiye içindeki teslimat adreslerine gönderilir; KKTC'ye ve yurt dışına gönderim yapılmaz.",
    ]);
    expect(region.bullets ?? []).toEqual([]);
    for (const [where, text] of docTexts()) {
      if (/KKTC|Kıbrıs/.test(text)) {
        // Only to say there is no such delivery, or about a complaint sent
        // from abroad.
        expect(text, where).toMatch(/gönderim yapılmaz|başvuru/);
      }
      expect(text, where).not.toMatch(
        /yurt dışı (teslimat|gönderi)|yurt dışına (sevk|gönderilir)|gümrük vergi/i,
      );
    }
  });

  it("cites the e-commerce regulation by its current title", () => {
    // The 2015 regulation was repealed by m.34 of the one published on
    // 29.12.2022 (RG 32058).
    const all = JSON.stringify(LEGAL_DOCS);
    expect(all).not.toContain(
      "Elektronik Ticarette Hizmet Sağlayıcı ve Aracı Hizmet Sağlayıcılar",
    );
    expect(all).toContain(
      "Elektronik Ticaret Aracı Hizmet Sağlayıcı ve Elektronik Ticaret Hizmet Sağlayıcılar Hakkında Yönetmelik",
    );
    expect(all).not.toMatch(/26\.08\.2015/);
  });
});

describe("legal content - no saved cards", () => {
  // Card storage was never turned on (rule 28), yet 42 sentences in 14
  // documents described it "once it is turned on": a member key, the last
  // four digits, a nickname, deletion at PayNkolay. A notice may not suggest
  // processing that does not happen (Aydınlatma Tebliği m.5/1-g, j), and the
  // server minted the member key anyway. The passages are kept word for word
  // in docs/LEGAL-REDLINES-2026-09.md §19; they come back in the PR that
  // flips SAVED_CARDS_IN_LEGAL_TEXTS, and the server gate reads that flag
  // (tests/saved-cards.test.ts).
  const savedCard =
    /kart saklama|kayıtlı kart|üye anahtarı|müşteri anahtarı|sonraki ödemeler için kaydet/i;

  it("describes no saved card while the texts say they are off", () => {
    expect(SAVED_CARDS_IN_LEGAL_TEXTS).toBe(false);
    for (const [where, text] of docTexts()) {
      expect(text, where).not.toMatch(savedCard);
    }
  });

  it("says in the payment documents that the card is not kept", () => {
    const kept = /sonraki ödemeler için (PayNkolay nezdinde de )?kaydedilmez/;
    for (const slug of [
      "on-bilgilendirme-formu",
      "mesafeli-satis-sozlesmesi",
      "odeme-kosullari",
      "uyelik-sozlesmesi",
      "mobil-uygulama-kosullari",
      "kafe-hizmet-kosullari",
    ]) {
      expect(
        docTexts(slug).some(([, text]) => kept.test(text)),
        slug,
      ).toBe(true);
    }
  });
});

describe("legal content - a documented return shipping cost is paid back", () => {
  // The texts promise that a buyer who sends the return with another carrier
  // gets the receipted cost back (MSY m.12/5: no carrier is named, so no
  // return cost may be asked). That money cannot ride on the card refund: a
  // full withdrawal already refunds everything collected, refundRefusal caps
  // the ledger at it and the POS cannot refund above the payment. So the
  // texts say it goes to the buyer's own bank account, and every notice that
  // lists the bank account details names this purpose too (KVKK m.4/2-c
  // and m.10/1-b: no processing for a purpose the notice does not name).
  // LEGAL-REDLINES §18.6.
  const promise =
    /gönderim bedeli (SATICI|Satıcı) tarafından (ALICI'ya )?geri ödenir/;

  function sentencesOf(slug: string, heading: string): string[] {
    return docTexts(slug)
      .filter(([where]) => where === `${slug} · ${heading}`)
      .flatMap(([, text]) => text.split(/(?<=\.)\s+(?=[A-ZÇĞİÖŞÜ])/u));
  }

  it("says how and when the cost is paid wherever it is promised", () => {
    const promised = new Set(
      docTexts()
        .filter(([, text]) => promise.test(text))
        .map(([where]) => where),
    );
    expect([...promised].sort()).toEqual([
      "iade-ve-cayma · 9. İade Kargo Masrafının Kime Ait Olduğu",
      "mesafeli-satis-sozlesmesi · 11. Cayma Hakkı",
      "on-bilgilendirme-formu · 13. Cayma Sonrası İade Usulü, İade Kargo Masrafı ve Geri Ödeme",
      "teslimat-ve-kargo · 19. Cayma Hakkı Kapsamında İade Gönderilerinde Kargo Düzeni",
    ]);
    for (const where of promised) {
      const [slug, heading] = where.split(" · ");
      const how = sentencesOf(slug, heading).find(
        (s) =>
          /gönderim bedel/.test(s) &&
          /kendi adına(?:za)? kayıtlı/.test(s) &&
          /banka hesabına havale veya EFT ile ödenir/.test(s),
      );
      expect(how, where).toBeDefined();
      expect(how, where).toMatch(
        /ulaşmasından itibaren 14 \(on dört\) gün içinde/,
      );
      expect(how, where).toMatch(/karta iade edilmez/);
    }
  });

  it("names that purpose wherever the bank account details are processed", () => {
    const bankData = /banka hesap bilgisi|IBAN bilgisi|IBAN'ı|adı ve IBAN/;
    let seen = 0;
    for (const [where, text] of docTexts()) {
      if (!bankData.test(text)) continue;
      // A supplier's account, and the sentence that only adds "bu amaçla"
      // to the partial refund just before it, are not this processing.
      if (/Tedarikçi/.test(text) || /[Bb]u amaçla bildirdiğiniz/.test(text)) {
        continue;
      }
      seen++;
      expect(text, where).toMatch(/gönderim bedel/);
    }
    expect(seen).toBeGreaterThanOrEqual(11);
    const purpose = sectionOf(
      "kvkk-aydinlatma-metni",
      "7. Kişisel Verilerin İşlenme Amaçları",
    ).bullets?.find((b) => b.startsWith("Cayma hakkı ve iade süreçleri:"));
    expect(purpose).toMatch(/gönderim bedelinin ödenmesi/);
  });

  it("keeps the payment terms' bank transfer list to the two cases", () => {
    const transfer = sectionOf(
      "odeme-kosullari",
      "14. Havale, EFT ve FAST; Banka Hesabına Yapılan İadeler",
    ).paragraphs?.[1];
    expect(transfer).toMatch(/^Banka hesabına transfer yalnızca iki hâlde/);
    expect(transfer).toMatch(/22\. maddede açıklanan istisnai hâlde/);
    expect(transfer).toMatch(/gönderim bedelinin ödenmesi/);
    expect(transfer).toMatch(/üçüncü kişilere ait hesaplara ödeme yapılmaz/);
  });
});
