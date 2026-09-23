import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `resetPasswordAction` hands a completed reset to `linkIdentityAfterReset`,
 * so a member whose row was never linked stops having an old app password
 * that still works (AB-5b). The link is best-effort: whatever it does, the
 * reset the member has already completed stands and they are signed in.
 */

const resetPasswordWithToken = vi.fn();
const linkIdentityAfterReset = vi.fn();
const setActiveCustomerSession = vi.fn();
const order: string[] = [];
const redirect = vi.fn(() => {
  throw new Error("NEXT_REDIRECT");
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/customer/auth", () => ({
  clearCustomerSession: vi.fn(),
  getActiveCustomer: vi.fn(),
  setActiveCustomerSession,
  requireCustomer: vi.fn(),
}));
vi.mock("@/lib/customer/store", () => ({
  addCustomerAddress: vi.fn(),
  adoptSupabasePassword: vi.fn(),
  changeCustomerPassword: vi.fn(),
  checkSitePassword: vi.fn(),
  createPasswordResetToken: vi.fn(),
  createVerificationToken: vi.fn(),
  deleteCustomerAddress: vi.fn(),
  registerCustomer: vi.fn(),
  resetPasswordWithToken,
  supabaseHoldsLatestPassword: vi.fn(),
  setCustomerDefaultAddress: vi.fn(),
  toggleWishlist: vi.fn(),
  updateCustomerAddress: vi.fn(),
  updateCustomerProfile: vi.fn(),
  updateNotificationPrefs: vi.fn(),
  verifyCustomerLogin: vi.fn(),
}));
vi.mock("@/lib/customer/supabase-bridge", () => ({
  ensureCustomerForSupabaseUser: vi.fn(),
  linkCustomerToSupabase: vi.fn(),
  linkIdentityAfterReset,
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock("@/lib/mobile/me", () => ({ deleteMe: vi.fn() }));
vi.mock("@/lib/admin/rate-limit", () => ({
  checkLoginLimit: vi.fn(),
  clearLoginLimit: vi.fn(),
  clientIp: vi.fn(async () => "1.2.3.4"),
  recordLoginFailure: vi.fn(),
  reserveLoginAttempt: vi.fn(),
}));
vi.mock("@/lib/newsletter/store", () => ({
  subscribeNewsletter: vi.fn(),
  unsubscribeNewsletterByEmail: vi.fn(),
}));
vi.mock("@/lib/email/send", () => ({
  sendVerificationEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}));

const { resetPasswordAction } = await import("@/app/uye/actions");

function form(password: string, confirm = password): FormData {
  const fd = new FormData();
  fd.set("token", "tok-1");
  fd.set("password", password);
  fd.set("passwordConfirm", confirm);
  return fd;
}

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  order.length = 0;
  resetPasswordWithToken.mockResolvedValue({
    ok: true,
    email: "eda@example.com",
  });
  linkIdentityAfterReset.mockImplementation(async () => {
    order.push("link");
    return { outcome: "linked", password: "updated" };
  });
  setActiveCustomerSession.mockImplementation(async () => {
    order.push("session");
  });
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("resetPasswordAction and the unlinked identity", () => {
  it("links the identity with the new password, then signs the member in", async () => {
    await expect(resetPasswordAction({}, form("yeni-sifre-123"))).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(resetPasswordWithToken).toHaveBeenCalledWith("tok-1", "yeni-sifre-123");
    expect(linkIdentityAfterReset).toHaveBeenCalledWith(
      "eda@example.com",
      "yeni-sifre-123",
    );
    expect(order).toEqual(["link", "session"]);
    expect(redirect).toHaveBeenCalledWith("/uye/hesap");
  });

  it("keeps the completed reset when the link throws", async () => {
    linkIdentityAfterReset.mockRejectedValue(new Error("db failure"));
    await expect(resetPasswordAction({}, form("yeni-sifre-123"))).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(setActiveCustomerSession).toHaveBeenCalledWith("eda@example.com");
    expect(errorSpy).toHaveBeenCalled();
  });

  it("does not look for an identity when the reset itself was refused", async () => {
    resetPasswordWithToken.mockResolvedValue({
      ok: false,
      error: "Bağlantı geçersiz veya kullanılmış.",
    });
    await expect(resetPasswordAction({}, form("yeni-sifre-123"))).resolves.toEqual({
      error: "Bağlantı geçersiz veya kullanılmış.",
    });
    expect(linkIdentityAfterReset).not.toHaveBeenCalled();
  });

  it("does not look for one when the two passwords differ", async () => {
    await expect(
      resetPasswordAction({}, form("yeni-sifre-123", "baska-sifre-123")),
    ).resolves.toEqual({ error: "Şifreler eşleşmiyor." });
    expect(resetPasswordWithToken).not.toHaveBeenCalled();
    expect(linkIdentityAfterReset).not.toHaveBeenCalled();
  });
});
