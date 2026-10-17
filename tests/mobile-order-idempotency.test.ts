import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminOrder } from "@/lib/admin/store";
import type { PublicCustomer } from "@/lib/customer/store";

import { DEFAULT_MOBILE_APP_CONFIG } from "@/lib/mobile/app-config";

/**
 * `POST /orders` end-to-end over a fake store: the app repeats the id it
 * generated for ONE checkout attempt, and the second call must answer with the
 * order the first one produced.
 *
 * Before `clientOrderId`, a phone that gave up on a slow response - while the
 * server was still mailing the confirmation and opening the checkout session -
 * placed a second order on "Tekrar dene": two pending rows, two e-mails, two
 * held stock claims, and a 429 lock-out after the third try.
 */

// ── the store, as far as createAppOrder can see it ────────────────────────
const placed: AdminOrder[] = [];
let seq = 0;

const placeAppOrder = vi.fn(
  async (input: { customerEmail: string; clientOrderId?: string }) => {
    seq += 1;
    const order: AdminOrder = {
      id: `ord-000${seq}`,
      orderNo: 100 + seq,
      customerName: "Eda Mancuso",
      customerEmail: input.customerEmail,
      customerPhone: "",
      shippingAddress: "",
      internalNote: "",
      status: "pending_payment",
      items: [],
      subtotalMinor: 24500,
      discountMinor: 0,
      promoCode: "",
      shippingMinor: 0,
      totalMinor: 24500,
      refunds: [],
      createdAt: new Date().toISOString(),
      legalConsent: {},
      channel: "app",
      kind: "cafe",
      fulfillment: "pickup",
      clientOrderId: input.clientOrderId ?? "",
    } as unknown as AdminOrder;
    // The partial unique index on (lower(customerEmail), "clientOrderId").
    if (
      input.clientOrderId &&
      placed.some((o) => o.clientOrderId === input.clientOrderId)
    ) {
      const { DbQueryError } = await import("@/lib/db/health");
      throw new DbQueryError(
        "finalizeOrder.insert",
        "duplicate key value violates unique constraint",
        "23505",
        400,
      );
    }
    placed.push(order);
    return { ok: true as const, order, promoDropped: false };
  },
);

const findAppOrderByClientId = vi.fn(
  async (email: string, clientOrderId: string) =>
    placed.find(
      (o) =>
        o.clientOrderId === clientOrderId &&
        o.customerEmail.toLowerCase() === email.toLowerCase(),
    ) ?? null,
);

/**
 * What the POS says about the last attempt before a second page is opened
 * (`checkPendingOrderPaid`, the web checkout's gate). Unpaid unless a test
 * says otherwise; an amount mismatch arrives here as "unknown".
 */
const checkPendingOrderPaid = vi.fn(
  async (): Promise<"paid" | "unpaid" | "unknown"> => "unpaid",
);

vi.mock("@/lib/admin/store", () => ({
  PENDING_ORDER_TTL_MINUTES: 45,
  applyPaymentSucceeded: vi.fn(async () => ({ ok: true as const })),
  applyPromoCode: vi.fn(),
  checkPendingOrderPaid,
  customerOrdersByEmail: vi.fn(async () => placed),
  expireStalePendingOrders: vi.fn(async () => 0),
  findAppOrderByClientId,
  getOrder: vi.fn(
    async (id: string) => placed.find((o) => o.id === id) ?? null,
  ),
  getSettings: vi.fn(async () => ({
    mobileApp: DEFAULT_MOBILE_APP_CONFIG,
  })),
  placeAppOrder,
  previewAppOrderLines: vi.fn(),
  settleWalletPayment: vi.fn(async () => null),
}));

const createCheckoutSession = vi.fn(async () => ({
  providerRef: "ref-1",
  redirectUrl: "https://pos.example/checkout/ref-1",
  expiresAt: "2026-09-05T13:00:00.000Z",
}));
vi.mock("@/lib/payment", () => ({
  getPaymentProvider: () => ({ name: "mock", createCheckoutSession }),
}));

