import { describe, expect, it } from "vitest";

import {
  firstIssueMessage,
  isCafeLine,
  placeOrderBodySchema,
  previewOrderBodySchema,
  promoPreviewBodySchema,
} from "@/lib/mobile/order-schema";

const cafeLine = {
  menuItemId: "mnu-0007",
  qty: 1,
  size: "M",
  options: {
    milk: "oat",
    roast: "intense",
    sugar: 0,
    syrup: "none",
    extraShot: true,
    note: "",
  },
};

const shopLine = {
  productId: "prd-0001",
  variantId: "var-250",
  qty: 2,
  note: "Öğütüm: Espresso",
};

const inlineAddress = {
  title: "Evim",
  fullName: "Eda Mancuso",
  phone: "+90 532 000 00 00",
  city: "İstanbul",
  district: "Tuzla",
  neighbourhood: "Postane Mah.",
  line: "Atatürk Cad. No: 28",
  note: "Kapı kodu 4821",
};

function cafeDelivery(overrides: Record<string, unknown> = {}) {
  return {
    kind: "cafe",
    fulfillment: "delivery",
    lines: [cafeLine],
    address: inlineAddress,
    scheduledFor: null,
    promoCode: "",
    note: "",
    legalConsent: true,
    ...overrides,
  };
}

describe("placeOrderBodySchema", () => {
  it("accepts a cafe delivery order with an inline address", () => {
    const r = placeOrderBodySchema.safeParse(cafeDelivery());
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.kind).toBe("cafe");
    expect(r.data.lines).toHaveLength(1);
    const line = r.data.lines[0];
    expect(isCafeLine(line)).toBe(true);
    if (!isCafeLine(line)) return;
    expect(line.options.milk).toBe("oat");
    expect(line.options.extraShot).toBe(true);
    expect(r.data.address).toMatchObject({ title: "Evim", city: "İstanbul" });
    expect(r.data.legalConsent).toBe(true);
  });

  it("accepts a pickup with no address and a saved-address reference", () => {
    const pickup = placeOrderBodySchema.safeParse(
      cafeDelivery({ fulfillment: "pickup", address: null }),
    );
    expect(pickup.success).toBe(true);
    if (pickup.success) expect(pickup.data.address).toBeNull();

    const saved = placeOrderBodySchema.safeParse(
      cafeDelivery({ address: { id: "adr-1" } }),
    );
    expect(saved.success).toBe(true);
    if (saved.success) expect(saved.data.address).toEqual({ id: "adr-1" });
  });

  it("defaults every option when the app sends none", () => {
    const r = placeOrderBodySchema.safeParse(
      cafeDelivery({
        fulfillment: "pickup",
        address: null,
        lines: [{ menuItemId: "mnu-0001", qty: 1, size: "single" }],
      }),
    );
    expect(r.success).toBe(true);
    if (!r.success) return;
    const line = r.data.lines[0];
    if (!isCafeLine(line)) throw new Error("expected a cafe line");
    expect(line.options).toEqual({
      milk: "normal",
      roast: "intense",
      sugar: 0,
      syrup: "none",
      extraShot: false,
      note: "",
    });
  });

  it("refuses an unticked consent box with a Turkish message", () => {
    const r = placeOrderBodySchema.safeParse(
      cafeDelivery({ legalConsent: false }),
    );
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(firstIssueMessage(r.error)).toContain("Mesafeli Satış");
  });

  it("refuses a basket that mixes cafe and shop lines", () => {
    const r = placeOrderBodySchema.safeParse(
      cafeDelivery({ lines: [cafeLine, shopLine] }),
    );
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(firstIssueMessage(r.error)).toBe(
      "Kafe ürünleri ile mağaza ürünleri aynı siparişte verilemez.",
    );
  });

  it("refuses a kind that disagrees with the basket", () => {
    const r = placeOrderBodySchema.safeParse(cafeDelivery({ kind: "shop" }));
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(firstIssueMessage(r.error)).toBe("Sipariş türü sepetle uyuşmuyor.");
  });

  it("ties fulfillment to kind: cafe never ships, shop never picks up", () => {
    const cafeShipping = placeOrderBodySchema.safeParse(
      cafeDelivery({ fulfillment: "shipping" }),
    );
    expect(cafeShipping.success).toBe(false);

    const shopPickup = placeOrderBodySchema.safeParse(
      cafeDelivery({ kind: "shop", fulfillment: "pickup", lines: [shopLine] }),
    );
    expect(shopPickup.success).toBe(false);

    const shopShipping = placeOrderBodySchema.safeParse(
      cafeDelivery({
        kind: "shop",
        fulfillment: "shipping",
        lines: [shopLine],
      }),
    );
    expect(shopShipping.success).toBe(true);
    if (!shopShipping.success) return;
    expect(shopShipping.data.lines[0]).toMatchObject({
      productId: "prd-0001",
      variantId: "var-250",
      qty: 2,
      note: "Öğütüm: Espresso",
    });
  });

  it("needs an address unless the order is picked up", () => {
    const r = placeOrderBodySchema.safeParse(cafeDelivery({ address: null }));
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(firstIssueMessage(r.error)).toBe("Teslimat adresi gerekli.");
  });

  it("surfaces the option error of a bad cafe line, not a union blob", () => {
    const r = placeOrderBodySchema.safeParse(
      cafeDelivery({
        lines: [{ ...cafeLine, options: { ...cafeLine.options, sugar: 9 } }],
      }),
    );
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(firstIssueMessage(r.error)).toBe("En fazla 3 şeker seçilebilir.");
    expect(r.error.issues[0].path).toEqual(["lines", 0, "options", "sugar"]);
  });

  it("bounds quantities and the number of lines", () => {
    const zero = placeOrderBodySchema.safeParse(
      cafeDelivery({ lines: [{ ...cafeLine, qty: 0 }] }),
    );
    expect(zero.success).toBe(false);

    const hundred = placeOrderBodySchema.safeParse(
      cafeDelivery({ lines: [{ ...cafeLine, qty: 100 }] }),
    );
    expect(hundred.success).toBe(false);

    const many = placeOrderBodySchema.safeParse(
      cafeDelivery({ lines: Array.from({ length: 31 }, () => cafeLine) }),
    );
    expect(many.success).toBe(false);

    const none = placeOrderBodySchema.safeParse(cafeDelivery({ lines: [] }));
    expect(none.success).toBe(false);
    if (none.success) return;
    expect(firstIssueMessage(none.error)).toBe("Sepet boş.");
  });

  it("validates scheduledFor as an ISO instant and keeps null", () => {
    const ok = placeOrderBodySchema.safeParse(
      cafeDelivery({ scheduledFor: "2026-08-30T17:00:00Z" }),
    );
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.scheduledFor).toBe("2026-08-30T17:00:00Z");

    const bad = placeOrderBodySchema.safeParse(
      cafeDelivery({ scheduledFor: "bugün 17:00" }),
    );
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(firstIssueMessage(bad.error)).toBe("Planlanan saat geçersiz.");
    }

    const omitted = placeOrderBodySchema.safeParse(
      cafeDelivery({ scheduledFor: undefined }),
    );
    expect(omitted.success).toBe(true);
    if (omitted.success) expect(omitted.data.scheduledFor).toBeNull();
  });

  it("rejects an inline address missing the recipient or the street", () => {
    const r = placeOrderBodySchema.safeParse(
      cafeDelivery({ address: { ...inlineAddress, line: "x" } }),
    );
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(firstIssueMessage(r.error)).toBe("Adres satırı zorunlu.");
    expect(r.error.issues[0].path).toEqual(["address", "line"]);
  });
});

