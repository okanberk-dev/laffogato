import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * One membership, two places that can change its password.
 *
 * The site keeps a bcrypt hash and Supabase keeps the identity, and until the
 * app grew a reset screen only one of them could ever move. Now both can, and
 * whichever one is stale is a live old credential — which is the exact thing a
 * password reset exists to destroy.
 */

const signInWithPassword = vi.fn();
const signOut = vi.fn();
const ensureCustomerForSupabaseUser = vi.fn();
const checkSitePassword = vi.fn();
const adoptSupabasePassword = vi.fn();
const verifyCustomerLogin = vi.fn();
const supabaseHoldsLatestPassword = vi.fn();
const setActiveCustomerSession = vi.fn();
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
  adoptSupabasePassword,
  changeCustomerPassword: vi.fn(),
  checkSitePassword,
  createPasswordResetToken: vi.fn(),
  createVerificationToken: vi.fn(),
  deleteCustomerAddress: vi.fn(),
  registerCustomer: vi.fn(),
  resetPasswordWithToken: vi.fn(),
  supabaseHoldsLatestPassword,
  setCustomerDefaultAddress: vi.fn(),
  toggleWishlist: vi.fn(),
  updateCustomerAddress: vi.fn(),
  updateCustomerProfile: vi.fn(),
  updateNotificationPrefs: vi.fn(),
  verifyCustomerLogin,
}));
vi.mock("@/lib/customer/supabase-bridge", () => ({
  ensureCustomerForSupabaseUser,
  linkCustomerToSupabase: vi.fn(),
}));
// The sign-in helpers are module-local to actions.ts; the seam is the client
// they build, so that is what gets replaced.
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { signInWithPassword, signOut },
  })),
}));
vi.mock("@/lib/mobile/me", () => ({ deleteMe: vi.fn() }));
vi.mock("@/lib/admin/rate-limit", () => ({
  checkLoginLimit: vi.fn(async () => ({ blocked: false })),
  clearLoginLimit: vi.fn(),
  clientIp: vi.fn(async () => "1.2.3.4"),
  recordLoginFailure: vi.fn(async () => ({ blocked: false })),
}));
vi.mock("@/lib/newsletter/store", () => ({
  subscribeNewsletter: vi.fn(),
  unsubscribeNewsletterByEmail: vi.fn(),
}));
vi.mock("@/lib/email/send", () => ({
  sendVerificationEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}));

const { loginAction } = await import("@/app/uye/actions");

function form(email: string, password: string): FormData {
  const fd = new FormData();
  fd.set("email", email);
  fd.set("password", password);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  signInWithPassword.mockResolvedValue({
    data: { user: { id: "u-1", email: "eda@example.com" } },
    error: null,
  });
  signOut.mockResolvedValue({ error: null });
  ensureCustomerForSupabaseUser.mockResolvedValue({
    ok: true,
    customer: { email: "eda@example.com" },
  });
  adoptSupabasePassword.mockResolvedValue(true);
  supabaseHoldsLatestPassword.mockResolvedValue(true);
});

