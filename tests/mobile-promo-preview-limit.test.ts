import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * WS1-03: the promo-code oracle behind POST /promo/preview and the
 * `promoCode` of POST /orders/preview.
 *
 * The limiter used to be "check, look the code up, then record the miss".
 * A burst sent in parallel passed the check all at once, so every guess in it
 * was answered and the fifteen-per-window cap held only for a caller who
 * waited for each answer. The fake limiter below is atomic the way
 * `reserve_auth_attempt` is, and the fake lookup holds every request until
 * the whole burst has passed the first check - the worst case of the race.
 */

const CAP = 15;
const limiter = { count: 0, locked: false };

const OPEN = { blocked: false, retryAfterSeconds: 0, remaining: CAP };
const LOCKED = { blocked: true, retryAfterSeconds: 60, remaining: 0 };

const checkLoginLimit = vi.fn(async () => (limiter.locked ? LOCKED : OPEN));
/** Atomic count-then-decide, as `reserve_auth_attempt` does it. */
const reserveLoginAttempt = vi.fn(async () => {
  if (limiter.locked) return LOCKED;
  limiter.count += 1;
  if (limiter.count >= CAP) limiter.locked = true;
  return OPEN;
});
/** The old, non-atomic recorder - counted after the answer was decided. */
const recordLoginFailure = vi.fn(async () => {
  limiter.count += 1;
  if (limiter.count >= CAP) limiter.locked = true;
  return OPEN;
});

vi.mock("@/lib/admin/rate-limit", () => ({
  checkLoginLimit,
  clientIp: async () => "10.0.0.1",
  recordLoginFailure,
  reserveLoginAttempt,
}));

/** Released once the whole burst is in flight. */
let release: () => void = () => {};
let gate = Promise.resolve();
const REAL = "YAZ20";
const applyPromoCode = vi.fn(async (code: string, subtotal: number) => {
  await gate;
  return code === REAL
    ? {
        ok: true as const,
        promo: { code: REAL },
        discountMinor: Math.round(subtotal / 5),
      }
    : { ok: false as const, error: "Geçersiz kod." };
});

vi.mock("@/lib/admin/store", () => ({
  PENDING_ORDER_TTL_MINUTES: 45,
  applyPaymentSucceeded: vi.fn(),
  applyPromoCode,
  customerOrdersByEmail: vi.fn(),
  expireStalePendingOrders: vi.fn(),
  findAppOrderByClientId: vi.fn(),
  getOrder: vi.fn(),
  getSettings: vi.fn(),
  placeAppOrder: vi.fn(),
  previewAppOrderLines: vi.fn(),
  settleWalletPayment: vi.fn(),
}));
vi.mock("@/lib/customer/store", () => ({ getCardUserKey: async () => "" }));
vi.mock("@/lib/customer/coupons", () => ({
  applyCustomerCoupon: vi.fn(async () => ({ ok: false, found: false })),
  couponAllowedForKind: () => true,
  CAFE_ONLY_COUPON_MESSAGE: "",
}));
vi.mock("@/lib/payment", () => ({ getPaymentProvider: vi.fn() }));
vi.mock("@/lib/email/send", () => ({ sendOrderPlacedEmail: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/mobile/loyalty", () => ({
  getStampedOrderIds: async () => new Set<string>(),
}));
vi.mock("@/lib/db", () => ({ getDb: vi.fn(), TABLES: {} }));
vi.mock("@/lib/legal/store", () => ({ checkoutConsentVersion: vi.fn() }));

const { previewPromoRateLimited } = await import("@/lib/mobile/orders");

beforeEach(() => {
  limiter.count = 0;
  limiter.locked = false;
  gate = Promise.resolve();
  vi.clearAllMocks();
});

describe("promo preview under a parallel burst", () => {
  it("answers at most the cap's worth of guesses, and does not reveal the real code by contrast", async () => {
    gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const guesses = Array.from({ length: 40 }, (_, i) => `KOD${i}`);
    // The real code is the last guess in the burst.
    guesses.push(REAL);
    const inFlight = guesses.map((code) =>
      previewPromoRateLimited(code, 20000, null),
    );
    // Let every request pass the early check before any lookup returns.
    await new Promise((r) => setTimeout(r, 0));
    expect(checkLoginLimit).toHaveBeenCalledTimes(guesses.length);
    release();
    const answers = await Promise.all(inFlight);

    const answered = answers.filter((a) => !a.limited);
    expect(answered.length).toBeLessThanOrEqual(CAP);
    // The hit came back after the bucket locked: it reads exactly like the
    // refused misses around it.
    const hit = answers[answers.length - 1]!;
    expect(hit.limited).toBe(true);
  });

  it("still answers a real code to a member who keeps re-pricing it", async () => {
    for (let i = 0; i < CAP * 2; i += 1) {
      const answer = await previewPromoRateLimited(REAL, 20000, null);
      expect(answer.limited).toBe(false);
      if (answer.limited) return;
      expect(answer.preview).toMatchObject({ ok: true, code: REAL });
    }
    expect(reserveLoginAttempt).not.toHaveBeenCalled();
  });

  it("counts a miss before answering it", async () => {
    const answer = await previewPromoRateLimited("YANLIS", 20000, null);
    expect(answer).toMatchObject({
      limited: false,
      preview: { ok: false, message: "Geçersiz kod." },
    });
    expect(reserveLoginAttempt).toHaveBeenCalledWith(
      "promo-preview",
      "10.0.0.1",
      "",
    );
    expect(recordLoginFailure).not.toHaveBeenCalled();
  });
});
