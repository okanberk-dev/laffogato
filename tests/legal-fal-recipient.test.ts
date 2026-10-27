import { describe, expect, it } from "vitest";

import { LEGAL_CONTENT } from "@/lib/legal/content";
import { findLegalDoc, LEGAL_DOCS, type LegalDoc } from "@/lib/legal/documents";
import {
  FAL_PROVIDERS,
  FAL_PROVIDER_INFO,
  falAiEnabled,
} from "@/lib/mobile/fal-core";

/**
 * 27 Ekim 2026 (LEGAL-REDLINES §36). App Review refused the iOS app under
 * Guideline 4.3(b) (fortune telling): fA'L, the coffee-fortune screen with
 * its optional AI reading, left the app (lafmobil karar 330). Kahve Modu took
 * its place: the member picks a coffee mood and the app writes it on the
 * member's own photo, on the device. Nothing is uploaded and no AI reads it.
 * The AI reading is off in code (`falAiEnabled`).
 *
 * Until then this file held the texts to the one provider the code could
 * send the photo to (karar 177: Anthropic, PBC). It now holds them to the
 * opposite: no AI recipient, no fA'L, no R12, and Kahve Modu said where the
 * app's permissions are said, with the photo kept on the device. The app
 * shows these texts and the reviewer can open them.
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

function text(slug: string): string {
  return strings(findLegalDoc(slug)).join("\n");
}

/** Every printed string of every coded document, with its slug. */
const ALL = LEGAL_DOCS.flatMap((doc) =>
  [doc.title, doc.summary, ...strings(doc)].map((t) => ({ slug: doc.slug, t })),
);

describe("no AI recipient for the photo", () => {
  it("the code sends the photo nowhere", () => {
    expect(falAiEnabled()).toBe(false);
  });

  it("no text names a provider the photo could have gone to", () => {
    const all = JSON.stringify(LEGAL_CONTENT);
    for (const provider of FAL_PROVIDERS) {
      const { legalName } = FAL_PROVIDER_INFO[provider];
      const brand = legalName.split(",")[0]!.trim();
      expect(all, legalName).not.toContain(legalName);
      expect(all, brand).not.toMatch(new RegExp(brand, "i"));
    }
  });

  it("the aydınlatma and the gizlilik texts list no AI provider among the recipients", () => {
    for (const slug of ["kvkk-aydinlatma-metni", "gizlilik-politikasi"]) {
      const keys = findLegalDoc(slug)!.sections.flatMap((s) =>
        (s.table ?? []).map((r) => r.key),
      );
      expect(
        keys.filter((k) => /yapay zekâ/i.test(k)),
        slug,
      ).toEqual([]);
      expect(text(slug), slug).not.toMatch(/yapay zekâ ile yorum/i);
    }
  });
});

describe("no fA'L, no fortune, no R12", () => {
  it("no coded document names fA'L, a fortune or the retired consent", () => {
    const stale =
      /fA'L|(^|[^\p{L}])fal(ı|ın|ınız)?([^\p{L}]|$)|kahve falı|\bR12\b|15\/A|Bu yorumu bildir/iu;
    for (const { slug, t } of ALL) {
      expect(t, `${slug}: ${t.slice(0, 90)}`).not.toMatch(stale);
    }
  });

  it("the Açık Rıza Metni asks for no AI reading consent", () => {
    const consent = text("acik-riza-metni");
    expect(consent).not.toMatch(/yapay zekâ yorumu/i);
    expect(consent).not.toContain("fA'L ekranı");
  });

  it("Kahve Modu is never called 'eğlence amaçlı'", () => {
    // "Eğlence için" is how fortune apps apologise; Kahve Modu reads
    // nothing, so there is nothing to apologise for (lafmobil
    // docs/APP-REVIEW-2026-10-27.md, finding 6). The karaoke room is still
    // an entertainment service in the cayma exceptions; only Kahve Modu's
    // sentences are held.
    let seen = 0;
    for (const { slug, t } of ALL) {
      for (const sentence of t.split(/(?<=[.;])\s+/)) {
        if (!sentence.includes("Kahve Modu")) continue;
        seen += 1;
        expect(sentence, `${slug}: ${sentence.slice(0, 90)}`).not.toMatch(
          /eğlence|kehanet|yorumlan/i,
        );
      }
    }
    expect(seen).toBeGreaterThan(40);
  });

  it("no Kahve Modu sentence promises the device keeps nothing", () => {
    // The picker's cache copy and the Story file are deleted on a best
    // effort (Android's crop file is out of the app's reach), so the texts
    // say the photo is not sent, never that the device does not keep it.
    for (const { slug, t } of ALL) {
      for (const sentence of t.split(/(?<=[.;])\s+/)) {
        if (!sentence.includes("Kahve Modu")) continue;
        expect(sentence, `${slug}: ${sentence.slice(0, 90)}`).not.toMatch(
          /saklanmaz|silinir/,
        );
      }
    }
  });
});

