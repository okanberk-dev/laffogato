import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Two things a member can spend: a hand-granted coupon and a counter stamp.
 * Both were handed out with no upper guard — a mistyped fixed coupon, and a
 * second stamp for the same double-clicked submit.
 */

const grantCoupon = vi.fn();
const addCounterStamp = vi.fn();
const listStamps = vi.fn();
const reverseCounterStamp = vi.fn();
const logAudit = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/admin/auth", () => ({
  requireRole: vi.fn(async () => ({ email: "kasa@laffogato.net" })),
}));
vi.mock("@/lib/admin/audit", () => ({ logAudit }));
vi.mock("@/lib/customer/coupons", () => ({
  grantCoupon,
  revokeCustomerCoupon: vi.fn(),
}));
vi.mock("@/lib/customer/store", () => ({
  adminDeleteCustomer: vi.fn(),
  adminUpdateCustomer: vi.fn(),
  createVerificationToken: vi.fn(),
  setCustomerActive: vi.fn(),
}));
vi.mock("@/lib/email/send", () => ({ sendVerificationEmail: vi.fn() }));
vi.mock("@/lib/mobile/loyalty", () => ({
  addCounterStamp,
  listStamps,
  reverseCounterStamp,
}));

const { grantCustomerCouponAction } =
  await import("@/app/admin/musteriler/actions");
const { addCounterStampAction, reverseCounterStampAction } =
  await import("@/app/admin/musteriler/[email]/actions");

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  grantCoupon.mockReset();
  grantCoupon.mockResolvedValue({ code: "LAF-TEST" });
  addCounterStamp.mockReset();
  addCounterStamp.mockResolvedValue({ id: "stamp-000001" });
  listStamps.mockReset();
  listStamps.mockResolvedValue([]);
  reverseCounterStamp.mockReset();
  reverseCounterStamp.mockResolvedValue({
    ok: true,
    stamp: { id: "stamp-000002" },
  });
  logAudit.mockClear();
});

describe("grantCustomerCouponAction", () => {
  it("expires at the end of the ISTANBUL day, not the server's", async () => {
    // Vercel functions run in UTC; 23:59:59 local put the coupon's death at
    // 02:59 the next morning Istanbul time. TR is a fixed UTC+3 since 2016.
    await grantCustomerCouponAction(
      "uye@ornek.com",
      {},
      form({
        kind: "fixed",
        value: "100",
        expiresAt: "2026-08-31",
      }),
    );
    expect(grantCoupon).toHaveBeenCalledWith(
      expect.objectContaining({ expiresAt: "2026-08-31T20:59:59.000Z" }),
    );
  });

  it("refuses a fat-fingered fixed coupon", async () => {
    const state = await grantCustomerCouponAction(
      "uye@ornek.com",
      {},
      form({
        kind: "fixed",
        value: "100000",
      }),
    );
    expect(state.error).toBeTruthy();
    expect(grantCoupon).not.toHaveBeenCalled();
  });

  it("still grants a sane fixed coupon in kuruş", async () => {
    const state = await grantCustomerCouponAction(
      "uye@ornek.com",
      {},
      form({
        kind: "fixed",
        value: "150",
      }),
    );
    expect(state.message).toBeTruthy();
    expect(grantCoupon).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "fixed", value: 15000 }),
    );
  });
});

describe("addCounterStampAction", () => {
  it("refuses a second counter stamp inside the double-submit window", async () => {
    listStamps.mockResolvedValue([
      {
        id: "stamp-000009",
        kind: "earn",
        source: "counter",
        createdAt: new Date(Date.now() - 30_000).toISOString(),
      },
    ]);
    const state = await addCounterStampAction("uye@ornek.com", {}, form({}));
    expect(state.error).toBeTruthy();
    expect(addCounterStamp).not.toHaveBeenCalled();
  });

  it("lets the operator override the guard on purpose", async () => {
    listStamps.mockResolvedValue([
      {
        id: "stamp-000009",
        kind: "earn",
        source: "counter",
        createdAt: new Date(Date.now() - 30_000).toISOString(),
      },
    ]);
    const state = await addCounterStampAction(
      "uye@ornek.com",
      {},
      form({ force: "on" }),
    );
    expect(state.message).toBeTruthy();
    expect(addCounterStamp).toHaveBeenCalled();
  });

  it("does not block a stamp when the last one is old", async () => {
    listStamps.mockResolvedValue([
      {
        id: "stamp-000009",
        kind: "earn",
        source: "counter",
        createdAt: new Date(Date.now() - 60 * 60_000).toISOString(),
      },
    ]);
    const state = await addCounterStampAction("uye@ornek.com", {}, form({}));
    expect(state.message).toBeTruthy();
    expect(addCounterStamp).toHaveBeenCalledWith(
      "uye@ornek.com",
      "kasa@laffogato.net",
      "",
    );
  });
});

describe("reverseCounterStampAction", () => {
  it("writes a reversal row and says who asked for it", async () => {
    const res = await reverseCounterStampAction(
      "uye@ornek.com",
      {},
      form({ note: "Yanlış üyeye verildi" }),
    );
    expect(res.message).toBe("Damga geri alındı.");
    expect(reverseCounterStamp).toHaveBeenCalledWith(
      "uye@ornek.com",
      "kasa@laffogato.net",
      "Yanlış üyeye verildi",
    );
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "customer",
        payload: expect.objectContaining({ kind: "reversal" }),
      }),
    );
  });

  it("reports a member with nothing to take back, and logs nothing", async () => {
    reverseCounterStamp.mockResolvedValue({ ok: false, error: "no_stamps" });
    const res = await reverseCounterStampAction("uye@ornek.com", {}, form({}));
    expect(res.error).toBe("Bu üyenin geri alınacak damgası yok.");
    expect(logAudit).not.toHaveBeenCalled();
  });
});
