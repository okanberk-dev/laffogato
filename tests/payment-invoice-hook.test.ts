import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDb, type Executor } from "@/lib/db/client";

/**
 * The e-Arşiv hook after a payment (src/lib/invoice/hook.ts): scheduled for
 * a payment the run cuts itself (PayNkolay), never for a wallet or
 * zero-total order. Those are invoiced by hand and settle from the app's
 * routes, whose 15 s limit the hook's run would outlast (post-merge review,
 * 22 Eki 2026); the daily run sees every order anyway.
 */

const { afterCallbacks, notifyStaffNewOrder, scheduleInvoiceWork } = vi.hoisted(
  () => ({
    afterCallbacks: [] as Array<() => unknown>,
    notifyStaffNewOrder: vi.fn(async () => "sent"),
    scheduleInvoiceWork: vi.fn(),
  }),
);

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (cb: () => unknown) => {
    afterCallbacks.push(cb);
  },
}));
vi.mock("@/lib/email/staff-order-notice", () => ({ notifyStaffNewOrder }));
vi.mock("@/lib/invoice/hook", () => ({ scheduleInvoiceWork }));

let insertConflict = false;
let advanced = true;
let total = 50000;
/** What the order reads as once the guarded UPDATE did not move it. */
let settledStatus = "paid";

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
          status: advanced ? "pending_payment" : settledStatus,
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

const payment = (provider: string) => ({
  orderId: "ord-0001",
  provider,
  providerRef: `${provider}_ord-0001`,
  amountMinor: total,
  currency: "TRY",
});

beforeEach(() => {
  afterCallbacks.length = 0;
  scheduleInvoiceWork.mockClear();
  insertConflict = false;
  advanced = true;
  total = 50000;
  settledStatus = "paid";
});

describe("the e-Arşiv hook after a payment", () => {
  it("is scheduled for a card payment through PayNkolay", async () => {
    expect(await applyPaymentSucceeded(payment("paynkolay"))).toEqual({
      ok: true,
    });
    expect(scheduleInvoiceWork).toHaveBeenCalledWith("ord-0001");
  });

  it("is not scheduled for a wallet or a zero-total order", async () => {
    expect(await applyPaymentSucceeded(payment("wallet"))).toEqual({
      ok: true,
    });
    total = 0;
    expect(await applyPaymentSucceeded(payment("free"))).toEqual({ ok: true });
    expect(scheduleInvoiceWork).not.toHaveBeenCalled();
  });
});
