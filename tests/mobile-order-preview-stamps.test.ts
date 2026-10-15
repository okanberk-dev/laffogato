import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_MOBILE_APP_CONFIG } from "@/lib/mobile/app-config";
import { previewOrderBodySchema } from "@/lib/mobile/order-schema";

/**
 * `POST /orders/preview` promises the stamps the paid order will write
 * (`onOrderPaid`): none under ₺140 of goods, then one per started ₺320, the
 * courier fee not counted (operator, 15 Eki 2026). It used to say 1 for any
 * cafe basket at or over ₺140.
 */
const basket = vi.hoisted(() => ({ unitPriceMinor: 0 }));
const previewAppOrderLines = vi.fn(async () => ({
  ok: true as const,
  kind: "cafe" as const,
  items: [
    { productName: "Latte", qty: 1, unitPriceMinor: basket.unitPriceMinor },
  ],
}));

vi.mock("@/lib/admin/store", () => ({
  PENDING_ORDER_TTL_MINUTES: 45,
  getSettings: vi.fn(async () => ({
    mobileApp: DEFAULT_MOBILE_APP_CONFIG,
    isShopOpen: true,
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

const { previewAppOrder } = await import("@/lib/mobile/orders");

function cafeBody(fulfillment: "pickup" | "delivery") {
  return previewOrderBodySchema.parse({
    kind: "cafe",
    fulfillment,
    lines: [{ menuItemId: "mnu-0001", qty: 1, size: "M" }],
    address: null,
    scheduledFor: null,
    promoCode: "",
    note: "",
  });
}

async function stampsToEarn(
  goodsMinor: number,
  fulfillment: "pickup" | "delivery" = "pickup",
): Promise<number> {
  basket.unitPriceMinor = goodsMinor;
  const res = await previewAppOrder(cafeBody(fulfillment), null);
  if (!res.ok) throw new Error(`preview refused: ${res.failure.code}`);
  return res.preview.stampsToEarn;
}

beforeEach(() => {
  previewAppOrderLines.mockClear();
});

describe("POST /orders/preview stampsToEarn", () => {
  it("follows the ₺320 step from ₺140", async () => {
    expect(await stampsToEarn(13999)).toBe(0);
    expect(await stampsToEarn(14000)).toBe(1);
    expect(await stampsToEarn(32000)).toBe(1);
    expect(await stampsToEarn(32001)).toBe(2);
    expect(await stampsToEarn(64000)).toBe(2);
    expect(await stampsToEarn(64001)).toBe(3);
  });

  it("does not count the courier fee", async () => {
    // ₺320 of goods + ₺55 courier: one stamp, as the paid order will write.
    expect(await stampsToEarn(32000, "delivery")).toBe(1);
    // ₺100 of goods + ₺55 courier: under the minimum.
    expect(await stampsToEarn(10000, "delivery")).toBe(0);
  });
});
