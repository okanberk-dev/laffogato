import { describe, it, expect } from "vitest";

import { LEGAL_CONTENT } from "@/lib/legal/content";
import { LEGAL_ENTITY, fillTokens } from "@/lib/legal/entity";
import { findLegalDoc } from "@/lib/legal/documents";
import { SITE } from "@/lib/seo/site";

/**
 * Kafe saati kodda TEK yerde yazılmalı.
 *
 * Bu testler var, çünkü tam olarak bu bozuldu: telefon, e-posta ve adres her
 * yerde düzeltildikten sonra /hukuk/sirket-bilgileri sayfası aylarca
 * "08:00 - 22:00" göstermeye devam etti - çünkü o değer, token yerine düz
 * metin olarak gömülüydü ve kimse orayı aramadı.
 */
describe("Kafe çalışma saatleri - tek kaynak", () => {
  it("kanonik değer her gün 09:00 - 02:00", () => {
    expect(LEGAL_ENTITY.cafeHours.opens).toBe("09:00");
    expect(LEGAL_ENTITY.cafeHours.closes).toBe("02:00");
  });

  it("kapanış açılıştan küçüktür - 02:00 ertesi gündür", () => {
    // Bu bir hata değil, kasıtlı. Saatleri sayısal karşılaştıran her kod
    // bunu bilmek zorunda; schema.org da böyle ifade eder.
    expect(LEGAL_ENTITY.cafeHours.closes < LEGAL_ENTITY.cafeHours.opens).toBe(
      true,
    );
  });

  it("SEO sabiti kopyalamaz, türetir", () => {
    expect(SITE.openingHours).toHaveLength(1);
    expect(SITE.openingHours[0].opens).toBe(LEGAL_ENTITY.cafeHours.opens);
    expect(SITE.openingHours[0].closes).toBe(LEGAL_ENTITY.cafeHours.closes);
    expect(SITE.openingHours[0].days).toHaveLength(7);
  });

  it("şirket bilgileri belgesi güncel saati basar", () => {
    const doc = findLegalDoc("sirket-bilgileri");
    expect(doc).toBeTruthy();
    const rendered = fillTokens(JSON.stringify(doc));
    expect(rendered).toContain(LEGAL_ENTITY.cafeHours.display);
  });

  it("hukuki metinlerde eski kafe saatlerinden hiçbiri kalmadı", () => {
    const all = fillTokens(JSON.stringify(LEGAL_CONTENT));
    for (const stale of ["08:00 - 22:00", "08:00 - 23:00", "09:00 - 22:00"]) {
      expect(all).not.toContain(stale);
    }
  });

  it("mağaza ve müşteri hizmetleri saatleri kafe saatiyle KARIŞTIRILMADI", () => {
    // Kafe 02:00'de kapanıyor; müşteri hizmetleri hafta içi mesai saatinde.
    // Bunları tek değere indirmek yanlış olurdu.
    const all = fillTokens(JSON.stringify(LEGAL_CONTENT));
    expect(all).toContain("Hafta içi 09:00 - 18:00");
    expect(all).toContain("7/24 açık");
  });
});

/**
 * Veri tabanı sağlayıcısının adı da tek kaynaktan gelmeli.
 *
 * Adı 35 hukuki pasajda geçiyor ve bunlar bağlayıcı beyan: verinin nerede
 * tutulduğunu ve yurt dışı aktarımın hangi sağlayıcıdan doğduğunu söylüyorlar.
 * Sağlayıcı değişince 34'ünü güncelleyip birini atlamak, yanlış bir hukuki
 * beyan bırakmak demektir.
 */
describe("Veri tabanı sağlayıcısı - tek kaynak", () => {
  it("hukuki metinlerde sağlayıcı adı düz metin olarak gömülü değil", () => {
    const raw = JSON.stringify(LEGAL_CONTENT);
    for (const provider of ["Neon", "Supabase"]) {
      expect(raw, `${provider} düz metin olarak gömülü`).not.toContain(
        provider,
      );
    }
  });

  it("token doldurulunca gerçek sağlayıcı adı basılır", () => {
    const rendered = fillTokens(JSON.stringify(LEGAL_CONTENT));
    expect(rendered).toContain(LEGAL_ENTITY.dbProvider);
  });

  it("sağlayıcı adı boş bırakılamaz", () => {
    // Boş bir değer, KVKK metninde veri işleyenin adının hiç yazmaması
    // demektir - satır düşmez, cümle sakatlanır.
    expect(LEGAL_ENTITY.dbProvider.trim().length).toBeGreaterThan(0);
  });
});
