import { describe, expect, it } from "vitest";

import { parsePriceLabel, priceLabel } from "@/lib/utils/format";
import { canAccess } from "@/lib/admin/roles";

describe("price display", () => {
  it("keeps kuruş when there are any, and drops them when there are none", () => {
    expect(priceLabel(18500)).toBe("185₺");
    expect(priceLabel(18490)).toBe("184,90₺");
    expect(priceLabel(0)).toBe("0₺");
  });

  it("reads a Turkish decimal comma back out", () => {
    // parseFloat stops at the comma and returns 184.
    expect(parsePriceLabel("184,90₺")).toBe(184.9);
    expect(parsePriceLabel("185₺")).toBe(185);
    expect(parsePriceLabel("1.250,50₺")).toBe(1250.5);
    expect(parsePriceLabel("—")).toBe(0);
  });

  it("round-trips a price through the label", () => {
    for (const minor of [1, 99, 100, 4550, 18490, 125050]) {
      expect(Math.round(parsePriceLabel(priceLabel(minor)) * 100)).toBe(minor);
    }
  });
});

describe("refund authorization", () => {
  it("keeps refunds away from staff", () => {
    expect(canAccess("orders", "staff")).toBe(true);
    expect(canAccess("refunds", "staff")).toBe(false);
    expect(canAccess("refunds", "manager")).toBe(true);
    expect(canAccess("refunds", "owner")).toBe(true);
  });
});
