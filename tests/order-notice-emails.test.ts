import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminOrder } from "@/lib/admin/store";

/**
 * The shipping, cancellation and refund mails the legal texts promise, and
 * the one property that matters most about each: it leaves once.
 *
 * What is real: the eligibility rules and the claim/settle protocol over
 * `order_notice_emails`. What is faked: the table (an in-memory list that
 * answers a duplicate primary key with 23505, as Postgres does) and the
 * three senders, so nothing here can reach an inbox.
 */

type Row = Record<string, unknown>;
const rows: Row[] = [];
let insertError: { code: string; message: string } | null = null;

/** A filter chain that runs when awaited, like the real query builder. */
function chain(op: "update" | "delete", patch?: Row) {
  const filters: Array<(r: Row) => boolean> = [];
  let selected = false;
  const run = () => {
    const hit = rows.filter((r) => filters.every((f) => f(r)));
    if (op === "update") {
      for (const r of hit) Object.assign(r, patch);
      return { data: selected ? hit.map((r) => ({ ...r })) : null, error: null };
    }
    for (const r of hit) rows.splice(rows.indexOf(r), 1);
    return { data: null, error: null };
  };
  const q = {
    eq(column: string, value: unknown) {
      filters.push((r) => r[column] === value);
      return q;
    },
    lt(column: string, value: string) {
      filters.push((r) => String(r[column]) < value);
      return q;
    },
    select() {
      selected = true;
      return q;
    },
    then<A, B>(
      resolve: (v: ReturnType<typeof run>) => A,
      reject?: (e: unknown) => B,
    ) {
      return Promise.resolve().then(run).then(resolve, reject);
    },
  };
  return q;
}

const from = vi.fn(() => ({
  insert: async (row: Row) => {
    if (insertError) return { data: null, error: insertError };
    if (rows.some((r) => r.orderId === row.orderId && r.kind === row.kind)) {
      return { data: null, error: { code: "23505", message: "duplicate key" } };
    }
    rows.push({ ...row });
    return { data: null, error: null };
  },
  update: (patch: Row) => chain("update", patch),
  delete: () => chain("delete"),
}));

vi.mock("@/lib/db", () => ({
  getDb: () => ({ from }),
  TABLES: { orderNoticeEmails: "order_notice_emails" },
}));

const sendOrderShippedEmail = vi.fn();
const sendOrderCancelledEmail = vi.fn();
const sendOrderRefundedEmail = vi.fn();
vi.mock("@/lib/email/send", () => ({
  sendOrderShippedEmail,
  sendOrderCancelledEmail,
  sendOrderRefundedEmail,
}));

const {
  notifyOrderCancelled,
  notifyOrderRefunded,
  notifyOrderShipped,
  shipmentNoticeKind,
} = await import("@/lib/email/order-notices");
const { isHandedOver } = await import("@/lib/mobile/geliver");

function order(over: Partial<AdminOrder> = {}): AdminOrder {
  return {
    id: "ord-1",
    orderNo: 1042,
    customerName: "Eda Mancuso",
    customerEmail: "eda@example.com",
    customerPhone: "",
    shippingAddress: "Tuzla",
    internalNote: "",
    status: "shipped",
    items: [
      {
        productName: "Sirena Espresso Harmanı",
        qty: 1,
        unitPriceMinor: 45_000,
        status: "pending",
      },
    ],
    subtotalMinor: 45_000,
    discountMinor: 0,
    promoCode: "",
    shippingMinor: 0,
    totalMinor: 45_000,
    refunds: [],
    createdAt: "2026-09-20T10:00:00Z",
    channel: "web",
    kind: "shop",
    fulfillment: "shipping",
    trackingNumber: "YK123456789TR",
    carrier: "Yurtiçi Kargo",
    trackingUrl: "",
    ...over,
  } as AdminOrder;
}

/** The cafe order the app places for gel-al: never a parcel, never a notice. */
const cafePickup = (over: Partial<AdminOrder> = {}) =>
  order({
    channel: "app",
    kind: "cafe",
    fulfillment: "pickup",
    trackingNumber: "",
    carrier: "",
    ...over,
  });

