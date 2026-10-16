import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The checkout's promo preview answers "geçersiz kod" or a real discount to
 * anyone, which makes it an oracle for guessing codes. Its budget used to be
 * checked first and recorded only after a miss, so a burst sent in parallel
 * passed the check before the first miss was written. The attempt is now
 * reserved (counted) before the lookup, and a hit is never cleared: clearing
 * would let one known campaign code reset the counter between guesses.
 */

type Limit = { blocked: boolean; remaining: number; retryAfterSeconds: number };
const reserveLoginAttempt = vi.fn(
  async (..._args: string[]): Promise<Limit> => ({
    blocked: false,
    remaining: 10,
    retryAfterSeconds: 0,
  }),
);
const clearLoginLimit = vi.fn();
const applyPromoCode = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/admin/store", () => ({
  applyPaymentSucceeded: vi.fn(),
  applyPromoCode,
  placeOrder: vi.fn(),
}));
vi.mock("@/lib/customer/auth", () => ({
  getActiveCustomer: vi.fn(async () => null),
}));
vi.mock("@/lib/customer/coupons", () => ({ applyCustomerCoupon: vi.fn() }));
vi.mock("@/lib/email/send", () => ({ sendOrderPaidEmail: vi.fn() }));
vi.mock("@/lib/legal/store", () => ({ checkoutConsentVersion: vi.fn() }));
vi.mock("@/lib/customer/store", () => ({ ensureCardUserKey: vi.fn() }));
vi.mock("@/lib/payment", () => ({ getPaymentProvider: vi.fn() }));
vi.mock("@/lib/admin/rate-limit", () => ({
  clientIp: vi.fn(async () => "203.0.113.5"),
  reserveLoginAttempt,
  clearLoginLimit,
}));

const { previewPromoAction } = await import("@/app/odeme/actions");

function form(code: string): FormData {
  const fd = new FormData();
  fd.set("code", code);
  fd.set("subtotal", "250");
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("promo preview budget", () => {
  it("counts the attempt before the code is looked up", async () => {
    applyPromoCode.mockResolvedValue({ ok: false, error: "Geçersiz kod." });
    await previewPromoAction({}, form("TAHMIN1"));
    expect(reserveLoginAttempt).toHaveBeenCalledWith(
      "promo-preview",
      "203.0.113.5",
      "",
    );
    expect(reserveLoginAttempt.mock.invocationCallOrder[0]).toBeLessThan(
      applyPromoCode.mock.invocationCallOrder[0],
    );
  });

  it("refuses without looking up once the budget is spent", async () => {
    reserveLoginAttempt.mockResolvedValueOnce({
      blocked: true,
      remaining: 0,
      retryAfterSeconds: 60,
    });
    const res = await previewPromoAction({}, form("TAHMIN2"));
    expect(res.error).toMatch(/çok fazla deneme/i);
    expect(applyPromoCode).not.toHaveBeenCalled();
  });

  it("does not reset the counter on a valid code", async () => {
    applyPromoCode.mockResolvedValue({
      ok: true,
      promo: { code: "EYLUL10" },
      discountMinor: 2500,
    });
    const res = await previewPromoAction({}, form("EYLUL10"));
    expect(res.ok?.discountMinor).toBe(2500);
    expect(clearLoginLimit).not.toHaveBeenCalled();
  });
});