// The customer's one order mail is "ödemen alındı" (`notifyOrderPaid`), sent
// when the payment moves the order to paid - creating an order sends nothing
// (operator, 16 Eki 2026). The mock stands in for it; the tests below hold
// that it is not called at creation.
const notifyOrderPaid = vi.fn(async () => "sent");
vi.mock("@/lib/email/order-notices", () => ({ notifyOrderPaid }));

vi.mock("@/lib/customer/store", () => ({ ensureCardUserKey: async () => "" }));
vi.mock("@/lib/customer/coupons", () => ({
  applyCustomerCoupon: vi.fn(),
  couponAllowedForKind: () => true,
  CAFE_ONLY_COUPON_MESSAGE: "",
}));
const OPEN_GATE = { blocked: false, retryAfterSeconds: 0, remaining: 7 };
const reserveLoginAttempt = vi.fn(async () => OPEN_GATE);
vi.mock("@/lib/admin/rate-limit", () => ({
  checkLoginLimit: vi.fn(),
  clientIp: async () => "10.0.0.1",
  recordLoginFailure: vi.fn(),
  reserveLoginAttempt,
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "user-agent": "LaffogatoApp/1.0" }),
}));
vi.mock("@/lib/mobile/loyalty", () => ({
  getStampedOrderIds: async () => new Set<string>(),
}));
vi.mock("@/lib/db", () => ({
  getDb: () => ({
    from: () => ({ insert: async () => ({ error: null }) }),
  }),
  TABLES: { paymentTransactions: "payment_transactions" },
}));
// The consent version reads the panel overrides; none are published here.
vi.mock("@/lib/legal/store", async () => {
  const { LEGAL_UPDATED } = await import("@/lib/legal/meta");
  return { checkoutConsentVersion: async () => LEGAL_UPDATED };
});

const { createAppOrder, payAppOrder } = await import("@/lib/mobile/orders");

const customer: PublicCustomer = {
  id: "cst-1",
  email: "eda@example.com",
  name: "Eda Mancuso",
  phone: "+90 532 000 00 00",
  birthday: "",
  addresses: [],
  wishlist: [],
  notificationPrefs: {
    orderUpdates: true,
    marketing: false,
    newsletter: false,
  },
  emailVerified: true,
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  inviteCode: "",
  usual: null,
};

function body(clientOrderId: string) {
  return {
    lines: [{ menuItemId: "mnu-0007", qty: 1, size: "M" as const }],
    fulfillment: "pickup" as const,
    note: "",
    scheduledFor: "",
    promoCode: "",
    clientOrderId,
  } as unknown as Parameters<typeof createAppOrder>[1];
}

beforeEach(() => {
  placed.length = 0;
  seq = 0;
  placeAppOrder.mockClear();
  notifyOrderPaid.mockClear();
  createCheckoutSession.mockClear();
  reserveLoginAttempt.mockReset();
  reserveLoginAttempt.mockResolvedValue(OPEN_GATE);
  checkPendingOrderPaid.mockReset();
  checkPendingOrderPaid.mockResolvedValue("unpaid");
});

