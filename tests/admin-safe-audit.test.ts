import { describe, expect, it, vi } from "vitest";

/**
 * `safeAudit` is `logAudit` for after the money moved. `logAudit` throws
 * when its insert fails; after a refund that turned the operator's success
 * into the error page, they retried, and the second refund passed because
 * money was still "left" (docs: map of 17 Eki 2026, refund bug (b)).
 */

const insert = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  TABLES: { auditLogs: "audit_logs" },
  getDb: () => ({ from: () => ({ insert }) }),
}));
vi.mock("@/lib/db/counters", () => ({ nextSeq: vi.fn(async () => 7) }));
vi.mock("@/lib/admin/auth", () => ({
  getAdminSession: vi.fn(async () => ({ email: "a@b.c", role: "owner" })),
}));

const { logAudit, safeAudit } = await import("@/lib/admin/audit");

describe("safeAudit", () => {
  it("never throws, and says whether the row landed", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    insert.mockResolvedValueOnce({ error: { message: "db down" } });
    await expect(
      logAudit({ action: "refund", entity: "order", entityId: "ord-1" }),
    ).rejects.toThrow(/db down/);
    insert.mockResolvedValueOnce({ error: { message: "db down" } });
    await expect(
      safeAudit({
        action: "refund",
        entity: "order",
        entityId: "ord-1",
        payload: { amountMinor: 100 },
      }),
    ).resolves.toBe(false);
    // Loud, with the row it could not write, so a human can put it back.
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("order:ord-1 refund"),
      JSON.stringify({ amountMinor: 100 }),
      expect.anything(),
    );
    insert.mockResolvedValueOnce({ error: null });
    await expect(
      safeAudit({ action: "refund", entity: "order", entityId: "ord-1" }),
    ).resolves.toBe(true);
    spy.mockRestore();
  });

  it("is what every order action writes with", async () => {
    const { readFileSync } = await import("node:fs");
    for (const file of [
      "src/lib/admin/order-ops.ts",
      "src/app/admin/siparisler/actions.ts",
    ]) {
      const src = readFileSync(file, "utf8");
      expect(src, file).toContain("safeAudit(");
      expect(src, file).not.toMatch(/\blogAudit\(/);
    }
  });
});
