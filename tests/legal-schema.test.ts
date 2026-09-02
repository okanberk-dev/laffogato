import { describe, it, expect } from "vitest";

import { legalDocSchema } from "@/lib/admin/legal-schema";
import { canAccess } from "@/lib/admin/roles";

describe("legalDocSchema", () => {
  it("parses a draft and maps isPublished checkbox", () => {
    const r = legalDocSchema.safeParse({
      title: "Gizlilik Politikası",
      summary: "Kısa özet",
      effectiveDate: "26 Mayıs 2026",
      bodyMarkdown: "## Başlık\n\nParagraf.",
      // isPublished absent → draft
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.isPublished).toBe(false);
    expect(r.data.title).toBe("Gizlilik Politikası");
  });

  it("requires real body content to publish", () => {
    const r = legalDocSchema.safeParse({
      title: "Bir Belge",
      bodyMarkdown: "kısa",
      isPublished: "on",
    });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.error.issues.some((i) => i.path[0] === "bodyMarkdown")).toBe(true);
  });

  it("rejects a too-short title", () => {
    expect(legalDocSchema.safeParse({ title: "A" }).success).toBe(false);
  });
});

describe("RBAC — new sections", () => {
  it("legal editing is owner-only", () => {
    expect(canAccess("legal", "owner")).toBe(true);
    expect(canAccess("legal", "manager")).toBe(false);
    expect(canAccess("legal", "staff")).toBe(false);
  });

  it("newsletter + leads are owner/manager, not staff", () => {
    for (const s of ["newsletter", "leads"] as const) {
      expect(canAccess(s, "owner")).toBe(true);
      expect(canAccess(s, "manager")).toBe(true);
      expect(canAccess(s, "staff")).toBe(false);
    }
  });
});
