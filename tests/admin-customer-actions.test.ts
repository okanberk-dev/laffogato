import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Two things a member can spend: a hand-granted coupon and a counter stamp.
 * Both were handed out with no upper guard - a mistyped fixed coupon, and a
 * second stamp for the same double-clicked submit.
 *
 * And the account actions on the customer page, which answered nothing at
 * all (pasifleştir, coupon revoke) or deleted only the customers row
 * ("Hesabı sil"): each now answers an ActionResult for its confirm dialog,
 * and the closure goes through the member's own deleteMe.
 */

const grantCoupon = vi.fn();
const revokeCustomerCoupon = vi.fn();
const addCounterStamp = vi.fn();
const listStamps = vi.fn();
const reverseCounterStamp = vi.fn();
const logAudit = vi.fn();
const setCustomerActive = vi.fn();
const getCustomerByEmail = vi.fn();
const deleteMe = vi.fn();
const setAdminFlash = vi.fn();
const redirect = vi.fn(() => {
  throw new Error("NEXT_REDIRECT");
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/admin/auth", () => ({
  requireRole: vi.fn(async () => ({ email: "kasa@laffogato.net" })),
}));
vi.mock("@/lib/admin/audit", () => ({ logAudit }));
vi.mock("@/lib/admin/flash", () => ({ setAdminFlash }));
vi.mock("@/lib/customer/coupons", () => ({
  grantCoupon,
  revokeCustomerCoupon,
}));
vi.mock("@/lib/customer/store", () => ({
  adminUpdateCustomer: vi.fn(),
  createVerificationToken: vi.fn(),
  getCustomerByEmail,
  setCustomerActive,
}));
vi.mock("@/lib/email/send", () => ({ sendVerificationEmail: vi.fn() }));
vi.mock("@/lib/mobile/me", () => ({ deleteMe }));
vi.mock("@/lib/mobile/loyalty", () => ({
  addCounterStamp,
  listStamps,
  reverseCounterStamp,
}));

const {
  closeCustomerAccountAction,
  grantCustomerCouponAction,
  revokeCustomerCouponAction,
  setCustomerActiveAction,
} = await import("@/app/admin/musteriler/actions");
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
  revokeCustomerCoupon.mockReset();
  setCustomerActive.mockReset();
  getCustomerByEmail.mockReset();
  getCustomerByEmail.mockResolvedValue(MEMBER);
  deleteMe.mockReset();
  deleteMe.mockResolvedValue({ ok: true, identity: "deleted" });
  setAdminFlash.mockReset();
  redirect.mockClear();
});

const MEMBER = {
  id: "cus-0042",
  email: "uye@ornek.com",
  name: "Ayşe Yılmaz",
  notificationPrefs: { orderUpdates: true, marketing: true, newsletter: true },
};

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
      null,
      form({ note: "Yanlış üyeye verildi" }),
    );
    expect(res).toMatchObject({ ok: true, message: "Damga geri alındı." });
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
    const res = await reverseCounterStampAction(
      "uye@ornek.com",
      null,
      form({}),
    );
    expect(res).toEqual({
      ok: false,
      error: "Bu üyenin geri alınacak damgası yok.",
    });
    expect(logAudit).not.toHaveBeenCalled();
  });
});

describe("setCustomerActiveAction", () => {
  it("answers the pasifleştir with a toast-ready result", async () => {
    setCustomerActive.mockResolvedValue({ email: "uye@ornek.com" });
    const res = await setCustomerActiveAction(
      null,
      form({ email: "uye@ornek.com", active: "0" }),
    );
    expect(setCustomerActive).toHaveBeenCalledWith("uye@ornek.com", false);
    expect(res).toMatchObject({ ok: true });
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ payload: { isActive: false } }),
    );
  });

  it("says so when there is no member account, instead of nothing", async () => {
    setCustomerActive.mockResolvedValue(null);
    const res = await setCustomerActiveAction(
      null,
      form({ email: "yok@ornek.com", active: "1" }),
    );
    expect(res).toEqual({ ok: false, error: "Üye hesabı bulunamadı." });
    expect(logAudit).not.toHaveBeenCalled();
  });
});

