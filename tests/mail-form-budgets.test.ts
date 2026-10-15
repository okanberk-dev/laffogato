import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The public forms that send mail to a typed address: password reset, sign-up
 * and the verification re-send. Each one leaves under our domain and counts
 * against the mail provider's daily quota, so a sender has a budget of its own
 * (not only the target address), and the budget is taken BEFORE anything is
 * looked up or sent - counted, not checked-then-recorded, so a parallel burst
 * cannot slip past it.
 */

type Limit = { blocked: boolean; remaining: number; retryAfterSeconds: number };
const OPEN: Limit = { blocked: false, remaining: 2, retryAfterSeconds: 0 };
const BLOCKED: Limit = { blocked: true, remaining: 0, retryAfterSeconds: 1800 };

const reserveLoginAttempt = vi.fn(
  async (_purpose: string, _ip: string, _identity: string): Promise<Limit> =>
    OPEN,
);
const createPasswordResetToken = vi.fn();
const registerCustomer = vi.fn();
const createVerificationToken = vi.fn();
const getActiveCustomer = vi.fn();
const changeCustomerPassword = vi.fn();
const clearLoginLimit = vi.fn();
const sendPasswordResetEmail = vi.fn(async () => true);
const sendVerificationEmail = vi.fn(async () => true);

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));
vi.mock("@/lib/customer/auth", () => ({
  clearCustomerSession: vi.fn(),
  getActiveCustomer,
  setActiveCustomerSession: vi.fn(),
  requireCustomer: vi.fn(),
}));
vi.mock("@/lib/customer/store", () => ({
  addCustomerAddress: vi.fn(),
  adoptSupabasePassword: vi.fn(),
  changeCustomerPassword,
  checkSitePassword: vi.fn(),
  createPasswordResetToken,
  createVerificationToken,
  deleteCustomerAddress: vi.fn(),
  registerCustomer,
  resetPasswordWithToken: vi.fn(),
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
  linkIdentityAfterReset: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock("@/lib/mobile/me", () => ({ deleteMe: vi.fn() }));
vi.mock("@/lib/admin/rate-limit", () => ({
  clearLoginLimit,
  clientIp: vi.fn(async () => "203.0.113.9"),
  reserveLoginAttempt,
}));
vi.mock("@/lib/newsletter/store", () => ({
  subscribeNewsletter: vi.fn(),
  unsubscribeNewsletterByEmail: vi.fn(),
}));
vi.mock("@/lib/email/send", () => ({
  sendVerificationEmail,
  sendPasswordResetEmail,
}));

const {
  changePasswordAction,
  requestPasswordResetAction,
  registerAction,
  resendVerificationAction,
} = await import("@/app/uye/actions");

function fd(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

/** Blocks only the named purpose; every other budget stays open. */
function blockOnly(purpose: string) {
  reserveLoginAttempt.mockImplementation(async (p: string) =>
    p === purpose ? BLOCKED : OPEN,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  reserveLoginAttempt.mockImplementation(async () => OPEN);
  createPasswordResetToken.mockResolvedValue({
    token: "t",
    name: "Eda",
    email: "eda@example.com",
  });
});

describe("password reset", () => {
  it("takes a per-sender and a per-address budget before looking anything up", async () => {
    const res = await requestPasswordResetAction(
      {},
      fd({ email: "eda@example.com" }),
    );
    expect(res.message).toBeTruthy();
    expect(reserveLoginAttempt).toHaveBeenCalledWith(
      "password-reset-ip",
      "203.0.113.9",
      "*",
    );
    // The address budget ignores the IP: rotating source addresses must not
    // buy a second round of links to one inbox.
    expect(reserveLoginAttempt).toHaveBeenCalledWith(
      "password-reset",
      "*",
      "eda@example.com",
    );
    const lastReserve = Math.max(
      ...reserveLoginAttempt.mock.invocationCallOrder,
    );
    expect(lastReserve).toBeLessThan(
      createPasswordResetToken.mock.invocationCallOrder[0],
    );
  });

  it.each(["password-reset-ip", "password-reset"])(
    "sends nothing once %s is spent",
    async (purpose) => {
      blockOnly(purpose);
      const res = await requestPasswordResetAction(
        {},
        fd({ email: "eda@example.com" }),
      );
      expect(res.error).toMatch(/çok fazla istek/i);
      expect(createPasswordResetToken).not.toHaveBeenCalled();
      expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    },
  );
});

describe("sign-up", () => {
  const signup = () =>
    fd({
      email: "yeni@example.com",
      name: "Yeni",
      password: "uzun-bir-sifre-1",
      passwordConfirm: "uzun-bir-sifre-1",
      acceptedTerms: "on",
    });

  it("is refused per sender before an account or a mail exists", async () => {
    blockOnly("register-ip");
    const res = await registerAction({}, signup());
    expect(res.error).toMatch(/çok fazla istek/i);
    expect(res.values?.email).toBe("yeni@example.com");
    expect(registerCustomer).not.toHaveBeenCalled();
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("counts the attempt against the sender's budget", async () => {
    registerCustomer.mockResolvedValue({ ok: false, error: "Kayıtlı." });
    await registerAction({}, signup());
    expect(reserveLoginAttempt).toHaveBeenCalledWith(
      "register-ip",
      "203.0.113.9",
      "*",
    );
  });
});

describe("verification re-send", () => {
  it("stops re-sending to one inbox after the budget", async () => {
    getActiveCustomer.mockResolvedValue({
      email: "yabanci@example.com",
      emailVerified: false,
    });
    blockOnly("verify-resend");
    const res = await resendVerificationAction({}, new FormData());
    expect(res.error).toMatch(/çok fazla istek/i);
    expect(reserveLoginAttempt).toHaveBeenCalledWith(
      "verify-resend",
      "*",
      "yabanci@example.com",
    );
    expect(createVerificationToken).not.toHaveBeenCalled();
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });
});

describe("password checks behind a session", () => {
  const change = () =>
    fd({
      currentPassword: "tahmin-1",
      newPassword: "yeni-sifre-123",
      newPasswordConfirm: "yeni-sifre-123",
    });

  beforeEach(() => {
    getActiveCustomer.mockResolvedValue({
      email: "eda@example.com",
      emailVerified: true,
    });
  });

  it("counts a current-password guess against the login budget", async () => {
    changeCustomerPassword.mockResolvedValue({
      ok: false,
      error: "Mevcut şifre hatalı.",
    });
    const res = await changePasswordAction({}, change());
    expect(res.error).toBe("Mevcut şifre hatalı.");
    expect(reserveLoginAttempt).toHaveBeenCalledWith(
      "customer-login",
      "203.0.113.9",
      "eda@example.com",
    );
    expect(clearLoginLimit).not.toHaveBeenCalled();
  });

  it("stops checking once the budget is spent", async () => {
    blockOnly("customer-login");
    const res = await changePasswordAction({}, change());
    expect(res.error).toMatch(/çok fazla başarısız deneme/i);
    expect(changeCustomerPassword).not.toHaveBeenCalled();
  });

  it("clears the budget after the right password", async () => {
    changeCustomerPassword.mockResolvedValue({ ok: true });
    const res = await changePasswordAction({}, change());
    expect(res.message).toBeTruthy();
    expect(clearLoginLimit).toHaveBeenCalledWith(
      "customer-login",
      "203.0.113.9",
      "eda@example.com",
    );
  });
});
