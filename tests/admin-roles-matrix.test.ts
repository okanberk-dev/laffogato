import { describe, expect, it } from "vitest";

import {
  ADMIN_ROLES,
  canAccess,
  landingPathFor,
  sectionsFor,
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

describe("landing paths", () => {
  it("keep the dashboard for every role that can open it", () => {
    for (const role of ADMIN_ROLES) {
      const path = landingPathFor(role);
      expect(path).toBe(
        canAccess("dashboard", role) ? "/admin" : "/admin/kasa",
      );
    }
  });
});
