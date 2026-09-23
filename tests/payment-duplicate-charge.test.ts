import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDb, type Executor } from "@/lib/db/client";

/**
 * A second SUCCESSFUL charge on an order another transaction already paid.
 *
 * PayNkolay accepts several attempts under one clientRefCode, and the bridge
 * page can be re-submitted from the browser's Back button, so this is a real
 * path to charging a customer twice. It used to be read as "a repeated
 * notification - harmless": a console.warn, and "ödemen alındı" mailed again.
 *
 * Driven through the real query builder with an executor that answers by
 * statement, so the SQL `applyPaymentSucceeded` actually issues is what runs.
 */

const sendOrderPaidEmail = vi.fn(async () => {});
const logAudit = vi.fn(async () => {});

let succeeded: { provider: string; providerRef: string }[] = [];
let orderStatus = "paid";

const exec: Executor = async ({ text }) => {
  if (/count\(\*\)/i.test(text)) return { rows: [{ count: 1 }], rowCount: 1 };
  if (/^INSERT INTO "payment_transactions"/.test(text)) {
    return { rows: [], rowCount: 1 };
  }
  if (/^SELECT .* FROM "payment_transactions"/.test(text)) {
    return { rows: succeeded, rowCount: succeeded.length };
  }
  if (/^UPDATE "orders"/.test(text)) {
    // Guarded on status = 'pending_payment': nothing to advance.
    return { rows: [], rowCount: 0 };
  }
  if (/^SELECT \* FROM "orders"/.test(text)) {
    return {
      rows: [
        {
          id: "ord-0001",
          orderNo: 10001,
          customerName: "Ayşe",
          customerEmail: "ayse@example.com",
          status: orderStatus,
          items: [],
          refunds: [],
          subtotalMinor: 50000,
          discountMinor: 0,
          shippingMinor: 0,
          totalMinor: 50000,
          createdAt: "2026-09-23T10:00:00.000Z",
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
  sendOrderPaidEmail,
}));
vi.mock("@/lib/admin/audit", () => ({ logAudit }));
vi.mock("@/lib/mobile/loyalty", () => ({
  onOrderPaid: vi.fn(async () => {}),
  onOrderReversed: vi.fn(async () => {}),
}));

const { applyPaymentSucceeded } = await import("@/lib/admin/store");

const payment = (providerRef: string) => ({
  orderId: "ord-0001",
  provider: "paynkolay",
  providerRef,
  amountMinor: 50000,
  currency: "TRY",
});

beforeEach(() => {
  sendOrderPaidEmail.mockClear();
  logAudit.mockClear();
  orderStatus = "paid";
});

describe("a second successful charge on a paid order", () => {
  it("is booked for a human and not mailed as a new payment", async () => {
    succeeded = [
      { provider: "paynkolay", providerRef: "ref-1" },
      { provider: "paynkolay", providerRef: "ref-2" },
    ];
    const res = await applyPaymentSucceeded(payment("ref-2"));
    expect(res).toEqual({ ok: true, reconcile: "duplicate_payment" });
    expect(sendOrderPaidEmail).not.toHaveBeenCalled();
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          event: "payment_unreconciled",
          reason: "duplicate_payment",
        }),
      }),
    );
  });

  it("still treats staff moving a paid order on as harmless", async () => {
    // Only this reference is on file: the order was paid by it and has
    // since moved to `preparing` - nothing to reconcile.
    orderStatus = "preparing";
    succeeded = [{ provider: "paynkolay", providerRef: "ref-1" }];
    await applyPaymentSucceeded(payment("ref-1"));
    expect(logAudit).not.toHaveBeenCalled();
  });
});
