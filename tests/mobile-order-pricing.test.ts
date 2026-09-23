import { describe, expect, it } from "vitest";

import type { CustomerAddress } from "@/lib/customer/store";

import {
  formatInlineAddress,
  formatSavedAddress,
  resolveOrderAddress,
} from "@/lib/mobile/order-address";
import { DEFAULT_MOBILE_APP_CONFIG } from "@/lib/mobile/app-config";
import {
  computeTotalsWithShipping,
  FULFILLMENT_UNAVAILABLE_MESSAGE,
  fulfillmentAllowed,
  normalizeScheduledFor,
  orderingRefusal,
  priceCafeLine,
  shippingModeFor,
  type CafePriceable,
  type OrderingRules,
} from "@/lib/mobile/order-pricing";

const cappuccino: CafePriceable = {
  id: "mnu-0007",
  name: "Cappuccino",
  priceMinor: 19500,
  priceMinorL: 21000,
  isActive: true,
};

const affogato: CafePriceable = {
  id: "mnu-0001",
  name: "Affogato Classico",
  priceMinor: 22000,
  priceMinorL: 0,
  isActive: true,
};

const CFG = {
  shippingFlatMinor: 4900,
  shippingFreeThresholdMinor: 50000,
  taxRatePct: 20,
};

describe("priceCafeLine", () => {
  it("prices M from the menu row plus the option surcharges", () => {
    const r = priceCafeLine(cappuccino, "M", {
      milk: "oat",
      syrup: "hazelnut",
      extraShot: true,
      sugar: 1,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // 195,00 + yulaf 25,00 + fındık 50,00 + shot 50,00
    expect(r.unitPriceMinor).toBe(32000);
    expect(r.size).toBe("M");
    expect(r.detail).toBe("M · yulaf · fındık şurubu · 1 şeker · +1 shot");
    expect(r.options).toEqual({
      milk: "oat",
      roast: "intense",
      sugar: 1,
      syrup: "hazelnut",
      extraShot: true,
      note: "",
    });
  });

  it("uses priceMinorL for L", () => {
    const r = priceCafeLine(cappuccino, "L", {});
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.unitPriceMinor).toBe(21000);
    expect(r.detail).toBe("L");
  });

  it("refuses L on a single-size item (contract: 400)", () => {
    const r = priceCafeLine(affogato, "L", {});
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("no_large_size");
    expect(r.message).toContain("Affogato Classico");
  });

  it("normalises a single-size item ordered as M to 'single'", () => {
    const r = priceCafeLine(affogato, "M", {});
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.size).toBe("single");
    expect(r.unitPriceMinor).toBe(22000);
    expect(r.detail).toBe("");
  });

  it("refuses 'single' on a two-size item rather than guessing a size", () => {
    const r = priceCafeLine(cappuccino, "single", {});
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("bad_size");
  });

  it("refuses an inactive item and an unknown option id", () => {
    const off = priceCafeLine({ ...cappuccino, isActive: false }, "M", {});
    expect(off.ok).toBe(false);
    if (!off.ok) expect(off.reason).toBe("inactive");

    const bad = priceCafeLine(cappuccino, "M", {
      milk: "soy" as unknown as "oat",
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.reason).toBe("bad_option");
  });

  it("never trusts a price from the caller - only the row and the table count", () => {
    const r = priceCafeLine({ ...cappuccino, priceMinor: 100 }, "M", {
      unitPriceMinor: 1,
    } as unknown as Record<string, never>);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.unitPriceMinor).toBe(100);
  });
});

