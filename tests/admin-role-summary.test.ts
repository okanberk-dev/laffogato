import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { roleSectionLabels, SECTION_LABELS } from "@/lib/admin/role-summary";
import { ADMIN_ROLES, sectionsFor } from "@/lib/admin/roles";

/**
 * The users page described the roles in a sentence of its own: "Yönetici
 * katalog, içerik ve siparişleri yönetir · Personel sipariş, stok ve kasayı
 * görür". The matrix also gives the manager refunds, every member's
 * personal data and "Hesabı sil", and mass e-mail; the owner picked roles
 * from that sentence. The summary is now read off the matrix itself.
 */
describe("role summary on /admin/kullanicilar", () => {
  it("names every section a role opens, from the same matrix", () => {
    for (const role of ADMIN_ROLES) {
      const expected = sectionsFor(role)
        .map((s) => SECTION_LABELS[s])
        .filter(Boolean);
      expect(roleSectionLabels(role), role).toEqual(expected);
    }
  });

  it("tells the owner what Yönetici really gets", () => {
    const manager = roleSectionLabels("manager");
    expect(manager).toContain("İadeler");
    expect(manager).toContain("Müşteriler (üye kişisel verileri, Hesabı sil)");
    expect(manager).toContain("Bülten ve kampanya e-postası");
    expect(manager).not.toContain("Kullanıcılar");
    expect(roleSectionLabels("staff")).toContain("Karaoke");
    // Decision D3: Personel updates the köşk's live status, not the app.
    expect(roleSectionLabels("staff")).toContain("Canlı durum");
    expect(roleSectionLabels("staff")).not.toContain("Mobil uygulama");
    expect(roleSectionLabels("cashier")).toEqual(["Kasa · damga"]);
  });

  it("has a label for every section with a page", () => {
    for (const [section, label] of Object.entries(SECTION_LABELS)) {
      if (section === "leads") continue; // no page of its own yet
      expect(label, section).not.toBe("");
    }
  });

  it("the page reads the summary, not the old sentence", () => {
    const page = readFileSync("src/app/admin/kullanicilar/page.tsx", "utf8");
    expect(page).toContain("roleSectionLabels(role)");
    expect(page).not.toContain("katalog, içerik ve siparişleri yönetir");
  });
});
