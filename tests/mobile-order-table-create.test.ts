import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminOrder } from "@/lib/admin/store";
import type { PublicCustomer } from "@/lib/customer/store";

import { DEFAULT_MOBILE_APP_CONFIG } from "@/lib/mobile/app-config";

/**
 * `POST /orders` with `fulfillment: "table"` over a fake store: the code must
 * name an ACTIVE table, the order row gets the table's snapshot, and nothing
 * is written or charged for a dead QR. Prepayment is untouched: a table
 * order opens the same checkout every other card order opens.
 */

const placeAppOrder = vi.fn(async (input: Record<string, unknown>) => {
  const order = {
    id: "ord-0901",
    orderNo: 10901,
    customerName: "Eda Mancuso",
    customerEmail: String(input.customerEmail),
    customerPhone: "",
    shippingAddress: String(input.shippingAddress ?? ""),
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
    fulfillment: input.fulfillment,
    tableCode: input.tableCode ?? "",
    tableName: input.tableName ?? "",
  } as unknown as AdminOrder;
  return { ok: true as const, order, promoDropped: false };
});

let ordering = { ...DEFAULT_MOBILE_APP_CONFIG.ordering };

vi.mock("@/lib/admin/store", () => ({
  PENDING_ORDER_TTL_MINUTES: 45,
  applyPaymentSucceeded: vi.fn(async () => ({ ok: true as const })),
  applyPromoCode: vi.fn(),
  customerOrdersByEmail: vi.fn(async () => []),
  expireStalePendingOrders: vi.fn(async () => 0),
  findAppOrderByClientId: vi.fn(async () => null),
  getOrder: vi.fn(async () => null),
  getSettings: vi.fn(async () => ({
    mobileApp: { ...DEFAULT_MOBILE_APP_CONFIG, ordering },
  })),
  placeAppOrder,
  previewAppOrderLines: vi.fn(),
  settleWalletPayment: vi.fn(async () => null),
}));

const lookupTableLimited = vi.fn();
vi.mock("@/lib/mobile/tables", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/mobile/tables")>();
  return { ...real, lookupTableLimited };
});

const createCheckoutSession = vi.fn(async () => ({
  providerRef: "ref-1",
  redirectUrl: "https://pos.example/checkout/ref-1",
  expiresAt: "2026-10-15T13:00:00.000Z",
}));
vi.mock("@/lib/payment", () => ({
  getPaymentProvider: () => ({ name: "mock", createCheckoutSession }),
}));
const sendOrderPlacedEmail = vi.fn(async () => true);
vi.mock("@/lib/email/send", () => ({ sendOrderPlacedEmail }));
vi.mock("@/lib/customer/store", () => ({ getCardUserKey: async () => "" }));
vi.mock("@/lib/customer/coupons", () => ({
  applyCustomerCoupon: vi.fn(),
  couponAllowedForKind: () => true,
  CAFE_ONLY_COUPON_MESSAGE: "",
}));
vi.mock("@/lib/admin/rate-limit", () => ({
  checkLoginLimit: vi.fn(),
  clientIp: async () => "10.0.0.1",
  recordLoginFailure: vi.fn(),
  reserveLoginAttempt: vi.fn(),
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
vi.mock("@/lib/legal/store", async () => {
  const { LEGAL_UPDATED } = await import("@/lib/legal/meta");
  return { checkoutConsentVersion: async () => LEGAL_UPDATED };
});

const { createAppOrder } = await import("@/lib/mobile/orders");

const customer = {
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
} as unknown as PublicCustomer;

function body(over: Record<string, unknown> = {}) {
  return {
    kind: "cafe",
    lines: [{ menuItemId: "mnu-0007", qty: 1, size: "M" as const }],
    fulfillment: "table" as const,
    tableCode: "ABCDEFGH23",
    address: null,
    note: "şekersiz",
    scheduledFor: null,
    promoCode: "",
    clientOrderId: "",
    payWithWallet: false,
    legalConsent: true,
    ...over,
  } as unknown as Parameters<typeof createAppOrder>[1];
}

beforeEach(() => {
  ordering = { ...DEFAULT_MOBILE_APP_CONFIG.ordering };
  placeAppOrder.mockClear();
  createCheckoutSession.mockClear();
  sendOrderPlacedEmail.mockClear();
  lookupTableLimited.mockReset();
  lookupTableLimited.mockResolvedValue({
    ok: true,
    table: { code: "ABCDEFGH23", name: "Bahçe 3" },
  });
});

describe("POST /orders - fulfillment: table", () => {
  it("snapshots the active table onto the order and opens the card checkout", async () => {
    const res = await createAppOrder(customer, body());
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(placeAppOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        fulfillment: "table",
        tableCode: "ABCDEFGH23",
        tableName: "Bahçe 3",
        shippingAddress: "",
      }),
    );
    expect(res.order.table).toEqual({ code: "ABCDEFGH23", name: "Bahçe 3" });
    // Prepayment is mandatory: there is no pay-at-the-table path.
    expect(res.payment?.redirectUrl).toContain("pos.example");
    expect(createCheckoutSession).toHaveBeenCalledTimes(1);
  });

  it("refuses an unknown code with 400 invalid_table and writes nothing", async () => {
    lookupTableLimited.mockResolvedValue({ ok: false, reason: "missing" });
    const res = await createAppOrder(customer, body());
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.failure).toMatchObject({ status: 400, code: "invalid_table" });
    expect(placeAppOrder).not.toHaveBeenCalled();
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("refuses an inactive table with 409 table_inactive", async () => {
    lookupTableLimited.mockResolvedValue({ ok: false, reason: "inactive" });
    const res = await createAppOrder(customer, body());
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.failure).toMatchObject({ status: 409, code: "table_inactive" });
    expect(placeAppOrder).not.toHaveBeenCalled();
  });

  it("passes a lookup lock-out through as 429 with Retry-After", async () => {
    lookupTableLimited.mockResolvedValue({
      ok: false,
      reason: "limited",
      retryAfterSeconds: 300,
    });
    const res = await createAppOrder(customer, body());
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.failure.status).toBe(429);
    expect(res.failure.headers?.["Retry-After"]).toBe("300");
  });

  it("still orders to a table with courier and gel-al both switched off", async () => {
    ordering = { ...ordering, deliveryEnabled: false, pickupEnabled: false };
    const res = await createAppOrder(customer, body());
    expect(res.ok).toBe(true);
  });

  it("is closed by the master cafe switch before the code is even looked up", async () => {
    ordering = { ...ordering, cafeEnabled: false };
    const res = await createAppOrder(customer, body());
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.failure.code).toBe("ordering_closed");
    expect(lookupTableLimited).not.toHaveBeenCalled();
  });

  it("does not look a code up for any other fulfillment", async () => {
    await createAppOrder(
      customer,
      body({ fulfillment: "pickup", tableCode: "" }),
    );
    expect(lookupTableLimited).not.toHaveBeenCalled();
    expect(placeAppOrder).toHaveBeenCalledWith(
      expect.not.objectContaining({ tableCode: expect.anything() }),
    );
  });

  it("mails the confirmation without a cargo line", async () => {
    await createAppOrder(customer, body());
    expect(sendOrderPlacedEmail).toHaveBeenCalledWith(
      expect.objectContaining({ servedAtTable: true }),
    );
  });
});