describe("previewOrderBodySchema", () => {
  it("is the order body without the consent flag", () => {
    const { legalConsent: _consent, ...body } = cafeDelivery();
    void _consent;
    const r = previewOrderBodySchema.safeParse(body);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect("legalConsent" in r.data).toBe(false);
  });

  it("prices a basket that has no address yet — the cart screen has none", () => {
    // Shipping is derived from `fulfillment` and the settings, never from the
    // address, so demanding one here only broke the basket screen.
    const shop = previewOrderBodySchema.safeParse({
      kind: "shop",
      fulfillment: "shipping",
      lines: [shopLine],
      address: null,
      scheduledFor: null,
      promoCode: "",
      note: "",
    });
    expect(shop.success).toBe(true);

    const courier = previewOrderBodySchema.safeParse({
      kind: "cafe",
      fulfillment: "delivery",
      lines: [cafeLine],
      address: null,
      scheduledFor: null,
      promoCode: "",
      note: "",
    });
    expect(courier.success).toBe(true);
  });

  it("but placing that same order still needs somewhere to send it", () => {
    const r = placeOrderBodySchema.safeParse(
      cafeDelivery({ address: null }),
    );
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(firstIssueMessage(r.error)).toBe("Teslimat adresi gerekli.");
  });

  it("applies the same cross-field rules", () => {
    const r = previewOrderBodySchema.safeParse({
      kind: "cafe",
      fulfillment: "shipping",
      lines: [cafeLine],
      address: null,
    });
    expect(r.success).toBe(false);
  });
});

describe("promoPreviewBodySchema", () => {
  it("requires a code and a non-negative integer subtotal in minor units", () => {
    expect(
      promoPreviewBodySchema.safeParse({
        code: " hosgeldin ",
        subtotalMinor: 25000,
      }).success,
    ).toBe(true);
    expect(
      promoPreviewBodySchema.safeParse({ code: "", subtotalMinor: 25000 })
        .success,
    ).toBe(false);
    expect(
      promoPreviewBodySchema.safeParse({ code: "X", subtotalMinor: 250.5 })
        .success,
    ).toBe(false);
    expect(
      promoPreviewBodySchema.safeParse({ code: "X", subtotalMinor: -1 })
        .success,
    ).toBe(false);
  });

  it("trims the code", () => {
    const r = promoPreviewBodySchema.safeParse({
      code: " hosgeldin ",
      subtotalMinor: 0,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.code).toBe("hosgeldin");
  });
});
