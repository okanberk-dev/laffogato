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

vi.mock("@/lib/admin/auth", () => ({ requireRole }));
vi.mock("@/lib/admin/audit", () => ({ logAudit }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/admin/staff-members", () => ({ grantBarista, revokeBarista }));

const { grantBaristaAction, revokeBaristaAction } =
  await import("@/app/admin/kullanicilar/actions");

function form(email: string): FormData {
  const fd = new FormData();
  fd.set("email", email);
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
    await expect(revokeBaristaAction({}, form(ROW.email))).rejects.toThrow();
    expect(revokeBarista).not.toHaveBeenCalled();
  });

  it("revokes and audits it as a removal", async () => {
    const state = await revokeBaristaAction({}, form(ROW.email));
    expect(revokeBarista).toHaveBeenCalledWith("bora@ornek.com");
    expect(state.message).toContain("kaldırıldı");
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
    const state = await revokeBaristaAction({}, form(ROW.email));
    expect(state.error).toMatch(/barista yetkisi yok/);
    expect(logAudit).not.toHaveBeenCalled();
  });
});
