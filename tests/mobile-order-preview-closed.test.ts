import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_MOBILE_APP_CONFIG } from "@/lib/mobile/app-config";
import { previewOrderBodySchema } from "@/lib/mobile/order-schema";

/**
 * W1-03: `POST /orders/preview` priced a shop basket while "Online mağaza
 * açık" was off, and only `POST /orders` refused it (409 `shop_closed`). The
 * app shows a 4xx preview's own message in place of the total
 * (lafmobil src/app/sepet.tsx, src/components/checkout/use-checkout-order.ts
 * `previewRejection`), so the preview now answers with the same refusal.
 */
const settings = vi.hoisted(() => ({ isShopOpen: false }));
const previewAppOrderLines = vi.fn(async () => ({
  ok: true as const,
  kind: "shop" as const,
  items: [{ productName: "Çekirdek", qty: 1, unitPriceMinor: 45000 }],
}));

vi.mock("@/lib/admin/store", () => ({
  PENDING_ORDER_TTL_MINUTES: 45,
  getSettings: vi.fn(async () => ({
    mobileApp: DEFAULT_MOBILE_APP_CONFIG,
    isShopOpen: settings.isShopOpen,
    courierFeeMinor: 5500,
    shippingFlatMinor: 4900,
    shippingFreeThresholdMinor: 75000,
    taxRatePct: 10,
  })),
  previewAppOrderLines,
}));
vi.mock("@/lib/payment", () => ({ getPaymentProvider: vi.fn() }));
vi.mock("@/lib/email/send", () => ({}));
vi.mock("@/lib/customer/store", () => ({}));
vi.mock("@/lib/customer/coupons", () => ({}));
vi.mock("@/lib/admin/rate-limit", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/mobile/loyalty", () => ({}));
vi.mock("@/lib/db", () => ({ getDb: vi.fn(), TABLES: {} }));
vi.mock("@/lib/legal/store", () => ({}));

const { previewAppOrder, failureFromResult } =
  await import("@/lib/mobile/orders");

const shopBasket = previewOrderBodySchema.parse({
  kind: "shop",
  fulfillment: "shipping",
  lines: [{ productId: "prd-0001", qty: 1 }],
  address: null,
  scheduledFor: null,
  promoCode: "",
  note: "",
});

beforeEach(() => {
  previewAppOrderLines.mockClear();
});

describe("POST /orders/preview with the shop closed", () => {
  it("answers the order endpoint's own 409 shop_closed and prices nothing", async () => {
    settings.isShopOpen = false;
    const res = await previewAppOrder(shopBasket, null);
    expect(res).toEqual({
      ok: false,
      failure: failureFromResult({ ok: false, reason: "shop_closed" }),
    });
    expect(res.ok === false && res.failure).toMatchObject({
      status: 409,
      code: "shop_closed",
    });
    expect(previewAppOrderLines).not.toHaveBeenCalled();
  });

  it("still prices the basket while the shop is open", async () => {
    settings.isShopOpen = true;
    const res = await previewAppOrder(shopBasket, null);
    expect(res.ok).toBe(true);
    expect(previewAppOrderLines).toHaveBeenCalledTimes(1);
  });
});
