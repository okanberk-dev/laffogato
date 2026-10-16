import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDb, type Executor } from "@/lib/db/client";

/**
 * The staff "new order" mail is scheduled from `applyPaymentSucceeded`, and
 * only from the confirmation that actually moved the order to `paid` - not
 * from a replayed notification, not for an order that was no longer pending,
 * not for a short payment. It is handed to `after()`, so the payment never
 * waits for it.
 */

const { afterCallbacks, notifyStaffNewOrder } = vi.hoisted(() => ({
  afterCallbacks: [] as Array<() => unknown>,
  notifyStaffNewOrder: vi.fn(async () => "sent"),
}));

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (cb: () => unknown) => {
    afterCallbacks.push(cb);
  },
}));
vi.mock("@/lib/email/staff-order-notice", () => ({ notifyStaffNewOrder }));

let insertConflict = false;
let advanced = true;
let total = 50000;

const exec: Executor = async ({ text }) => {
  if (/count\(\*\)/i.test(text)) return { rows: [{ count: 1 }], rowCount: 1 };
  if (/^INSERT INTO "payment_transactions"/.test(text)) {
    if (insertConflict) {
      const err = Object.assign(new Error("duplicate key"), { code: "23505" });
      throw err;
    }
    return { rows: [], rowCount: 1 };
  }
  if (/^SELECT .* FROM "payment_transactions"/.test(text)) {
    return { rows: [], rowCount: 0 };
  }
  if (/^UPDATE "orders"/.test(text)) {
    return advanced
      ? { rows: [{ id: "ord-0001" }], rowCount: 1 }
      : { rows: [], rowCount: 0 };
  }
  if (/^SELECT \* FROM "orders"/.test(text)) {
    return {
      rows: [
        {
          id: "ord-0001",
          orderNo: 10001,
          customerName: "Ayşe",
          customerEmail: "ayse@example.com",
          status: advanced ? "pending_payment" : "paid",
          items: [],
          refunds: [],
          subtotalMinor: total,
          discountMinor: 0,
          shippingMinor: 0,
          totalMinor: total,
          createdAt: "2026-10-15T10:00:00.000Z",
          channel: "app",
          kind: "cafe",
          fulfillment: "table",
        },
      ],
      rowCount: 1,
    };
  }
  return { rows: [], rowCount: 0 };
};

vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const db = createDb(exec);
  return { ...real, getDb: () => db };
});
vi.mock("@/lib/email/send", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email/send")>()),
  sendOrderPaidEmail: vi.fn(async () => true),
}));
vi.mock("@/lib/admin/audit", () => ({ logAudit: vi.fn(async () => {}) }));
vi.mock("@/lib/mobile/loyalty", () => ({
  onOrderPaid: vi.fn(async () => {}),
  onOrderReversed: vi.fn(async () => {}),
}));

const { applyPaymentSucceeded } = await import("@/lib/admin/store");

const payment = (amountMinor = 50000) => ({
  orderId: "ord-0001",
  provider: "paynkolay",
  providerRef: "ref-1",
  amountMinor,
  currency: "TRY",
});

async function runAfter() {
  for (const cb of afterCallbacks.splice(0)) await cb();
}

beforeEach(() => {
  afterCallbacks.length = 0;
  notifyStaffNewOrder.mockClear();
  insertConflict = false;
  advanced = true;
  total = 50000;
});

describe("the staff new-order mail after a payment", () => {
  it("is scheduled after the response for the confirmation that paid the order", async () => {
    const res = await applyPaymentSucceeded(payment());
    expect(res).toEqual({ ok: true });
    // Nothing has been sent while the payment was being answered.
    expect(notifyStaffNewOrder).not.toHaveBeenCalled();
    expect(afterCallbacks).toHaveLength(1);
    await runAfter();
    expect(notifyStaffNewOrder).toHaveBeenCalledWith("ord-0001", {
      provider: "paynkolay",
    });
  });

  it("is not scheduled by a confirmation that found the order already paid", async () => {
    advanced = false;
    insertConflict = true;
    await applyPaymentSucceeded(payment());
    expect(afterCallbacks).toHaveLength(0);
  });

  it("is not scheduled for a payment that does not cover the order", async () => {
    await applyPaymentSucceeded(payment(100));
    expect(afterCallbacks).toHaveLength(0);
  });

  it("cannot fail the payment when the mail itself throws", async () => {
    notifyStaffNewOrder.mockRejectedValueOnce(new Error("resend down"));
    const res = await applyPaymentSucceeded(payment());
    expect(res).toEqual({ ok: true });
    await expect(runAfter()).resolves.toBeUndefined();
  });
});
