import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDb, type Executor } from "@/lib/db/client";

/**
 * Who may change an order's customer card (admin audit ORD-16, karar D2).
 *
 * Member history is read by the order's e-mail: any orders role (Personel
 * included) could rewrite it on any order, completed and refunded ones too,
 * and a typo moved the order with its address and phone into another
 * member's app. The audit row said only "customer_delivery", so the old
 * address existed nowhere afterwards.
 */

const seen: { text: string; params: readonly unknown[] }[] = [];
let stored: Record<string, unknown> | null = null;
let updatedRows = 1;
let stampRows = 0;
let couponRows = 0;

const exec: Executor = async ({ text, params }) => {
  seen.push({ text, params });
  if (/^SELECT count\(\*\)/.test(text))
    return { rows: [{ count: 1 }], rowCount: 1 };
  if (/^SELECT .* FROM "loyalty_stamps"/.test(text)) {
    const rows = Array.from({ length: stampRows }, () => ({ id: "stp-1" }));
    return { rows, rowCount: rows.length };
  }
  if (/^SELECT .* FROM "customer_coupons"/.test(text)) {
    const rows = Array.from({ length: couponRows }, () => ({ id: "cpn-1" }));
    return { rows, rowCount: rows.length };
  }
  if (/^SELECT .* FROM "orders"/.test(text)) {
    return stored ? { rows: [stored], rowCount: 1 } : { rows: [], rowCount: 0 };
  }
  if (/^UPDATE "orders"/.test(text)) {
    const rows = Array.from({ length: updatedRows }, () => ({ id: "ord-1" }));
    return { rows, rowCount: rows.length };
  }
  return { rows: [], rowCount: 0 };
};

vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const db = createDb(exec);
  return { ...real, getDb: () => db };
});

const store = await import("@/lib/admin/store");
const {
  ORDER_DETAILS_MESSAGES,
  orderDetailsChange,
  orderDetailsRefusal,
  orderDetailsRules,
} = await import("@/lib/admin/order-details");

beforeEach(() => {
  seen.length = 0;
  updatedRows = 1;
  stampRows = 0;
  couponRows = 0;
  stored = {
    id: "ord-1",
    orderNo: 10023,
    status: "preparing",
    customerName: "Eda Mancuso",
    customerEmail: "eda@example.com",
    customerPhone: "+90 532 000 00 00",
    shippingAddress: "Postane Mah. No: 28, Tuzla",
    items: [],
    refunds: [],
    totalMinor: 10_000,
    createdAt: "2026-10-17T08:00:00.000Z",
  };
});

describe("orderDetailsRules", () => {
  it("staff edit name, phone and address of an open order, never the e-mail", () => {
    const r = orderDetailsRules({ status: "preparing" }, "staff");
    expect(r.editable).toBe(true);
    expect(r.emailEditable).toBe(false);
    expect(r.emailReason).toBe(ORDER_DETAILS_MESSAGES.emailRole);
  });

  it("staff edit nothing on a closed order", () => {
    for (const status of ["completed", "cancelled", "refunded"] as const) {
      const r = orderDetailsRules({ status }, "staff");
      expect(r.editable, status).toBe(false);
      expect(r.reason, status).toBe(ORDER_DETAILS_MESSAGES.closed);
    }
  });

  it("the owner changes the e-mail of an open order, not of a closed one", () => {
    expect(
      orderDetailsRules({ status: "shipped" }, "owner").emailEditable,
    ).toBe(true);
    expect(
      orderDetailsRules({ status: "pending_payment" }, "manager").emailEditable,
    ).toBe(true);
    const done = orderDetailsRules({ status: "completed" }, "owner");
    expect(done.editable).toBe(true);
    expect(done.emailEditable).toBe(false);
    expect(done.emailReason).toBe(ORDER_DETAILS_MESSAGES.emailClosed);
  });

  it("locks the e-mail of an order with stamps or a coupon filed under it", () => {
    const held = orderDetailsRules({ status: "paid" }, "owner", true);
    expect(held.editable).toBe(true);
    expect(held.emailEditable).toBe(false);
    expect(held.emailReason).toBe(ORDER_DETAILS_MESSAGES.emailLedger);
    // Staff are still told the role is why.
    expect(
      orderDetailsRules({ status: "paid" }, "staff", true).emailReason,
    ).toBe(ORDER_DETAILS_MESSAGES.emailRole);
  });
});

describe("orderDetailsRefusal", () => {
  const open = { status: "paid" as const, customerEmail: "eda@example.com" };

  it("lets a save that keeps the e-mail through, or leaves it out", () => {
    expect(
      orderDetailsRefusal(
        open,
        { customerEmail: " eda@example.com " },
        "staff",
        false,
      ),
    ).toBeNull();
    expect(orderDetailsRefusal(open, {}, "staff", false)).toBeNull();
  });

  it("refuses a staff e-mail change, a blank one too", () => {
    expect(
      orderDetailsRefusal(
        open,
        { customerEmail: "baska@example.com" },
        "staff",
        true,
      ),
    ).toBe(ORDER_DETAILS_MESSAGES.emailRole);
    expect(
      orderDetailsRefusal(open, { customerEmail: "" }, "staff", true),
    ).toBe(ORDER_DETAILS_MESSAGES.emailRole);
  });

  it("wants the owner's confirm before the order moves", () => {
    expect(
      orderDetailsRefusal(
        open,
        { customerEmail: "baska@example.com" },
        "owner",
        false,
      ),
    ).toBe(ORDER_DETAILS_MESSAGES.emailConfirm);
    expect(
      orderDetailsRefusal(
        open,
        { customerEmail: "baska@example.com" },
        "owner",
        true,
      ),
    ).toBeNull();
  });

  it("refuses an e-mail change on a closed order even for the owner", () => {
    expect(
      orderDetailsRefusal(
        { status: "refunded", customerEmail: "eda@example.com" },
        { customerEmail: "baska@example.com" },
        "owner",
        true,
      ),
    ).toBe(ORDER_DETAILS_MESSAGES.emailClosed);
  });
});

