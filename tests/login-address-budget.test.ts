import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Both login forms kept their budget per address + account only, so one
 * address could try a leaked e-mail/password list one account at a time
 * (credential stuffing), or spray one password across every panel account,
 * and never meet a limit. A budget per address across all accounts is taken
 * first, before any credential is looked at.
 */

type Limit = { blocked: boolean; remaining: number; retryAfterSeconds: number };
const OPEN: Limit = { blocked: false, remaining: 4, retryAfterSeconds: 0 };
const BLOCKED: Limit = { blocked: true, remaining: 0, retryAfterSeconds: 900 };

const reserveLoginAttempt = vi.fn(
  async (..._args: string[]): Promise<Limit> => OPEN,
);
const resolveAdminUser = vi.fn();
const verifyCustomerLogin = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
    set: vi.fn(),
    delete: vi.fn(),
  }),
  headers: async () => new Headers(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));
vi.mock("@/lib/admin/rate-limit", () => ({
  clientIp: async () => "203.0.113.20",
  clearLoginLimit: vi.fn(),
  reserveLoginAttempt,
}));
vi.mock("@/lib/admin/users", () => ({
  anyAdminUserExists: vi.fn(async () => true),
  resolveAdminUser,
  verifyAdminPassword: vi.fn(async () => false),
}));
vi.mock("@/lib/admin/twofa", () => ({
  has2FA: vi.fn(async () => false),
  verifyToken: vi.fn(async () => false),
}));
vi.mock("@/lib/customer/auth", () => ({
  clearCustomerSession: vi.fn(),
  getActiveCustomer: vi.fn(),
  setActiveCustomerSession: vi.fn(),
  requireCustomer: vi.fn(),
}));
vi.mock("@/lib/customer/store", () => ({
  adoptSupabasePassword: vi.fn(),
  checkSitePassword: vi.fn(),
  supabaseHoldsLatestPassword: vi.fn(async () => false),
  verifyCustomerLogin,
}));
vi.mock("@/lib/customer/supabase-bridge", () => ({
  ensureCustomerForSupabaseUser: vi.fn(),
  linkCustomerToSupabase: vi.fn(),
  linkIdentityAfterReset: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      signInWithPassword: async () => ({
        data: { user: null },
        error: { status: 400, message: "Invalid login credentials" },
      }),
      signOut: async () => ({}),
    },
  })),
}));
vi.mock("@/lib/mobile/me", () => ({ deleteMe: vi.fn() }));
vi.mock("@/lib/newsletter/store", () => ({
  subscribeNewsletter: vi.fn(),
  unsubscribeNewsletterByEmail: vi.fn(),
}));
vi.mock("@/lib/email/send", () => ({
  sendVerificationEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}));

process.env.ADMIN_SESSION_SECRET = "test-secret";

const { signInAdmin } = await import("@/lib/admin/auth");
const { loginAction } = await import("@/app/uye/actions");

function blockOnly(purpose: string) {
  reserveLoginAttempt.mockImplementation(async (p: string) =>
    p === purpose ? BLOCKED : OPEN,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  reserveLoginAttempt.mockImplementation(async () => OPEN);
  resolveAdminUser.mockResolvedValue(null);
  verifyCustomerLogin.mockResolvedValue({
    ok: false,
    error: "E-posta veya şifre hatalı.",
  });
});

describe("admin sign-in", () => {
  it("takes the address's budget across all accounts first", async () => {
    await signInAdmin("sahip@laffogato.net", "tahmin");
    expect(reserveLoginAttempt.mock.calls[0]).toEqual([
      "admin-login-ip",
      "203.0.113.20",
      "*",
    ]);
    expect(reserveLoginAttempt).toHaveBeenCalledWith(
      "admin-login",
      "203.0.113.20",
      "sahip@laffogato.net",
    );
  });

  it("refuses as throttled without checking the password once it is spent", async () => {
    blockOnly("admin-login-ip");
    const res = await signInAdmin("baska@laffogato.net", "tahmin");
    expect(res.ok).toBe(false);
    expect(res.throttled).toBe(true);
    expect(resolveAdminUser).not.toHaveBeenCalled();
  });
});

describe("member sign-in", () => {
  function form(email: string): FormData {
    const fd = new FormData();
    fd.set("email", email);
    fd.set("password", "sizdirilmis-parola");
    return fd;
  }

  it("takes the address's budget across all accounts first", async () => {
    await loginAction({}, form("uye@example.com"));
    expect(reserveLoginAttempt.mock.calls[0]).toEqual([
      "customer-login-ip",
      "203.0.113.20",
      "*",
    ]);
  });

  it("checks no credential once it is spent", async () => {
    blockOnly("customer-login-ip");
    const res = await loginAction({}, form("bir-sonraki@example.com"));
    expect(res.error).toMatch(/çok fazla başarısız deneme/i);
    expect(verifyCustomerLogin).not.toHaveBeenCalled();
  });
});
