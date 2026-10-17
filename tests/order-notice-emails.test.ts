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
function chain(op: "update" | "delete" | "select", patch?: Row) {
  const filters: Array<(r: Row) => boolean> = [];
  let selected = false;
  const run = () => {
    const hit = rows.filter((r) => filters.every((f) => f(r)));
    if (op === "select") {
      return { data: hit.map((r) => ({ ...r })), error: null };
    }
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
  select: () => chain("select"),
}));

vi.mock("@/lib/db", () => ({
  getDb: () => ({ from }),
  TABLES: { orderNoticeEmails: "order_notice_emails" },
}));

const sendOrderShippedEmail = vi.fn();
const sendOrderCancelledEmail = vi.fn();
const sendOrderRefundedEmail = vi.fn();
const sendOrderPaidEmail = vi.fn();
vi.mock("@/lib/email/send", () => ({
  sendOrderShippedEmail,
  sendOrderCancelledEmail,
  sendOrderRefundedEmail,
  sendOrderPaidEmail,
}));

const {
  maskedNoticeError,
  notifyOrderCancelled,
  notifyOrderPaid,
  notifyOrderRefunded,
  notifyOrderShipped,
  resendOrderNotice,
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

  it("keeps a failed delivery on record, and the next trigger sends it", async () => {
    sendOrderShippedEmail.mockResolvedValueOnce({
      ok: false,
      error: "The laffogato.net domain is not verified.",
    });
    expect(await notifyOrderShipped(order())).toBe("failed");
    // The order page shows which mail did not go out, and why.
    expect(rows).toEqual([
      expect.objectContaining({
        status: "failed",
        error: "The laffogato.net domain is not verified.",
      }),
    ]);
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
  const ops = readFileSync("src/lib/admin/order-ops.ts", "utf8");
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
    // The bulk tool runs each order through the order page's own cancel.
    expect(body(ops, "runBulkOrderAction")).toContain("cancelOrder(");
    expect(body(ops, "cancelOrder")).toContain('transitionOrder(id, "cancel"');
  });

  it("refunds from the panel and from the provider's webhook", () => {
    expect(body(store, "finalizeRefund")).toContain("notifyOrderRefunded(");
    expect(body(store, "recordProviderRefund")).toContain(
      "notifyOrderRefunded(",
    );
    expect(body(ops, "issueRefund")).toMatch(
      // A wallet-paid order's refund goes back to the wallet, not a card.
      /finalizeRefund\(reserved\.order, \{\s*refund: reserved\.refund,\s*viaCard: destination === "card",/,
    );
  });
});

/**
 * "Ödemen alındı" - the customer's one order mail before shipping (operator,
 * 16 Eki 2026: "sipariş maili ödeme tam alınmadan gitmesin"). Nothing is
 * mailed while the payment is pending; the paid mail leaves once.
 */
describe("the paid notice", () => {
  beforeEach(() => {
    sendOrderPaidEmail.mockReset();
    sendOrderPaidEmail.mockResolvedValue({ ok: true, id: "re_1" });
  });

  it("is sent once, whichever confirmation gets there first", async () => {
    const paid = order({ status: "paid", trackingNumber: "" });
    expect(await notifyOrderPaid(paid)).toBe("sent");
    expect(await notifyOrderPaid(paid)).toBe("duplicate");
    expect(sendOrderPaidEmail).toHaveBeenCalledTimes(1);
    const [data, key] = sendOrderPaidEmail.mock.calls[0];
    expect(key).toBe("order-ord-1-paid");
    expect(data).toMatchObject({
      to: "eda@example.com",
      orderNo: 1042,
      totalMinor: 45_000,
      items: [{ productName: "Sirena Espresso Harmanı", qty: 1 }],
    });
  });

  it("goes to an app cafe order too, with the line's detail", async () => {
    await notifyOrderPaid(
      cafePickup({
        status: "paid",
        items: [
          {
            productName: "Latte",
            detail: "Yulaf sütü",
            qty: 1,
            unitPriceMinor: 14_000,
            status: "pending",
          },
        ] as AdminOrder["items"],
      }),
    );
    expect(sendOrderPaidEmail.mock.calls[0][0].items[0].productName).toBe(
      "Latte (Yulaf sütü)",
    );
  });

  it("carries no cargo line for a table order", async () => {
    await notifyOrderPaid(
      cafePickup({ status: "paid", fulfillment: "table" as never }),
    );
    expect(sendOrderPaidEmail.mock.calls[0][0]).toMatchObject({
      servedAtTable: true,
    });
  });

  it("is retried after a failed delivery", async () => {
    sendOrderPaidEmail.mockResolvedValueOnce({ ok: false, error: "down" });
    const paid = order({ status: "paid" });
    expect(await notifyOrderPaid(paid)).toBe("failed");
    expect(await notifyOrderPaid(paid)).toBe("sent");
  });

  it("is not due for a checkout placeholder", async () => {
    expect(
      await notifyOrderPaid(order({ customerEmail: "guest@laffogato.local" })),
    ).toBe("not_due");
    expect(sendOrderPaidEmail).not.toHaveBeenCalled();
  });

  it("is the only order mail, sent where an order becomes paid", () => {
    const store = readFileSync("src/lib/admin/store.ts", "utf8");
    const pay = store.slice(
      store.indexOf("export async function applyPaymentSucceeded"),
      store.indexOf("export async function recordProviderRefund"),
    );
    expect(pay).toMatch(/if \(advanced\) \{\s+await notifyOrderPaid\(/);
    const transition = store.slice(
      store.indexOf("export async function transitionOrder"),
      store.indexOf("async function noticeCancelled"),
    );
    expect(transition).toContain("notifyOrderPaid(");
    // No "siparişin alındı" before payment, from the web or the app.
    const send = readFileSync("src/lib/email/send.ts", "utf8");
    expect(send).not.toContain("export async function sendOrderPlacedEmail");
    for (const file of [
      "src/app/odeme/actions.ts",
      "src/lib/mobile/orders.ts",
      "src/lib/admin/store.ts",
    ]) {
      const code = readFileSync(file, "utf8");
      expect(code, file).not.toContain("sendOrderPlacedEmail");
      expect(code, file).not.toContain("sendOrderPaidEmail(");
    }
  });

  it("keeps the contract links on the mail the customer gets", () => {
    const html = readFileSync(
      "src/lib/email/templates/odeme-onaylandi.html",
      "utf8",
    );
    for (const slug of [
      "on-bilgilendirme-formu",
      "mesafeli-satis-sozlesmesi",
      "iade-ve-cayma",
    ]) {
      expect(html, slug).toContain(`/hukuk/${slug}`);
    }
    const text = readFileSync("src/lib/email/text.ts", "utf8");
    const paidText = text.slice(text.indexOf('"odeme-onaylandi"'));
    expect(paidText.slice(0, paidText.indexOf("SIGNATURE"))).toContain(
      "[BELGELER]",
    );
  });

  it("does not tell a customer about cancelling an attempt they never paid", () => {
    const store = readFileSync("src/lib/admin/store.ts", "utf8");
    const notice = store.slice(store.indexOf("async function noticeCancelled"));
    expect(notice).toContain(
      'if (unpaidAttempt && collected !== true) return "not_due";',
    );
  });
});

/**
 * "Yeniden gönder" (order page): the same mail again under a new kind, so
 * the provider does not answer it from its record of the first, and only
 * while what it says is still true.
 */
describe("resending a customer mail", () => {
  beforeEach(() => {
    sendOrderPaidEmail.mockReset();
    sendOrderPaidEmail.mockResolvedValue({ ok: true });
  });

  it("sends under <kind>#resend-<n>, counting up", async () => {
    const paid = order({ status: "paid" });
    expect(await notifyOrderPaid(paid)).toBe("sent");
    expect(await resendOrderNotice(paid, "paid", { collected: true })).toBe("sent");
    expect(await resendOrderNotice(paid, "paid", { collected: true })).toBe("sent");
    expect(rows.map((r) => r.kind)).toEqual(["paid", "paid#resend-1", "paid#resend-2"]);
    expect(sendOrderPaidEmail).toHaveBeenCalledTimes(3);
    expect(sendOrderPaidEmail.mock.calls[2][1]).toBe("order-ord-1-paid#resend-2");
  });

  it("is not due when the mail is no longer true", async () => {
    expect(
      await resendOrderNotice(order({ status: "paid" }), "cancelled", { collected: true }),
    ).toBe("not_due");
    expect(
      await resendOrderNotice(order({ status: "pending_payment" }), "paid", { collected: false }),
    ).toBe("not_due");
    // An old number's mail is not resent for the parcel's new number.
    expect(
      await resendOrderNotice(order(), shipmentNoticeKind("OLD123"), { collected: true }),
    ).toBe("not_due");
    expect(
      await resendOrderNotice(order(), "refund:rfn-gone", { collected: true }),
    ).toBe("not_due");
    expect(await resendOrderNotice(order(), "staff-new", { collected: true })).toBe("not_due");
    expect(sendOrderPaidEmail).not.toHaveBeenCalled();
    expect(sendOrderCancelledEmail).not.toHaveBeenCalled();
  });

  it("resends the current tracking number's mail", async () => {
    const kind = shipmentNoticeKind("YK123456789TR");
    expect(await resendOrderNotice(order(), kind, { collected: true })).toBe("sent");
    expect(rows.map((r) => r.kind)).toEqual([`${kind}#resend-1`]);
  });

  it("keeps addresses out of the stored error", () => {
    expect(maskedNoticeError("Invalid `to`: eda@example.com is blocked")).toBe(
      "Invalid `to`: [e-posta] is blocked",
    );
  });
});
