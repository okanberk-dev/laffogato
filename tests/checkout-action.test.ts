import { beforeEach, describe, expect, it, vi } from "vitest";

import { checkoutCartKey } from "@/lib/checkout/cart-key";
import { PaynkolayPaymentProvider } from "@/lib/payment/paynkolay";

/**
 * startCheckoutAction, run for real with its collaborators faked: what it
 * does with a retry (the POS is asked before an old order's payload is
 * handed out again) and with a zero-total order whose settling failed.
 * No card, no network, no database.
 */

const provider = new PaynkolayPaymentProvider({
  sx: "SX-TOKEN",
  sxList: "SX-LIST",
  sxCancel: "SX-CANCEL",
  merchantSecretKey: "MERCHANT-SECRET-0001",
  merchantNo: "400000001",
  baseUrl: "https://paynkolaytest.nkolayislem.com.tr",
  successUrl: "https://laffogato.net/odeme/donus",
  failUrl: "https://laffogato.net/odeme/donus",
  checkoutMode: "direct",
});

const store = vi.hoisted(() => ({
  applyPaymentSucceeded: vi.fn(),
  applyPromoCode: vi.fn(),
  checkPendingOrderPaid: vi.fn(),
  getOrder: vi.fn(),
  isOwnUnpaidWebOrder: vi.fn(),
  placeOrder: vi.fn(),
}));
vi.mock("@/lib/admin/store", () => store);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "user-agent": "vitest" }),
}));
vi.mock("@/lib/admin/rate-limit", () => ({
  clientIp: async () => "85.105.1.1",
  reserveLoginAttempt: async () => ({
    blocked: false,
    retryAfterSeconds: 0,
    remaining: 9,
  }),
}));
const customer = {
  id: "cst-1",
  email: "ada@example.com",
  name: "Ada Lovelace",
  phone: "0532 123 45 67",
  emailVerified: true,
};
vi.mock("@/lib/customer/auth", () => ({
  getActiveCustomer: async () => customer,
}));
vi.mock("@/lib/customer/coupons", () => ({
  applyCustomerCoupon: vi.fn(),
  CAFE_ONLY_COUPON_MESSAGE: "",
  couponAllowedForKind: () => true,
  evaluateCoupon: vi.fn(),
}));
vi.mock("@/lib/customer/store", () => ({ ensureCardUserKey: async () => "" }));
vi.mock("@/lib/legal/store", () => ({
  checkoutConsentVersion: async () => "v1",
}));
vi.mock("@/lib/payment", () => ({ getPaymentProvider: () => provider }));
vi.mock("@/lib/payment/saved-cards", () => ({
  deleteCheckoutSavedCard: vi.fn(),
}));

const { startCheckoutAction } = await import("@/app/odeme/actions");

const ITEMS = [{ productId: "prd-1", name: "Çekirdek", price: 640.05, qty: 2 }];
const FIELDS = {
  customerName: "Ada Lovelace",
  customerPhone: "0532 123 45 67",
  shippingAddress: "Postane Mah. 28, Tuzla, İstanbul",
};

function orderRow(over: Record<string, unknown> = {}) {
  return {
    id: "ord-0284",
    orderNo: 10284,
    customerName: FIELDS.customerName,
    customerEmail: customer.email,
    customerPhone: FIELDS.customerPhone,
    shippingAddress: FIELDS.shippingAddress,
    status: "pending_payment",
    items: [
      {
        productId: "prd-1",
        productName: "Çekirdek",
        qty: 2,
        unitPriceMinor: 64005,
        status: "pending",
      },
    ],
    subtotalMinor: 128010,
    discountMinor: 0,
    shippingMinor: 0,
    totalMinor: 128010,
    promoCode: "",
    channel: "web",
    ...over,
  };
}

async function payloadFor(orderId: string, amountMinor = 128010) {
  const session = await provider.createCheckoutSession({
    orderId,
    amountMinor,
    currency: "TRY",
    customer: { id: "c", email: customer.email, fullName: "Ada" },
    billingAddress: { city: "", district: "", line1: "x" },
    shippingAddress: { city: "", district: "", line1: "x" },
    items: [
      { productId: "", name: "x", unitPriceMinor: amountMinor, quantity: 1 },
    ],
    successUrl: "https://laffogato.net/odeme/donus",
    failureUrl: "https://laffogato.net/odeme?error=payment",
    buyerIp: "85.105.1.1",
  });
  const url = new URL(session.redirectUrl);
  return { d: url.searchParams.get("d")!, s: url.searchParams.get("s")! };
}

function form(extra: Record<string, string> = {}) {
  const fd = new FormData();
  fd.set("items", JSON.stringify(ITEMS));
  fd.set("legalConsent", "on");
  for (const [k, v] of Object.entries(FIELDS)) fd.set(k, v);
  fd.set("promoCode", "");
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  return fd;
}

