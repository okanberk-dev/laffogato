import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Çıkış used to write its audit row before deleting the cookie, and
 * `logAudit` throws when the row cannot be written. With the database down
 * the operator pressed Çıkış, got an error, and the panel stayed signed in
 * on the shared köşk device (admin audit SHE-M02).
 */

const calls = vi.hoisted(() => [] as string[]);
const nextSeq = vi.hoisted(() => vi.fn());
const insert = vi.hoisted(() => vi.fn());
const getAdminSession = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  redirect: vi.fn((to: string) => {
    calls.push(`redirect:${to}`);
  }),
}));
vi.mock("@/lib/db", () => ({
  TABLES: { auditLogs: "audit_logs" },
  getDb: () => ({ from: () => ({ insert }) }),
}));
vi.mock("@/lib/db/counters", () => ({ nextSeq }));
vi.mock("@/lib/admin/auth", () => ({
  getAdminSession,
  signOutAdmin: vi.fn(async () => {
    calls.push("signOut");
  }),
}));

const { logoutAction } = await import("@/app/admin/actions");

beforeEach(() => {
  calls.length = 0;
  nextSeq.mockReset();
  insert.mockReset();
  getAdminSession.mockReset();
  getAdminSession.mockResolvedValue({ email: "kasa@laffogato.net" });
});

describe("logoutAction", () => {
  it("signs out and leaves even when the audit row cannot be written", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    nextSeq.mockRejectedValue(new Error("connect ECONNREFUSED"));
    await expect(logoutAction()).resolves.toBeUndefined();
    expect(calls).toEqual(["signOut", "redirect:/admin/giris"]);
    spy.mockRestore();
  });

  it("signs out when the session itself cannot be looked up", async () => {
    getAdminSession.mockRejectedValue(new Error("account lookup unavailable"));
    await logoutAction();
    expect(calls).toEqual(["signOut", "redirect:/admin/giris"]);
    // No actor to write: nothing is attempted.
    expect(nextSeq).not.toHaveBeenCalled();
  });

  it("still records who left when the database answers", async () => {
    nextSeq.mockResolvedValue(12);
    insert.mockResolvedValue({ error: null });
    await logoutAction();
    expect(calls).toEqual(["signOut", "redirect:/admin/giris"]);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "logout",
        entity: "auth",
        entityId: "kasa@laffogato.net",
        actor: "kasa@laffogato.net",
      }),
    );
  });
});
