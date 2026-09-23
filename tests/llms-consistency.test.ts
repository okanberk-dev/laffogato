import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect } from "vitest";

import { LEGAL_ENTITY } from "@/lib/legal/entity";
import { SITE } from "@/lib/seo/site";

/**
 * public/llms.txt ve llms-full.txt elle yazılmış metinlerdir ve robots.ts
 * bunları yapay zekâ botlarına (GPTBot, ClaudeBot, PerplexityBot) açıkça
 * serbest bırakır. Yani buradaki bir bayat telefon numarası, insanlara değil
 * ama ASİSTANLARA verilen resmi cevap olur - kullanıcı "telefon hâlâ yanlış"
 * derken canlı sayfa doğruydu; asistanların okuduğu bu dosyalar eskiydi.
 *
 * Bu test o sınıfı kapatır: elle yazılmış metin, koddaki kanonik değerlerle
 * eşleşmek zorundadır. Dosyayı güncellemeyi unutmak artık derlemeyi kırar,
 * sessizce yanlış numara dağıtmaz.
 */
const FILES = ["llms.txt", "llms-full.txt"].map((name) => ({
  name,
  text: readFileSync(join(process.cwd(), "public", name), "utf-8"),
}));

describe("llms.txt tutarlılığı - asistanlara giden veri koddaki gerçekle aynı", () => {
  it("kanonik telefonu içerir, eskisini içermez", () => {
    for (const f of FILES) {
      expect(f.text, f.name).toContain(LEGAL_ENTITY.phone);
      expect(f.text, f.name).not.toContain("216 459 30 60");
    }
  });

  it("kanonik e-postayı içerir, eski adresleri içermez", () => {
    for (const f of FILES) {
      expect(f.text, f.name).toContain(LEGAL_ENTITY.email);
      expect(f.text, f.name).not.toMatch(/@laffogato\.it/);
    }
  });

  it("kafe saatini kanonik değerle verir, eski tarifeyi vermez", () => {
    const { opens, closes } = LEGAL_ENTITY.cafeHours;
    for (const f of FILES) {
      expect(f.text, f.name).toContain(`${opens} — ${closes}`);
      // Ayraçtan bağımsız: eski tarife "10:00 - 23:00", "10.00-24.00" gibi
      // herhangi bir biçimde geri gelirse de yakalanır. Birebir dize, kılık
      // değiştirmiş bayatlamayı kaçırır.
      expect(f.text, f.name).not.toMatch(/10[:.]00\s*[-–—]+\s*2[34][:.]00/);
    }
  });

  it("unvan, VKN ve MERSİS hukuki kimlikle eşleşir", () => {
    // Koşulsuz: iki dosya da yasal kimlik taşımak zorunda. "Vergi kelimesi
    // geçiyorsa" kapısı, bölümün tamamen silinmesini görünmez yapardı.
    for (const f of FILES) {
      expect(f.text, f.name).toContain(LEGAL_ENTITY.legalName);
      expect(f.text, f.name).toContain(LEGAL_ENTITY.taxNo);
    }
    // MERSİS yalnız full dosyada bekleniyor (kısa dosya özet tutar).
    expect(FILES[1].text, FILES[1].name).toContain(LEGAL_ENTITY.mersisNo);
  });

  it("adres, vergi levhasındaki cadde adını taşır", () => {
    for (const f of FILES) {
      expect(f.text, f.name).toContain(LEGAL_ENTITY.address.line1);
      expect(f.text, f.name).not.toContain("29 Ekim");
    }
  });

  it("SITE ile llms aynı koordinatları söyler - iki dosyada da", () => {
    // Dosya dosya: birleşik metin, tek dosyanın bayatlamasını maskelerdi.
    for (const f of FILES) {
      expect(f.text, f.name).toContain(String(SITE.geo.latitude));
      expect(f.text, f.name).toContain(String(SITE.geo.longitude));
    }
  });
});
