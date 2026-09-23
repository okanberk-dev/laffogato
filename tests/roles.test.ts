import { describe, it, expect } from "vitest";

import { canAccess, sectionsFor } from "@/lib/admin/roles";

describe("RBAC - canAccess", () => {
  it("owner can reach every section, including settings + audit", () => {
    expect(canAccess("settings", "owner")).toBe(true);
    expect(canAccess("audit", "owner")).toBe(true);
    expect(canAccess("products", "owner")).toBe(true);
  });

  it("all roles can reach the dashboard", () => {
    expect(canAccess("dashboard", "owner")).toBe(true);
    expect(canAccess("dashboard", "manager")).toBe(true);
    expect(canAccess("dashboard", "staff")).toBe(true);
  });

  it("staff cannot reach settings", () => {
    expect(canAccess("settings", "staff")).toBe(false);
  });

  it("sectionsFor(owner) is a superset of sectionsFor(staff)", () => {
    const owner = new Set(sectionsFor("owner"));
    for (const s of sectionsFor("staff")) {
      expect(owner.has(s)).toBe(true);
    }
  });
});
