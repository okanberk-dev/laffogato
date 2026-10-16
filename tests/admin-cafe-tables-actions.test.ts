import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * /admin/masalar actions. Every export of a "use server" file is a public
 * POST endpoint (CLAUDE.md rule 27), so each one is called here the way a
 * hand-made request would call it.
 */

const {
  requireRole,
  logAudit,
  createCafeTable,
  updateCafeTable,
  setCafeTableActive,
  rotateCafeTableCode,
  redirect,
} = vi.hoisted(() => ({
  requireRole: vi.fn(async () => ({ email: "m@ornek.com", role: "manager" })),
  logAudit: vi.fn(async () => {}),
  createCafeTable: vi.fn(),
  updateCafeTable: vi.fn(),
  setCafeTableActive: vi.fn(),
  rotateCafeTableCode: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/admin/auth", () => ({ requireRole }));
vi.mock("@/lib/admin/audit", () => ({ logAudit }));
vi.mock("@/lib/admin/cafe-tables", () => ({
  createCafeTable,
  updateCafeTable,
  setCafeTableActive,
  rotateCafeTableCode,
}));

const actions = await import("@/app/admin/masalar/actions");

const TABLE = {
  id: "tbl-0003",
  code: "ABCDEFGH23",
  name: "Bahçe 3",
  sortOrder: 3,
  isActive: true,
  createdAt: "",
  updatedAt: "",
  rotatedAt: "2026-10-15T18:00:00.000Z",
};

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  for (const f of [
    requireRole,
    logAudit,
    createCafeTable,
    updateCafeTable,
    setCafeTableActive,
    rotateCafeTableCode,
  ]) {
    f.mockClear();
  }
  createCafeTable.mockResolvedValue({ ok: true, value: TABLE });
  updateCafeTable.mockResolvedValue({ ok: true, value: TABLE });
  setCafeTableActive.mockResolvedValue({ ok: true, value: TABLE });
  rotateCafeTableCode.mockResolvedValue({ ok: true, value: TABLE });
});

describe("masalar actions", () => {
  it("export no delete: a table leaves service by deactivation", () => {
    expect(Object.keys(actions).sort()).toEqual([
      "createCafeTableAction",
      "rotateCafeTableCodeAction",
      "setCafeTableActiveAction",
      "updateCafeTableAction",
    ]);
    const src = readFileSync("src/lib/admin/cafe-tables.ts", "utf8");
    expect(src).not.toMatch(/\.delete\(/);
  });

  it("each checks the tables section before anything else", async () => {
    requireRole.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));
    await expect(
      actions.createCafeTableAction({}, form({ name: "Bahçe 3" })),
    ).rejects.toThrow();
    expect(createCafeTable).not.toHaveBeenCalled();

    for (const run of [
      () =>
        actions.setCafeTableActiveAction(
          form({ id: "tbl-0003", isActive: "false" }),
        ),
      () => actions.rotateCafeTableCodeAction(form({ id: "tbl-0003" })),
    ]) {
      requireRole.mockClear();
      await run();
      expect(requireRole).toHaveBeenCalledWith("tables");
    }
  });

  it("creates with the name only and audits it", async () => {
    await expect(
      actions.createCafeTableAction(
        {},
        form({ name: "  Bahçe 3 ", code: "HANDMADE01" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    // A code in the request is never read: the server draws it.
    expect(createCafeTable).toHaveBeenCalledWith("Bahçe 3");
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "create", entity: "cafe_table" }),
    );
  });

  it("refuses an empty or too long name without touching the store", async () => {
    const empty = await actions.createCafeTableAction({}, form({ name: " " }));
    expect(empty.error).toBeTruthy();
    const long = await actions.updateCafeTableAction(
      {},
      form({ id: "tbl-0003", name: "x".repeat(41), sortOrder: "1" }),
    );
    expect(long.error).toBeTruthy();
    expect(createCafeTable).not.toHaveBeenCalled();
    expect(updateCafeTable).not.toHaveBeenCalled();
  });

  it("refuses an id that is not a table's", async () => {
    await actions.rotateCafeTableCodeAction(form({ id: "ord-0001" }));
    await actions.setCafeTableActiveAction(form({ id: "x", isActive: "true" }));
    expect(rotateCafeTableCode).not.toHaveBeenCalled();
    expect(setCafeTableActive).not.toHaveBeenCalled();
  });

  it("logs a rotation without either code", async () => {
    await actions.rotateCafeTableCodeAction(form({ id: "tbl-0003" }));
    expect(rotateCafeTableCode).toHaveBeenCalledWith("tbl-0003");
    const payload = JSON.stringify(logAudit.mock.calls.at(-1));
    expect(payload).toContain("code_rotated");
    expect(payload).not.toContain("ABCDEFGH23");
  });

  it("toggles the active flag from an explicit value", async () => {
    await actions.setCafeTableActiveAction(
      form({ id: "tbl-0003", isActive: "false" }),
    );
    expect(setCafeTableActive).toHaveBeenCalledWith("tbl-0003", false);
  });
});

describe("the QR download", () => {
  it("checks the session and the role itself", () => {
    const src = readFileSync("src/app/admin/masalar/[id]/qr/route.ts", "utf8");
    expect(src).toContain("getAdminSession()");
    expect(src).toContain('canAccess("tables", session.role)');
    expect(src).toContain("image/svg+xml");
    expect(src).toContain("Content-Disposition");
  });
});
