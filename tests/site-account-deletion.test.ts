import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The site's own way out (`/uye/hesap/sil`). The membership agreement §14
 * offers it alongside the app's and an e-mail to support; before it existed a
 * member who had signed up on the site could only write in.
 */

const getActiveCustomer = vi.fn();
const checkSitePassword = vi.fn();
const deleteMe = vi.fn();
const clearCustomerSession = vi.fn();
const redirect = vi.fn(() => {
  // next/navigation's redirect throws to unwind the action; mirror that so a
  // test can tell "redirected" from "fell through and returned".
  throw new Error("NEXT_REDIRECT");
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/customer/auth", () => ({
  clearCustomerSession,
  getActiveCustomer,
  setActiveCustomerSession: vi.fn(),
  requireCustomer: vi.fn(),
}));
vi.mock("@/lib/customer/store", () => ({
  addCustomerAddress: vi.fn(),
  changeCustomerPassword: vi.fn(),
  checkSitePassword,
  createVerificationToken: vi.fn(),
  deleteCustomerAddress: vi.fn(),
  registerCustomer: vi.fn(),
  setCustomerDefaultAddress: vi.fn(),
  toggleWishlist: vi.fn(),
  updateCustomerAddress: vi.fn(),
  updateCustomerProfile: vi.fn(),
  updateNotificationPrefs: vi.fn(),
  verifyCustomerLogin: vi.fn(),
}));
vi.mock("@/lib/mobile/me", () => ({ deleteMe }));
const reserveLoginAttempt = vi.fn();
vi.mock("@/lib/admin/rate-limit", () => ({
  clearLoginLimit: vi.fn(),
  clientIp: vi.fn(async () => "203.0.113.4"),
  reserveLoginAttempt,
}));

const { deleteAccountAction } = await import("@/app/uye/actions");
const { accountClosureNotice, accountClosureParam } =
  await import("@/lib/customer/account-closure");

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  getActiveCustomer.mockResolvedValue({ email: "eda@example.com" });
  checkSitePassword.mockResolvedValue("match");
  deleteMe.mockResolvedValue({ ok: true, identity: "deleted" });
  reserveLoginAttempt.mockResolvedValue({
    blocked: false,
    remaining: 4,
    retryAfterSeconds: 0,
  });
});

describe("deleteAccountAction", () => {
  it("anonymises the account, drops the session and leaves the area", async () => {
    await expect(
      deleteAccountAction(
        {},
        form({ confirmEmail: "Eda@Example.com", password: "sifre123" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(deleteMe).toHaveBeenCalledWith({ email: "eda@example.com" });
    expect(clearCustomerSession).toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith("/?hesap=silindi");
  });

  it.each([
    ["skipped", "skipped"],
    ["failed", "failed"],
    ["a missing identity field", undefined],
  ])(
    "does not claim the personal data is gone when the identity is %s",
    async (_label, identity) => {
      // The Supabase sign-in identity still carries the e-mail and the name
      // unless it was deleted (docs/API-MOBILE.md §4, O28): the short
      // sentence, never "Kişisel verilerin silindi".
      deleteMe.mockResolvedValue({ ok: true, identity });
      await expect(
        deleteAccountAction(
          {},
          form({ confirmEmail: "eda@example.com", password: "sifre123" }),
        ),
      ).rejects.toThrow("NEXT_REDIRECT");
      expect(redirect).toHaveBeenCalledWith("/?hesap=kapatildi");
    },
  );

  it("refuses a mistyped confirmation without touching the account", async () => {
    const res = await deleteAccountAction(
      {},
      form({ confirmEmail: "eda@exampel.com", password: "sifre123" }),
    );
    expect(res.error).toContain("birebir");
    expect(deleteMe).not.toHaveBeenCalled();
  });

  it("refuses a wrong password", async () => {
    checkSitePassword.mockResolvedValue("mismatch");
    const res = await deleteAccountAction(
      {},
      form({ confirmEmail: "eda@example.com", password: "yanlis" }),
    );
    expect(res.error).toBe("Şifre hatalı.");
    expect(deleteMe).not.toHaveBeenCalled();
  });

  it("stops checking passwords once the login budget is spent", async () => {
    // A session holder could otherwise guess the password here without limit.
    reserveLoginAttempt.mockResolvedValue({
      blocked: true,
      remaining: 0,
      retryAfterSeconds: 60,
    });
    const res = await deleteAccountAction(
      {},
      form({ confirmEmail: "eda@example.com", password: "tahmin" }),
    );
    expect(res.error).toMatch(/çok fazla başarısız deneme/i);
    expect(reserveLoginAttempt).toHaveBeenCalledWith(
      "customer-login",
      "203.0.113.4",
      "eda@example.com",
    );
    expect(checkSitePassword).not.toHaveBeenCalled();
    expect(deleteMe).not.toHaveBeenCalled();
  });

  it("lets a social-login account through with no password", async () => {
    // No local passwordHash → "none"; asking for a password would lock the
    // member out of the only self-service route they have.
    checkSitePassword.mockResolvedValue("none");
    await expect(
      deleteAccountAction({}, form({ confirmEmail: "eda@example.com" })),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(deleteMe).toHaveBeenCalled();
  });

  it("keeps the account while an order is still running (Üyelik Sözleşmesi §14)", () => {
    // Same refusal the app's DELETE /me answers with 409: anonymising the
    // buyer of an order the kitchen is about to hand over would leave the
    // member unable to follow what they already paid for.
    deleteMe.mockResolvedValue({
      ok: false,
      error: "orders_in_progress",
      count: 1,
    });
    return deleteAccountAction(
      {},
      form({ confirmEmail: "eda@example.com", password: "sifre123" }),
    ).then((res) => {
      expect(res.error).toContain("Devam eden siparişin");
      expect(clearCustomerSession).not.toHaveBeenCalled();
      expect(redirect).not.toHaveBeenCalled();
    });
  });
});

describe("the notice the home page shows after a closure", () => {
  it("says the personal data was deleted only after the identity went too", () => {
    expect(accountClosureParam("deleted")).toBe("silindi");
    expect(accountClosureParam("skipped")).toBe("kapatildi");
    expect(accountClosureParam("failed")).toBe("kapatildi");
    expect(accountClosureParam(undefined)).toBe("kapatildi");
    expect(accountClosureNotice("silindi")).toContain(
      "Kişisel verilerin silindi",
    );
    expect(accountClosureNotice("kapatildi")).toBe("Hesabın kapatıldı.");
    expect(accountClosureNotice("kapatildi")).not.toMatch(/silindi|anonim/);
  });

  it("shows nothing for any other value", () => {
    expect(accountClosureNotice(undefined)).toBeUndefined();
    expect(accountClosureNotice("")).toBeUndefined();
    expect(accountClosureNotice("baska")).toBeUndefined();
  });
});
