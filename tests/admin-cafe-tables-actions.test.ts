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
  setAdminFlash,
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
  setAdminFlash: vi.fn(async () => {}),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect,
  // Next's own control flow is rethrown; anything else is not.
  unstable_rethrow: (err: unknown) => {
    if (err instanceof Error && err.message === "NEXT_REDIRECT") throw err;
  },
}));
vi.mock("@/lib/admin/auth", () => ({ requireRole }));
vi.mock("@/lib/admin/audit", () => ({ logAudit }));
vi.mock("@/lib/admin/flash", () => ({ setAdminFlash }));
vi.mock("@/lib/admin/cafe-tables", () => ({
  createCafeTable,
  updateCafeTable,
  setCafeTableActive,
  rotateCafeTableCode,
}));

const actions = await import("@/app/admin/masalar/actions");
const { PANEL_ACTION_FAILED, runPanelAction } =
  await import("@/components/admin/action-form");

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
      actions.createCafeTableAction(null, form({ name: "Bahçe 3" })),
    ).rejects.toThrow();
    expect(createCafeTable).not.toHaveBeenCalled();

    for (const run of [
      () =>
        actions.setCafeTableActiveAction(
          null,
          form({ id: "tbl-0003", isActive: "false" }),
        ),
      () => actions.rotateCafeTableCodeAction(null, form({ id: "tbl-0003" })),
    ]) {
      requireRole.mockClear();
      await run();
      expect(requireRole).toHaveBeenCalledWith("tables");
    }
  });

  it("creates with the name only and audits it", async () => {
    await expect(
      actions.createCafeTableAction(
        null,
        form({ name: "  Bahçe 3 ", code: "HANDMADE01" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    // A code in the request is never read: the server draws it.
    expect(createCafeTable).toHaveBeenCalledWith("Bahçe 3");
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "create", entity: "cafe_table" }),
    );
    // The list it lands on says so (a toast from the flash cookie).
    expect(setAdminFlash).toHaveBeenCalledWith(
      expect.stringContaining("Bahçe 3 eklendi"),
    );
  });

  it("refuses an empty or too long name without touching the store", async () => {
    const empty = await actions.createCafeTableAction(
      null,
      form({ name: " " }),
    );
    expect(empty.ok).toBe(false);
    const long = await actions.updateCafeTableAction(
      null,
      form({ id: "tbl-0003", name: "x".repeat(41), sortOrder: "1" }),
    );
    expect(long.ok).toBe(false);
    expect(createCafeTable).not.toHaveBeenCalled();
    expect(updateCafeTable).not.toHaveBeenCalled();
  });

  it("puts each refusal under its own field (KAR-14)", async () => {
    const res = await actions.updateCafeTableAction(
      null,
      form({ id: "tbl-0003", name: "", sortOrder: "-1" }),
    );
    expect(res).toMatchObject({
      ok: false,
      fieldErrors: {
        name: "Masa adı gerekli.",
        sortOrder: "Sıra 0 ile 9999 arasında olmalı.",
      },
    });
    // The store's own name check lands on the name field too.
    createCafeTable.mockResolvedValueOnce({
      ok: false,
      error: "invalid_name",
      message: "Masa adı 1-40 karakter olmalı.",
    });
    const store = await actions.createCafeTableAction(
      null,
      form({ name: "Bahçe 3" }),
    );
    expect(store).toMatchObject({
      ok: false,
      fieldErrors: { name: "Masa adı 1-40 karakter olmalı." },
    });
  });

  it("a database error reaches the form as 'Bir hata oldu', not the error screen (KAR-14)", async () => {
    createCafeTable.mockRejectedValueOnce(new Error("db down"));
    const res = await runPanelAction(
      actions.createCafeTableAction,
      null,
      form({ name: "Bahçe 3" }),
    );
    expect(res).toEqual({ ok: false, error: PANEL_ACTION_FAILED });
    expect(logAudit).not.toHaveBeenCalled();
  });

  it("a saved table opens its own page", async () => {
    await expect(
      actions.updateCafeTableAction(
        null,
        form({ id: "tbl-0003", name: "Bahçe 3", sortOrder: "3" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenLastCalledWith("/admin/masalar/tbl-0003");
  });

  it("refuses an id that is not a table's", async () => {
    await actions.rotateCafeTableCodeAction(null, form({ id: "ord-0001" }));
    await actions.setCafeTableActiveAction(
      null,
      form({ id: "x", isActive: "true" }),
    );
    expect(rotateCafeTableCode).not.toHaveBeenCalled();
    expect(setCafeTableActive).not.toHaveBeenCalled();
  });

  it("logs a rotation without either code", async () => {
    await actions.rotateCafeTableCodeAction(null, form({ id: "tbl-0003" }));
    expect(rotateCafeTableCode).toHaveBeenCalledWith("tbl-0003");
    const payload = JSON.stringify(logAudit.mock.calls.at(-1));
    expect(payload).toContain("code_rotated");
    expect(payload).not.toContain("ABCDEFGH23");
  });

  it("toggles the active flag from an explicit value", async () => {
    const res = await actions.setCafeTableActiveAction(
      null,
      form({ id: "tbl-0003", isActive: "false" }),
    );
    expect(setCafeTableActive).toHaveBeenCalledWith("tbl-0003", false);
    expect(res).toMatchObject({ ok: true });
  });

  it("says what failed instead of returning nothing", async () => {
    // Pasifleştir, Etkinleştir and Kodu yenile used to `return;` on every
    // refusal: the operator could not tell a failure from a slow page.
    const bad = await actions.setCafeTableActiveAction(
      null,
      form({ id: "x", isActive: "true" }),
    );
    expect(bad.ok).toBe(false);
    setCafeTableActive.mockResolvedValueOnce({
      ok: false,
      error: "not_found",
      message: "Masa bulunamadı.",
    });
    expect(
      await actions.setCafeTableActiveAction(
        null,
        form({ id: "tbl-0003", isActive: "true" }),
      ),
    ).toEqual({ ok: false, error: "Masa bulunamadı." });
    rotateCafeTableCode.mockResolvedValueOnce({
      ok: false,
      error: "not_found",
      message: "Masa bulunamadı.",
    });
    expect(
      await actions.rotateCafeTableCodeAction(null, form({ id: "tbl-0003" })),
    ).toEqual({ ok: false, error: "Masa bulunamadı." });
    expect(logAudit).not.toHaveBeenCalled();
  });

  it("answers a rotation with a warning that stays until read", async () => {
    // The printed card is dead from now on; the toast must not fade.
    const res = await actions.rotateCafeTableCodeAction(
      null,
      form({ id: "tbl-0003" }),
    );
    expect(res).toMatchObject({ ok: true, tone: "warning" });
    expect(res.ok && res.message).toContain("Bahçe 3");
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