describe("POST /orders - clientOrderId", () => {
  it("answers a repeat with the SAME order and places nothing new", async () => {
    const first = await createAppOrder(customer, body("attempt-1"));
    const second = await createAppOrder(customer, body("attempt-1"));

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.order.id).toBe(first.order.id);
    expect(second.order.orderNo).toBe(first.order.orderNo);
    expect(placeAppOrder).toHaveBeenCalledTimes(1);
    expect(placed).toHaveLength(1);
  });

  it("mails nothing while the order is unpaid, however often it is retried", async () => {
    // Operator, 16 Eki 2026: "sipariş maili ödeme tam alınmadan gitmesin".
    // The customer's one order mail goes out when the payment moves the
    // order to paid (notifyOrderPaid), never at creation.
    await createAppOrder(customer, body("attempt-1"));
    await createAppOrder(customer, body("attempt-1"));
    expect(notifyOrderPaid).not.toHaveBeenCalled();
  });

  it("re-opens the checkout for the retry - provider sessions expire", async () => {
    const first = await createAppOrder(customer, body("attempt-1"));
    const second = await createAppOrder(customer, body("attempt-1"));
    expect(first.ok && first.payment?.redirectUrl).toBeTruthy();
    expect(second.ok && second.payment?.redirectUrl).toBeTruthy();
    expect(createCheckoutSession).toHaveBeenCalledTimes(2);
  });

  it("never answers an unpaid retry with payment: null", async () => {
    // §3: `payment` is null only for a ₺0 order. When the POS could not be
    // reopened the replay used to swallow it and answer 201 + null, and the
    // app emptied the basket and showed an unpaid order as placed.
    await createAppOrder(customer, body("attempt-1"));
    createCheckoutSession.mockRejectedValueOnce(new Error("POS down"));
    await expect(createAppOrder(customer, body("attempt-1"))).rejects.toThrow(
      "POS down",
    );
    // …and the attempt after that replays the SAME order with a session.
    const third = await createAppOrder(customer, body("attempt-1"));
    expect(third.ok && third.payment?.redirectUrl).toBeTruthy();
    expect(placeAppOrder).toHaveBeenCalledTimes(1);
  });

  it("replays a committed order even after staff close ordering", async () => {
    // The retry of an order that already exists is not a new order: it used
    // to hit the operator's switch first and come back 409 ordering_closed.
    const first = await createAppOrder(customer, body("attempt-1"));
    const { getSettings } = await import("@/lib/admin/store");
    const open = vi.mocked(getSettings).getMockImplementation();
    vi.mocked(getSettings).mockImplementation(
      async () =>
        ({
          mobileApp: {
            ...DEFAULT_MOBILE_APP_CONFIG,
            ordering: {
              ...DEFAULT_MOBILE_APP_CONFIG.ordering,
              cafeEnabled: false,
            },
          },
        }) as Awaited<ReturnType<typeof getSettings>>,
    );
    try {
      const cafe = (id: string) =>
        ({ ...body(id), kind: "cafe" }) as Parameters<typeof createAppOrder>[1];
      const retry = await createAppOrder(customer, cafe("attempt-1"));
      expect(retry.ok).toBe(true);
      expect(retry.ok && retry.order.id).toBe(first.ok && first.order.id);
      // …while a NEW order is still refused.
      const fresh = await createAppOrder(customer, cafe("attempt-9"));
      expect(!fresh.ok && fresh.failure.code).toBe("ordering_closed");
    } finally {
      vi.mocked(getSettings).mockImplementation(open!);
    }
  });

  it("treats a different attempt id as a different order", async () => {
    const first = await createAppOrder(customer, body("attempt-1"));
    const second = await createAppOrder(customer, body("attempt-2"));
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.order.id).not.toBe(first.order.id);
    expect(placeAppOrder).toHaveBeenCalledTimes(2);
  });

  it("replays when the two POSTs race and the unique index refuses the second", async () => {
    // Both calls miss the lookup - the first row has not committed yet - so
    // the insert is what refuses the duplicate. The member must get the one
    // order back, not a 500 they retry into a third attempt.
    await createAppOrder(customer, body("attempt-1"));
    findAppOrderByClientId.mockResolvedValueOnce(null);
    const raced = await createAppOrder(customer, body("attempt-1"));
    expect(raced.ok).toBe(true);
    if (!raced.ok) return;
    expect(raced.order.id).toBe("ord-0001");
    expect(placed).toHaveLength(1);
  });
});

/**
 * `POST /orders/{id}/payment` (W8a): the order abandoned at the POS, paid from
 * "Siparişlerim" long after the checkout that made it - by id, because the app
 * no longer holds the `clientOrderId`.
 */