describe("Kahve Modu where the handoff puts it", () => {
  it("every document that listed fA'L among the app's functions lists Kahve Modu", () => {
    for (const slug of [
      "on-bilgilendirme-formu",
      "mesafeli-satis-sozlesmesi",
      "iade-ve-cayma",
      "gizlilik-politikasi",
      "kvkk-aydinlatma-metni",
      "ticari-elektronik-ileti",
      "kullanim-sartlari",
      "uyelik-sozlesmesi",
      "mobil-uygulama-kosullari",
      "sirket-bilgileri",
      "kafe-hizmet-kosullari",
      "satis-politikasi",
      "odeme-kosullari",
      "guvenli-alisveris",
      "acik-riza-metni",
      "veri-saklama-ve-imha-politikasi",
      "cerez-politikasi",
      "sikayet-ve-uyusmazlik",
      "fikri-mulkiyet",
    ]) {
      expect(text(slug), slug).toContain("Kahve Modu");
    }
  });

  it("the photo is processed on the device and sent to nobody", () => {
    expect(text("on-bilgilendirme-formu")).toContain(
      "Kahve Modu özelliğinde çekilen veya seçilen fotoğraf yalnızca cihazda işlenir; SATICI'ya ya da başka bir yere gönderilmez.",
    );
    expect(text("gizlilik-politikasi")).toContain(
      "fotoğraf yalnızca cihazınızda işlenir ve Story görseli de cihazınızda oluşturulur; fotoğraf Şirkete ya da başka bir yere gönderilmez, görseli yalnızca siz, seçtiğiniz yerde paylaşırsınız.",
    );
    expect(text("kvkk-aydinlatma-metni")).toContain(
      "Görselin üzerindeki kahve modu fotoğrafa bakılarak seçilmez; görseli yalnızca siz, cihazınızın paylaşım ekranından seçtiğiniz yerde paylaşırsınız.",
    );
    expect(text("kvkk-aydinlatma-metni")).toContain(
      "Kahve Modu fotoğrafı cihazınızdan çıkmadığı için tarafımızca işlenmez ve aktarılmaz.",
    );
    expect(text("uyelik-sozlesmesi")).toContain(
      "Kahve Modu fotoğrafı yalnızca cihazda işlenir ve Şirket'e ya da başka bir yere gönderilmez.",
    );
  });

  it("the Mobil Uygulama Koşulları describe the mood, not a reading", () => {
    const terms = text("mobil-uygulama-kosullari");
    expect(terms).toContain(
      "Kahve Modu: Kullanıcı'nın kendi içecek fotoğrafına seçtiği kahve modunun (kahve üzerine kısa bir söz) yazılması ve isteğe bağlı olarak hikâye görselinin paylaşılması (9. madde).",
    );
    expect(terms).toContain(
      "Mod fotoğrafa bakılarak seçilmez; bir tahmin, yorum veya tavsiye içermez.",
    );
    expect(terms).toContain(
      "Fotoğraf ve hikâye görseli yalnızca cihazda işlenir; fotoğraf Şirkete ya da başka bir yere gönderilmez.",
    );
  });

  it("the camera sentences name the table QR as well", () => {
    // Table ordering (16 Eki 2026) opens the camera too; the texts never
    // said so until the fA'L sentences were rewritten.
    for (const slug of [
      "on-bilgilendirme-formu",
      "mesafeli-satis-sozlesmesi",
      "gizlilik-politikasi",
      "kvkk-aydinlatma-metni",
      "ticari-elektronik-ileti",
      "kullanim-sartlari",
      "uyelik-sozlesmesi",
      "mobil-uygulama-kosullari",
      "sirket-bilgileri",
      "kafe-hizmet-kosullari",
    ]) {
      expect(text(slug), slug).toMatch(/masadaki QR kodu/);
    }
  });
});

describe("the retired feature's records", () => {
  it("Veri Saklama makes no new record and keeps the old ones' periods", () => {
    const rows = findLegalDoc(
      "veri-saklama-ve-imha-politikasi",
    )!.sections.flatMap((s) => s.table ?? []);
    const usage = rows.find((r) =>
      r.key.startsWith(
        "27 Ekim 2026'da mobil uygulamadan kaldırılan yapay zekâ fotoğraf yorumu özelliği",
      ),
    );
    expect(usage, "usage row").toBeDefined();
    expect(usage!.value).toContain(
      "27 Ekim 2026'dan itibaren yeni kayıt oluşturulmaz",
    );
    // The period src/lib/retention.ts quotes, word for word.
    expect(usage!.value).toContain(
      "kullanım kaydı günlük sınırın uygulanması için doksan gün saklanır ve ardından silinir.",
    );
    const reports = rows.find((r) =>
      r.key.startsWith("Aynı özelliğin yorum bildirimleri"),
    );
    expect(reports, "reports row").toBeDefined();
    expect(reports!.value).toContain(
      "Bildirim tarihinden itibaren 90 gün saklanır ve ardından silinir; fotoğraf bildirime girmez.",
    );
    expect(reports!.value).toContain(
      "27 Ekim 2026'dan itibaren yeni bildirim alınmaz",
    );
    const consents = rows.find((r) =>
      r.key.startsWith("Özellik bazlı açık rıza kayıtları"),
    );
    expect(consents, "consents row").toBeDefined();
    expect(consents!.value).toContain(
      "geri çekme tarihinden itibaren 3 yıl saklanır ve ardından silinir.",
    );
    expect(consents!.value).toContain(
      "27 Ekim 2026'dan itibaren yeni onay alınmaz",
    );
  });
});
