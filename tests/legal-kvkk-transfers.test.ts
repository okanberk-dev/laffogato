import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { LEGAL_CONTENT } from "@/lib/legal/content";
import { findLegalDoc, LEGAL_DOCS, type LegalDoc } from "@/lib/legal/documents";
import { LEGAL_ENTITY } from "@/lib/legal/entity";
import { GOOGLE_TAGS_IN_LEGAL_TEXTS } from "@/lib/legal/meta";

/**
 * The transfers abroad as they stand on 19 Ekim 2026 (ASK-O-4,
 * OP-SS2-PROVIDERS, OP-KARAOKE-MAILBOX, OP-REGIONS). Every infrastructure
 * provider is abroad and no country has an adequacy decision, so each
 * transfer needs the Board's standard contract (KVKK m.9/4-c), and none is
 * signed yet. The texts say exactly that: the transfers WILL rest on the
 * contract, signing is in progress, each recipient is named with its
 * company, country and status, and these continuous transfers are not
 * based on consent (m.9/6-a is for incidental transfers; Yönetmelik
 * m.16/1). Kurul İlke Kararı 2026/347: no consent text for a transfer
 * consent cannot carry, and no text listing a transfer that does not
 * happen. docs/LEGAL-REDLINES-2026-09.md §15.6.
 */

function strings(doc: LegalDoc | undefined): string[] {
  expect(doc).toBeDefined();
  return doc!.sections.flatMap((s) => [
    s.heading,
    ...(s.paragraphs ?? []),
    ...(s.bullets ?? []),
    ...(s.ordered ?? []),
    ...(s.table ?? []).flatMap((r) => [r.key, r.value]),
  ]);
}

function section(slug: string, prefix: string) {
  const s = findLegalDoc(slug)?.sections.find((x) =>
    x.heading.startsWith(prefix),
  );
  expect(s, `${slug} ${prefix}`).toBeDefined();
  return s!;
}

const TAGS_OFF =
  "İnternet sitemizde bugün analitik veya reklam etiketi kullanılmaz";

