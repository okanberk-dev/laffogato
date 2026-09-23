import { describe, expect, it } from "vitest";

import type { AdminOrder } from "@/lib/admin/store";

import { etaMinutesFor, toMobileOrder } from "@/lib/mobile/order-mapper";
import {
  firstIssueMessage,
  placeOrderBodySchema,
  previewOrderBodySchema,
} from "@/lib/mobile/order-schema";

const NOW = new Date("2026-09-05T09:00:00.000Z");

function order(overrides: Partial<AdminOrder> = {}): AdminOrder {
  return {
    id: "ord-0284",
    orderNo: 284,
    customerName: "Eda Mancuso",
    customerEmail: "eda@example.com",
    customerPhone: "+90 532 000 00 00",
    shippingAddress: "",
    internalNote: "",
    status: "paid",
    items: [
      {
        productName: "Cappuccino",
        qty: 1,
        unitPriceMinor: 24500,
        status: "pending",
        menuItemId: "mnu-0007",
      },
    ],
    subtotalMinor: 24500,
    discountMinor: 0,
    promoCode: "",
    shippingMinor: 0,
    totalMinor: 24500,
    refunds: [],
    createdAt: "2026-09-05T08:55:00.000Z",
    channel: "app",
    kind: "cafe",
    fulfillment: "pickup",
    ...overrides,
  };
}

describe("scheduled order ETA", () => {
  it("counts down to the time the member picked, not to 15 minutes", () => {
    // A pickup booked for tomorrow used to say "Hazır - 15 dk" the evening
    // before, with a countdown that hit zero while the house was closed.
    const scheduled = order({ scheduledFor: "2026-09-06T06:00:00.000Z" });
    expect(etaMinutesFor(scheduled, NOW)).toBe(21 * 60);
    expect(toMobileOrder(scheduled, NOW).etaAt).toBe(
      "2026-09-06T06:00:00.000Z",
    );
  });

  it("adds the courier leg's own wording to nothing - the picked time stands", () => {
    const scheduled = order({
      fulfillment: "delivery",
      scheduledFor: "2026-09-05T10:30:00.000Z",
    });
    expect(etaMinutesFor(scheduled, NOW)).toBe(90);
  });

  it("falls back to the preparation estimate once the time has passed", () => {
    const late = order({ scheduledFor: "2026-09-05T08:30:00.000Z" });
    expect(etaMinutesFor(late, NOW)).toBe(15);
  });

  it("keeps the ordinary estimate for an as-soon-as-possible basket", () => {
    expect(etaMinutesFor(order(), NOW)).toBe(15);
    expect(etaMinutesFor(order({ fulfillment: "delivery" }), NOW)).toBe(35);
    expect(etaMinutesFor(order({ status: "shipped" }), NOW)).toBe(0);
  });

  it("gives a finished or cancelled order no countdown at all", () => {
    const done = order({
      status: "completed",
      scheduledFor: "2026-09-06T06:00:00.000Z",
    });
    expect(etaMinutesFor(done, NOW)).toBeNull();
    expect(toMobileOrder(done, NOW).etaAt).toBeNull();
  });
});

const CAFE_BASKET = {
  kind: "cafe",
  fulfillment: "pickup",
  lines: [{ menuItemId: "mnu-0007", qty: 1, size: "M" }],
  legalConsent: true,
};

describe("order body contract", () => {
  it("carries the app's idempotency key through", () => {
    const parsed = placeOrderBodySchema.safeParse({
      ...CAFE_BASKET,
      clientOrderId: "5b1d0f4a-2f3e-4c1a-9b0d-2d5e6f7a8b9c",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.clientOrderId).toBe(
        "5b1d0f4a-2f3e-4c1a-9b0d-2d5e6f7a8b9c",
      );
    }
  });

  it("defaults the key to empty, so an older app build still orders", () => {
    const parsed = placeOrderBodySchema.safeParse(CAFE_BASKET);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.clientOrderId).toBe("");
  });

  it("refuses an unknown top-level field in Turkish instead of dropping it", () => {
    // `scheduleFor` for `scheduledFor` used to be silently ignored, which
    // turned every scheduled order into an as-soon-as-possible one.
    const parsed = placeOrderBodySchema.safeParse({
      ...CAFE_BASKET,
      scheduleFor: "2026-09-06T06:00:00.000Z",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const message = firstIssueMessage(parsed.error);
      expect(message).toContain("scheduleFor");
      expect(message).toContain("Bilinmeyen alan");
    }
  });

  it("refuses an unknown field inside a basket line", () => {
    const parsed = previewOrderBodySchema.safeParse({
      kind: "cafe",
      fulfillment: "pickup",
      lines: [{ menuItemId: "mnu-0007", qty: 1, size: "M", priceMinor: 1 }],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(firstIssueMessage(parsed.error)).toContain("priceMinor");
    }
  });

  it("still accepts the basket the app posts to the preview", () => {
    const parsed = previewOrderBodySchema.safeParse({
      kind: "cafe",
      fulfillment: "pickup",
      lines: [{ menuItemId: "mnu-0007", qty: 1, size: "M" }],
      address: null,
      scheduledFor: null,
      promoCode: "",
      note: "",
      clientOrderId: "",
    });
    expect(parsed.success).toBe(true);
  });
});
