import { describe, expect, it } from "vitest";

import {
  CUSTOMIZATION,
  OPTION_GROUPS,
  lineOptionsSchema,
  optionGroupsFor,
  orderItemSizeSchema,
  resolveOptionPricing,
  UnknownOptionError,
} from "@/lib/mobile/customization";

describe("CUSTOMIZATION constant (docs/API-MOBILE.md §1)", () => {
  it("matches the contract's ids, labels and prices", () => {
    expect(CUSTOMIZATION.milks).toEqual([
      { id: "normal", label: "Normal", priceMinor: 0, allergens: [] },
      { id: "lactose-free", label: "Laktozsuz", priceMinor: 0, allergens: [] },
      { id: "almond", label: "Badem", priceMinor: 2500, allergens: ["nuts"] },
    ]);
    expect(CUSTOMIZATION.roasts).toEqual([
      { id: "intense", label: "Yoğun" },
      { id: "light", label: "Hafif" },
    ]);
    expect(CUSTOMIZATION.syrups.map((s) => s.id)).toEqual([
      "none",
      "vanilla",
      "caramel",
      "hazelnut",
    ]);
    expect(CUSTOMIZATION.extraShotMinor).toBe(5000);
    expect(CUSTOMIZATION.sugarMax).toBe(3);
  });

  it("flags the hazelnut syrup as a nut allergen and nothing else", () => {
    for (const s of CUSTOMIZATION.syrups) {
      expect(s.allergens).toEqual(s.id === "hazelnut" ? ["nuts"] : []);
    }
  });

  it("flags the almond milk as a nut allergen and no other milk", () => {
    // A tree nut, like the hazelnut syrup - and until 23 Sep 2026 the only
    // nut on the options that drew no warning at all.
    for (const m of CUSTOMIZATION.milks) {
      expect(m.allergens).toEqual(m.id === "almond" ? ["nuts"] : []);
    }
  });

  it("surfaces the almond milk's nut allergen on its own, and once with the hazelnut syrup", () => {
    expect(resolveOptionPricing({ milk: "almond" }).allergens).toEqual(["nuts"]);
    expect(
      resolveOptionPricing({ milk: "almond", syrup: "hazelnut" }).allergens,
    ).toEqual(["nuts"]);
    expect(resolveOptionPricing({ milk: "lactose-free" }).allergens).toEqual([]);
  });

  it("no longer offers or prices the oat milk (operator, 5 Kas 2026)", () => {
    // Three milks: normal, lactose-free, almond. "oat" stays a known id for
    // the orders that carry it, but a new line asking for it is refused.
    expect(CUSTOMIZATION.milks.map((m) => m.id)).toEqual([
      "normal",
      "lactose-free",
      "almond",
    ]);
    expect(() => resolveOptionPricing({ milk: "oat" })).toThrow(
      UnknownOptionError,
    );
  });

  it("uses integer minor units everywhere", () => {
    const prices = [
      ...CUSTOMIZATION.milks.map((m) => m.priceMinor),
      ...CUSTOMIZATION.syrups.map((s) => s.priceMinor),
      CUSTOMIZATION.extraShotMinor,
    ];
    for (const p of prices) expect(Number.isInteger(p)).toBe(true);
  });
});

