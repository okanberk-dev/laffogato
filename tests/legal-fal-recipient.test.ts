import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { LEGAL_CONTENT } from "@/lib/legal/content";
import { findLegalDoc, type LegalDoc } from "@/lib/legal/documents";
import {
  FAL_CONSENT_VERSION,
  FAL_DISCLOSED_PROVIDER,
  FAL_PROVIDERS,
  FAL_PROVIDER_INFO,
} from "@/lib/mobile/fal-core";

/**
 * Karar 177, 17 Eki 2026: fA'L's AI reading moved to Anthropic. The photo may
 * go only to the company the published texts name, so the texts, the
 * provider the code allows (`FAL_DISCLOSED_PROVIDER`) and the R12 consent
 * version are held together here: change one and this file says which other
 * has to follow.
 */

const RECIPIENT = FAL_PROVIDER_INFO[FAL_DISCLOSED_PROVIDER].legalName;
/** "Anthropic, PBC" -> "Anthropic": the name a sentence may use on its own. */
const brand = (legalName: string) => legalName.split(",")[0]!.trim();

function text(doc: LegalDoc | undefined): string {
  expect(doc).toBeDefined();
  return JSON.stringify(doc);
}

function r12(): string {
  const doc = findLegalDoc("acik-riza-metni");
  const section = doc?.sections.find((s) => s.heading.startsWith("15/A. R12"));
  expect(section, "Açık Rıza Metni 15/A (R12)").toBeDefined();
  return [...(section!.paragraphs ?? []), ...(section!.bullets ?? [])].join("\n");
}

