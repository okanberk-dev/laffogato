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
const adminUpdateCustomer = vi.fn();
const revokeCustomerCoupon = vi.fn();
const addCounterStamp = vi.fn();
const listStamps = vi.fn();
const reverseCounterStamp = vi.fn();
const logAudit = vi.fn();
const setCustomerActive = vi.fn();
const getCustomerByEmail = vi.fn();
const deleteMe = vi.fn();
const getDeletionRequest = vi.fn();
const sendAccountDeletedEmail = vi.fn();
const logMemberMail = vi.fn();
// The closure audits with safeAudit (it must not fail after the account is
// gone); the spy forwards to logAudit so one list holds every row.
const safeAudit = vi.fn(async (input: unknown) => {
  logAudit(input);
  return true;
});
const setAdminFlash = vi.fn();
const hasServiceRole = vi.fn(() => true);
const redirect = vi.fn(() => {
  throw new Error("NEXT_REDIRECT");
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/admin/auth", () => ({
  requireRole: vi.fn(async () => ({ email: "kasa@laffogato.net" })),
}));
vi.mock("@/lib/admin/audit", () => ({ logAudit, safeAudit }));
vi.mock("@/lib/admin/flash", () => ({ setAdminFlash }));
vi.mock("@/lib/customer/coupons", () => ({
  grantCoupon,
  revokeCustomerCoupon,
}));
vi.mock("@/lib/customer/store", () => ({
  adminUpdateCustomer,
  createVerificationToken: vi.fn(),
  getCustomerByEmail,
  setCustomerActive,
}));
vi.mock("@/lib/email/send", () => ({
  sendAccountDeletedEmail,
  sendVerificationEmail: vi.fn(),
}));
vi.mock("@/lib/customer/deletion-request", () => ({ getDeletionRequest }));
vi.mock("@/lib/email/account-deletion-notice", () => ({ logMemberMail }));
vi.mock("@/lib/mobile/me", () => ({ deleteMe }));
vi.mock("@/lib/supabase/admin", () => ({ hasServiceRole }));
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
  updateCustomerAction,
} = await import("@/app/admin/musteriler/actions");
const { addCounterStampAction, reverseCounterStampAction } =
  await import("@/app/admin/musteriler/[email]/actions");
const { requireRole } = await import("@/lib/admin/auth");

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
  getDeletionRequest.mockReset();
  getDeletionRequest.mockResolvedValue(null);
  sendAccountDeletedEmail.mockReset();
  sendAccountDeletedEmail.mockResolvedValue({ ok: true });
  logMemberMail.mockReset();
  safeAudit.mockClear();
  setAdminFlash.mockReset();
  hasServiceRole.mockReset();
  hasServiceRole.mockReturnValue(true);
  redirect.mockClear();
});

const MEMBER = {
  id: "cus-0042",
  email: "uye@ornek.com",
  name: "Ayşe Yılmaz",
  isActive: true,
  notificationPrefs: { orderUpdates: true, marketing: true, newsletter: true },
};

