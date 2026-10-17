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
    expect(all).toContain("yalnızca fA'L yapay zekâ yorumu onayınız hâlinde Anthropic, PBC.");
  });

  it("the aydınlatma and the gizlilik texts name the same recipient", () => {
    const aydinlatma = text(findLegalDoc("kvkk-aydinlatma-metni"));
    // §9 consent-based processing, §12 the app, §15 abroad and its recipients.
    expect(aydinlatma.split("Anthropic, PBC'ye (ABD)").length - 1).toBe(3);
    expect(aydinlatma).toContain("fA'L yapay zekâ yorumu için yalnızca açık rızanızla Anthropic, PBC (ABD).");
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

  it("R12 promises nothing the Messages API does not do: no 'do not keep' instruction, no training or retention term", () => {
    const consent = r12();
    // OpenAI took `store: false`; the Messages API has no such switch.
    expect(consent).not.toContain("saklamaması talimat");
    // The provider's own keeping is left to its terms, without a number.
    expect(consent).toContain("kendi ticari hizmet koşulları ve politikalarında belirlenen süre boyunca saklayabileceğini");
    expect(consent).not.toMatch(/eğit/i);
  });
});

describe("the R12 consent version follows the recipient", () => {
  it("names the provider the texts name, so a new recipient is a new version", () => {
    expect(FAL_CONSENT_VERSION).toBe(`2026-10-17-${FAL_DISCLOSED_PROVIDER}`);
    // The 23 Eyl 2026 text named OpenAI; consents to it are not consents to this.
    expect(FAL_CONSENT_VERSION).not.toBe("2026-09-23");
  });
});