beforeEach(() => {
  rows.splice(0);
  insertError = null;
  from.mockClear();
  for (const fn of [
    sendOrderShippedEmail,
    sendOrderCancelledEmail,
    sendOrderRefundedEmail,
  ]) {
    fn.mockReset();
    fn.mockResolvedValue({ ok: true });
  }
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("the tracking-number mail", () => {
  it("is sent once, with the number, the carrier and a provider idempotency key", async () => {
    expect(await notifyOrderShipped(order())).toBe("sent");
    expect(sendOrderShippedEmail).toHaveBeenCalledTimes(1);
    const [data, key] = sendOrderShippedEmail.mock.calls[0];
    expect(data).toMatchObject({
      to: "eda@example.com",
      orderNo: 1042,
      trackingNumber: "YK123456789TR",
      carrier: "Yurtiçi Kargo",
    });
    expect(key).toBe(`order-ord-1-${shipmentNoticeKind("YK123456789TR")}`);
    expect(rows).toEqual([
      expect.objectContaining({ orderId: "ord-1", status: "sent" }),
    ]);
    // The number identifies a parcel and a person; the log keeps a digest.
    expect(JSON.stringify(rows)).not.toContain("YK123456789TR");
  });

  it("ignores a replayed Geliver event and a re-saved tracking form", async () => {
    await notifyOrderShipped(order());
    // The same number again - the panel's second save, then the carrier's
    // SHIPPED and IN_TRANSIT webhooks, then a retry of one of them.
    expect(await notifyOrderShipped(order())).toBe("duplicate");
    expect(
      await notifyOrderShipped(
        order({ shipmentStatus: "shipped", trackingUrl: "https://kargo.example/t/1" }),
      ),
    ).toBe("duplicate");
    expect(
      await notifyOrderShipped(order({ shipmentStatus: "in_transit" })),
    ).toBe("duplicate");
    expect(sendOrderShippedEmail).toHaveBeenCalledTimes(1);
  });

  it("tells the buyer about a corrected number, once", async () => {
    await notifyOrderShipped(order());
    expect(
      await notifyOrderShipped(order({ trackingNumber: "YK987654321TR" })),
    ).toBe("sent");
    expect(
      await notifyOrderShipped(order({ trackingNumber: "YK987654321TR" })),
    ).toBe("duplicate");
    expect(sendOrderShippedEmail).toHaveBeenCalledTimes(2);
  });

  it("releases the claim when delivery fails, so the next trigger sends it", async () => {
    sendOrderShippedEmail.mockResolvedValueOnce({
      ok: false,
      error: "The laffogato.net domain is not verified.",
    });
    expect(await notifyOrderShipped(order())).toBe("failed");
    expect(rows).toHaveLength(0);
    expect(await notifyOrderShipped(order())).toBe("sent");
    expect(await notifyOrderShipped(order())).toBe("duplicate");
    expect(sendOrderShippedEmail).toHaveBeenCalledTimes(2);
  });

  it("takes over a claim a dead request left behind, and only a stale one", async () => {
    const kind = shipmentNoticeKind("YK123456789TR");
    rows.push({
      orderId: "ord-1",
      kind,
      status: "sending",
      createdAt: new Date(Date.now() - 60_000).toISOString(),
    });
    // A minute old: another request is still sending it.
    expect(await notifyOrderShipped(order())).toBe("duplicate");
    rows[0].createdAt = new Date(Date.now() - 20 * 60_000).toISOString();
    expect(await notifyOrderShipped(order())).toBe("sent");
    expect(sendOrderShippedEmail).toHaveBeenCalledTimes(1);
  });

  it("sends nothing without the claim - no claim, no 'once'", async () => {
    insertError = { code: "57P01", message: "terminating connection" };
    expect(await notifyOrderShipped(order())).toBe("failed");
    expect(sendOrderShippedEmail).not.toHaveBeenCalled();
  });

  it("is never due before a number exists, before payment, or after the order is undone", async () => {
    for (const o of [
      order({ trackingNumber: "" }),
      order({ trackingNumber: "   " }),
      order({ status: "pending_payment" }),
      order({ status: "cancelled" }),
      order({ status: "refunded" }),
    ]) {
      expect(await notifyOrderShipped(o)).toBe("not_due");
    }
    expect(sendOrderShippedEmail).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it("is never due to a checkout placeholder or a closed account", async () => {
    for (const email of ["", "guest@laffogato.local", "silindi-1@anon.local"]) {
      expect(await notifyOrderShipped(order({ customerEmail: email }))).toBe(
        "not_due",
      );
    }
    expect(sendOrderShippedEmail).not.toHaveBeenCalled();
  });

  it("goes out when the carrier takes the parcel, not when a label is printed", () => {
    // TRACKING_CODE_CREATED and LABEL_PRINTED map to `preparing`: the box
    // is still on the köşk's bench.
    expect(isHandedOver("preparing")).toBe(false);
    expect(isHandedOver("shipped")).toBe(true);
    expect(isHandedOver("in_transit")).toBe(true);
    expect(isHandedOver("delivered")).toBe(false);
    expect(isHandedOver("returned")).toBe(false);
    expect(isHandedOver("failed")).toBe(false);
  });
});

describe("the cancellation mail", () => {
  it("is sent once, saying whether money was taken", async () => {
    const cancelled = order({ status: "cancelled", paidAt: "2026-09-20T10:05:00Z" });
    expect(await notifyOrderCancelled(cancelled, { collected: true })).toBe(
      "sent",
    );
    expect(await notifyOrderCancelled(cancelled, { collected: true })).toBe(
      "duplicate",
    );
    expect(sendOrderCancelledEmail).toHaveBeenCalledTimes(1);
    const [data, key] = sendOrderCancelledEmail.mock.calls[0];
    expect(data).toMatchObject({ orderNo: 1042, collected: true, totalMinor: 45_000 });
    expect(data.items).toEqual([
      { productName: "Sirena Espresso Harmanı", qty: 1, unitPriceMinor: 45_000 },
    ]);
    expect(key).toBe("order-ord-1-cancelled");
  });

  it("passes an unknown payment state through rather than guessing", async () => {
    await notifyOrderCancelled(order({ status: "cancelled" }), { collected: null });
    expect(sendOrderCancelledEmail.mock.calls[0][0].collected).toBeNull();
  });
});

describe("the refund mail", () => {
  it("is sent once per refund entry, with the running total", async () => {
    const first = { id: "rfn-1-1695", amountMinor: 10_000, reason: "", createdAt: "" };
    const second = { id: "rfn-2-1696", amountMinor: 5_000, reason: "", createdAt: "" };
    const afterFirst = order({ status: "paid", refunds: [first] });
    const afterSecond = order({ status: "paid", refunds: [first, second] });

    expect(await notifyOrderRefunded(afterFirst, first, { viaCard: true })).toBe(
      "sent",
    );
    // The provider reporting the same refund again.
    expect(await notifyOrderRefunded(afterFirst, first, { viaCard: true })).toBe(
      "duplicate",
    );
    expect(
      await notifyOrderRefunded(afterSecond, second, { viaCard: true }),
    ).toBe("sent");

    expect(sendOrderRefundedEmail).toHaveBeenCalledTimes(2);
    expect(sendOrderRefundedEmail.mock.calls[0][0]).toMatchObject({
      refundMinor: 10_000,
      refundedTotalMinor: 10_000,
      totalMinor: 45_000,
      viaCard: true,
    });
    expect(sendOrderRefundedEmail.mock.calls[1][0]).toMatchObject({
      refundMinor: 5_000,
      refundedTotalMinor: 15_000,
    });
    expect(sendOrderRefundedEmail.mock.calls[1][1]).toBe(
      "order-ord-1-refund:rfn-2-1696",
    );
  });

  it("says nothing about a card for a refund booked without a POS", async () => {
    const r = { id: "rfn-1-1", amountMinor: 1_000, reason: "", createdAt: "" };
    await notifyOrderRefunded(order({ refunds: [r] }), r, { viaCard: false });
    expect(sendOrderRefundedEmail.mock.calls[0][0].viaCard).toBe(false);
  });
});

describe("the cafe pickup flow gets none of them", () => {
  it("sends no shipping, cancellation or refund mail for a gel-al order", async () => {
    const r = { id: "rfn-1-1", amountMinor: 1_000, reason: "", createdAt: "" };
    expect(await notifyOrderShipped(cafePickup({ status: "shipped" }))).toBe(
      "not_due",
    );
    // Even with a number typed into it by mistake.
    expect(
      await notifyOrderShipped(cafePickup({ trackingNumber: "YK1", status: "shipped" })),
    ).toBe("not_due");
    expect(
      await notifyOrderCancelled(cafePickup({ status: "cancelled" }), {
        collected: true,
      }),
    ).toBe("not_due");
    expect(
      await notifyOrderRefunded(cafePickup({ refunds: [r] }), r, { viaCard: true }),
    ).toBe("not_due");
    expect(sendOrderShippedEmail).not.toHaveBeenCalled();
    expect(sendOrderCancelledEmail).not.toHaveBeenCalled();
    expect(sendOrderRefundedEmail).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it("sends no tracking mail for a shop order the köşk's courier carries", async () => {
    expect(
      await notifyOrderShipped(order({ fulfillment: "delivery" })),
    ).toBe("not_due");
  });
});

/**
 * The wiring, read off the source: every place a parcel can become shipped,
 * an order cancelled or money returned calls its notice. A behavioural test
 * of each would need the whole store over a database; what can silently go
 * missing is the call itself.
 */
describe("every trigger calls its notice", () => {
  const store = readFileSync("src/lib/admin/store.ts", "utf8");
  const action = readFileSync("src/app/admin/siparisler/actions.ts", "utf8");
  const body = (source: string, fn: string) => {
    const start = source.indexOf(`export async function ${fn}(`);
    expect(start, fn).toBeGreaterThan(-1);
    const next = source.indexOf("\nexport ", start + 1);
    return source.slice(start, next === -1 ? undefined : next);
  };

  it("ships from the tracking form, the 'Kargoya ver' move and the Geliver hand-over", () => {
    expect(body(store, "setOrderTracking")).toContain("notifyOrderShipped(");
    expect(body(store, "transitionOrder")).toContain("notifyOrderShipped(");
    const geliver = body(store, "setOrderShipmentStatus");
    expect(geliver).toContain("isHandedOver(");
    expect(geliver).toContain("notifyOrderShipped(");
  });

  it("cancels from transitionOrder, which the bulk tool also goes through", () => {
    expect(body(store, "transitionOrder")).toContain("noticeCancelled(");
    expect(body(store, "bulkUpdateOrders")).toContain("transitionOrder(");
  });

  it("refunds from the panel and from the provider's webhook", () => {
    expect(body(store, "finalizeRefund")).toContain("notifyOrderRefunded(");
    expect(body(store, "recordProviderRefund")).toContain(
      "notifyOrderRefunded(",
    );
    expect(body(action, "refundOrderAction")).toMatch(
      /finalizeRefund\(reserved\.order, \{\s*refund: reserved\.refund,\s*viaCard: Boolean\(ref\),/,
    );
  });
});