describe("a password the app reset", () => {
  it("opens the website, and the stale hash here is brought into line", async () => {
    // Supabase says yes to the new password; this row still holds the old one.
    checkSitePassword.mockResolvedValue("mismatch");

    await expect(loginAction({}, form("eda@example.com", "yeni-sifre"))).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(adoptSupabasePassword).toHaveBeenCalledWith(
      "eda@example.com",
      "yeni-sifre",
    );
    expect(setActiveCustomerSession).toHaveBeenCalledWith("eda@example.com");
    expect(signOut).not.toHaveBeenCalled();
  });

  it("refuses the old one without consulting the stale bcrypt copy at all", async () => {
    // The hole this closes: Supabase rejected the old password, the bcrypt
    // path was asked for a second opinion, and the stale hash — still holding
    // that very password — said yes. A reset that leaves the old password
    // working is not a reset.
    signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid login credentials", status: 400 },
    });
    verifyCustomerLogin.mockResolvedValue({
      ok: true,
      customer: { email: "eda@example.com" },
    });

    const res = await loginAction({}, form("eda@example.com", "eski-sifre"));
    expect(res.error).toContain("hatalı");
    expect(verifyCustomerLogin).not.toHaveBeenCalled();
    expect(setActiveCustomerSession).not.toHaveBeenCalled();
  });

  it("still lets the bcrypt copy answer when Supabase is unreachable", async () => {
    // An auth server that did not answer has not refused anything, and
    // locking every member out of the site for the length of a Supabase
    // outage is the worse of the two failures.
    signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: "service unavailable", status: 503 },
    });
    verifyCustomerLogin.mockResolvedValue({
      ok: true,
      customer: { email: "eda@example.com" },
    });

    await expect(loginAction({}, form("eda@example.com", "sifre"))).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(verifyCustomerLogin).toHaveBeenCalled();
  });

  it("does not touch the hash when the two already agree", async () => {
    checkSitePassword.mockResolvedValue("match");
    await expect(loginAction({}, form("eda@example.com", "ayni"))).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(adoptSupabasePassword).not.toHaveBeenCalled();
  });

  it("leaves a member with no site password alone", async () => {
    // Signed up in the app: the row has an empty hash, so there is nothing to
    // disagree with and nothing to adopt.
    checkSitePassword.mockResolvedValue("none");
    await expect(loginAction({}, form("eda@example.com", "sifre"))).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(adoptSupabasePassword).not.toHaveBeenCalled();
  });
});

describe("signing out here does not sign the member out of their phone", () => {
  /**
   * supabase-js defaults `signOut()` to `global`, which revokes every refresh
   * token the member holds anywhere. The site called it bare — so leaving the
   * website killed the app session too, and the two calls on the FAILED login
   * path did it to someone who never signed in. A password Supabase still
   * accepts but this row has replaced reaches that branch, which turns a
   * stale credential into a way to knock a member off their phone.
   */
  it("scopes the sign-out to this browser when a bridged login is refused", async () => {
    supabaseHoldsLatestPassword.mockResolvedValue(false);
    checkSitePassword.mockResolvedValue("mismatch");
    verifyCustomerLogin.mockResolvedValue({
      ok: false,
      error: "E-posta veya şifre hatalı.",
    });

    await loginAction({}, form("eda@example.com", "eski-sifre"));

    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(signOut).not.toHaveBeenCalledWith();
  });

  it("scopes the ordinary logout the same way", async () => {
    const { logoutAction } = await import("@/app/uye/actions");
    await expect(logoutAction()).rejects.toThrow("NEXT_REDIRECT");
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});

describe("when the mirror is not known to have landed", () => {
  /**
   * `passwordMirroredAt` empty means a password written HERE may never have
   * reached Supabase — no service-role key, an unlinked row, a failed call.
   * Supabase can then be holding something OLDER than this row, and adopting
   * it would roll a member's password change back to the one they replaced.
   */
  it("keeps this site's copy authoritative and refuses the disagreement", async () => {
    supabaseHoldsLatestPassword.mockResolvedValue(false);
    checkSitePassword.mockResolvedValue("mismatch");

    const res = await loginAction({}, form("eda@example.com", "eski-sifre"));
    expect(res.error).toContain("hatalı");
    expect(adoptSupabasePassword).not.toHaveBeenCalled();
    expect(signOut).toHaveBeenCalled();
    expect(setActiveCustomerSession).not.toHaveBeenCalled();
  });

  it("still offers the bcrypt path, which is the only copy that can be current", async () => {
    supabaseHoldsLatestPassword.mockResolvedValue(false);
    signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid login credentials", status: 400 },
    });
    verifyCustomerLogin.mockResolvedValue({
      ok: true,
      customer: { email: "eda@example.com" },
    });

    await expect(loginAction({}, form("eda@example.com", "yeni-sifre"))).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(verifyCustomerLogin).toHaveBeenCalled();
  });
});
