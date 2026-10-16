import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminOrder } from "@/lib/admin/store";
import { createDb, type Executor } from "@/lib/db/client";
import { EMAIL_TEXT } from "@/lib/email/text";
import { renderEmail } from "@/lib/email/render";

/**
 * The order machine's side of "stamps follow the goods kept" (review of 16
 * Eki 2026): EVERY refund settles the stamps - a partial one too, through the
 * admin path and the provider's webhook - with the refund it just recorded,
 * and only a cancel or a full refund takes everything. And the paid-order
 * mail states the stamps the order really earns, or none at all.
 */

const onOrderReversed = vi.fn(async (..._args: unknown[]) => {});
const settleLoyaltyDebt = vi.fn(async (..._args: unknown[]) => {});
/** Whether `releaseCustomerCoupon` finds the member's coupon on the order. */
let couponHeld = false;
const sendOrderPaidEmail = vi.fn(async (..._args: unknown[]) => true);
const notifyOrderRefunded = vi.fn(async () => {});

let orderRow: Record<string, unknown> = {};

const exec: Executor = async ({ text }) => {
  if (/count\(\*\)/i.test(text)) return { rows: [{ count: 1 }], rowCount: 1 };
  if (/^SELECT \* FROM "orders"/.test(text)) {
    return { rows: [{ ...orderRow }], rowCount: 1 };
  }
  if (/^UPDATE "orders"/.test(text) && /RETURNING/.test(text)) {
    return { rows: [{ id: orderRow.id }], rowCount: 1 };
  }
  if (/^UPDATE "customer_coupons"/.test(text) && /RETURNING/.test(text)) {
    return couponHeld
      ? { rows: [{ id: "cpn-0001" }], rowCount: 1 }
      : { rows: [], rowCount: 0 };
  }
  return { rows: [], rowCount: 1 };
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
vi.mock("@/lib/email/order-notices", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email/order-notices")>()),
  notifyOrderRefunded,
}));
vi.mock("@/lib/admin/audit", () => ({ logAudit: vi.fn(async () => {}) }));
vi.mock("@/lib/mobile/loyalty", () => ({
  onOrderPaid: vi.fn(async () => {}),
  onOrderReversed,
  settleLoyaltyDebt,
}));

const {
  applyPaymentSucceeded,
  finalizeRefund,
  recordProviderRefund,
  transitionOrder,
} = await import("@/lib/admin/store");

function order(over: Partial<AdminOrder> = {}): AdminOrder {
  return {
    id: "ord-0001",
    orderNo: 10001,
    customerName: "Eda",
    customerEmail: "eda@example.com",
    status: "paid",
    channel: "app",
    kind: "cafe",
    items: [],
    refunds: [],
    subtotalMinor: 100000,
    discountMinor: 0,
    shippingMinor: 0,
    totalMinor: 100000,
    createdAt: "2026-10-16T09:00:00.000Z",
    ...over,
  } as AdminOrder;
}

const refund = (id: string, amountMinor: number) => ({
  id,
  amountMinor,
  reason: "test",
  createdAt: "2026-10-16T10:00:00.000Z",
});

beforeEach(() => {
  onOrderReversed.mockClear();
  settleLoyaltyDebt.mockClear();
  couponHeld = false;
  sendOrderPaidEmail.mockClear();
  notifyOrderRefunded.mockClear();
  orderRow = order() as unknown as Record<string, unknown>;
});

