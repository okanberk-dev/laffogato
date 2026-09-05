import { describe, expect, it } from "vitest";

import type { AdminOrder } from "@/lib/admin/store";

import { appOrderDeepLink, isSafeOrderId } from "@/lib/mobile/deep-link";
import {
  buildTimeline,
  etaMinutesFor,
  stampsEarnedFor,
  statusLabelFor,
  toMobileOrder,
} from "@/lib/mobile/order-mapper";

const NOW = new Date("2026-08-30T12:00:00.000Z");

/** The ledger says this order has its stamp. */
const STAMPED = new Set(["ord-0284"]);

function order(overrides: Partial<AdminOrder> = {}): AdminOrder {
  return {
    id: "ord-0284",
    orderNo: 284,
    customerName: "Eda Mancuso",
    customerEmail: "eda@example.com",
    customerPhone: "+90 532 000 00 00",
    shippingAddress: "Evim — Eda Mancuso, +90 532 000 00 00\nPostane Mah.",
    internalNote: "staff only",
    status: "preparing",
    items: [
      {
        productName: "Cappuccino",
        qty: 1,
        unitPriceMinor: 24500,
        status: "pending",
        menuItemId: "mnu-0007",
        size: "M",
        options: { milk: "oat", extraShot: true },
        detail: "M · yulaf · +1 shot",
      },
    ],
    subtotalMinor: 24500,
    discountMinor: 0,
    promoCode: "",
    shippingMinor: 5500,
    totalMinor: 30000,
    refunds: [],
    createdAt: "2026-08-30T11:40:00.000Z",
    legalConsent: {
      acceptedAt: "2026-08-30T11:39:00.000Z",
      documents: ["on-bilgilendirme-formu"],
      version: "1 Eylül 2026",
      ip: "10.0.0.1",
    },
    channel: "app",
    kind: "cafe",
    fulfillment: "delivery",
    scheduledFor: "",
    deliveryNote: "Kapı kodu 4821",
    paidAt: "2026-08-30T11:41:00.000Z",
    ...overrides,
  };
}

describe("toMobileOrder", () => {
  it("maps an app cafe delivery order to the contract shape", () => {
    const m = toMobileOrder(order(), NOW, STAMPED);
    expect(m).toMatchObject({
      id: "ord-0284",
      orderNo: 284,
      status: "preparing",
      statusLabel: "Hazırlanıyor",
      channel: "app",
      kind: "cafe",
      fulfillment: "delivery",
      subtotalMinor: 24500,
      discountMinor: 0,
      shippingMinor: 5500,
      totalMinor: 30000,
      promoCode: "",
      scheduledFor: null,
      etaMinutes: 35,
      etaAt: "2026-08-30T12:35:00.000Z",
      stampsEarned: 1,
      createdAt: "2026-08-30T11:40:00.000Z",
      paidAt: "2026-08-30T11:41:00.000Z",
    });
    expect(m.address).toContain("Evim — Eda Mancuso");
    expect(m.items).toEqual([
      {
        name: "Cappuccino",
        detail: "M · yulaf · +1 shot",
        qty: 1,
        unitPriceMinor: 24500,
        menuItemId: "mnu-0007",
        productId: null,
        variantId: null,
        size: "M",
        options: { milk: "oat", extraShot: true },
      },
    ]);
  });

  it("never leaks the internal note, consent evidence or refunds", () => {
    const m = toMobileOrder(order(), NOW) as unknown as Record<string, unknown>;
    expect(m).not.toHaveProperty("internalNote");
    expect(m).not.toHaveProperty("legalConsent");
    expect(m).not.toHaveProperty("refunds");
    expect(m).not.toHaveProperty("customerEmail");
    expect(m).not.toHaveProperty("deliveryNote");
  });

  it("reads a row written before the app existed as a web shipping order", () => {
    const legacy = order({
      channel: undefined,
      kind: undefined,
      fulfillment: undefined,
      scheduledFor: undefined,
      deliveryNote: undefined,
      paidAt: undefined,
      status: "paid",
      items: [
        {
          productName: "Sirena — Espresso Blend · 250 g",
          qty: 1,
          unitPriceMinor: 32000,
          status: "pending",
          productId: "prd-0001",
          variantId: "var-250",
        },
      ],
    });
    const m = toMobileOrder(legacy, NOW);
    expect(m.channel).toBe("web");
    expect(m.kind).toBe("shop");
    expect(m.fulfillment).toBe("shipping");
    expect(m.paidAt).toBeNull();
    expect(m.scheduledFor).toBeNull();
    expect(m.etaMinutes).toBeNull();
    expect(m.etaAt).toBeNull();
    expect(m.stampsEarned).toBe(0);
    expect(m.items[0]).toMatchObject({
      detail: "",
      menuItemId: null,
      productId: "prd-0001",
      variantId: "var-250",
      size: null,
      options: null,
    });
  });
});