describe("the fA'L recipient in the published texts", () => {
  it("is Anthropic, PBC: the provider the code may send the photo to", () => {
    expect(FAL_DISCLOSED_PROVIDER).toBe("anthropic");
    expect(RECIPIENT).toBe("Anthropic, PBC");
  });

  it("R12 names it as the recipient, in the United States, as a data processor", () => {
    const consent = r12();
    expect(consent).toContain("Alıcı: Anthropic, PBC (Amerika Birleşik Devletleri), veri işleyen sıfatıyla.");
    expect(consent).toContain(
      "şirketimizin sunucusu üzerinden Anthropic, PBC (Amerika Birleşik Devletleri) tarafından sağlanan yapay zekâ hizmetine gönderilir.",
    );
    // The consent items table and the transfer section of the same text.
    const all = text(findLegalDoc("acik-riza-metni"));
    expect(all).toContain("Anthropic, PBC (ABD) altyapısına aktarılır; fotoğraf şirketimizce saklanmaz.");
    // R6 is no consent item since 19 Eki 2026 and lists no recipients; R12
    // names the company the standard contract is to be signed with.
    expect(all).toContain("Anthropic, PBC ile imzalanacak ve Kurul tarafından ilan edilen standart sözleşmeye dayandırılır");
  });

  it("the aydınlatma and the gizlilik texts name the same recipient", () => {
    const aydinlatma = text(findLegalDoc("kvkk-aydinlatma-metni"));
    // §9 consent-based processing, §12 the app, §15 abroad and its recipients.
    expect(aydinlatma.split("Anthropic, PBC'ye (ABD)").length - 1).toBe(3);
    expect(aydinlatma).toContain(
      "fA'L yapay zekâ yorumu için yalnızca açık rızanızla ve standart sözleşme imzalanıp Kurum'a bildirildikten sonra Anthropic, PBC (ABD).",
    );
    // §14 lists it among the recipients too (open item Y1-6).
    expect(aydinlatma).toContain("Yapay zekâ hizmet sağlayıcısı Anthropic, PBC (ABD, yalnızca açık rızanızla)");
    const gizlilik = text(findLegalDoc("gizlilik-politikasi"));
    expect(gizlilik).toContain("yorumun üretilmesi amacıyla Anthropic, PBC'ye (ABD) aktarılması; fotoğraf şirketimizce saklanmaz");
  });

  it("no text names a provider the photo does not go to", () => {
    const all = JSON.stringify(LEGAL_CONTENT);
    for (const provider of FAL_PROVIDERS) {
      const { legalName } = FAL_PROVIDER_INFO[provider];
      if (provider === FAL_DISCLOSED_PROVIDER) {
        expect(all, legalName).toContain(legalName);
        continue;
      }
      expect(all, legalName).not.toContain(legalName);
      expect(all, brand(legalName)).not.toMatch(new RegExp(brand(legalName), "i"));
    }
  });

  it("where the three texts say the photo is not kept, they say by us", () => {
    // "aktarılır ve saklanmaz" right after naming the provider read as a
    // promise about the provider; it is ours to make only for ourselves.
    for (const slug of ["gizlilik-politikasi", "kvkk-aydinlatma-metni", "acik-riza-metni"]) {
      const doc = findLegalDoc(slug)!;
      const strings = doc.sections.flatMap((s) => [
        ...(s.paragraphs ?? []),
        ...(s.bullets ?? []),
        ...(s.table ?? []).map((r) => r.value),
      ]);
      for (const s of strings.filter((t) => /fA'L|yapay zekâ/.test(t))) {
        for (const m of s.matchAll(/(\S+)\s+saklanmaz/g)) {
          expect(m[1], `${slug}: ${s.slice(0, 80)}`).toBe("şirketimizce");
        }
      }
    }
  });

  it("R12 promises nothing the Messages API does not do, and states the provider's published terms", () => {
    const consent = r12();
    // OpenAI took `store: false`; the Messages API has no such switch.
    expect(consent).not.toContain("saklamaması talimat");
    // 19 Eki 2026 (ASK-FAL-1): Anthropic's commercial retention policy
    // (privacy.claude.com 7996866) and its Commercial Terms §B, by name and
    // with their numbers, instead of "its own terms".
    expect(consent).not.toContain("kendi ticari hizmet koşulları ve politikalarında belirlenen süre boyunca saklayabileceğini");
    expect(consent).toContain(
      "Hizmet sağlayıcı Anthropic, PBC, yayımladığı ticari veri saklama politikasına göre ilettiğimiz fotoğrafı ve ürettiği yanıtı en geç 30 gün içinde siler; içerik, kullanım politikasına aykırılık şüphesiyle otomatik olarak işaretlenirse 2 yıla kadar, bu işaretlemeye ilişkin güvenlik puanları 7 yıla kadar ve kanunen gerekli hâllerde daha uzun süre saklanabilir.",
    );
    expect(consent).toContain("Anthropic, PBC sözleşme gereği bu içeriği yapay zekâ modellerini eğitmek için kullanamaz.");
    expect(consent).toContain(
      "Hizmet sağlayıcı fotoğrafı ve yanıtı kendi politikasına göre en geç 30 gün içinde siler; işaretlenen içerik 2 yıla kadar saklanabilir.",
    );
    // No zero-retention agreement exists, so no text says the provider keeps nothing.
    expect(consent).not.toMatch(/sıfır veri saklama/i);
  });

  it("R12 says no photo leaves before the contract is signed and notified, and that it is not signed yet", () => {
    const consent = r12();
    expect(consent).toContain("Bu sözleşme imzalanıp Kurum'a bildirilmeden fotoğrafınız yapay zekâ hizmetine gönderilmez.");
    // OP-FAL-OFF: the enabling PR dates this ("<gün Ay yıl> tarihinde
    // imzalanan, ... bildirilen ve") together with fal-safeguard.ts.
    expect(consent).toContain("Anthropic, PBC ile imzalanacak ve Kurul");
    expect(consent).not.toContain("akdedilen");
    const record = findLegalDoc("acik-riza-metni")!
      .sections.find((s) => s.heading.startsWith("20. "))!
      .bullets!.find((b) => b.startsWith("fA'L yapay zekâ yorumu onayı (R12)"))!;
    // Only what the app and the server do today: POST /fal/consent takes
    // `{ version }` alone, so the text promises no tick that nothing checks.
    expect(record).toContain("Onay, fA'L ekranında fotoğraf gönderilmeden önce açılan ayrı bir pencereden verilir; pencere fotoğrafın nereye gönderildiğini özetler ve bu metnin tamamına bağlantı verir.");
    expect(record).not.toMatch(/işaretle|okudum, anladım/);
    expect(readFileSync("src/app/api/mobile/v1/fal/consent/route.ts", "utf8")).toContain(
      "const GRANT = z.object({ version: z.string().min(1).max(40) });",
    );
    // Still no app version in the record.
    expect(record).toContain("IP adresi, kanal veya uygulama sürümü bu kayda yazılmaz");
  });
});

describe("the transfer abroad rests on the standard contract, not on consent alone (KVKK m.9, 2024)", () => {
  // Since 1 Haziran 2024 (7499 s. Kanun) explicit consent carries a transfer
  // abroad only when it is incidental (m.9/6-a). The Yönetmelik (RG 10.07.2024,
  // m.16/1) calls incidental what is irregular, one-off and outside the ordinary
  // course; the fA'L photo goes with every reading, so it needs the Board's
  // standard contract (m.9/4-c), notified within five business days (m.9/5).

  it("R12 says the transfer is not incidental and rests on the Board's standard contract", () => {
    const consent = r12();
    expect(consent).toContain("arızi nitelikte değildir");
    expect(consent).toContain("yurt dışına aktarım yalnızca bu onaya dayanmaz");
    expect(consent).toContain("Kurul tarafından ilan edilen standart sözleşmeye dayandırılır");
    expect(consent).not.toContain("standart sözleşme gibi uygun güvencelere");
  });

  it("the aydınlatma's transfer section says the same for the fA'L photo", () => {
    const doc = findLegalDoc("kvkk-aydinlatma-metni")!;
    const abroad = doc.sections.find((s) => s.heading.startsWith("15. Kişisel Verilerin Yurt Dışına"));
    expect(abroad, "KVKK Aydınlatma §15").toBeDefined();
    const fal = (abroad!.paragraphs ?? []).find((p) => p.includes("fA'L"));
    expect(fal).toContain(RECIPIENT);
    expect(fal).toContain("arızi nitelikte değildir");
    expect(fal).toContain("yalnızca açık rızaya dayanmaz");
    expect(fal).toContain("standart sözleşmeye dayandırılır");
  });

  it("no text offers explicit consent as a way around the incidental limit", () => {
    const gizlilik = findLegalDoc("gizlilik-politikasi")!;
    const abroad = gizlilik.sections.find((s) => s.heading === "9. Yurt Dışına Aktarım");
    expect(abroad, "Gizlilik Politikası §9").toBeDefined();
    expect((abroad!.paragraphs ?? []).join("\n")).toContain("yalnızca arızi nitelikte olması kaydıyla");
    expect(JSON.stringify(LEGAL_CONTENT)).not.toContain("arızi hâllere veya ayrıca alınan açık rızanıza");
  });
});

describe("the R12 consent version follows the recipient", () => {
  it("names the provider the texts name, so a new recipient is a new version", () => {
    expect(FAL_CONSENT_VERSION).toBe(`2026-10-19-${FAL_DISCLOSED_PROVIDER}`);
    // The 23 Eyl 2026 text named OpenAI; consents to it are not consents to this.
    expect(FAL_CONSENT_VERSION).not.toBe("2026-09-23");
    // The 17 Eki text named Anthropic but not its retention terms or the
    // contract condition: R12's words changed, so the version moved.
    expect(FAL_CONSENT_VERSION).not.toBe("2026-10-17-anthropic");
  });
});
