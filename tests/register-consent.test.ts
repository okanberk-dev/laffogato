import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { findLegalDoc } from "@/lib/legal/documents";

/**
 * Sign-up asks the member to accept the Kullanım Şartları, and only tells
 * them where the KVKK notice is: an aydınlatma is read, never "accepted"
 * (Kurul İlke Kararı 2026/347, RG 24.03.2026; KVKK m.10). The old box said
 * "Kullanım Şartları ve Gizlilik Politikası'nı (KVKK aydınlatma metni
 * dahil) okudum, kabul ediyorum." The field name and the unticked start
 * stay (tests/frontend-form-contract.test.ts).
 */

vi.mock("@/app/uye/actions", () => ({
  registerAction: async () => ({}),
}));

async function form() {
  const { RegisterForm } = await import("@/app/uye/kayit/register-form");
  return renderToStaticMarkup(createElement(RegisterForm));
}

const words = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .replace(/ '/g, "'")
    .trim();

describe("sign-up consent", () => {
  it("the terms box accepts the Kullanım Şartları alone", async () => {
    const html = await form();
    const label = html.match(
      /<label class="auth-consent"><input [^>]*name="acceptedTerms"[\s\S]*?<\/label>/,
    )?.[0];
    expect(label).toBeTruthy();
    expect(words(label!)).toBe("Kullanım Şartları'nı okudum, kabul ediyorum.");
    expect(label).toContain('href="/hukuk/kullanim-sartlari"');
    expect(label).not.toMatch(/gizlilik|kvkk|aydınlatma/i);
    // Still unticked and required.
    expect(label).toMatch(
      /<input type="checkbox" required="" name="acceptedTerms"\/>/,
    );
    expect(label).not.toMatch(/\bchecked\b/);
  });

  it("the KVKK notice is named under it, without a box, as something to read", async () => {
    const html = await form();
    const note = html.match(/<p class="auth-consent-note">[\s\S]*?<\/p>/)?.[0];
    expect(note).toBeTruthy();
    expect(words(note!)).toBe(
      "Kişisel verilerinin nasıl işlendiğini Gizlilik Politikası ve KVKK Aydınlatma Metni'nde okuyabilirsin.",
    );
    expect(note).toContain('href="/hukuk/gizlilik-politikasi"');
    expect(note).toContain('href="/hukuk/kvkk-aydinlatma-metni"');
    expect(note).not.toContain("<input");
    expect(note).not.toMatch(/kabul/i);
    // Right under the terms box, before the marketing boxes.
    expect(html.indexOf("auth-consent-note")).toBeGreaterThan(
      html.indexOf('name="acceptedTerms"'),
    );
    expect(html.indexOf("auth-consent-note")).toBeLessThan(
      html.indexOf('name="marketing"'),
    );
    expect(html).not.toContain("aydınlatma metni dahil");
  });
});

describe("the Kullanım Şartları the box accepts", () => {
  // The box above accepts the Kullanım Şartları alone, but §1 and §3 of
  // that text still made the Gizlilik Politikası an annex and part of the
  // box's acceptance. The sentences live in content.ts (back end), so this
  // front-end PR records them as open in LEGAL-REDLINES §22.6 with the
  // decided wording. When the back-end PR rewrites them, this turns into a
  // plain check that no Terms sentence ties the box to the privacy notice.
  it("while the Terms tie the sign-up box to the Gizlilik Politikası, LEGAL-REDLINES lists both sentences as open", () => {
    const terms = findLegalDoc("kullanim-sartlari");
    expect(terms).toBeDefined();
    const text = terms!.sections
      .flatMap((s) => [...(s.paragraphs ?? []), ...(s.bullets ?? [])])
      .join("\n");
    const boxTiesPrivacy =
      /onay kutucuğunu işaretlemek suretiyle işbu Şartları ve Gizlilik/.test(
        text,
      );
    const privacyIsAnnex =
      /İşbu Şartlar; Gizlilik ve Kişisel Verilerin Korunması Politikası/.test(
        text,
      );
    if (!boxTiesPrivacy && !privacyIsAnnex) return;

    const redlines = readFileSync("docs/LEGAL-REDLINES-2026-09.md", "utf8");
    const open = redlines.match(
      /### 22\.6 Açık: Kullanım Şartları kayıt kutusunu[\s\S]*?(?=\n## |\n### )/,
    )?.[0];
    expect(open, "LEGAL-REDLINES §22.6 is missing").toBeTruthy();
    if (boxTiesPrivacy) {
      expect(open).toContain(
        "onay kutucuğunu işaretlemek suretiyle işbu Şartları ve Gizlilik ve Kişisel Verilerin Korunması Politikası'nı açıkça kabul etmiş sayılırsınız",
      );
    }
    if (privacyIsAnnex) {
      expect(open).toContain(
        "İşbu Şartlar; Gizlilik ve Kişisel Verilerin Korunması Politikası, Çerez Politikası",
      );
    }
    // The section status says it is open, not done.
    expect(redlines).toMatch(/\*\*Açık:\*\* Kullanım Şartları §1 ve\n> §3/);
  });
});
