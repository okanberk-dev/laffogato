import { describe, expect, it } from "vitest";

import {
  CUSTOMIZATION,
  customizationFor,
  DEFAULT_OPTION_PRICES,
  OPTION_MENU_ITEM_IDS,
  OPTION_MENU_ITEMS,
  optionPricesFromMenu,
  resolveOptionPricing,
} from "@/lib/mobile/customization";
import { priceCafeLine } from "@/lib/mobile/order-pricing";

// S8 (lafmaliyet docs/planlar/senkron.md): ekstra shot, şurup ve alternatif
// süt ücreti sitedeki kalemlerinin fiyatından (mnu-0081, mnu-0080,
// mnu-0082), kod sabitinden değil. Alternatif süt şimdilik istisna: sahip
// karar verene dek (menüde 50, seçenekte 25) sabitten gelir.

const menuRow = (id: string, priceMinor: number, priceMinorL = 0) => ({
  id,
  priceMinor,
  priceMinorL,
});

describe("optionPricesFromMenu", () => {
  it("üç kalemin fiyatı seçenek fiyatıdır", () => {
    expect(OPTION_MENU_ITEMS).toEqual({
      syrup: "mnu-0080",
      extraShot: "mnu-0081",
      altMilk: "mnu-0082",
    });
    expect(OPTION_MENU_ITEM_IDS).toEqual(["mnu-0080", "mnu-0081", "mnu-0082"]);
    expect(
      optionPricesFromMenu([
        menuRow("mnu-0011", 13000),
        menuRow("mnu-0080", 6000),
        menuRow("mnu-0081", 5500),
        menuRow("mnu-0082", 3000),
      ]),
    ).toEqual({ syrupMinor: 6000, extraShotMinor: 5500, altMilkMinor: 2500 });
  });

  it("şurup ve ekstra shot menüden okunur", () => {
    const prices = optionPricesFromMenu([
      menuRow("mnu-0080", 6000),
      menuRow("mnu-0081", 5500),
    ]);
    expect(prices.syrupMinor).toBe(6000);
    expect(prices.extraShotMinor).toBe(5500);
  });

  it("alternatif süt sahip karar verene dek sabitten gelir (menüde 50, seçenekte 25)", () => {
    // Canlıdaki durum: "Alternatif Süt" 50 TL, uygulamada badem 25 TL.
    const prices = optionPricesFromMenu([menuRow("mnu-0082", 5000)]);
    expect(prices.altMilkMinor).toBe(2500);
    expect(prices.altMilkMinor).toBe(DEFAULT_OPTION_PRICES.altMilkMinor);
    const almond = customizationFor(prices).milks.find(
      (m) => m.id === "almond",
    );
    expect(almond?.priceMinor).toBe(2500);
    expect(
      resolveOptionPricing({ milk: "almond" }, "M", prices).extraMinor,
    ).toBe(2500);
  });

  it("Satışta bilgisi okunmaz: kasada tükenen şurup yine aynı fiyattır", () => {
    expect(
      optionPricesFromMenu([
        { ...menuRow("mnu-0081", 5500), isActive: false } as never,
      ]).extraShotMinor,
    ).toBe(5500);
  });

  it("kalem yoksa, iki boyluysa ya da fiyatı bozuksa her seçenek kendi başına sabite düşer", () => {
    expect(optionPricesFromMenu([])).toEqual(DEFAULT_OPTION_PRICES);
    expect(DEFAULT_OPTION_PRICES).toEqual({
      syrupMinor: 5000,
      extraShotMinor: 5000,
      altMilkMinor: 2500,
    });
    const prices = optionPricesFromMenu([
      menuRow("mnu-0080", 6000, 7000), // iki boy
      menuRow("mnu-0081", 0), // sıfır
      menuRow("mnu-0082", 12.5), // kuruş tam değil
    ]);
    expect(prices).toEqual(DEFAULT_OPTION_PRICES);
    expect(
      optionPricesFromMenu([menuRow("mnu-0081", 100_000_001)]).extraShotMinor,
    ).toBe(5000);
    expect(optionPricesFromMenu([menuRow("mnu-0081", 5500)]).syrupMinor).toBe(
      5000,
    );
  });
});

describe("customizationFor", () => {
  const table = customizationFor({
    syrupMinor: 6000,
    extraShotMinor: 5500,
    altMilkMinor: 3000,
  });

  it("biçim ve kimlikler aynı; yalnız ücretli seçeneklerin fiyatı menüden", () => {
    expect(table.milks.map((m) => m.id)).toEqual(
      CUSTOMIZATION.milks.map((m) => m.id),
    );
    expect(table.syrups.map((s) => s.id)).toEqual(
      CUSTOMIZATION.syrups.map((s) => s.id),
    );
    expect(table.extraShotMinor).toBe(5500);
    expect(table.sugarMax).toBe(CUSTOMIZATION.sugarMax);
    expect(table.roasts).toEqual(CUSTOMIZATION.roasts);
  });

  it("laktozsuz ve normal süt, şurup yok 0 kalır; badem alternatif sütün fiyatını alır", () => {
    const milk = Object.fromEntries(table.milks.map((m) => [m.id, m]));
    expect(milk.normal.priceMinor).toBe(0);
    expect(milk["lactose-free"].priceMinor).toBe(0);
    expect(milk.almond.priceMinor).toBe(3000);
    expect(milk.almond.allergens).toEqual(["nuts"]);
    const syrup = Object.fromEntries(table.syrups.map((s) => [s.id, s]));
    expect(syrup.none.priceMinor).toBe(0);
    expect(syrup.vanilla.priceMinor).toBe(6000);
    expect(syrup.hazelnut.priceMinor).toBe(6000);
    expect(syrup.hazelnut.allergens).toEqual(["nuts"]);
  });

  it("sabit değişmez (başka bir okuma onu ezmesin)", () => {
    expect(CUSTOMIZATION.extraShotMinor).toBe(5000);
    expect(CUSTOMIZATION.milks.find((m) => m.id === "almond")?.priceMinor).toBe(
      2500,
    );
  });

  it("sabitin fiyatlarıyla sabitin kendisidir", () => {
    expect(customizationFor(DEFAULT_OPTION_PRICES)).toEqual(CUSTOMIZATION);
  });
});

describe("sipariş fiyatı menünün seçenek fiyatıyla", () => {
  const prices = { syrupMinor: 6000, extraShotMinor: 5500, altMilkMinor: 3000 };

  it("resolveOptionPricing", () => {
    expect(
      resolveOptionPricing(
        { milk: "almond", syrup: "caramel", extraShot: true },
        "M",
        prices,
      ).extraMinor,
    ).toBe(3000 + 6000 + 5500);
    expect(
      resolveOptionPricing({ milk: "lactose-free" }, "M", prices).extraMinor,
    ).toBe(0);
    // Varsayılan: sabit (eski çağrılar aynı kalır).
    expect(
      resolveOptionPricing({ extraShot: true, milk: "almond" }, "M").extraMinor,
    ).toBe(5000 + 2500);
  });

  it("priceCafeLine: Lafmaliyet'te 55 TL yapılan shot uygulamada da 55 TL", () => {
    const latte = {
      id: "mnu-0011",
      name: "Latte",
      priceMinor: 13000,
      priceMinorL: 15000,
      isActive: true,
      categoryKey: "espresso",
    };
    const priced = priceCafeLine(latte, "L", { extraShot: true }, prices);
    expect(priced).toMatchObject({ ok: true, unitPriceMinor: 15000 + 5500 });
  });
});
