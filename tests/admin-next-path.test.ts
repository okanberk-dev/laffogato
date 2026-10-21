import { describe, expect, it } from "vitest";

import { adminNextPath } from "@/lib/admin/next-path";

/**
 * Where a sign-in sends the operator next (admin audit SHE-30, rule 26): a
 * panel page with its query, nothing off the panel, never a sign-in step.
 */
describe("adminNextPath", () => {
  it("keeps a panel page and its query", () => {
    expect(adminNextPath("/admin")).toBe("/admin");
    expect(adminNextPath("/admin/siparisler?durum=acik&sayfa=2")).toBe(
      "/admin/siparisler?durum=acik&sayfa=2",
    );
  });

  it("refuses anything off the panel", () => {
    for (const raw of [
      "/odeme",
      "/administrator",
      "/admin-x",
      "//evil.example/admin",
      "/\\evil.example",
      "https://evil.example/admin",
      "/admin/../uye/hesap",
      "/%61dmin",
      "/admin\n/kasa",
      "",
      undefined,
      ["/admin"],
    ]) {
      expect(adminNextPath(raw), String(raw)).toBeNull();
    }
  });

  it("never sends a login back to a sign-in step", () => {
    expect(adminNextPath("/admin/giris?next=/admin")).toBeNull();
    expect(adminNextPath("/admin/iki-asama")).toBeNull();
  });

  it("drops a fragment and an over-long target", () => {
    expect(adminNextPath("/admin/menu#kahve")).toBe("/admin/menu");
    expect(adminNextPath(`/admin/musteriler?q=${"a".repeat(400)}`)).toBeNull();
  });
});