describe("KVKK Aydınlatma §15: the transfers as they are", () => {
  const abroad = section(
    "kvkk-aydinlatma-metni",
    "15. Kişisel Verilerin Yurt Dışına",
  );
  const text = [...(abroad.paragraphs ?? []), ...(abroad.bullets ?? [])].join(
    "\n",
  );

  it("says the contracts are being signed, not that they are signed", () => {
    expect(text).toContain(
      "bu aktarımlar Kanun'un 9. maddesinin dördüncü fıkrası uyarınca Kurul tarafından ilan edilen standart sözleşmeye (veri sorumlusundan veri işleyene) dayandırılacaktır",
    );
    expect(text).toContain(
      "Bu sözleşmeleri aşağıda sayılan sağlayıcılarla imzalama sürecimiz devam etmektedir",
    );
    expect(text).toContain("arızi değildir ve açık rızanıza dayandırılmaz");
    expect(text).not.toContain("standart sözleşme metni imzalanır");
  });

  it("names every recipient with its company, country, server location and status", () => {
    const recipients = (abroad.bullets ?? []).find((b) =>
      b.startsWith("Alıcılar ve bilinen konumlar"),
    );
    // Rendered: an empty token would have dropped the whole line (fillList).
    expect(recipients, "the recipients line is rendered").toBeDefined();
    for (const part of [
      "Vercel Inc. (ABD; sunucu işlevleri Almanya, Frankfurt; imza sürecinde)",
      "Resend (Plus Five Five, Inc.; ABD; gönderim bölgesi İrlanda; imza sürecinde)",
      `${LEGAL_ENTITY.dbProvider} (Databricks, Inc. / Neon, LLC; ABD; sunucu bölgesi ABD, Ohio; imza sürecinde)`,
      `${LEGAL_ENTITY.authProvider} (Supabase Pte. Ltd.; Singapur; proje bölgesi Singapur; imza sürecinde)`,
      "Anthropic, PBC (ABD)",
    ]) {
      expect(recipients, part).toContain(part);
    }
    expect(recipients).not.toMatch(/\{\{/);
    // None of §15's lines is lost to an empty token.
    const source = LEGAL_CONTENT.find(
      (d) => d.slug === "kvkk-aydinlatma-metni",
    )!.sections.find((s) =>
      s.heading.startsWith("15. Kişisel Verilerin Yurt Dışına"),
    )!;
    expect(abroad.bullets).toHaveLength(source.bullets!.length);
    expect(abroad.paragraphs).toHaveLength(source.paragraphs!.length);
  });

  it("takes the company and region from the entity, next to the provider's name", () => {
    // One source (entity.ts): moving the database or the login changes the
    // name, the company and the region together, and none may be empty - an
    // empty token would drop the whole recipients line.
    const source = JSON.stringify(
      LEGAL_CONTENT.find((d) => d.slug === "kvkk-aydinlatma-metni"),
    );
    expect(source).toContain(
      "{{DB_PROVIDER}} ({{DB_RECIPIENT}}; imza sürecinde)",
    );
    expect(source).toContain(
      "{{AUTH_PROVIDER}} ({{AUTH_RECIPIENT}}; imza sürecinde)",
    );
    expect(LEGAL_ENTITY.dbRecipient.trim()).not.toBe("");
    expect(LEGAL_ENTITY.authRecipient.trim()).not.toBe("");
    // Today's facts (OP-REGIONS): Neon in AWS us-east-2, Supabase in Singapore.
    expect(LEGAL_ENTITY.dbProvider).toBe("Neon");
    expect(LEGAL_ENTITY.dbRecipient).toBe(
      "Databricks, Inc. / Neon, LLC; ABD; sunucu bölgesi ABD, Ohio",
    );
    expect(LEGAL_ENTITY.authProvider).toBe("Supabase");
    expect(LEGAL_ENTITY.authRecipient).toBe(
      "Supabase Pte. Ltd.; Singapur; proje bölgesi Singapur",
    );
  });

  it("names one safeguard, the standard contract, and no consent for these transfers", () => {
    expect(text).toContain(
      "Güvence yöntemi: Kurul tarafından ilan edilen standart sözleşme (veri sorumlusundan veri işleyene); her sağlayıcı için imza ve bildirim durumu yukarıdaki alıcılar satırında yazılıdır. Bu aktarımlar için bağlayıcı şirket kuralları, taahhütname veya açık rıza kullanılmaz.",
    );
    expect(text).not.toContain("Güvence yöntemleri: Kurul yeterlilik kararı");
  });

  it("cites the regulation by its title", () => {
    const all = JSON.stringify(LEGAL_CONTENT);
    expect(all).not.toContain(
      "Yurt Dışına Kişisel Veri Aktarımı Hakkında Yönetmelik",
    );
    expect(findLegalDoc("kvkk-aydinlatma-metni")!.references).toContain(
      "Kişisel Verilerin Yurt Dışına Aktarılmasına İlişkin Usul ve Esaslar Hakkında Yönetmelik (RG: 10.07.2024, 32598)",
    );
  });
});

describe("no text says an unsigned contract carries a transfer today", () => {
  it("present tense for the standard contract only where nothing is sent before it (fA'L)", () => {
    // fA'L sends no photo before the contract is signed and notified
    // (fal-safeguard.ts), so "dayandırılır" is true there. Everywhere else
    // the transfers run today, so the contract "will" carry them.
    const present =
      /dayandırılır\b|dayanılarak (?:gerçekleştirilir|yapılır)|metni imzalanır|uygun olarak gerçekleştirilir|uygulanır\b/;
    let checked = 0;
    for (const doc of LEGAL_DOCS) {
      for (const text of strings(doc)) {
        // A passage about the fA'L photo may say it; the rest may not.
        if (/fA'L|Anthropic/.test(text)) continue;
        // A sentence ends at a full stop before a capital ("9. maddesi" does not).
        for (const sentence of text.split(/(?<=\.)\s+(?=[A-ZÇĞİÖŞÜ])/)) {
          if (!/standart sözleşme/.test(sentence)) continue;
          checked += 1;
          expect(sentence, `${doc.slug}: ${sentence.slice(0, 90)}`).not.toMatch(
            present,
          );
        }
      }
    }
    // KVKK §15, Gizlilik §9, Veri Saklama, İYS and Çerez §18 at least.
    expect(checked).toBeGreaterThanOrEqual(5);
  });

  it("no text lists the public-bodies-only safeguard or offers consent for the running transfers", () => {
    const all = JSON.stringify(LEGAL_CONTENT);
    // m.9/4-a: an agreement that is not an international treaty is for
    // public bodies only.
    expect(all).not.toContain("taahhütname veya uluslararası sözleşme");
    // The İYS notice no longer leans on consent "where needed".
    expect(all).not.toContain("gerekli hâllerde açık rızanıza dayanılarak");
    const iys = strings(findLegalDoc("ticari-elektronik-ileti")).join("\n");
    expect(iys).toContain(
      "aktarım, Kanun'un 9. maddesi uyarınca Kurul tarafından ilan edilen standart sözleşmeye dayandırılacaktır; sözleşmelerin imza ve bildirim durumu KVKK Aydınlatma Metni'nin 15. bölümünde yazılır. Açık rızanıza yalnızca arızi bir aktarımda ve olası riskler size ayrıca anlatıldıktan sonra başvurulur.",
    );
  });
});

describe("Açık Rıza R6 is a note, not a consent item", () => {
  const consent = findLegalDoc("acik-riza-metni")!;

  it("keeps its number as a 'rıza istenmez' section with no consent in it", () => {
    const r6 = section("acik-riza-metni", "11. R6");
    expect(r6.heading).toBe(
      "11. R6 - Kişisel Verilerin Yurt Dışına Aktarılması (rıza istenmez)",
    );
    const body = (r6.paragraphs ?? []).join("\n");
    expect(body).toContain(
      "R6 onayı kaldırılmıştır; yurt dışına aktarım için açık rızanızı istemiyoruz.",
    );
    expect(body).toContain(
      "arızi olmadıkları için Kanun'un 9. maddesi uyarınca açık rızaya dayandırılamazlar",
    );
    expect(r6.bullets).toBeUndefined();
    expect(JSON.stringify(consent)).not.toContain("Bu onayı (R6)");
    expect(JSON.stringify(consent)).not.toContain(
      "hizmet yurt içi imkânlarla yürütülür",
    );
  });

  it("the summary table holds only the consents that are asked", () => {
    const table = section("acik-riza-metni", "6. Açık Rızanıza").table!.map(
      (r) => r.key.split(" - ")[0],
    );
    expect(table).toEqual(["R2", "R7", "R12"]);
    const note = section("acik-riza-metni", "6. Açık Rızanıza").paragraphs![0]!;
    expect(note).toContain(
      "R1, R3, R4, R5, R8, R9, R10 ve R11 kalemleri için bugün veri işlenmediğinden rıza istenmez",
    );
    expect(note).toContain(
      "R6 kalemi kaldırılmıştır: yurt dışına aktarım için açık rıza istenmez (bkz. 11. bölüm).",
    );
  });

  it("R7 to R12 keep their numbers, so the references elsewhere hold", () => {
    const headings = consent.sections.map((s) => s.heading);
    for (const prefix of [
      "10. R5",
      "11. R6",
      "12. R7",
      "13. R8",
      "14. R9",
      "15. R10 ve R11",
      "15/A. R12",
    ]) {
      expect(
        headings.some((h) => h.startsWith(prefix)),
        prefix,
      ).toBe(true);
    }
    expect(section("acik-riza-metni", "10. R5").heading).toMatch(
      /Yürütülmemektedir$/,
    );
  });
});

describe("Google is taken out, not contracted", () => {
  it("the texts say there are no tags while the code loads none", () => {
    // Flip GOOGLE_TAGS_IN_LEGAL_TEXTS only with the texts that describe the
    // tags again (and a Google standard contract signed and notified).
    expect(GOOGLE_TAGS_IN_LEGAL_TEXTS).toBe(false);
    for (const slug of [
      "gizlilik-politikasi",
      "kvkk-aydinlatma-metni",
      "acik-riza-metni",
      "cerez-politikasi",
    ]) {
      expect(strings(findLegalDoc(slug)).join("\n"), slug).toContain(TAGS_OFF);
    }
    const all = JSON.stringify(LEGAL_CONTENT);
    for (const claim of [
      "Etiket yöneticisinin kendisi her sayfada yüklenir",
      "GTM betiği sayfa yüklenirken çalışır",
      "Google Etiket Yöneticisi her sayfada yüklendiğinden",
      "rızanızdan bağımsız olarak her sayfada yüklenir",
      "Etiketleri yöneten Google Etiket Yöneticisi ise her sayfada yüklenir",
      "Etiketleri yöneten Google Etiket Yöneticisi bu sırada da yüklenir",
      "her sayfa görüntülemesinde yüklenir",
      "izninize bağlı analitik ölçüm",
      "çerez bandındaki ve tercih merkezindeki seçeneklerle birebir aynıdır",
    ]) {
      expect(all, claim).not.toContain(claim);
    }
  });

  it("the map stays in the texts exactly while the visit page still embeds it", () => {
    // 2026/347: no listed transfer that does not happen. When the embed
    // becomes a plain link (system-site-settings), the map clause leaves.
    const embeds = /<iframe/.test(
      readFileSync("src/components/laffogato/visit-page.tsx", "utf8"),
    );
    const recipients = section(
      "kvkk-aydinlatma-metni",
      "15. Kişisel Verilerin Yurt Dışına",
    ).bullets!.find((b) => b.startsWith("Alıcılar ve bilinen konumlar"))!;
    expect(
      recipients.includes("talebinize bağlı harita gösterimi Google LLC"),
    ).toBe(embeds);
    if (embeds) {
      expect(recipients).toContain(
        "Google LLC (ABD; standart sözleşme bulunmadığından kaldırılacaktır)",
      );
    }
  });
});

describe("the karaoke inbox is the company's, in Türkiye", () => {
  it("no text names Gmail or a team inbox abroad", () => {
    const kvkk = strings(findLegalDoc("kvkk-aydinlatma-metni")).join("\n");
    expect(JSON.stringify(LEGAL_CONTENT)).not.toMatch(/Gmail/);
    expect(kvkk).not.toContain("ekip e-posta kutusu");
    expect(kvkk).toContain(
      "Karaoke rezervasyon bildirimlerinin ulaştığı kurumsal e-posta kutusunun barındırma hizmeti sağlayıcısı (Türkiye)",
    );
    expect(kvkk).toContain(
      "Bildirim e-postası Resend üzerinden gönderilir ve şirketimizin Türkiye'de barındırılan kurumsal e-posta kutusunda tutulur.",
    );
  });
});

describe("the processor lists agree with the aydınlatma", () => {
  it("Veri Saklama names the login provider and Anthropic, and no Google processor", () => {
    const vsip = LEGAL_CONTENT.find(
      (d) => d.slug === "veri-saklama-ve-imha-politikasi",
    )!;
    const src = JSON.stringify(vsip);
    expect(src).toContain(
      "üyelik kimlik doğrulaması ({{AUTH_PROVIDER}}), işlemsel e-posta gönderimi (Resend), yalnızca fA'L yapay zekâ yorumuna açık rıza verilmesi hâlinde yapay zekâ hizmeti (Anthropic, PBC),",
    );
    expect(src).not.toMatch(/Google \(|\(Google\)/);
    expect(src).toContain("standart sözleşmeye dayandırılacaktır");
  });

  it("the aydınlatma's login row names its provider", () => {
    const keys = section("kvkk-aydinlatma-metni", "14.").table!.map(
      (r) => r.key,
    );
    expect(keys).toContain(
      `Üyelik kimlik doğrulama hizmeti sağlayıcısı (${LEGAL_ENTITY.authProvider})`,
    );
    // The map is a link out since 7d: no Google row (2026/347).
    expect(keys.some((k) => k.startsWith("Google LLC"))).toBe(false);
  });
});

describe("every recipient the texts list, and no reason without one (2026/347)", () => {
  const abroad = section(
    "kvkk-aydinlatma-metni",
    "15. Kişisel Verilerin Yurt Dışına",
  );
  const recipients = abroad.bullets!.find((b) =>
    b.startsWith("Alıcılar ve bilinen konumlar"),
  )!;
  const reasons = abroad.bullets!.find((b) =>
    b.startsWith("Aktarım gerekçeleri"),
  )!;

  it("names Paraşüt, which issues the e-invoices, as a processor and not as a maybe", () => {
    // Operator, 19 Oct 2026: every e-invoice goes out through Paraşüt.
    const row = section("kvkk-aydinlatma-metni", "14.").table!.find((r) =>
      r.key.includes("Paraşüt"),
    );
    expect(row, "§14 row").toBeDefined();
    expect(row!.key).toContain(
      "Elektronik fatura hizmet sağlayıcısı Paraşüt (Paraşüt Yazılım Teknolojileri A.Ş., Türkiye)",
    );
    expect(row!.value).toContain("veri işleyen sıfatıyla");
    expect(row!.value).toContain("Aktarılan veri:");
    expect(JSON.stringify(LEGAL_CONTENT)).not.toContain(
      "kullanılması hâlinde elektronik fatura",
    );
    // Its own notice says its suppliers may sit abroad: §15 says where the
    // invoice data is held once Paraşüt states it in writing.
    expect(recipients).toContain(
      "fatura düzenlenmesi Paraşüt Yazılım Teknolojileri A.Ş. (Türkiye; veriler ona yurt içinde aktarılır;",
    );
    const privacy = section("gizlilik-politikasi", "8.").table!.map(
      (r) => r.key,
    );
    expect(privacy.some((k) => k.includes("Paraşüt"))).toBe(true);
  });

  it("gives every listed reason a named recipient", () => {
    // The CDN and the server's error and performance logs are Vercel's; the
    // app stores distribute the app as controllers in their own right and we
    // send them nothing (§14), so they are no transfer of ours.
    expect(recipients).toContain(
      "uygulama barındırma, içerik dağıtım ağı ve sunucu hata ve performans kayıtları Vercel Inc.",
    );
    expect(reasons).not.toContain("mağaza dağıtımı");
    expect(abroad.paragraphs!.join("\n")).toContain(
      "bu kanalla tarafımızca kişisel veri aktarılmaz (14. bölüm)",
    );
    expect(abroad.paragraphs![1]).not.toMatch(
      /\([^)]*mobil uygulama mağaza dağıtımı[^)]*\) yurt dışında yerleşik/,
    );
    for (const reason of [
      "Uygulama barındırma",
      "PostgreSQL veri tabanı",
      "üyelik kimlik doğrulaması",
      "e-posta gönderimi",
    ]) {
      expect(reasons, reason).toContain(reason);
    }
    for (const recipient of [
      "Vercel Inc.",
      "Resend",
      LEGAL_ENTITY.dbProvider,
      LEGAL_ENTITY.authProvider,
    ]) {
      expect(recipients, recipient).toContain(recipient);
    }
    // The map opens Google Maps in a new tab: no reason, no recipient.
    expect(reasons).not.toContain("harita");
    expect(recipients).not.toContain("Google LLC");
  });
});