describe("POST /orders/{id}/payment", () => {
  it("reopens the checkout of the member's own unpaid app order, and places nothing", async () => {
    const first = await createAppOrder(customer, body("attempt-1"));
    if (!first.ok) throw new Error("setup");
    createCheckoutSession.mockClear();

    const paid = await payAppOrder(customer, first.order.id);
    expect(paid.ok).toBe(true);
    if (!paid.ok) return;
    expect(paid.order.id).toBe(first.order.id);
    expect(paid.payment.redirectUrl).toBeTruthy();
    expect(createCheckoutSession).toHaveBeenCalledTimes(1);
    expect(placeAppOrder).toHaveBeenCalledTimes(1);
    expect(notifyOrderPaid).not.toHaveBeenCalled();
  });

  it("answers a stranger's id exactly like a missing one", async () => {
    const first = await createAppOrder(customer, body("attempt-1"));
    if (!first.ok) throw new Error("setup");
    const stranger = { ...customer, email: "someone@example.com" };
    expect(await payAppOrder(stranger, first.order.id)).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(await payAppOrder(customer, "ord-9999")).toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("does not reopen anything for an unverified member", async () => {
    const first = await createAppOrder(customer, body("attempt-1"));
    if (!first.ok) throw new Error("setup");
    const unverified = { ...customer, emailVerified: false };
    expect((await payAppOrder(unverified, first.order.id)).ok).toBe(false);
  });

  it("leaves a web order to the web's own checkout", async () => {
    const first = await createAppOrder(customer, body("attempt-1"));
    if (!first.ok) throw new Error("setup");
    placed[0] = { ...placed[0]!, channel: "web" } as AdminOrder;
    expect(await payAppOrder(customer, first.order.id)).toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("calls an order with nothing to pay not_payable, and hands it back as it stands", async () => {
    const first = await createAppOrder(customer, body("attempt-1"));
    if (!first.ok) throw new Error("setup");
    placed[0] = { ...placed[0]!, status: "paid" } as AdminOrder;
    createCheckoutSession.mockClear();
    const answer = await payAppOrder(customer, first.order.id);
    expect(answer.ok).toBe(false);
    if (answer.ok || answer.reason !== "not_payable") return;
    expect(answer.order.id).toBe(first.order.id);
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });
});

/**
 * WS1-02: every reopened checkout is a call to the payment provider and a
 * pending `payment_transactions` row. Nothing bounded it, so one member with
 * one unpaid order could open POS sessions from the merchant account in a
 * loop, by either door.
 */
describe("reopening the POS is budgeted per member", () => {
  const BLOCKED = { blocked: true, retryAfterSeconds: 540, remaining: 0 };

  it("does not count the first session of a new order", async () => {
    const first = await createAppOrder(customer, body("attempt-1"));
    expect(first.ok && first.payment?.redirectUrl).toBeTruthy();
    expect(reserveLoginAttempt).not.toHaveBeenCalled();
  });

  it("counts a clientOrderId replay against the member, before the POS is called", async () => {
    await createAppOrder(customer, body("attempt-1"));
    createCheckoutSession.mockClear();
    await createAppOrder(customer, body("attempt-1"));
    expect(reserveLoginAttempt).toHaveBeenCalledWith(
      "checkout-reopen",
      "",
      customer.email,
    );
    expect(createCheckoutSession).toHaveBeenCalledTimes(1);
  });

  it("answers a spent budget with 429 rate_limited and opens no session", async () => {
    await createAppOrder(customer, body("attempt-1"));
    createCheckoutSession.mockClear();
    reserveLoginAttempt.mockResolvedValue(BLOCKED);
    const retry = await createAppOrder(customer, body("attempt-1"));
    expect(retry.ok).toBe(false);
    if (retry.ok) return;
    expect(retry.failure).toMatchObject({ status: 429, code: "rate_limited" });
    expect(retry.failure.headers).toEqual({ "Retry-After": "540" });
    expect(createCheckoutSession).not.toHaveBeenCalled();
    expect(placeAppOrder).toHaveBeenCalledTimes(1);
  });

  it("holds the same budget on POST /orders/{id}/payment", async () => {
    const first = await createAppOrder(customer, body("attempt-1"));
    if (!first.ok) throw new Error("setup");
    createCheckoutSession.mockClear();
    reserveLoginAttempt.mockResolvedValue(BLOCKED);
    const paid = await payAppOrder(customer, first.order.id);
    expect(paid.ok).toBe(false);
    if (paid.ok || paid.reason !== "refused") {
      throw new Error(`expected refused, got ${JSON.stringify(paid)}`);
    }
    expect(paid.failure.code).toBe("rate_limited");
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("asks the POS only after the budget, so a spent budget asks nothing", async () => {
    await createAppOrder(customer, body("attempt-1"));
    reserveLoginAttempt.mockResolvedValue(BLOCKED);
    await createAppOrder(customer, body("attempt-1"));
    expect(checkPendingOrderPaid).not.toHaveBeenCalled();
  });
});

/**
 * PayNkolay takes a second sale on the same `clientRefCode` (docs/PAYNKOLAY.md
 * §2). A payment whose return was lost - a closed tab, a phone that locked on
 * the bank's page - leaves the order `pending_payment`, and a second page then
 * charged the card twice. Both doors that reopen an order ask the POS first
 * (`checkPendingOrderPaid`), after the reopen budget and before the session.
 */
describe("reopening asks the POS about the last attempt first", () => {
  /** The lookup books a payment it finds (applyPaymentSucceeded) before it answers. */
  function paidAtThePos() {
    checkPendingOrderPaid.mockImplementationOnce(async () => {
      placed[0] = { ...placed[0]!, status: "paid" } as AdminOrder;
      return "paid";
    });
  }

  it("POST /orders/{id}/payment: a payment the POS holds is booked, no session, not_payable", async () => {
    const first = await createAppOrder(customer, body("attempt-1"));
    if (!first.ok) throw new Error("setup");
    createCheckoutSession.mockClear();
    paidAtThePos();
    const answer = await payAppOrder(customer, first.order.id);
    if (answer.ok || answer.reason !== "not_payable") {
      throw new Error(`expected not_payable, got ${JSON.stringify(answer)}`);
    }
    expect(answer.order.status).toBe("paid");
    expect(createCheckoutSession).not.toHaveBeenCalled();
    expect(checkPendingOrderPaid).toHaveBeenCalledTimes(1);
    expect(vi.mocked(checkPendingOrderPaid).mock.calls[0]).toEqual([
      expect.objectContaining({ id: first.order.id }),
      expect.objectContaining({ name: "mock" }),
    ]);
  });

  it("POST /orders/{id}/payment: a POS that cannot be asked is 503 payment_unavailable, no session", async () => {
    const first = await createAppOrder(customer, body("attempt-1"));
    if (!first.ok) throw new Error("setup");
    createCheckoutSession.mockClear();
    checkPendingOrderPaid.mockResolvedValueOnce("unknown");
    const answer = await payAppOrder(customer, first.order.id);
    if (answer.ok || answer.reason !== "refused") {
      throw new Error(`expected refused, got ${JSON.stringify(answer)}`);
    }
    expect(answer.failure).toMatchObject({
      status: 503,
      code: "payment_unavailable",
    });
    expect(answer.failure.message).toMatch(/doğrulayamıyoruz/);
    expect(createCheckoutSession).not.toHaveBeenCalled();
    expect(placed[0]!.status).toBe("pending_payment");
  });

  it("the clientOrderId replay: a payment the POS holds is booked and answered without a session", async () => {
    await createAppOrder(customer, body("attempt-1"));
    createCheckoutSession.mockClear();
    paidAtThePos();
    const retry = await createAppOrder(customer, body("attempt-1"));
    expect(retry.ok).toBe(true);
    if (!retry.ok) return;
    expect(retry.order.status).toBe("paid");
    expect(retry.payment).toBeNull();
    expect(createCheckoutSession).not.toHaveBeenCalled();
    expect(placeAppOrder).toHaveBeenCalledTimes(1);
  });

  it("the clientOrderId replay: a POS that cannot be asked is 503 payment_unavailable, no session", async () => {
    await createAppOrder(customer, body("attempt-1"));
    createCheckoutSession.mockClear();
    checkPendingOrderPaid.mockResolvedValueOnce("unknown");
    const retry = await createAppOrder(customer, body("attempt-1"));
    expect(retry.ok).toBe(false);
    if (retry.ok) return;
    expect(retry.failure).toMatchObject({
      status: 503,
      code: "payment_unavailable",
    });
    expect(createCheckoutSession).not.toHaveBeenCalled();
    expect(placeAppOrder).toHaveBeenCalledTimes(1);
  });

  it("a first checkout asks nothing: there is no earlier attempt", async () => {
    const first = await createAppOrder(customer, body("attempt-1"));
    expect(first.ok && first.payment?.redirectUrl).toBeTruthy();
    expect(checkPendingOrderPaid).not.toHaveBeenCalled();
  });
});
