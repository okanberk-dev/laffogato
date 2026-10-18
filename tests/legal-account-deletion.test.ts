import { describe, expect, it } from "vitest";

import { findLegalDoc, LEGAL_DOCS } from "@/lib/legal/documents";

/**
 * The legal texts follow the deletion flow (18 Eki 2026): on the Site an
 * account is deleted by the team on the member's request, within thirty
 * days (KVKK m.13/2, Tebliğ m.6/5); the app's "Hesabımı sil" stays
 * immediate (Apple 5.1.1(v)). No text may still promise that the Site
 * deletes an account the moment the member asks.
 */

const all = (slug: string) => {
  const d = findLegalDoc(slug)!;
  return [
    d.summary,
    ...d.sections.flatMap((s) => [
      s.heading,
      ...(s.paragraphs ?? []),
      ...(s.bullets ?? []),
      ...(s.ordered ?? []),
      ...(s.table ?? []).flatMap((r) => [r.key, r.value]),
    ]),
  ].join("\n");
};

describe("hesap-silme", () => {
  const text = all("hesap-silme");

  it("describes the Site's request and the app's in-app button", () => {
    expect(text).toContain("/uye/hesap/sil");
    expect(text).toContain("Hesabımın silinmesini istiyorum");
    expect(text).toContain('"Hesabımı sil"');
    expect(text).toMatch(/ekibimizce silinir/);
    expect(text).toMatch(/en geç otuz gün içinde ücretsiz olarak/);
  });

  it("says how a request is taken back", () => {
    expect(text).toContain("Talebi geri al");
  });

  it("says what is kept, and on which basis", () => {
    expect(text).toContain("213 sayılı Vergi Usul Kanunu");
    expect(text).toContain("6102 sayılı Türk Ticaret Kanunu");
    const refs = findLegalDoc("hesap-silme")!.references!.join("\n");
    expect(refs).toContain("m.5/2-ç hukuki yükümlülük");
    expect(refs).toContain("m.13 veri sorumlusuna başvuru");
  });

  it("no longer says the Site deletes on the member's click", () => {
    expect(text).not.toContain("şifrenizi doğruladığınızda anında");
    expect(text).not.toContain("Hesabım > Hesabı sil sayfası");
  });
});

describe("the other texts that sent members to /uye/hesap/sil", () => {
  it("no text offers the Site page as an immediate way to close the account", () => {
    for (const d of LEGAL_DOCS) {
      const text = all(d.slug);
      expect(text, d.slug).not.toMatch(
        /hesap silme seçeneğinden veya \S*\/uye\/hesap\/sil sayfasından başlat/,
      );
      expect(text, d.slug).not.toMatch(
        /uygulamadaki veya sitedeki hesap silme seçeneğiyle/,
      );
    }
  });

  it("the membership agreement says the Site's request is answered within thirty days", () => {
    expect(all("uyelik-sozlesmesi")).toMatch(
      /Site'den veya e-postayla iletilen talep Şirket tarafından en geç otuz gün içinde sonuçlandırılır/,
    );
  });
});