async function retryForm() {
  const { d, s } = await payloadFor("ord-0284");
  const cartKey = checkoutCartKey({
    items: [{ productId: "prd-1", name: "Çekirdek", qty: 2 }],
    ...FIELDS,
    promoCode: "",
  });
  return {
    d,
    s,
    fd: form({
      reuseOrderId: "ord-0284",
      reuseData: d,
      reuseSignature: s,
      reuseCartKey: cartKey,
    }),
  };
}

beforeEach(() => {
  for (const fn of Object.values(store)) fn.mockReset();
  store.getOrder.mockResolvedValue(orderRow());
  store.placeOrder.mockResolvedValue({
    ok: true,
    order: orderRow({ id: "ord-0285", orderNo: 10285 }),
    priceAdjusted: false,
    promoDropped: false,
  });
  store.applyPaymentSucceeded.mockResolvedValue({ ok: true });
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("a retry of a declined card", () => {
  it("reuses the order when the POS knows nothing of a payment", async () => {
    const { d, s, fd } = await retryForm();
    store.checkPendingOrderPaid.mockResolvedValue("unpaid");
    const res = await startCheckoutAction(fd);
    expect(res).toMatchObject({ kind: "card", d, s });
    expect(store.checkPendingOrderPaid).toHaveBeenCalledTimes(1);
    expect(store.placeOrder).not.toHaveBeenCalled();
  });

  it("goes to the success page when the POS shows the old order paid", async () => {
    // The customer paid at the bank, the return POST was lost, and they
    // pressed pay again: the same order must not be charged twice.
    const { fd } = await retryForm();
    store.checkPendingOrderPaid.mockResolvedValue("paid");
    const res = await startCheckoutAction(fd);
    expect(res).toEqual({
      kind: "paid",
      url: "/odeme/basarili?ref=ord-0284",
    });
    expect(store.placeOrder).not.toHaveBeenCalled();
  });

  it("makes a NEW order, not a reuse, when the POS cannot be asked", async () => {
    const { d, fd } = await retryForm();
    store.checkPendingOrderPaid.mockResolvedValue("unknown");
    const res = await startCheckoutAction(fd);
    expect(store.placeOrder).toHaveBeenCalledTimes(1);
    expect(res).toMatchObject({ kind: "card" });
    expect(res.kind === "card" && res.d).not.toBe(d);
  });

  it("does not even ask the POS for a claim the rules refused", async () => {
    const { fd } = await retryForm();
    store.getOrder.mockResolvedValue(orderRow({ status: "cancelled" }));
    await startCheckoutAction(fd);
    expect(store.checkPendingOrderPaid).not.toHaveBeenCalled();
    expect(store.placeOrder).toHaveBeenCalledTimes(1);
  });
});

describe("a zero-total order", () => {
  const zero = () =>
    store.placeOrder.mockResolvedValue({
      ok: true,
      order: orderRow({
        id: "ord-0300",
        totalMinor: 0,
        subtotalMinor: 0,
        items: [],
      }),
      priceAdjusted: false,
      promoDropped: false,
    });

  it("goes to the success page once it is settled", async () => {
    zero();
    const res = await startCheckoutAction(form());
    expect(res).toEqual({
      kind: "paid",
      url: "/odeme/basarili?ref=ord-0300",
    });
    expect(store.applyPaymentSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "free", amountMinor: 0 }),
    );
  });

  it("is an error - not 'paid' - when settling it failed", async () => {
    zero();
    store.applyPaymentSucceeded.mockResolvedValue({
      ok: false,
      error: "db down",
    });
    const res = await startCheckoutAction(form());
    expect(res.kind).toBe("error");
    expect(res.kind === "error" && res.error.code).toBe("unavailable");
    expect(res.kind === "error" && res.error.message).toContain(
      "kartından para çekilmedi",
    );
  });
});

describe("a refused basket", () => {
  it("asks for a variant when the cart holds a product sold by its variants without one", async () => {
    // The shop card's quick add put such a line in the cart; the store now
    // refuses it (tests/order-variant-lines.test.ts) and the page says what
    // to change instead of "artık satışta değil".
    store.placeOrder.mockResolvedValue({
      ok: false,
      reason: "not_found",
      productName: "Sirena Espresso",
      variantRequired: true,
    });
    const res = await startCheckoutAction(form());
    expect(res).toEqual({
      kind: "error",
      error: {
        code: "cart",
        message:
          "Sirena Espresso için bir seçenek seç. Sepetten çıkarıp ürün sayfasından seçerek yeniden ekle.",
      },
    });
  });

  it("still says a product gone from the shop is no longer on sale", async () => {
    store.placeOrder.mockResolvedValue({
      ok: false,
      reason: "not_found",
      productName: "Moka Pot",
    });
    const res = await startCheckoutAction(form());
    expect(res.kind === "error" && res.error.message).toBe(
      "Moka Pot artık satışta değil. Sepetten çıkarıp yeniden dene.",
    );
  });
});
