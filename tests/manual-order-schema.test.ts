import { describe, it, expect } from "vitest";

import {
  manualOrderSchema,
  manualShippingMode,
} from "@/lib/admin/manual-order-schema";

describe("manualOrderSchema", () => {
  it("parses valid lines and defaults status to 'paid'", () => {
    const r = manualOrderSchema.safeParse({
      items: JSON.stringify([
        { productId: "prd-0001", qty: 2 },
        { productId: "prd-0002", variantId: "var-1", qty: 1 },
      ]),
      customerName: "Ali Veli",
      paymentMethod: "nakit",
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
      paymentMethod: "nakit",
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
      paymentMethod: "nakit",
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

  const LINE = JSON.stringify([{ productId: "prd-1", qty: 1 }]);

  it("is a Gel-al order unless told otherwise (karar D4)", () => {
    const r = manualOrderSchema.safeParse({
      items: LINE,
      customerName: "Eda",
      status: "pending_payment",
    });
    expect(r.success && r.data.fulfillment).toBe("pickup");
    for (const fulfillment of ["pickup", "delivery", "shipping"]) {
      const ok = manualOrderSchema.safeParse({
        items: LINE,
        customerName: "Eda",
        status: "pending_payment",
        fulfillment,
        shippingAddress: "Postane Mah. No: 28, Tuzla",
      });
      expect(ok.success && ok.data.fulfillment, fulfillment).toBe(fulfillment);
    }
  });

  it("refuses a table order or a made-up way, in Turkish", () => {
    const r = manualOrderSchema.safeParse({
      items: LINE,
      customerName: "Eda",
      status: "pending_payment",
      fulfillment: "table",
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]).toMatchObject({
      path: ["fulfillment"],
      message: "Teslimat şeklini seç.",
    });
  });

  it("wants an address for a courier or a parcel, not for a pickup", () => {
    for (const fulfillment of ["delivery", "shipping"]) {
      const r = manualOrderSchema.safeParse({
        items: LINE,
        customerName: "Eda",
        status: "pending_payment",
        fulfillment,
      });
      expect(r.success, fulfillment).toBe(false);
      expect(r.error?.issues.map((i) => i.path[0])).toEqual([
        "shippingAddress",
      ]);
    }
  });

  it("asks how a paid start was paid (karar D5)", () => {
    for (const status of ["paid", "preparing"]) {
      const none = manualOrderSchema.safeParse({
        items: LINE,
        customerName: "Eda",
        status,
      });
      expect(none.success, status).toBe(false);
      expect(none.error?.issues[0]).toMatchObject({
        path: ["paymentMethod"],
        message: "Ödemenin nasıl alındığını seç.",
      });
      const made = manualOrderSchema.safeParse({
        items: LINE,
        customerName: "Eda",
        status,
        paymentMethod: "bitcoin",
      });
      expect(made.success, status).toBe(false);
      const ok = manualOrderSchema.safeParse({
        items: LINE,
        customerName: "Eda",
        status,
        paymentMethod: "havale",
      });
      expect(ok.success && ok.data.paymentMethod, status).toBe("havale");
    }
  });

  it("drops the method of an unpaid start: nothing was collected", () => {
    const r = manualOrderSchema.safeParse({
      items: LINE,
      customerName: "Eda",
      status: "pending_payment",
      paymentMethod: "nakit",
    });
    expect(r.success && r.data.paymentMethod).toBeNull();
  });

  it("says every length cap in Turkish (the e-mail cap was Zod's English)", () => {
    const cases: Array<[string, number, RegExp]> = [
      ["customerEmail", 161, /E-posta en fazla 160 karakter/],
      ["customerPhone", 41, /Telefon en fazla 40 karakter/],
      ["shippingAddress", 601, /Adres en fazla 600 karakter/],
      ["internalNote", 2001, /İç not en fazla 2000 karakter/],
      ["promoCode", 41, /Promosyon kodu en fazla 40 karakter/],
    ];
    for (const [field, length, message] of cases) {
      const r = manualOrderSchema.safeParse({
        items: LINE,
        customerName: "Eda",
        status: "pending_payment",
        [field]: "a".repeat(length),
      });
      expect(r.success, field).toBe(false);
      const issue = r.error?.issues.find((i) => i.path[0] === field);
      expect(issue?.message, field).toMatch(message);
    }
  });
});

describe("manualShippingMode", () => {
  const settings = { courierFeeMinor: 5_500 };

  it("charges nothing for a pickup, the courier fee for Kurye, the shop rule for Kargo", () => {
    expect(manualShippingMode("pickup", settings)).toEqual({
      mode: "fixed",
      minor: 0,
    });
    expect(manualShippingMode("delivery", settings)).toEqual({
      mode: "fixed",
      minor: 5_500,
    });
    expect(manualShippingMode("shipping", settings)).toEqual({
      mode: "settings",
    });
  });
});
