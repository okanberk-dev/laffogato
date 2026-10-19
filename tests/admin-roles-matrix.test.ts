import { describe, expect, it } from "vitest";

import { activeNavHref } from "@/lib/admin/nav-match";
import { parseOrderTab } from "@/lib/admin/order-filters";
import {
  ADMIN_ROLES,
  canAccess,
  deniedPathFor,
  landingPathFor,
  sectionsFor,
  type AdminRole,
  type AdminSection,
} from "@/lib/admin/roles";

/**
 * The cashier role exists so a shift worker can hand out stamps at the till
 * WITHOUT being able to read the order list, the refunds or the customer
 * records. That is a single-line claim in the matrix and a whole class of data
 * exposure if it drifts.
 */
describe("cashier", () => {
  it("sees the till and nothing else", () => {
    expect(sectionsFor("cashier")).toEqual(["till"]);
  });

  it("is kept out of orders, customers and the dashboard", () => {
    for (const section of [
      "orders",
      "customers",
      "dashboard",
      "refunds",
    ] as const) {
      expect(canAccess(section, "cashier")).toBe(false);
    }
  });

  it("lands on the till, because /admin would deny it", () => {
    expect(landingPathFor("cashier")).toBe("/admin/kasa");
    expect(canAccess("dashboard", "cashier")).toBe(false);
  });
});

describe("till", () => {
  it("is open to everyone who works a shift", () => {
    for (const role of ADMIN_ROLES) {
      expect(canAccess("till", role)).toBe(true);
    }
  });
});

describe("adminUsers", () => {
  it("is the owner's alone - it can grant every other privilege", () => {
    expect(canAccess("adminUsers", "owner")).toBe(true);
    for (const role of ["manager", "staff", "cashier"] as const) {
      expect(canAccess("adminUsers", role)).toBe(false);
    }
  });
});

/**
 * Changed on purpose (admin UI v2, decision D2): Personel no longer lands on
 * the dashboard but on the orders still open. Owner and manager keep the
 * dashboard, the cashier the till.
 */
describe("landing paths", () => {
  const LANDING: Record<AdminRole, [string, AdminSection]> = {
    owner: ["/admin", "dashboard"],
    manager: ["/admin", "dashboard"],
    staff: ["/admin/siparisler?durum=acik", "orders"],
    cashier: ["/admin/kasa", "till"],
  };

  it("send each role where its work starts", () => {
    for (const role of ADMIN_ROLES) {
      expect(landingPathFor(role), role).toBe(LANDING[role][0]);
    }
  });

  it("are pages the role can open, or a denial there would bounce forever", () => {
    for (const role of ADMIN_ROLES) {
      expect(canAccess(LANDING[role][1], role), role).toBe(true);
    }
  });

  it("open Personel on the list's Açık tab, with Siparişler lit in the nav", () => {
    const url = new URL(landingPathFor("staff"), "https://panel.invalid");
    expect(parseOrderTab(url.searchParams)).toBe("acik");
    // The sidebar matches the address bar's path, never its query.
    expect(
      activeNavHref(url.pathname, [
        "/admin",
        "/admin/siparisler",
        "/admin/kasa",
      ]),
    ).toBe("/admin/siparisler");
  });
});

describe("denied paths", () => {
  it("join `denied=1` to the landing page's own query: one `?`, one flag", () => {
    for (const role of ADMIN_ROLES) {
      const path = deniedPathFor(role);
      expect(path.split("?"), role).toHaveLength(2);
      const url = new URL(path, "https://panel.invalid");
      expect(url.searchParams.getAll("denied"), role).toEqual(["1"]);
      url.searchParams.delete("denied");
      expect(url.pathname + url.search, role).toBe(landingPathFor(role));
    }
  });

  it("keep owner, manager and cashier where they were", () => {
    expect(deniedPathFor("owner")).toBe("/admin?denied=1");
    expect(deniedPathFor("manager")).toBe("/admin?denied=1");
    expect(deniedPathFor("cashier")).toBe("/admin/kasa?denied=1");
  });

  it("land a refused Personel on the open orders, with the notice", () => {
    const path = deniedPathFor("staff");
    expect(path).toBe("/admin/siparisler?durum=acik&denied=1");
    const sp = new URL(path, "https://panel.invalid").searchParams;
    expect(parseOrderTab(sp)).toBe("acik");
    // What `${landing}?denied=1` built: an unknown tab (every order) and no
    // flag for the shell to say.
    const glued = new URL(
      `${landingPathFor("staff")}?denied=1`,
      "https://panel.invalid",
    ).searchParams;
    expect(parseOrderTab(glued)).toBeNull();
    expect(glued.get("denied")).toBeNull();
  });
});

describe("tables", () => {
  it("is the owner's and the manager's: rotating a code kills a printed card", () => {
    expect(canAccess("tables", "owner")).toBe(true);
    expect(canAccess("tables", "manager")).toBe(true);
    expect(canAccess("tables", "staff")).toBe(false);
    expect(canAccess("tables", "cashier")).toBe(false);
  });
});
