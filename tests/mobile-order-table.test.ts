import { describe, expect, it } from "vitest";

import type { AdminOrder } from "@/lib/admin/store";

import {
  markShippedLabel,
  ORDER_FULFILLMENT_LABELS,
  orderFulfillment,
  orderTable,
  shippedStatusLabel,
} from "@/lib/admin/order-channel";
import { DEFAULT_MOBILE_APP_CONFIG } from "@/lib/mobile/app-config";
import {
  buildTimeline,
  etaMinutesFor,
  statusLabelFor,
  toMobileOrder,
} from "@/lib/mobile/order-mapper";
import {
  fulfillmentAllowed,
  orderingRefusal,
  shippingModeFor,
  type OrderingRules,
} from "@/lib/mobile/order-pricing";
import {
  placeOrderBodySchema,
  previewOrderBodySchema,
  TABLE_ORDER_MESSAGES,
} from "@/lib/mobile/order-schema";

/**
 * Table orders (docs/API-MOBILE.md §3, 15 Eki 2026): an app cafe order with
 * `fulfillment: "table"` and the code from the table's QR. The wire rules,
 * the operator switches, the price and the way the order reads back.
 */

const CAFE_LINE = { menuItemId: "mnu-0007", qty: 1, size: "M" };

function body(over: Record<string, unknown> = {}) {
  return {
    kind: "cafe",
    fulfillment: "table",
    tableCode: "ABCDEFGH23",
    lines: [CAFE_LINE],
    legalConsent: true,
    ...over,
  };
}

function firstMessage(r: {
  success: boolean;
  error?: { issues: { message: string }[] };
}) {
  return r.success ? "" : (r.error?.issues[0]?.message ?? "");
}

describe("the wire", () => {
  it("accepts a cafe basket to a table, with no address", () => {
    const r = placeOrderBodySchema.safeParse(body());
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.fulfillment).toBe("table");
      expect(r.data.tableCode).toBe("ABCDEFGH23");
      expect(r.data.address).toBeNull();
    }
  });

  it("leaves tableCode optional for every existing build", () => {
    const r = placeOrderBodySchema.safeParse(
      body({ fulfillment: "pickup", tableCode: undefined }),
    );
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.tableCode).toBe("");
  });

  it("refuses a table order with an address", () => {
    const r = placeOrderBodySchema.safeParse(
      body({ address: { id: "adr-1" } }),
    );
    expect(firstMessage(r)).toBe(TABLE_ORDER_MESSAGES.address);
  });

  it("refuses a scheduled table order", () => {
    const r = placeOrderBodySchema.safeParse(
      body({ scheduledFor: "2026-10-16T09:00:00Z" }),
    );
    expect(firstMessage(r)).toBe(TABLE_ORDER_MESSAGES.scheduled);
    // null and "" are "now", which is what a table order is.
    expect(
      placeOrderBodySchema.safeParse(body({ scheduledFor: null })).success,
    ).toBe(true);
    expect(
      placeOrderBodySchema.safeParse(body({ scheduledFor: "" })).success,
    ).toBe(true);
  });

  it("refuses a table code on any other fulfillment", () => {
    const r = placeOrderBodySchema.safeParse(
      body({ fulfillment: "pickup", tableCode: "ABCDEFGH23" }),
    );
    expect(firstMessage(r)).toBe(TABLE_ORDER_MESSAGES.codeWithoutTable);
  });

  it("refuses a table for shop goods", () => {
    const r = placeOrderBodySchema.safeParse(
      body({
        kind: "shop",
        lines: [{ productId: "prd-0001", qty: 1 }],
      }),
    );
    expect(r.success).toBe(false);
  });

  it("caps the code's length", () => {
    expect(
      placeOrderBodySchema.safeParse(body({ tableCode: "A".repeat(17) }))
        .success,
    ).toBe(false);
  });

  it("applies the same rules to the preview", () => {
    const preview = (over: Record<string, unknown> = {}) => {
      const { legalConsent: _c, ...rest } = body(over);
      void _c;
      return rest;
    };
    expect(previewOrderBodySchema.safeParse(preview()).success).toBe(true);
    expect(
      previewOrderBodySchema.safeParse(
        preview({ scheduledFor: "2026-10-16T09:00:00Z" }),
      ).success,
    ).toBe(false);
  });
});