describe("every refund settles the stamps", () => {
  it("a partial admin refund passes the order with its refunds, not in full", async () => {
    const partial = order({ refunds: [refund("rfn-1", 30000)] });
    const out = await finalizeRefund(partial);
    expect(out.status).toBe("paid");
    expect(onOrderReversed).toHaveBeenCalledTimes(1);
    expect(onOrderReversed).toHaveBeenCalledWith(partial, { full: false });
  });

  it("a full admin refund takes everything", async () => {
    const all = order({
      refunds: [refund("rfn-1", 30000), refund("rfn-2", 70000)],
    });
    const out = await finalizeRefund(all);
    expect(out.status).toBe("refunded");
    expect(onOrderReversed).toHaveBeenCalledWith(
      expect.objectContaining({ status: "refunded" }),
      { full: true },
    );
  });

  it("a refund on a cancelled order keeps it at none", async () => {
    const cancelled = order({
      status: "cancelled",
      refunds: [refund("rfn-1", 30000)],
    });
    await finalizeRefund(cancelled);
    expect(onOrderReversed).toHaveBeenCalledWith(cancelled, { full: true });
  });

  it("a partial provider refund settles with the refund it just recorded", async () => {
    const res = await recordProviderRefund({
      orderId: "ord-0001",
      provider: "paynkolay",
      providerRef: "ref-1",
      amountMinor: 25000,
      currency: "TRY",
    });
    expect(res).toEqual({ ok: true });
    expect(onOrderReversed).toHaveBeenCalledTimes(1);
    const [passed, opts] = onOrderReversed.mock.calls[0] as [
      AdminOrder,
      unknown,
    ];
    expect(opts).toEqual({ full: false });
    expect(passed.status).toBe("paid");
    expect(passed.refunds.map((r) => r.amountMinor)).toEqual([25000]);
  });

  it("a full provider refund takes everything", async () => {
    await recordProviderRefund({
      orderId: "ord-0001",
      provider: "paynkolay",
      providerRef: "ref-1",
      amountMinor: 100000,
      currency: "TRY",
    });
    const [passed, opts] = onOrderReversed.mock.calls[0] as [
      AdminOrder,
      unknown,
    ];
    expect(opts).toEqual({ full: true });
    expect(passed.status).toBe("refunded");
  });
});

describe("a coupon handed back by an unpaid order", () => {
  // Review of 16 Eki 2026: a reward held by an unpaid order reads as used, so
  // a reversal cannot take it; once the order lets go, settle again.
  it("settles the member's loyalty again when their coupon comes back", async () => {
    orderRow = order({
      status: "pending_payment",
      promoCode: "SD-ABC123",
    }) as unknown as Record<string, unknown>;
    couponHeld = true;
    const out = await transitionOrder("ord-0001", "cancel");
    expect(out.ok).toBe(true);
    expect(settleLoyaltyDebt).toHaveBeenCalledWith("eda@example.com");
  });

  it("does not when no personal coupon came back", async () => {
    orderRow = order({
      status: "pending_payment",
      promoCode: "HOSGELDIN",
    }) as unknown as Record<string, unknown>;
    await transitionOrder("ord-0001", "cancel");
    expect(settleLoyaltyDebt).not.toHaveBeenCalled();
  });
});

describe("the paid-order mail states the stamps the order earns", () => {
  const paid = () =>
    applyPaymentSucceeded({
      orderId: "ord-0001",
      provider: "paynkolay",
      providerRef: "ref-1",
      amountMinor: Number(orderRow.totalMinor),
      currency: "TRY",
    });

  it("an app cafe order of 1.000 TL is told 4", async () => {
    orderRow = order({ status: "pending_payment" }) as unknown as Record<
      string,
      unknown
    >;
    await paid();
    expect(sendOrderPaidEmail).toHaveBeenCalledWith(
      expect.objectContaining({ stampsEarned: 4 }),
    );
  });

  it("a shop order is told none", async () => {
    orderRow = order({
      status: "pending_payment",
      kind: "shop",
      channel: "web",
    }) as unknown as Record<string, unknown>;
    await paid();
    expect(sendOrderPaidEmail).toHaveBeenCalledWith(
      expect.objectContaining({ stampsEarned: 0 }),
    );
  });

  const render = (stamps: string) =>
    renderEmail("odeme-onaylandi", {
      vars: {
        AD: "Eda",
        SIPARIS_NO: "10001",
        SIPARIS_URL: "https://laffogato.net/uye/hesap/siparislerim/10001",
        ARA_TOPLAM: "1.000,00 ₺",
        KARGO: "Ücretsiz",
        TOPLAM: "1.000,00 ₺",
        KALEMLER: "1 × Latte",
        BELGELER: "-",
        DAMGA_HEDEFI: "6",
        DAMGA_SAYISI: stamps,
      },
      loops: { ITEMS: [] },
      text: EMAIL_TEXT["odeme-onaylandi"],
    });

  it("prints the real count, never a fixed +1", () => {
    const r = render("3");
    expect(r.html).toContain("+3 damga");
    expect(r.html).not.toContain("+1 damga");
    expect(r.text).toContain("Bu siparişle 3 damga kazandınız");
  });

  it("drops the stamp panel from both halves when the order earns none", () => {
    const r = render("");
    expect(r.html).not.toContain("DAMGA KAZANDINIZ");
    expect(r.html).not.toMatch(/\+\d+ damga/);
    expect(r.text).not.toContain("damga");
    expect(r.text).not.toMatch(/\n\n\n/);
  });
});
