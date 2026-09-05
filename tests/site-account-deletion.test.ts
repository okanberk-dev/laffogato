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

const { deleteAccountAction } = await import("@/app/uye/actions");

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  getActiveCustomer.mockResolvedValue({ email: "eda@example.com" });
  checkSitePassword.mockResolvedValue("match");
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
  });

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

  it("lets a social-login account through with no password", async () => {
    // No local passwordHash → "none"; asking for a password would lock the
    // member out of the only self-service route they have.
    checkSitePassword.mockResolvedValue("none");
    await expect(
      deleteAccountAction({}, form({ confirmEmail: "eda@example.com" })),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(deleteMe).toHaveBeenCalled();
  });
});