describe("resolveOptionPricing", () => {
  it("prices the contract example: M · badem · +1 shot", () => {
    const r = resolveOptionPricing(
      {
        milk: "almond",
        roast: "intense",
        sugar: 0,
        syrup: "none",
        extraShot: true,
        note: "",
      },
      "M",
    );
    expect(r.detail).toBe("M · badem · +1 shot");
    expect(r.extraMinor).toBe(2500 + 5000);
    expect(r.allergens).toEqual(["nuts"]);
  });

  it("is free and silent for a plain drink", () => {
    expect(resolveOptionPricing({}, "M")).toEqual({
      detail: "M",
      extraMinor: 0,
      allergens: [],
    });
    expect(resolveOptionPricing(undefined).detail).toBe("");
    expect(resolveOptionPricing(null, "single").extraMinor).toBe(0);
  });

  it("adds every surcharge and surfaces the nut allergen", () => {
    const r = resolveOptionPricing(
      { milk: "almond", syrup: "hazelnut", extraShot: true, sugar: 2 },
      "L",
    );
    expect(r.extraMinor).toBe(2500 + 5000 + 5000);
    expect(r.allergens).toEqual(["nuts"]);
    expect(r.detail).toBe("L · badem · fındık şurubu · 2 şeker · +1 shot");
  });

  it("names a light roast and a lactose-free milk without charging", () => {
    const r = resolveOptionPricing({ milk: "lactose-free", roast: "light" });
    expect(r.detail).toBe("laktozsuz · hafif");
    expect(r.extraMinor).toBe(0);
  });

  it("clamps sugar to the table maximum and ignores garbage", () => {
    expect(resolveOptionPricing({ sugar: 9 }).detail).toBe("3 şeker");
    expect(resolveOptionPricing({ sugar: -2 }).detail).toBe("");
    expect(
      resolveOptionPricing({ sugar: Number.NaN as unknown as number }).detail,
    ).toBe("");
  });

  it("never prices an id outside the table", () => {
    expect(() =>
      resolveOptionPricing({ milk: "soy" as unknown as "oat" }),
    ).toThrow(UnknownOptionError);
    expect(() =>
      resolveOptionPricing({ syrup: "pistachio" as unknown as "none" }),
    ).toThrow(/Bilinmeyen seçenek/);
  });

  it("does not put the note in the detail", () => {
    expect(resolveOptionPricing({ note: "az köpük" }, "M").detail).toBe("M");
  });
});

describe("lineOptionsSchema", () => {
  it("defaults every field so `{}` is a plain drink", () => {
    expect(lineOptionsSchema.parse({})).toEqual({
      milk: "normal",
      roast: "intense",
      sugar: 0,
      syrup: "none",
      extraShot: false,
      note: "",
    });
  });

  it("rejects unknown ids, out-of-range sugar and long notes in Turkish", () => {
    const bad = lineOptionsSchema.safeParse({ milk: "soy" });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.error.issues[0]?.message).toBe("Geçersiz süt seçimi.");
    }
    expect(lineOptionsSchema.safeParse({ sugar: 4 }).success).toBe(false);
    expect(lineOptionsSchema.safeParse({ sugar: 1.5 }).success).toBe(false);
    expect(lineOptionsSchema.safeParse({ note: "x".repeat(201) }).success).toBe(
      false,
    );
  });

  it("trims the note", () => {
    expect(lineOptionsSchema.parse({ note: "  az köpük " }).note).toBe(
      "az köpük",
    );
  });
});

describe("orderItemSizeSchema", () => {
  it("accepts only M, L and single", () => {
    expect(orderItemSizeSchema.parse("M")).toBe("M");
    expect(orderItemSizeSchema.parse("single")).toBe("single");
    expect(orderItemSizeSchema.safeParse("S").success).toBe(false);
  });
});

describe("optionGroupsFor - what a drink offers (5 Kas 2026)", () => {
  it("keeps every group on an espresso drink and none on a cold one", () => {
    expect(optionGroupsFor("espresso", "Latte")).toEqual([...OPTION_GROUPS]);
    expect(optionGroupsFor("cold", "Soda")).toEqual([]);
    expect(optionGroupsFor("smoothie", "Mango")).toEqual([]);
    expect(optionGroupsFor("frozen", "Çilek")).toEqual([]);
  });

  it("narrows the cup where the category is wider", () => {
    expect(optionGroupsFor("espresso", "Espresso")).toEqual([
      "roast",
      "sugar",
      "extraShot",
    ]);
    expect(optionGroupsFor("espresso", "Türk Kahvesi")).toEqual(["sugar"]);
    expect(optionGroupsFor("hot", "Çay")).toEqual(["sugar"]);
    expect(optionGroupsFor("hot", "Salep")).toEqual(["milk", "sugar"]);
    expect(optionGroupsFor("matcha", "Matcha Latte")).toEqual([
      "milk",
      "sugar",
      "syrup",
    ]);
  });

  it("offers nothing on a dessert and everything in a category it does not know", () => {
    expect(optionGroupsFor("dessert", "Tiramisu")).toEqual([]);
    expect(optionGroupsFor("yeni-kategori", "Yeni İçecek")).toEqual([
      ...OPTION_GROUPS,
    ]);
  });
});