describe("timeline", () => {
  it("labels a courier order 'Kuryede' then 'Kapında', with done flags by stage", () => {
    const steps = buildTimeline(order({ status: "preparing" }));
    expect(steps.map((s) => s.key)).toEqual([
      "received",
      "preparing",
      "on_the_way",
      "delivered",
    ]);
    expect(steps.map((s) => s.label)).toEqual([
      "Sipariş alındı",
      "Hazırlanıyor",
      "Kuryede",
      "Kapında",
    ]);
    expect(steps.map((s) => s.done)).toEqual([true, true, false, false]);
    expect(steps[0].at).toBe("2026-08-30T11:40:00.000Z");
    expect(steps[1].at).toBe("2026-08-30T11:41:00.000Z");
    expect(steps[2].at).toBeNull();
  });

  it("dates each step from its own stage column, not from paidAt", () => {
    const steps = buildTimeline(
      order({
        status: "completed",
        preparingAt: "2026-08-30T11:45:00.000Z",
        shippedAt: "2026-08-30T11:52:00.000Z",
        completedAt: "2026-08-30T12:10:00.000Z",
      }),
    );
    expect(steps.map((s) => s.at)).toEqual([
      "2026-08-30T11:40:00.000Z",
      "2026-08-30T11:45:00.000Z",
      "2026-08-30T11:52:00.000Z",
      "2026-08-30T12:10:00.000Z",
    ]);
  });

  it("stays blank on the last steps of an order older than the stage columns", () => {
    // Rows written before 20260905160000 have "" in all three; a done step
    // borrowing paidAt is exactly the mis-dating those columns removed.
    const steps = buildTimeline(
      order({
        status: "completed",
        preparingAt: "",
        shippedAt: "",
        completedAt: "",
      }),
    );
    expect(steps[1].at).toBe("2026-08-30T11:41:00.000Z");
    expect(steps[2].at).toBeNull();
    expect(steps[3].at).toBeNull();
  });

  it("says 'Hazır — gel al' for a pickup and uses it as the status label", () => {
    const o = order({
      fulfillment: "pickup",
      status: "shipped",
      shippedAt: "2026-08-30T11:50:00.000Z",
    });
    const steps = buildTimeline(o);
    expect(steps[2]).toEqual({
      key: "ready",
      label: "Hazır — gel al",
      at: "2026-08-30T11:50:00.000Z",
      done: true,
    });
    expect(steps[3].done).toBe(false);
    expect(statusLabelFor(o)).toBe("Hazır — gel al");
  });

  it("marks every step done on completion and none beyond the first when cancelled", () => {
    expect(
      buildTimeline(order({ status: "completed" })).every((s) => s.done),
    ).toBe(true);
    const cancelled = buildTimeline(order({ status: "cancelled" }));
    expect(cancelled.every((s) => !s.done)).toBe(true);
    expect(statusLabelFor(order({ status: "cancelled" }))).toBe("İptal edildi");
    expect(statusLabelFor(order({ status: "pending_payment" }))).toBe(
      "Ödeme bekleniyor",
    );
  });
});

describe("eta and stamps", () => {
  it("estimates by fulfillment and status", () => {
    expect(etaMinutesFor(order({ status: "paid" }))).toBe(35);
    expect(etaMinutesFor(order({ status: "shipped" }))).toBe(10);
    expect(etaMinutesFor(order({ status: "completed" }))).toBeNull();
    expect(etaMinutesFor(order({ status: "pending_payment" }))).toBeNull();
    expect(
      etaMinutesFor(order({ fulfillment: "pickup", status: "preparing" })),
    ).toBe(15);
    expect(
      etaMinutesFor(order({ fulfillment: "pickup", status: "shipped" })),
    ).toBe(0);
    expect(
      etaMinutesFor(order({ fulfillment: "shipping", status: "shipped" })),
    ).toBeNull();
  });

  // These used to assert the OLD rule — a stamp inferred from the status —
  // which is exactly the bug: `onOrderPaid` is best-effort, so a paid app
  // cafe order whose ledger insert failed had the app printing "+1 damga"
  // for a stamp the card never got. The ledger is the answer now.
  it("reads the stamp from the ledger, not from the status", () => {
    expect(stampsEarnedFor(order({ status: "paid" }), STAMPED)).toBe(1);
    expect(stampsEarnedFor(order({ status: "completed" }), STAMPED)).toBe(1);
    expect(stampsEarnedFor(order({ status: "paid" }), new Set())).toBe(0);
  });

  it("claims nothing when no ledger was handed in", () => {
    expect(toMobileOrder(order({ status: "paid" }), NOW).stampsEarned).toBe(0);
  });

  it("does not lend one order's stamp to another", () => {
    const other = new Set(["ord-0999"]);
    expect(stampsEarnedFor(order({ status: "paid" }), other)).toBe(0);
  });
});

describe("deep link", () => {
  it("builds laffogato://siparis/<id>?status=… for a store id", () => {
    expect(appOrderDeepLink("ord-0284", "success")).toBe(
      "laffogato://siparis/ord-0284?status=success",
    );
    expect(appOrderDeepLink("ord-0284", "failed")).toBe(
      "laffogato://siparis/ord-0284?status=failed",
    );
  });

  it("refuses to put anything but an order id into the link", () => {
    expect(isSafeOrderId("ord-0284")).toBe(true);
    expect(isSafeOrderId("ord-0284?x=1")).toBe(false);
    expect(isSafeOrderId("javascript:alert(1)")).toBe(false);
    expect(isSafeOrderId("")).toBe(false);
    expect(appOrderDeepLink("../evil", "failed")).toBe("laffogato://");
  });
});