describe("the operator's switches", () => {
  const rules = (over: Partial<OrderingRules> = {}): OrderingRules => ({
    ...DEFAULT_MOBILE_APP_CONFIG.ordering,
    ...over,
  });

  it("are not closed for tables by courier and gel-al both being off", () => {
    const r = rules({ deliveryEnabled: false, pickupEnabled: false });
    expect(orderingRefusal("cafe", "table", r)).toBeNull();
    // ...while the other two still read as closed, exactly as before.
    expect(orderingRefusal("cafe", "pickup", r)?.code).toBe("ordering_closed");
  });

  it("close tables with the master cafe switch", () => {
    const refusal = orderingRefusal(
      "cafe",
      "table",
      rules({ cafeEnabled: false }),
    );
    expect(refusal).toMatchObject({ status: 409, code: "ordering_closed" });
  });

  it("have a table switch of its own", () => {
    const refusal = orderingRefusal(
      "cafe",
      "table",
      rules({ tableEnabled: false }),
    );
    expect(refusal).toMatchObject({
      status: 400,
      code: "fulfillment_unavailable",
    });
    // Absent (an older caller) is on.
    const { tableEnabled: _t, ...legacy } = rules();
    void _t;
    expect(orderingRefusal("cafe", "table", legacy)).toBeNull();
  });

  it("default the table switch to on, and send it in bootstrap", () => {
    expect(DEFAULT_MOBILE_APP_CONFIG.ordering.tableEnabled).toBe(true);
  });

  it("fit tables to cafe orders only", () => {
    expect(fulfillmentAllowed("cafe", "table")).toBe(true);
    expect(fulfillmentAllowed("shop", "table")).toBe(false);
  });
});

describe("price", () => {
  it("charges no delivery fee to a table", () => {
    expect(shippingModeFor("table", { courierFeeMinor: 5500 })).toEqual({
      mode: "fixed",
      minor: 0,
    });
  });
});

const NOW = new Date("2026-10-15T12:00:00.000Z");

function tableOrder(over: Partial<AdminOrder> = {}): AdminOrder {
  return {
    id: "ord-0900",
    orderNo: 10900,
    customerName: "Eda Mancuso",
    customerEmail: "eda@example.com",
    customerPhone: "",
    shippingAddress: "",
    internalNote: "",
    status: "paid",
    items: [],
    subtotalMinor: 24500,
    discountMinor: 0,
    promoCode: "",
    shippingMinor: 0,
    totalMinor: 24500,
    refunds: [],
    createdAt: "2026-10-15T11:55:00.000Z",
    channel: "app",
    kind: "cafe",
    fulfillment: "table",
    tableCode: "ABCDEFGH23",
    tableName: "Bahçe 3",
    paidAt: "2026-10-15T11:56:00.000Z",
    ...over,
  } as AdminOrder;
}

describe("the order, read back", () => {
  it("keeps the table fulfillment instead of defaulting it to cargo", () => {
    expect(orderFulfillment({ fulfillment: "table" })).toBe("table");
    expect(ORDER_FULFILLMENT_LABELS.table).toBe("Masaya servis");
  });

  it("carries the table snapshot, and null on every other order", () => {
    expect(toMobileOrder(tableOrder(), NOW).table).toEqual({
      code: "ABCDEFGH23",
      name: "Bahçe 3",
    });
    expect(
      toMobileOrder(tableOrder({ fulfillment: "pickup" }), NOW).table,
    ).toBeNull();
    expect(orderTable({ fulfillment: "table", tableCode: "" })).toBeNull();
  });

  it("says it was brought to the table, not shipped", () => {
    const keys = buildTimeline(tableOrder()).map((s) => s.key);
    expect(keys).toEqual(["received", "preparing", "served", "completed"]);
    expect(statusLabelFor(tableOrder({ status: "shipped" }))).toBe(
      "Masana getirildi",
    );
    expect(shippedStatusLabel("table")).toBe("Masada");
    expect(markShippedLabel("table")).not.toContain("Kargo");
  });

  it("estimates like a gel-al order and has no shipment", () => {
    expect(etaMinutesFor(tableOrder({ status: "paid" }), NOW)).toBe(15);
    expect(etaMinutesFor(tableOrder({ status: "shipped" }), NOW)).toBe(0);
    expect(toMobileOrder(tableOrder(), NOW).shipment).toBeNull();
  });
});