describe("fulfillment and shipping", () => {
  it("allows pickup/delivery only for cafe and shipping only for shop", () => {
    expect(fulfillmentAllowed("cafe", "pickup")).toBe(true);
    expect(fulfillmentAllowed("cafe", "delivery")).toBe(true);
    expect(fulfillmentAllowed("cafe", "shipping")).toBe(false);
    expect(fulfillmentAllowed("shop", "shipping")).toBe(true);
    expect(fulfillmentAllowed("shop", "pickup")).toBe(false);
    expect(fulfillmentAllowed("shop", "delivery")).toBe(false);
  });

  describe("operator ordering switches (mobileApp.ordering)", () => {
    const open: OrderingRules = { ...DEFAULT_MOBILE_APP_CONFIG.ordering };

    it("lets everything through with the defaults", () => {
      expect(orderingRefusal("cafe", "pickup", open)).toBeNull();
      expect(orderingRefusal("cafe", "delivery", open)).toBeNull();
      expect(orderingRefusal("shop", "shipping", open)).toBeNull();
      expect(fulfillmentAllowed("cafe", "delivery", open)).toBe(true);
    });

    it("cafe disabled → 409 ordering_closed with the operator's copy", () => {
      const rules = {
        ...open,
        cafeEnabled: false,
        closedMessage: "Bugün kapalıyız.",
      };
      for (const f of ["pickup", "delivery"] as const) {
        expect(orderingRefusal("cafe", f, rules)).toEqual({
          status: 409,
          code: "ordering_closed",
          message: "Bugün kapalıyız.",
        });
        expect(fulfillmentAllowed("cafe", f, rules)).toBe(false);
      }
      // The shop has its own switch (isShopOpen); this one does not touch it.
      expect(orderingRefusal("shop", "shipping", rules)).toBeNull();
      expect(fulfillmentAllowed("shop", "shipping", rules)).toBe(true);
    });

    it("delivery disabled → 400 fulfillment_unavailable, pickup still fine", () => {
      const rules = { ...open, deliveryEnabled: false };
      expect(orderingRefusal("cafe", "delivery", rules)).toEqual({
        status: 400,
        code: "fulfillment_unavailable",
        message: FULFILLMENT_UNAVAILABLE_MESSAGE,
      });
      expect(fulfillmentAllowed("cafe", "delivery", rules)).toBe(false);
      expect(orderingRefusal("cafe", "pickup", rules)).toBeNull();
      expect(fulfillmentAllowed("cafe", "pickup", rules)).toBe(true);
    });

    it("pickup disabled → 400 fulfillment_unavailable, delivery still fine", () => {
      const rules = { ...open, pickupEnabled: false };
      expect(orderingRefusal("cafe", "pickup", rules)?.code).toBe(
        "fulfillment_unavailable",
      );
      expect(orderingRefusal("cafe", "delivery", rules)).toBeNull();
    });

    it("both fulfillments off is a closed cafe, not a wrong choice", () => {
      const rules = { ...open, deliveryEnabled: false, pickupEnabled: false };
      expect(orderingRefusal("cafe", "pickup", rules)?.code).toBe(
        "ordering_closed",
      );
      expect(orderingRefusal("cafe", "delivery", rules)?.status).toBe(409);
    });

    it("the shape rule still wins over the switches", () => {
      // A shop basket on a courier is a bad request whatever the switches say.
      expect(fulfillmentAllowed("shop", "delivery", open)).toBe(false);
      expect(fulfillmentAllowed("cafe", "shipping", open)).toBe(false);
    });
  });

  it("charges nothing for pickup, the courier fee for delivery, settings for shipping", () => {
    const settings = { courierFeeMinor: 5500 };
    expect(shippingModeFor("pickup", settings)).toEqual({
      mode: "fixed",
      minor: 0,
    });
    expect(shippingModeFor("delivery", settings)).toEqual({
      mode: "fixed",
      minor: 5500,
    });
    expect(shippingModeFor("shipping", settings)).toEqual({ mode: "settings" });
    expect(shippingModeFor("delivery", { courierFeeMinor: -1 })).toEqual({
      mode: "fixed",
      minor: 0,
    });
  });

  it("applies a fixed courier fee regardless of the free-shipping threshold", () => {
    const delivery = computeTotalsWithShipping(
      83500,
      0,
      { mode: "fixed", minor: 5500 },
      CFG,
    );
    expect(delivery.shippingMinor).toBe(5500);
    expect(delivery.totalMinor).toBe(89000);

    const pickup = computeTotalsWithShipping(
      83500,
      0,
      { mode: "fixed", minor: 0 },
      CFG,
    );
    expect(pickup.shippingMinor).toBe(0);
    expect(pickup.totalMinor).toBe(83500);
  });

  it("keeps the web checkout arithmetic for shipping mode", () => {
    const under = computeTotalsWithShipping(
      32000,
      0,
      { mode: "settings" },
      CFG,
    );
    expect(under.shippingMinor).toBe(4900);
    expect(under.totalMinor).toBe(36900);

    const over = computeTotalsWithShipping(60000, 0, { mode: "settings" }, CFG);
    expect(over.shippingMinor).toBe(0);
    expect(over.totalMinor).toBe(60000);
  });

  it("clamps the discount to the subtotal, so a free drink can bring the total to zero", () => {
    const t = computeTotalsWithShipping(
      19500,
      28000,
      { mode: "fixed", minor: 0 },
      CFG,
    );
    expect(t.discountMinor).toBe(19500);
    expect(t.totalMinor).toBe(0);
  });
});

