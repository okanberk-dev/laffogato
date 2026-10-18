import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The site's way out (`/uye/hesap/sil`) since 18 Eki 2026 (operator:
 * "hesabı silme sadece bize ulaşarak olsun"): the member sends a request,
 * the team closes the account from the panel. The page used to delete on
 * the member's own click (`deleteAccountAction`); that export is gone, so
 * no POST can delete an account from the site any more. The app's
 * DELETE /me is unchanged (tests/mobile-me-delete-route.test.ts).
 */

const getActiveCustomer = vi.fn();
const deleteMe = vi.fn();
const openDeletionRequest = vi.fn();
const withdrawDeletionRequest = vi.fn();
const safeAudit = vi.fn(async () => true);
const notifyStaffOfDeletionRequest = vi.fn(async () => true);
const logMemberMail = vi.fn();
const sendDeletionRequestReceivedEmail = vi.fn(async () => ({
  ok: true as const,
}));
const reserveLoginAttempt = vi.fn();
const revalidatePath = vi.fn();
const redirect = vi.fn(() => {
  throw new Error("NEXT_REDIRECT");
});

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/customer/auth", () => ({
  clearCustomerSession: vi.fn(),
  getActiveCustomer,
  setActiveCustomerSession: vi.fn(),
  requireCustomer: vi.fn(),
}));
vi.mock("@/lib/customer/store", () => ({
  addCustomerAddress: vi.fn(),
  changeCustomerPassword: vi.fn(),
  checkSitePassword: vi.fn(),
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
vi.mock("@/lib/customer/deletion-request", () => ({
  openDeletionRequest,
  withdrawDeletionRequest,
}));
vi.mock("@/lib/admin/audit", () => ({ safeAudit }));
vi.mock("@/lib/email/account-deletion-notice", () => ({
  logMemberMail,
  notifyStaffOfDeletionRequest,
}));
vi.mock("@/lib/email/send", () => ({
  sendDeletionRequestReceivedEmail,
  sendPasswordResetEmail: vi.fn(),
  sendVerificationEmail: vi.fn(),
}));
vi.mock("@/lib/admin/rate-limit", () => ({
  clearLoginLimit: vi.fn(),
  clientIp: vi.fn(async () => "203.0.113.4"),
  reserveLoginAttempt,
}));

const actions = await import("@/app/uye/actions");
const { requestAccountDeletionAction, withdrawAccountDeletionAction } = actions;
const { accountClosureNotice, accountClosureParam } =
  await import("@/lib/customer/account-closure");

const MEMBER = {
  id: "cus-0042",
  email: "eda@example.com",
  name: "Eda Yılmaz",
  isActive: true,
};
const AT = "2026-10-18T09:15:00.000Z";

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  getActiveCustomer.mockResolvedValue(MEMBER);
  openDeletionRequest.mockResolvedValue({ status: "created", requestedAt: AT });
  withdrawDeletionRequest.mockResolvedValue({
    status: "withdrawn",
    requestedAt: AT,
  });
  reserveLoginAttempt.mockResolvedValue({
    blocked: false,
    remaining: 5,
    retryAfterSeconds: 0,
  });
});

describe("the site cannot delete an account on the member's click", () => {
  it("has no deleteAccountAction endpoint any more", () => {
    // Every export of a "use server" file is a public POST endpoint (rule
    // 27): the old one would still delete if it were only unlinked.
    expect("deleteAccountAction" in actions).toBe(false);
    const src = readFileSync("src/app/uye/actions.ts", "utf8");
    expect(src).not.toContain("deleteMe(");
    expect(src).not.toMatch(/from "@\/lib\/mobile\/me"/);
  });

  it("a request leaves the member active: it stores a request and deletes nothing", async () => {
    const res = await requestAccountDeletionAction(
      {},
      form({ confirm: "on", reason: "Taşınıyorum" }),
    );
    expect(res.error).toBeUndefined();
    expect(openDeletionRequest).toHaveBeenCalledWith(
      "eda@example.com",
      "Taşınıyorum",
    );
    expect(deleteMe).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("requestAccountDeletionAction", () => {
  it("records the request, audits it and mails the team and the member", async () => {
    const res = await requestAccountDeletionAction(
      {},
      form({ confirm: "on", reason: "  Artık\n\nkullanmıyorum  " }),
    );
    expect(res.message).toContain("Silme talebin bize ulaştı");
    // The reason is folded to one line before it is stored.
    expect(openDeletionRequest).toHaveBeenCalledWith(
      "eda@example.com",
      "Artık kullanmıyorum",
    );
    expect(safeAudit).toHaveBeenCalledTimes(1);
    expect(safeAudit).toHaveBeenCalledWith({
      action: "update",
      entity: "customer",
      entityId: "cus-0042",
      actor: "customer",
      payload: { deletionRequest: "opened", requestedAt: AT, withReason: true },
    });
    // The ten-year log names the account by id and keeps no free text.
    expect(JSON.stringify(safeAudit.mock.calls)).not.toContain("eda@");
    expect(JSON.stringify(safeAudit.mock.calls)).not.toContain("kullanmıyorum");
    expect(notifyStaffOfDeletionRequest).toHaveBeenCalledWith({
      kind: "opened",
      customerId: "cus-0042",
      name: "Eda Yılmaz",
      email: "eda@example.com",
      requestedAt: AT,
      hasReason: true,
    });
    expect(sendDeletionRequestReceivedEmail).toHaveBeenCalledWith(
      "eda@example.com",
      {
        requestedOn: "18 Ekim 2026",
        deadline: "17 Kasım 2026",
        requestUrl: "https://laffogato.net/uye/hesap/sil",
        idempotencyKey: `account-deletion-cus-0042-${Date.parse(AT)}-member`,
      },
    );
    expect(revalidatePath).toHaveBeenCalledWith("/uye/hesap", "layout");
  });

  it("stores one request: a second press mails nobody and writes no audit row", async () => {
    openDeletionRequest.mockResolvedValue({
      status: "exists",
      requestedAt: AT,
    });
    const res = await requestAccountDeletionAction({}, form({ confirm: "on" }));
    expect(res.message).toContain("zaten bizde");
    expect(safeAudit).not.toHaveBeenCalled();
    expect(notifyStaffOfDeletionRequest).not.toHaveBeenCalled();
    expect(sendDeletionRequestReceivedEmail).not.toHaveBeenCalled();
  });

  it("refuses without the confirmation box, before anything is counted or written", async () => {
    const res = await requestAccountDeletionAction(
      {},
      form({ reason: "Taşınıyorum" }),
    );
    expect(res.error).toContain("Hesabımın silinmesini istiyorum");
    expect(reserveLoginAttempt).not.toHaveBeenCalled();
    expect(openDeletionRequest).not.toHaveBeenCalled();
  });

  it("refuses a reason over the cap instead of cutting it", async () => {
    const res = await requestAccountDeletionAction(
      {},
      form({ confirm: "on", reason: "a".repeat(501) }),
    );
    expect(res.error).toContain("500");
    expect(openDeletionRequest).not.toHaveBeenCalled();
    const ok = await requestAccountDeletionAction(
      {},
      form({ confirm: "on", reason: "a".repeat(500) }),
    );
    expect(ok.error).toBeUndefined();
    expect(openDeletionRequest).toHaveBeenCalledWith(
      "eda@example.com",
      "a".repeat(500),
    );
  });

  it("is counted per member and stops at the budget", async () => {
    reserveLoginAttempt.mockResolvedValue({
      blocked: true,
      remaining: 0,
      retryAfterSeconds: 3600,
    });
    const res = await requestAccountDeletionAction({}, form({ confirm: "on" }));
    expect(res.error).toMatch(/Çok fazla istek/);
    expect(reserveLoginAttempt).toHaveBeenCalledWith(
      "account-deletion",
      "*",
      "eda@example.com",
    );
    expect(openDeletionRequest).not.toHaveBeenCalled();
  });

  it("asks a signed-out visitor to sign in and writes nothing", async () => {
    getActiveCustomer.mockResolvedValue(null);
    const res = await requestAccountDeletionAction({}, form({ confirm: "on" }));
    expect(res.error).toContain("giriş");
    expect(openDeletionRequest).not.toHaveBeenCalled();
  });

  it("does not fail the request when a mail does not go", async () => {
    sendDeletionRequestReceivedEmail.mockResolvedValueOnce({
      ok: false,
      error: "RESEND_API_KEY tanımlı değil.",
    } as never);
    notifyStaffOfDeletionRequest.mockResolvedValueOnce(false);
    const res = await requestAccountDeletionAction({}, form({ confirm: "on" }));
    expect(res.error).toBeUndefined();
    expect(logMemberMail).toHaveBeenCalledWith(
      "request",
      "cus-0042",
      "eda@example.com",
      { ok: false, error: "RESEND_API_KEY tanımlı değil." },
    );
  });
});

describe("withdrawAccountDeletionAction", () => {
  it("clears the request, audits it and tells the team", async () => {
    const res = await withdrawAccountDeletionAction({});
    expect(res.message).toContain("geri aldın");
    expect(withdrawDeletionRequest).toHaveBeenCalledWith("eda@example.com");
    expect(safeAudit).toHaveBeenCalledWith({
      action: "update",
      entity: "customer",
      entityId: "cus-0042",
      actor: "customer",
      payload: { deletionRequest: "withdrawn", requestedAt: AT },
    });
    expect(notifyStaffOfDeletionRequest).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "withdrawn", requestedAt: AT }),
    );
    expect(deleteMe).not.toHaveBeenCalled();
  });

  it("does nothing for a member with no open request", async () => {
    withdrawDeletionRequest.mockResolvedValue({ status: "none" });
    const res = await withdrawAccountDeletionAction({});
    expect(res.message).toContain("Açık bir silme talebin yok");
    expect(safeAudit).not.toHaveBeenCalled();
    expect(notifyStaffOfDeletionRequest).not.toHaveBeenCalled();
  });

  it("is on the same per-member budget", async () => {
    reserveLoginAttempt.mockResolvedValue({
      blocked: true,
      remaining: 0,
      retryAfterSeconds: 60,
    });
    const res = await withdrawAccountDeletionAction({});
    expect(res.error).toMatch(/Çok fazla istek/);
    expect(withdrawDeletionRequest).not.toHaveBeenCalled();
  });
});

describe("the notice the home page shows after a closure (old links)", () => {
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