describe("revokeCustomerCouponAction", () => {
  it("revokes, audits and answers", async () => {
    revokeCustomerCoupon.mockResolvedValue(true);
    const res = await revokeCustomerCouponAction(
      null,
      form({ id: "cpn-0007", email: "uye@ornek.com" }),
    );
    expect(res).toMatchObject({ ok: true });
    expect(logAudit).toHaveBeenCalledWith({
      action: "delete",
      entity: "coupon",
      entityId: "cpn-0007",
    });
  });

  it("reports a coupon that was already used or removed", async () => {
    revokeCustomerCoupon.mockResolvedValue(false);
    const res = await revokeCustomerCouponAction(
      null,
      form({ id: "cpn-0007", email: "uye@ornek.com" }),
    );
    expect(res.ok).toBe(false);
    expect(logAudit).not.toHaveBeenCalled();
  });
});

describe("closeCustomerAccountAction (Hesabı sil)", () => {
  it("has no raw row delete left to call", () => {
    // The old helper deleted the customers row and nothing else.
    const store = readFileSync("src/lib/customer/store.ts", "utf8");
    expect(store).not.toMatch(/export async function adminDeleteCustomer/);
    const src = readFileSync("src/app/admin/musteriler/actions.ts", "utf8");
    expect(src).toContain('import { deleteMe } from "@/lib/mobile/me";');
  });

  it("refuses unless the member's address is typed out", async () => {
    const res = await closeCustomerAccountAction(
      null,
      form({ email: "uye@ornek.com", confirm: "evet" }),
    );
    expect(res).toEqual({
      ok: false,
      error: "Onay için üyenin e-posta adresini birebir yaz.",
    });
    expect(deleteMe).not.toHaveBeenCalled();
  });

  it("closes the account through the member's own pipeline (deleteMe)", async () => {
    await expect(
      closeCustomerAccountAction(
        null,
        form({ email: "Uye@Ornek.com", confirm: " uye@ornek.com " }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    // The same function DELETE /me and /uye/hesap/sil call: it cancels and
    // refunds future karaoke, removes the barista grant and anonymises.
    expect(getCustomerByEmail).toHaveBeenCalledWith("uye@ornek.com");
    expect(deleteMe).toHaveBeenCalledWith(MEMBER);
    // Named by id: the address is what is being erased.
    expect(logAudit).toHaveBeenCalledWith({
      action: "delete",
      entity: "customer",
      entityId: "cus-0042",
      payload: { closedBy: "admin", identity: "deleted" },
    });
    expect(JSON.stringify(logAudit.mock.calls)).not.toContain("uye@ornek.com");
    expect(setAdminFlash).toHaveBeenCalledWith(
      expect.stringContaining("Hesap kapatıldı"),
    );
    expect(redirect).toHaveBeenCalledWith("/admin/musteriler");
  });

  it("waits for an order in flight, like the member's own deletion", async () => {
    deleteMe.mockResolvedValue({
      ok: false,
      error: "orders_in_progress",
      count: 2,
    });
    const res = await closeCustomerAccountAction(
      null,
      form({ email: "uye@ornek.com", confirm: "uye@ornek.com" }),
    );
    expect(res.ok).toBe(false);
    expect(res.ok ? "" : res.error).toContain("2 siparişi");
    expect(logAudit).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("leaves a warning when the sign-in identity could not be deleted", async () => {
    deleteMe.mockResolvedValue({ ok: true, identity: "failed" });
    await expect(
      closeCustomerAccountAction(
        null,
        form({ email: "uye@ornek.com", confirm: "uye@ornek.com" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(setAdminFlash).toHaveBeenCalledWith(
      expect.stringContaining("Supabase"),
      "warning",
    );
  });

  it("reports an address with no member account", async () => {
    getCustomerByEmail.mockResolvedValue(null);
    const res = await closeCustomerAccountAction(
      null,
      form({ email: "yok@ornek.com", confirm: "yok@ornek.com" }),
    );
    expect(res).toEqual({ ok: false, error: "Üye hesabı bulunamadı." });
    expect(deleteMe).not.toHaveBeenCalled();
  });
});
