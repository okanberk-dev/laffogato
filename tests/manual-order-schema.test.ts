import { describe, it, expect } from "vitest";

import { manualOrderSchema } from "@/lib/admin/manual-order-schema";

describe("manualOrderSchema", () => {
  it("parses valid lines and defaults status to 'paid'", () => {
    const r = manualOrderSchema.safeParse({
      items: JSON.stringify([
        { productId: "prd-0001", qty: 2 },
        { productId: "prd-0002", variantId: "var-1", qty: 1 },
      ]),
      customerName: "Ali Veli",
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.lines).toHaveLength(2);
    expect(r.data.lines[0]).toEqual({
      productId: "prd-0001",
      variantId: undefined,
      qty: 2,
    });
    expect(r.data.lines[1].variantId).toBe("var-1");
    expect(r.data.status).toBe("paid");
  });

  it("drops invalid lines (no id, qty<=0, qty>99)", () => {
    const r = manualOrderSchema.safeParse({
      items: JSON.stringify([
        { productId: "", qty: 3 },
        { productId: "prd-1", qty: 0 },
        { productId: "prd-2", qty: 250 },
        { productId: "prd-3", qty: 4 },
      ]),
      customerName: "Test",
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.lines).toEqual([
      { productId: "prd-3", variantId: undefined, qty: 4 },
    ]);
  });

  it("fails when no valid line remains", () => {
    const r = manualOrderSchema.safeParse({
      items: JSON.stringify([{ productId: "", qty: 1 }]),
      customerName: "Test",
    });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.error.issues.some((i) => i.path[0] === "items")).toBe(true);
  });

  it("requires a customer name of at least 2 chars", () => {
    const r = manualOrderSchema.safeParse({
      items: JSON.stringify([{ productId: "prd-1", qty: 1 }]),
      customerName: "A",
    });
    expect(r.success).toBe(false);
  });

  it("rejects a malformed e-mail but allows an empty one", () => {
    const base = {
      items: JSON.stringify([{ productId: "prd-1", qty: 1 }]),
      customerName: "Valid Name",
    };
    expect(
      manualOrderSchema.safeParse({ ...base, customerEmail: "not-an-email" })
        .success,
    ).toBe(false);
    expect(
      manualOrderSchema.safeParse({ ...base, customerEmail: "" }).success,
    ).toBe(true);
  });

  it("tolerates malformed items JSON (treats as empty → fails refine)", () => {
    const r = manualOrderSchema.safeParse({
      items: "{not json",
      customerName: "Valid Name",
    });
    expect(r.success).toBe(false);
  });
});