describe("normalizeScheduledFor", () => {
  const now = new Date("2026-08-30T12:00:00.000Z");

  it("treats empty as 'as soon as possible'", () => {
    expect(normalizeScheduledFor(null, now)).toEqual({ ok: true, value: "" });
    expect(normalizeScheduledFor("", now)).toEqual({ ok: true, value: "" });
  });

  it("accepts a near-future instant and normalises it to ISO", () => {
    const r = normalizeScheduledFor("2026-08-30T17:00:00+03:00", now);
    expect(r).toEqual({ ok: true, value: "2026-08-30T14:00:00.000Z" });
  });

  it("refuses the past beyond tolerance and more than a week ahead", () => {
    expect(normalizeScheduledFor("2026-08-30T11:00:00Z", now).ok).toBe(false);
    expect(normalizeScheduledFor("2026-08-30T11:58:00Z", now).ok).toBe(true);
    expect(normalizeScheduledFor("2026-09-10T12:00:00Z", now).ok).toBe(false);
    expect(normalizeScheduledFor("not a date", now).ok).toBe(false);
  });
});

describe("order address", () => {
  const saved: CustomerAddress = {
    id: "adr-1",
    label: "Evim",
    recipientName: "Eda Mancuso",
    phone: "+90 532 000 00 00",
    line1: "Postane Mah., Atatürk Cad. No: 28",
    line2: "Kapı kodu 4821",
    district: "Tuzla",
    city: "İstanbul",
    zip: "34940",
    isDefault: true,
  };

  it("formats a saved address as the block the panel and courier read", () => {
    const r = formatSavedAddress(saved);
    expect(r.text).toBe(
      "Evim - Eda Mancuso, +90 532 000 00 00\nPostane Mah., Atatürk Cad. No: 28\nTuzla / İstanbul 34940",
    );
    expect(r.note).toBe("Kapı kodu 4821");
    expect(r.phone).toBe("+90 532 000 00 00");
  });

  it("formats an inline address, folding the neighbourhood into the street", () => {
    const r = formatInlineAddress({
      title: "İş",
      fullName: "Selin K.",
      phone: "+90 533 111 22 33",
      city: "İstanbul",
      district: "Tuzla",
      neighbourhood: "Postane Mah.",
      line: "Atatürk Cad. No: 28",
      note: "",
    });
    expect(r.text).toBe(
      "İş - Selin K., +90 533 111 22 33\nPostane Mah., Atatürk Cad. No: 28\nTuzla / İstanbul",
    );
    expect(r.note).toBe("");
  });

  it("resolves { id } only against the member's own book", () => {
    const ok = resolveOrderAddress([saved], { id: "adr-1" });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.address?.text).toContain("Evim - Eda Mancuso");

    const missing = resolveOrderAddress([saved], { id: "adr-999" });
    expect(missing.ok).toBe(false);

    expect(resolveOrderAddress([saved], null)).toEqual({
      ok: true,
      address: null,
    });
  });
});
