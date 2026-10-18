import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminOrder } from "@/lib/admin/store";
import type { PublicCustomer } from "@/lib/customer/store";

import { DEFAULT_MOBILE_APP_CONFIG } from "@/lib/mobile/app-config";

/**
 * An app order mints no card key while card storage is off.
 *
 * `POST /orders` used to call `ensureCardUserKey` before every card checkout,
 * so each member who ordered from the app got a random PayNkolay member key
 * in `customers."cardUserKey"` although no card can be saved. The web
 * checkout already asked `cardStorageEnabled` first (src/app/odeme/actions.ts);
 * the app path now asks the same question. The `/me` answer never carried
 * the key, so nothing in the v1 contract changes.
 */

const h = vi.hoisted(() => ({
  storage: false as boolean | undefined,
  ensureCardUserKey: vi.fn(),
  createCheckoutSession: vi.fn(),
}));

const placeAppOrder = vi.fn(async (input: Record<string, unknown>) => {
  const order = {
    id: "ord-0901",
    orderNo: 10901,
    customerName: "Eda Mancuso",
    customerEmail: String(input.customerEmail),
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
    fulfillment: input.fulfillment,
    tableCode: input.tableCode ?? "",
    tableName: input.tableName ?? "",
  } as unknown as AdminOrder;
  return { ok: true as const, order, promoDropped: false };
});

vi.mock("@/lib/admin/store", () => ({
  PENDING_ORDER_TTL_MINUTES: 45,
  applyPaymentSucceeded: vi.fn(async () => ({ ok: true as const })),
  applyPromoCode: vi.fn(),
  customerOrdersByEmail: vi.fn(async () => []),
  expireStalePendingOrders: vi.fn(async () => 0),
  findAppOrderByClientId: vi.fn(async () => null),
  getOrder: vi.fn(async () => null),
  getSettings: vi.fn(async () => ({
    mobileApp: {
      ...DEFAULT_MOBILE_APP_CONFIG,
      ordering: { ...DEFAULT_MOBILE_APP_CONFIG.ordering },
    },
  })),
  placeAppOrder,
  previewAppOrderLines: vi.fn(),
  settleWalletPayment: vi.fn(async () => null),
}));
vi.mock("@/lib/mobile/tables", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/mobile/tables")>();
  return {
    ...real,
    lookupTableLimited: vi.fn(async () => ({
      ok: true,
      table: { code: "ABCDEFGH23", name: "Bahçe 3" },
    })),
  };
});
vi.mock("@/lib/payment", () => ({
  getPaymentProvider: () => ({
    name: "paynkolay",
    cardStorageEnabled: h.storage,
    createCheckoutSession: h.createCheckoutSession,
  }),
}));
vi.mock("@/lib/email/order-notices", () => ({
  notifyOrderPaid: vi.fn(async () => "sent"),
}));
vi.mock("@/lib/customer/store", () => ({
  getCardUserKey: async () => "",
  ensureCardUserKey: h.ensureCardUserKey,
}));
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
  getOrderStamps: async () => new Map<string, number>(),
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

const body = {
  kind: "cafe",
  lines: [{ menuItemId: "mnu-0007", qty: 1, size: "M" as const }],
  fulfillment: "table" as const,
  tableCode: "ABCDEFGH23",
  address: null,
  note: "",
  scheduledFor: null,
  promoCode: "",
  clientOrderId: "",
  payWithWallet: false,
  legalConsent: true,
} as unknown as Parameters<typeof createAppOrder>[1];

/** The key the payment page was opened with. */
function sentKey(): unknown {
  const input = h.createCheckoutSession.mock.calls[0]?.[0] as
    | { cardUserKey?: string }
    | undefined;
  return input?.cardUserKey;
}

beforeEach(() => {
  h.storage = false;
  h.ensureCardUserKey.mockReset();
  h.ensureCardUserKey.mockResolvedValue("MEMBERKEY01");
  h.createCheckoutSession.mockReset();
  h.createCheckoutSession.mockResolvedValue({
    providerRef: "ref-1",
    redirectUrl: "https://pos.example/checkout/ref-1",
    expiresAt: "2026-10-15T13:00:00.000Z",
  });
});

describe("app order and the member's card key", () => {
  it("mints no key and sends none while card storage is off", async () => {
    const res = await createAppOrder(customer, body);
    expect(res.ok).toBe(true);
    expect(h.createCheckoutSession).toHaveBeenCalledTimes(1);
    expect(h.ensureCardUserKey).not.toHaveBeenCalled();
    expect(sentKey()).toBeUndefined();
  });

  it("reads a provider that says nothing about card storage as off", async () => {
    h.storage = undefined;
    await createAppOrder(customer, body);
    expect(h.ensureCardUserKey).not.toHaveBeenCalled();
    expect(sentKey()).toBeUndefined();
  });

  it("uses the member's key once card storage is on", async () => {
    h.storage = true;
    await createAppOrder(customer, body);
    expect(h.ensureCardUserKey).toHaveBeenCalledWith("eda@example.com");
    expect(sentKey()).toBe("MEMBERKEY01");
  });
});
