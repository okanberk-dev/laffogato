import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The barista grant on /admin/kullanicilar.
 *
 * Handing out the till from the app is handing out stamps, so both actions
 * open the `adminUsers` gate themselves (a Server Action is a POST endpoint
 * the page cannot protect), parse the address with Zod before anything is
 * written, and leave an audit row. What the store refuses - an unknown or a
 * closed member - is run against Postgres in
 * tests/db-integration-staff-stamp.test.ts.
 */

const requireRole = vi.fn();
const logAudit = vi.fn();
const revalidatePath = vi.fn();
const grantBarista = vi.fn();
const revokeBarista = vi.fn();
const deleteAdminUser = vi.fn();
const updateAdminUser = vi.fn();
const createAdminUser = vi.fn();
const listAdminUsers = vi.fn();
const disable2FA = vi.fn();
/** The break-glass accounts of ADMIN_USERS / ADMIN_EMAIL. */
const listEnvAdminContacts = vi.fn(() => [
  { email: "acil@laffogato.net", role: "owner" },
]);

vi.mock("@/lib/admin/auth", () => ({ listEnvAdminContacts, requireRole }));
vi.mock("@/lib/admin/twofa", () => ({ disable2FA }));
vi.mock("@/lib/admin/audit", () => ({ logAudit }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/admin/staff-members", () => ({ grantBarista, revokeBarista }));
vi.mock("@/lib/admin/users", () => ({
  createAdminUser,
  deleteAdminUser,
  listAdminUsers,
  normalizeAdminEmail: (e: string) => e.trim().toLowerCase(),
  setAdminPassword: vi.fn(),
  updateAdminUser,
}));

const {
  createAdminUserAction,
  deleteAdminUserAction,
  grantBaristaAction,
  reset2FAAction,
  revokeBaristaAction,
  saveAdminUserAction,
} = await import("@/app/admin/kullanicilar/actions");
const { SELF_CHANGE_REFUSED, SELF_DELETE_REFUSED } =
  await import("@/lib/admin/users-self");

function form(email: string, extra: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("email", email);
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  return fd;
}

const ROW = {
  email: "bora@ornek.com",
  role: "barista",
  isActive: true,
  grantedBy: "patron@laffogato.net",
  grantedAt: "2026-10-15T08:00:00.000Z",
  updatedAt: "2026-10-15T08:00:00.000Z",
  name: "Bora",
};

beforeEach(() => {
  requireRole.mockReset();
  requireRole.mockResolvedValue({ email: "patron@laffogato.net" });
  logAudit.mockReset();
  revalidatePath.mockReset();
  grantBarista.mockReset();
  grantBarista.mockResolvedValue({ ok: true, value: ROW });
  revokeBarista.mockReset();
  revokeBarista.mockResolvedValue({
    ok: true,
    value: { ...ROW, isActive: false },
  });
  deleteAdminUser.mockReset();
  createAdminUser.mockReset();
  disable2FA.mockReset();
  listAdminUsers.mockReset();
  listAdminUsers.mockResolvedValue([
    { email: "kasa@laffogato.net", role: "cashier", isActive: true },
    { email: "patron@laffogato.net", role: "owner", isActive: true },
  ]);
});

describe("grantBaristaAction", () => {
  it("opens the adminUsers gate before anything else", async () => {
    requireRole.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(grantBaristaAction({}, form(ROW.email))).rejects.toThrow();
    expect(requireRole).toHaveBeenCalledWith("adminUsers");
    expect(grantBarista).not.toHaveBeenCalled();
  });

  it("refuses an address Zod does not accept, writing nothing", async () => {
    const state = await grantBaristaAction({}, form("bora@"));
    expect(state.error).toBe("Geçerli bir e-posta gir.");
    expect(grantBarista).not.toHaveBeenCalled();
    expect(logAudit).not.toHaveBeenCalled();
  });

  it("grants the lower-cased address as the signed-in admin", async () => {
    const state = await grantBaristaAction({}, form("  Bora@Ornek.com "));
    expect(grantBarista).toHaveBeenCalledWith({
      email: "bora@ornek.com",
      grantedBy: "patron@laffogato.net",
    });
    expect(state.message).toContain("bora@ornek.com");
    expect(logAudit).toHaveBeenCalledWith({
      action: "create",
      entity: "staff_member",
      entityId: "bora@ornek.com",
      payload: { role: "barista" },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/kullanicilar");
  });

  it("shows the store's refusal for an unknown member and audits nothing", async () => {
    grantBarista.mockResolvedValue({
      ok: false,
      error: "no_member",
      message: "Bu adrese ait üye hesabı yok.",
    });
    const state = await grantBaristaAction({}, form("yok@ornek.com"));
    expect(state).toEqual({ error: "Bu adrese ait üye hesabı yok." });
    expect(logAudit).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("revokeBaristaAction", () => {
  it("opens the adminUsers gate", async () => {
    requireRole.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(revokeBaristaAction(null, form(ROW.email))).rejects.toThrow();
    expect(revokeBarista).not.toHaveBeenCalled();
  });

  it("revokes and audits it as a removal", async () => {
    const state = await revokeBaristaAction(null, form(ROW.email));
    expect(revokeBarista).toHaveBeenCalledWith("bora@ornek.com");
    // An ActionResult: the confirm dialog closes on it and shows the toast.
    expect(state).toMatchObject({
      ok: true,
      message: expect.stringContaining("kaldırıldı"),
    });
    expect(logAudit).toHaveBeenCalledWith({
      action: "delete",
      entity: "staff_member",
      entityId: "bora@ornek.com",
      payload: { role: "barista" },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/kullanicilar");
  });

  it("passes the store's refusal on when there is nothing to revoke", async () => {
    revokeBarista.mockResolvedValue({
      ok: false,
      error: "not_found",
      message: "Bu adres için açık bir barista yetkisi yok.",
    });
    const state = await revokeBaristaAction(null, form(ROW.email));
    expect(state).toMatchObject({
      ok: false,
      error: expect.stringMatching(/barista yetkisi yok/),
    });
    expect(logAudit).not.toHaveBeenCalled();
  });
});

describe("deleteAdminUserAction", () => {
  // Behind ConfirmButton now (it deleted on the first click): it answers an
  // ActionResult the dialog reads.
  it("deletes, audits and answers for the toast", async () => {
    deleteAdminUser.mockResolvedValue({
      ok: true,
      value: { email: "kasa@laffogato.net", role: "cashier" },
    });
    const res = await deleteAdminUserAction(null, form(" Kasa@Laffogato.net "));
    expect(deleteAdminUser).toHaveBeenCalledWith("kasa@laffogato.net");
    expect(res).toMatchObject({
      ok: true,
      message: "kasa@laffogato.net silindi.",
    });
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "delete", entity: "admin_user" }),
    );
    // The authenticator goes with the account: a re-created account with the
    // same address inherited the lost secret.
    expect(disable2FA).toHaveBeenCalledWith("kasa@laffogato.net");
  });

  it("audits the delete even when the 2FA cleanup fails", async () => {
    // The account is already gone: a failing 2FA delete must not leave a
    // removed panel account with no audit row.
    deleteAdminUser.mockResolvedValue({
      ok: true,
      value: { email: "kasa@laffogato.net", role: "cashier" },
    });
    disable2FA.mockRejectedValueOnce(new Error("twofa.disable2FA: db"));
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await deleteAdminUserAction(null, form("kasa@laffogato.net"));
    expect(logAudit).toHaveBeenCalledWith({
      action: "delete",
      entity: "admin_user",
      entityId: "kasa@laffogato.net",
      payload: { role: "cashier" },
    });
    expect(res).toMatchObject({ ok: true, tone: "warning" });
    // Logged without the address (rule 9).
    expect(errorLog).toHaveBeenCalled();
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain("kasa@");
    errorLog.mockRestore();
  });

  it("leaves a break-glass account's 2FA alone", async () => {
    deleteAdminUser.mockResolvedValue({
      ok: true,
      value: { email: "acil@laffogato.net", role: "owner" },
    });
    await deleteAdminUserAction(null, form("acil@laffogato.net"));
    expect(disable2FA).not.toHaveBeenCalled();
  });

  it("keeps the dialog open on the last-owner refusal", async () => {
    deleteAdminUser.mockResolvedValue({
      ok: false,
      error: "last_owner",
      message: "Son sahip hesabı silinemez.",
    });
    const res = await deleteAdminUserAction(null, form("ortak@laffogato.net"));
    expect(res).toEqual({ ok: false, error: "Son sahip hesabı silinemez." });
    expect(logAudit).not.toHaveBeenCalled();
  });
});

describe("the signed-in owner's own row", () => {
  // The session's account is re-read on every request: a lower role took
  // the page away at once and switching yourself off signed you out, with
  // nobody's say. The row now saves the name alone.
  beforeEach(() => {
    requireRole.mockResolvedValue({
      email: "patron@laffogato.net",
      role: "owner",
    });
    updateAdminUser.mockReset();
    updateAdminUser.mockResolvedValue({
      ok: true,
      value: { email: "patron@laffogato.net", role: "owner", isActive: true },
    });
  });

  it("cannot delete itself; the store is never asked", async () => {
    const res = await deleteAdminUserAction(
      null,
      form(" Patron@Laffogato.net "),
    );
    expect(res).toEqual({ ok: false, error: SELF_DELETE_REFUSED });
    expect(deleteAdminUser).not.toHaveBeenCalled();
    expect(logAudit).not.toHaveBeenCalled();
  });

  it("cannot change its own role or switch its own access off", async () => {
    // The row sends neither field; a request that does is refused, even
    // with the stored values (it cannot be told from a change here).
    const changes: Record<string, string>[] = [
      { name: "Patron", role: "manager", isActive: "on" },
      { name: "Patron", role: "owner" },
      { name: "Patron", isActive: "on" },
    ];
    for (const extra of changes) {
      const state = await saveAdminUserAction(
        {},
        form("patron@laffogato.net", extra),
      );
      expect(state).toEqual({ error: SELF_CHANGE_REFUSED });
    }
    expect(updateAdminUser).not.toHaveBeenCalled();
  });

  it("can still save its own name, and only the name", async () => {
    // Role and access stay as stored: an env sign-in beside an inactive
    // row of the same address must not switch that row on.
    const state = await saveAdminUserAction(
      {},
      form("patron@laffogato.net", { name: "Patron" }),
    );
    expect(state).toEqual({ message: "Kaydedildi." });
    expect(updateAdminUser).toHaveBeenCalledWith("patron@laffogato.net", {
      name: "Patron",
    });
  });

  it("leaves another owner's row to the usual rules", async () => {
    updateAdminUser.mockResolvedValue({
      ok: true,
      value: { email: "ortak@laffogato.net", role: "manager", isActive: false },
    });
    const state = await saveAdminUserAction(
      {},
      form("ortak@laffogato.net", { name: "Ortak", role: "manager" }),
    );
    expect(state).toEqual({ message: "Kaydedildi." });
  });
});

describe("createAdminUserAction", () => {
  const fields = { name: "Eda", role: "cashier", password: "cokGizliParola1" };

  it("drops a 2FA row an earlier account of the address left behind", async () => {
    createAdminUser.mockResolvedValue({
      ok: true,
      value: { email: "kasa@laffogato.net", role: "cashier", name: "Eda" },
    });
    const state = await createAdminUserAction(
      {},
      form("kasa@laffogato.net", fields),
    );
    expect(state.message).toBeTruthy();
    expect(disable2FA).toHaveBeenCalledWith("kasa@laffogato.net");
  });

  it("audits the create even when the 2FA cleanup fails", async () => {
    // The account exists (it can be an owner) and a retry says "zaten
    // kayıtlı": granting panel access must never go unaudited.
    createAdminUser.mockResolvedValue({
      ok: true,
      value: { email: "kasa@laffogato.net", role: "owner", name: "Eda" },
    });
    disable2FA.mockRejectedValueOnce(new Error("twofa.disable2FA: db"));
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const state = await createAdminUserAction(
      {},
      form("kasa@laffogato.net", fields),
    );
    expect(logAudit).toHaveBeenCalledWith({
      action: "create",
      entity: "admin_user",
      entityId: "kasa@laffogato.net",
      payload: { role: "owner", name: "Eda" },
    });
    // The operator learns the old 2FA row may still ask for a code.
    expect(state.message).toMatch(/2FA'yı sıfırla/);
    expect(state.error).toBeUndefined();
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain("kasa@");
    errorLog.mockRestore();
  });

  it("touches nothing when the create is refused", async () => {
    // "exists": the address is a live account whose 2FA must stay.
    createAdminUser.mockResolvedValue({
      ok: false,
      error: "exists",
      message: "Bu e-posta zaten kayıtlı.",
    });
    const state = await createAdminUserAction(
      {},
      form("kasa@laffogato.net", fields),
    );
    expect(state.error).toBe("Bu e-posta zaten kayıtlı.");
    expect(disable2FA).not.toHaveBeenCalled();
  });
});

describe("reset2FAAction (lost phone)", () => {
  const confirmed = (email: string) => form(email, { confirm: email });

  it("opens the adminUsers gate before anything else", async () => {
    requireRole.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(
      reset2FAAction(null, confirmed("kasa@laffogato.net")),
    ).rejects.toThrow();
    expect(requireRole).toHaveBeenCalledWith("adminUsers");
    expect(disable2FA).not.toHaveBeenCalled();
  });

  it("resets another user's 2FA, audited first and without the secret", async () => {
    const res = await reset2FAAction(null, confirmed(" Kasa@Laffogato.net "));
    expect(res).toMatchObject({ ok: true });
    expect(disable2FA).toHaveBeenCalledWith("kasa@laffogato.net");
    expect(logAudit).toHaveBeenCalledWith({
      action: "2fa_disable",
      entity: "2fa",
      entityId: "kasa@laffogato.net",
      payload: { reset: "owner" },
    });
    // No unaudited security change: the row goes in before the reset.
    expect(logAudit.mock.invocationCallOrder[0]).toBeLessThan(
      disable2FA.mock.invocationCallOrder[0],
    );
    expect(JSON.stringify(logAudit.mock.calls)).not.toMatch(/secret/i);
  });

  it("refuses the signed-in owner's own account", async () => {
    // There the 2FA page asks for a code; a stolen session must not strip it.
    const res = await reset2FAAction(null, confirmed("patron@laffogato.net"));
    expect(res.ok).toBe(false);
    expect(disable2FA).not.toHaveBeenCalled();
    expect(logAudit).not.toHaveBeenCalled();
  });

  it("refuses a break-glass account, an unknown one, and a missing confirm", async () => {
    for (const fd of [
      confirmed("acil@laffogato.net"),
      confirmed("yok@laffogato.net"),
      form("kasa@laffogato.net", { confirm: "kasa" }),
    ]) {
      const res = await reset2FAAction(null, fd);
      expect(res.ok).toBe(false);
    }
    expect(disable2FA).not.toHaveBeenCalled();
    expect(logAudit).not.toHaveBeenCalled();
  });
});