describe("orderDetailsChange: the audit payload", () => {
  it("keeps the old and new value of each changed field, nothing else", () => {
    const before = {
      customerName: "Eda Mancuso",
      customerEmail: "eda@example.com",
      customerPhone: "+90 532 000 00 00",
      shippingAddress: "Eski adres",
    };
    const c = orderDetailsChange(before, {
      ...before,
      customerEmail: "eda.m@example.com",
      shippingAddress: "Yeni adres",
    });
    expect(c.changed).toEqual(["customerEmail", "shippingAddress"]);
    // The old address in full: the audit log is owner-only and this is the
    // only copy that can put it back.
    expect(c.before).toEqual({
      customerEmail: "eda@example.com",
      shippingAddress: "Eski adres",
    });
    expect(c.after).toEqual({
      customerEmail: "eda.m@example.com",
      shippingAddress: "Yeni adres",
    });
  });
});

describe("updateOrderDetails", () => {
  const input = {
    customerName: "Eda M.",
    customerPhone: "+90 532 000 00 00",
    shippingAddress: "Postane Mah. No: 28, Tuzla",
  };

  it("writes only when the order is still in the status and e-mail it was judged by", async () => {
    const res = await store.updateOrderDetails("ord-1", input);
    expect(res.ok).toBe(true);
    const update = seen.find((q) => /^UPDATE "orders"/.test(q.text))!;
    expect(update.text).toMatch(
      /WHERE "id" = \$\d+ AND "status" = \$\d+ AND "customerEmail" = \$\d+/,
    );
    expect(update.params).toEqual(
      expect.arrayContaining(["ord-1", "preparing", "eda@example.com"]),
    );
    // Left out of the input: the e-mail is not written at all.
    expect(update.text.split(" WHERE ")[0]).not.toContain('"customerEmail"');
    if (res.ok) {
      expect(res.before.customerName).toBe("Eda Mancuso");
      expect(res.order.customerName).toBe("Eda M.");
    }
  });

  it("answers 'changed' when the row moved in between, writing nothing", async () => {
    updatedRows = 0;
    const res = await store.updateOrderDetails("ord-1", input);
    expect(res).toEqual({
      ok: false,
      error: "Sipariş bu arada değişti. Sayfa yenilendi, tekrar bak.",
    });
  });

  it("asks the rule about the stored order and stops before any write", async () => {
    const refuse = vi.fn(() => "Hayır.");
    const res = await store.updateOrderDetails(
      "ord-1",
      { ...input, customerEmail: "baska@example.com" },
      refuse,
    );
    expect(res).toEqual({ ok: false, error: "Hayır." });
    expect(refuse).toHaveBeenCalledWith(
      expect.objectContaining({ status: "preparing" }),
    );
    expect(seen.some((q) => /^UPDATE/.test(q.text))).toBe(false);
  });

  // Verifier C1: a cancel or refund finds the order's stamps and member
  // coupon by its e-mail as it is then. Moved, they stayed with the old
  // address: the member kept the stamps of a refunded order.
  it("refuses an e-mail that would leave stamps under the old address", async () => {
    stampRows = 1;
    const res = await store.updateOrderDetails("ord-1", {
      ...input,
      customerEmail: "baska@example.com",
    });
    expect(res).toEqual({
      ok: false,
      error: ORDER_DETAILS_MESSAGES.emailLedger,
    });
    expect(seen.some((q) => /^UPDATE/.test(q.text))).toBe(false);
  });

  it("refuses it for a member coupon the order spent", async () => {
    stored = { ...stored!, promoCode: "HOSGELDIN-AB12" };
    couponRows = 1;
    const res = await store.updateOrderDetails("ord-1", {
      ...input,
      customerEmail: "baska@example.com",
    });
    expect(res).toEqual({
      ok: false,
      error: ORDER_DETAILS_MESSAGES.emailLedger,
    });
    const coupon = seen.find((q) => /FROM "customer_coupons"/.test(q.text))!;
    expect(coupon.params).toContain(10023);
  });

  it("refuses it for a paid app cafe order before its stamp row is there", async () => {
    // The stamp is written just after the payment, under the e-mail the
    // order had then.
    stored = {
      ...stored!,
      status: "paid",
      channel: "app",
      kind: "cafe",
      totalMinor: 70_000,
      shippingMinor: 0,
      paidAt: "2026-10-17T08:01:00.000Z",
    };
    const res = await store.updateOrderDetails("ord-1", {
      ...input,
      customerEmail: "baska@example.com",
    });
    expect(res).toEqual({
      ok: false,
      error: ORDER_DETAILS_MESSAGES.emailLedger,
    });
  });

  it("still moves an order nothing is filed under, and a case-only fix never asks", async () => {
    const moved = await store.updateOrderDetails("ord-1", {
      ...input,
      customerEmail: "baska@example.com",
    });
    expect(moved.ok).toBe(true);
    stampRows = 1;
    seen.length = 0;
    const cased = await store.updateOrderDetails("ord-1", {
      ...input,
      customerEmail: "Eda@Example.com",
    });
    expect(cased.ok).toBe(true);
    expect(seen.some((q) => /FROM "loyalty_stamps"/.test(q.text))).toBe(false);
  });

  it("says the order is gone", async () => {
    stored = null;
    expect(await store.updateOrderDetails("ord-1", input)).toEqual({
      ok: false,
      error: "Sipariş bulunamadı.",
    });
  });
});