describe("updateCustomerAction", () => {
  it("leaves a toast before it goes back to the member page", async () => {
    adminUpdateCustomer.mockResolvedValue({ ok: true, customer: MEMBER });
    await expect(
      updateCustomerAction(
        "uye@ornek.com",
        {},
        form({ name: "Ayşe Yılmaz Demir", notifyMarketing: "on" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(setAdminFlash).toHaveBeenCalledWith("Üye bilgileri kaydedildi.");
    expect(redirect).toHaveBeenCalledWith("/admin/musteriler/uye%40ornek.com");
  });

  it("passes on how the form drew the commercial switches", async () => {
    adminUpdateCustomer.mockResolvedValue({ ok: true, customer: MEMBER });
    await expect(
      updateCustomerAction(
        "uye@ornek.com",
        {},
        form({
          name: "Ayşe Yılmaz",
          shownMarketing: "off",
          shownNewsletter: "on",
          notifyNewsletter: "on",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(adminUpdateCustomer).toHaveBeenCalledWith(
      "uye@ornek.com",
      expect.objectContaining({
        shownPrefs: { marketing: false, newsletter: true },
      }),
    );
  });
});

describe("updateCustomerAction and commercial consent", () => {
  it("refuses a switch-on under the field, and redirects nowhere", async () => {
    adminUpdateCustomer.mockResolvedValue({
      ok: false,
      error: "consent_grant",
      purposes: ["marketing"],
    });
    const state = await updateCustomerAction(
      "uye@ornek.com",
      {},
      form({ name: "Ayşe Yılmaz", notifyMarketing: "on" }),
    );
    expect(state.error).toMatch(/yalnız üye kendisi açabilir/);
    expect(state.fieldErrors).toEqual({
      notifyMarketing: "Bu izni yalnız üye açabilir.",
    });
    expect(logAudit).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });
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
        expiresAt: "2036-08-31",
      }),
    );
    expect(grantCoupon).toHaveBeenCalledWith(
      expect.objectContaining({ expiresAt: "2036-08-31T20:59:59.000Z" }),
    );
  });

  it("refuses a day already over, and still takes today", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // 17 Eki 2026 23:30 in Tuzla (20:30 UTC): today is not over yet.
    vi.setSystemTime(new Date("2026-10-17T20:30:00.000Z"));
    try {
      const past = await grantCustomerCouponAction(
        "uye@ornek.com",
        {},
        form({ kind: "pct", value: "10", expiresAt: "2026-10-16" }),
      );
      expect(past.error).toMatch(/geçmişte kaldı/);
      expect(grantCoupon).not.toHaveBeenCalled();
      const today = await grantCustomerCouponAction(
        "uye@ornek.com",
        {},
        form({ kind: "pct", value: "10", expiresAt: "2026-10-17" }),
      );
      expect(today.message).toBeTruthy();
      expect(grantCoupon).toHaveBeenCalledWith(
        expect.objectContaining({ expiresAt: "2026-10-17T20:59:59.000Z" }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("refuses a minimum basket the column cannot hold", async () => {
    // 2.500.000.000 kuruş: Postgres 22003, and the member page went with it.
    const state = await grantCustomerCouponAction(
      "uye@ornek.com",
      {},
      form({ kind: "pct", value: "10", minSubtotal: "25.000.000" }),
    );
    expect(state.error).toBe(
      "Min. sepet: Tutar en fazla 1.000.000 TL olabilir.",
    );
    expect(grantCoupon).not.toHaveBeenCalled();
  });

  it("answers a store failure instead of throwing to the error page", async () => {
    grantCoupon.mockRejectedValue(new Error("grantCoupon: connection lost"));
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const state = await grantCustomerCouponAction(
      "uye@ornek.com",
      {},
      form({ kind: "pct", value: "10" }),
    );
    expect(state.error).toBe("Kupon tanımlanamadı. Biraz sonra yeniden dene.");
    expect(logAudit).not.toHaveBeenCalled();
    expect(JSON.stringify(errors.mock.calls)).not.toContain("uye@ornek.com");
    errors.mockRestore();
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
  it("opens the customers gate, the gate of the page that offers it", async () => {
    vi.mocked(requireRole).mockClear();
    await addCounterStampAction("uye@ornek.com", {}, form({}));
    // It was `orders`: shift staff could post any address the client bound.
    expect(vi.mocked(requireRole)).toHaveBeenCalledWith("customers");
    expect(vi.mocked(requireRole)).not.toHaveBeenCalledWith("orders");
  });

  it("refuses an address with no member account, writing nothing", async () => {
    getCustomerByEmail.mockResolvedValue(null);
    const state = await addCounterStampAction(
      "uye@gmial.com",
      {},
      form({ force: "on" }),
    );
    expect(state.error).toBe("Bu adrese ait üye hesabı yok.");
    expect(addCounterStamp).not.toHaveBeenCalled();
    expect(logAudit).not.toHaveBeenCalled();
  });

  it("refuses a closed account", async () => {
    getCustomerByEmail.mockResolvedValue({ ...MEMBER, isActive: false });
    const state = await addCounterStampAction("uye@ornek.com", {}, form({}));
    expect(state.error).toBe("Bu üye hesabı kapalı; damga işlenmez.");
    expect(addCounterStamp).not.toHaveBeenCalled();
  });

  it("keeps the stamp's answer when the audit row fails after it", async () => {
    logAudit.mockRejectedValueOnce(new Error("logAudit: db down"));
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const state = await addCounterStampAction("uye@ornek.com", {}, form({}));
    // The stamp is in; the error page would have made the staff press again.
    expect(state).toEqual({ message: "Damga eklendi." });
    expect(errors).toHaveBeenCalled();
    expect(JSON.stringify(errors.mock.calls)).toContain("stamp-000001");
    expect(JSON.stringify(errors.mock.calls)).not.toContain("uye@ornek.com");
    errors.mockRestore();
  });

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
    expect(src).toMatch(
      /import \{ deleteMe\b[^}]*\} from "@\/lib\/mobile\/me";/,
    );
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
    // As the panel's act: the consent history gets no admin IP (DeleteMeOptions).
    expect(deleteMe).toHaveBeenCalledWith(MEMBER, { by: "admin" });
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
      "success",
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

  it("does not call a skipped identity a clean closure when the key is missing", async () => {
    // No service-role key: every closure skips the identity, and an app
    // member's e-mail and name stay in Supabase.
    hasServiceRole.mockReturnValue(false);
    deleteMe.mockResolvedValue({ ok: true, identity: "skipped" });
    await expect(
      closeCustomerAccountAction(
        null,
        form({ email: "uye@ornek.com", confirm: "uye@ornek.com" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(setAdminFlash).toHaveBeenCalledWith(
      expect.stringContaining("Supabase'de duruyor"),
      "warning",
    );
  });

  it("calls a skipped identity a clean closure when the row was never linked", async () => {
    // The key is there, so a skip means there was no identity to delete.
    deleteMe.mockResolvedValue({ ok: true, identity: "skipped" });
    await expect(
      closeCustomerAccountAction(
        null,
        form({ email: "uye@ornek.com", confirm: "uye@ornek.com" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(setAdminFlash).toHaveBeenCalledWith(
      "Hesap kapatıldı. Kişisel veriler anonimleştirildi. Üyeye bilgi e-postası gitti.",
      "success",
    );
    // Nothing is left in Supabase: the member is told "silindi".
    expect(sendAccountDeletedEmail).toHaveBeenCalledWith(
      "uye@ornek.com",
      expect.objectContaining({ complete: true }),
    );
  });

  it("says plainly when the closure stopped half-way, and leaves a row", async () => {
    // deleteMe throws only before the member row is rewritten; karaoke and
    // the saved cards may already be done.
    deleteMe.mockRejectedValue(new Error("connection terminated"));
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await closeCustomerAccountAction(
      null,
      form({ email: "uye@ornek.com", confirm: "uye@ornek.com" }),
    );
    expect(res.ok).toBe(false);
    expect(res.ok ? "" : res.error).toMatch(
      /kapatılamadı, üye kaydı değişmedi/,
    );
    expect(res.ok ? "" : res.error).toMatch(/karaoke/);
    expect(logAudit).toHaveBeenCalledWith({
      action: "update",
      entity: "customer",
      entityId: "cus-0042",
      payload: { closedBy: "admin", closure: "failed" },
    });
    // PII rule: the id in the log, never the address.
    expect(JSON.stringify(errors.mock.calls)).not.toContain("uye@ornek.com");
    expect(redirect).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it("is the owner and manager's (`customers`) to run", async () => {
    await expect(
      closeCustomerAccountAction(
        null,
        form({ email: "uye@ornek.com", confirm: "uye@ornek.com" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(requireRole).toHaveBeenCalledWith("customers");
  });

  it("answers a web deletion request: the audit row dates it, the member is mailed", async () => {
    getDeletionRequest.mockResolvedValue({
      requestedAt: "2026-10-18T09:15:00.000Z",
      reason: "Taşınıyorum",
    });
    await expect(
      closeCustomerAccountAction(
        null,
        form({ email: "uye@ornek.com", confirm: "uye@ornek.com" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    // Read before deleteMe blanks it (deleteMe clears the request itself).
    expect(getDeletionRequest.mock.invocationCallOrder[0]).toBeLessThan(
      deleteMe.mock.invocationCallOrder[0],
    );
    expect(safeAudit).toHaveBeenCalledWith({
      action: "delete",
      entity: "customer",
      entityId: "cus-0042",
      payload: {
        closedBy: "admin",
        identity: "deleted",
        deletionRequestedAt: "2026-10-18T09:15:00.000Z",
      },
    });
    // The reason's words are not copied into the ten-year log.
    expect(JSON.stringify(logAudit.mock.calls)).not.toContain("Taşınıyorum");
    // Sent after the closure, to the address the account had.
    expect(sendAccountDeletedEmail).toHaveBeenCalledWith("uye@ornek.com", {
      complete: true,
      idempotencyKey: `account-deletion-cus-0042-${Date.parse("2026-10-18T09:15:00.000Z")}-closed`,
    });
    expect(deleteMe.mock.invocationCallOrder[0]).toBeLessThan(
      sendAccountDeletedEmail.mock.invocationCallOrder[0],
    );
  });

  describe("from the request card (it posts the request it showed)", () => {
    const SHOWN = "2026-10-18T09:15:00.000Z";
    const fromCard = () =>
      form({
        email: "uye@ornek.com",
        confirm: "uye@ornek.com",
        requestedAt: SHOWN,
      });

    it("closes while that request is still open", async () => {
      getDeletionRequest.mockResolvedValue({ requestedAt: SHOWN, reason: "" });
      await expect(
        closeCustomerAccountAction(null, fromCard()),
      ).rejects.toThrow("NEXT_REDIRECT");
      expect(deleteMe).toHaveBeenCalledWith(MEMBER, { by: "admin" });
    });

    it("keeps the account when the member took the request back meanwhile", async () => {
      // The tab was opened from the request mail; the member pressed
      // "Talebi geri al" before the operator confirmed (hesap-silme §4:
      // "Geri alınan talep işleme konmaz").
      getDeletionRequest.mockResolvedValue(null);
      const res = await closeCustomerAccountAction(null, fromCard());
      expect(res.ok).toBe(false);
      expect(res.ok ? "" : res.error).toMatch(/geri aldı/);
      expect(deleteMe).not.toHaveBeenCalled();
      expect(sendAccountDeletedEmail).not.toHaveBeenCalled();
      expect(logAudit).not.toHaveBeenCalled();
      expect(redirect).not.toHaveBeenCalled();
    });

    it("keeps the account when a newer request replaced the one shown", async () => {
      getDeletionRequest.mockResolvedValue({
        requestedAt: "2026-10-19T08:00:00.000Z",
        reason: "Yine de silin",
      });
      const res = await closeCustomerAccountAction(null, fromCard());
      expect(res.ok).toBe(false);
      expect(res.ok ? "" : res.error).toMatch(/yenile/);
      expect(deleteMe).not.toHaveBeenCalled();
    });

    it("keeps the account when the request cannot be read", async () => {
      getDeletionRequest.mockRejectedValue(new Error("connection terminated"));
      const errors = vi.spyOn(console, "error").mockImplementation(() => {});
      const res = await closeCustomerAccountAction(null, fromCard());
      expect(res.ok).toBe(false);
      expect(deleteMe).not.toHaveBeenCalled();
      errors.mockRestore();
    });

    it("leaves the Yönetim card's closure (no request posted) as it was", async () => {
      getDeletionRequest.mockResolvedValue(null);
      await expect(
        closeCustomerAccountAction(
          null,
          form({ email: "uye@ornek.com", confirm: "uye@ornek.com" }),
        ),
      ).rejects.toThrow("NEXT_REDIRECT");
      expect(deleteMe).toHaveBeenCalledTimes(1);
    });
  });

  it("tells the member 'kapatıldı', not 'silindi', while the identity is still there", async () => {
    deleteMe.mockResolvedValue({ ok: true, identity: "failed" });
    await expect(
      closeCustomerAccountAction(
        null,
        form({ email: "uye@ornek.com", confirm: "uye@ornek.com" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(sendAccountDeletedEmail).toHaveBeenCalledWith(
      "uye@ornek.com",
      expect.objectContaining({ complete: false }),
    );
  });

  it("keeps the closure when the member's mail does not go, and says so", async () => {
    sendAccountDeletedEmail.mockResolvedValue({ ok: false, error: "429" });
    await expect(
      closeCustomerAccountAction(
        null,
        form({ email: "uye@ornek.com", confirm: "uye@ornek.com" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(setAdminFlash).toHaveBeenCalledWith(
      expect.stringContaining("Üyeye bilgi e-postası gönderilemedi"),
      "warning",
    );
    expect(logMemberMail).toHaveBeenCalledWith(
      "closure",
      "cus-0042",
      "uye@ornek.com",
      { ok: false, error: "429" },
    );
    expect(redirect).toHaveBeenCalledWith("/admin/musteriler");
  });

  it("closes and mails even when the audit insert is refused", async () => {
    safeAudit.mockResolvedValueOnce(false);
    await expect(
      closeCustomerAccountAction(
        null,
        form({ email: "uye@ornek.com", confirm: "uye@ornek.com" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(sendAccountDeletedEmail).toHaveBeenCalled();
  });

  it("sends no mail when the closure was refused", async () => {
    deleteMe.mockResolvedValue({
      ok: false,
      error: "orders_in_progress",
      count: 1,
    });
    await closeCustomerAccountAction(
      null,
      form({ email: "uye@ornek.com", confirm: "uye@ornek.com" }),
    );
    expect(sendAccountDeletedEmail).not.toHaveBeenCalled();
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
