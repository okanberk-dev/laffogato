import { readFileSync } from "node:fs";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Mobil → Canlı durum (admin audit CON-03, CON-07, CON-23, CON-25): the
 * form posts through ActionForm, so a refusal (more free tables than
 * tables) keeps every field as typed and names the field; the answer is an
 * ActionResult a toast or a role="alert" line can say.
 *
 * Admin UI v2, UI-13 (decision D3): the page and its actions open to the
 * `venue` section (owner, manager, Personel). Only a role with `mobileApp`
 * changes the table count: Personel's save ignores a posted one and goes
 * through patchVenueStatus, which never writes it. The top bar's köşk chip
 * saves through saveVenueQuickAction (the override and the free tables
 * only) and reads through venueQuickSignalAction (its own tests:
 * admin-venue-signal).
 */

const updateVenueStatus = vi.fn(async (input: Record<string, unknown>) => ({
  ...input,
}));
const getSettings = vi.fn(async () => ({
  weeklyHours: {
    mon: { open: "00:00", close: "24:00", closed: false },
    tue: { open: "00:00", close: "24:00", closed: false },
    wed: { open: "00:00", close: "24:00", closed: false },
    thu: { open: "00:00", close: "24:00", closed: false },
    fri: { open: "00:00", close: "24:00", closed: false },
    sat: { open: "00:00", close: "24:00", closed: false },
    sun: { open: "00:00", close: "24:00", closed: false },
  },
}));
const venueSignal = vi.fn(async (_cursor: unknown) => ({
  status: null,
  cursor: "",
}));
const patchVenueStatus = vi.fn(
  async (
    patch: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null> => ({
    ...STORED,
    ...patch,
  }),
);
const getVenueStatus = vi.fn(async () => ({ ...STORED }));
const logAudit = vi.fn(async (_input: unknown) => {});
const safeAudit = vi.fn(async (_input: unknown) => true);
const revalidatePath = vi.fn();

const auth = vi.hoisted(() => ({
  role: "owner" as string | null,
  sections: [] as string[],
}));

const STORED = {
  id: "main",
  manualOverride: "auto",
  freeTables: 3,
  totalTables: 12,
  wifi: "slow",
  noise: "high",
  power: false,
  note: "Maç gecesi",
  updatedAt: "2026-10-19T18:00:00.000Z",
};

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ unstable_rethrow: vi.fn() }));
vi.mock("@/lib/admin/auth", async () => {
  const { canAccess } = await import("@/lib/admin/roles");
  return {
    requireRole: vi.fn(async (section: string) => {
      auth.sections.push(section);
      if (!auth.role) throw new Error("NEXT_REDIRECT /admin/giris");
      if (!canAccess(section as never, auth.role as never)) {
        throw new Error("NEXT_REDIRECT denied");
      }
      return { email: "x@laffogato.net", role: auth.role, expiresAt: 0 };
    }),
    getAdminSession: vi.fn(async () =>
      auth.role
        ? { email: "x@laffogato.net", role: auth.role, expiresAt: 0 }
        : null,
    ),
  };
});
vi.mock("@/lib/admin/audit", () => ({ logAudit, safeAudit }));
vi.mock("@/lib/admin/store", () => ({ getSettings }));
vi.mock("@/lib/admin/venue-signal", () => ({ venueSignal }));
vi.mock("@/lib/mobile/venue", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/mobile/venue")>();
  return {
    ...real,
    updateVenueStatus,
    patchVenueStatus,
    getVenueStatus,
  };
});

const { saveVenueQuickAction, saveVenueStatusAction, venueQuickSignalAction } =
  await import("@/app/admin/mobil/canli-durum/actions");
const { VenueStatusForm } =
  await import("@/app/admin/mobil/canli-durum/venue-status-form");
const VenueStatusPage = (await import("@/app/admin/mobil/canli-durum/page"))
  .default;

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const OK = {
  manualOverride: "auto",
  freeTables: "3",
  totalTables: "12",
  wifi: "stable",
  noise: "low",
  note: "",
};

beforeEach(() => {
  auth.role = "owner";
  auth.sections.length = 0;
  updateVenueStatus.mockClear();
  patchVenueStatus.mockClear();
  getVenueStatus.mockClear();
  getSettings.mockClear();
  logAudit.mockClear();
  safeAudit.mockClear();
  revalidatePath.mockClear();
  venueSignal.mockClear();
});

describe("saveVenueStatusAction", () => {
  it("refuses more free tables than tables under the field, and writes nothing", async () => {
    const res = await saveVenueStatusAction(
      null,
      form({ ...OK, freeTables: "14" }),
    );
    expect(res.ok).toBe(false);
    expect(!res.ok && res.fieldErrors?.freeTables).toMatch(/geçemez/);
    // Said once, under the field; the line by the button points there.
    expect(!res.ok && res.error).toBe("Formdaki uyarıları gider.");
    expect(updateVenueStatus).not.toHaveBeenCalled();
  });

  it("answers a save for the toast", async () => {
    const res = await saveVenueStatusAction(null, form(OK));
    expect(res).toMatchObject({ ok: true });
    expect(res.ok && res.message).toMatch(/kaydedildi/);
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ entity: "venue_status" }),
    );
  });

  it("opens to the venue section: owner, manager and Personel, not the cashier", async () => {
    for (const role of ["owner", "manager", "staff"]) {
      auth.role = role;
      const res = await saveVenueStatusAction(null, form(OK));
      expect(res.ok, role).toBe(true);
    }
    expect(new Set(auth.sections)).toEqual(new Set(["venue"]));
    auth.role = "cashier";
    await expect(saveVenueStatusAction(null, form(OK))).rejects.toThrow(
      /denied/,
    );
    auth.role = null;
    await expect(saveVenueStatusAction(null, form(OK))).rejects.toThrow(
      /giris/,
    );
  });

  it("lets owner and manager change the table count (the whole row, as before)", async () => {
    for (const role of ["owner", "manager"]) {
      auth.role = role;
      updateVenueStatus.mockClear();
      await saveVenueStatusAction(null, form({ ...OK, totalTables: "30" }));
      expect(updateVenueStatus, role).toHaveBeenCalledWith(
        expect.objectContaining({ totalTables: 30, freeTables: 3 }),
      );
      expect(patchVenueStatus).not.toHaveBeenCalled();
    }
  });

  it("ignores a table count Personel posts: the patch has none, the stored one stays", async () => {
    auth.role = "staff";
    const res = await saveVenueStatusAction(
      null,
      form({ ...OK, totalTables: "500", power: "on", note: "Priz var" }),
    );
    expect(res.ok).toBe(true);
    expect(updateVenueStatus).not.toHaveBeenCalled();
    expect(patchVenueStatus).toHaveBeenCalledTimes(1);
    const patch = patchVenueStatus.mock.calls[0][0];
    expect(patch).not.toHaveProperty("totalTables");
    expect(patch).toEqual({
      manualOverride: "auto",
      freeTables: 3,
      wifi: "stable",
      noise: "low",
      power: true,
      note: "Priz var",
    });
    // The audit row says what Personel changed, not a count they did not.
    const audit = logAudit.mock.calls[0][0] as { payload: object };
    expect(audit.payload).not.toHaveProperty("totalTables");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/mobil/canli-durum");
  });

  it("refuses Personel's free tables over the STORED total under the field", async () => {
    auth.role = "staff";
    patchVenueStatus.mockResolvedValueOnce(null);
    // A posted total of 500 does not lift the stored 12.
    const res = await saveVenueStatusAction(
      null,
      form({ ...OK, freeTables: "13", totalTables: "500" }),
    );
    expect(res.ok).toBe(false);
    expect(!res.ok && res.fieldErrors?.freeTables).toMatch(/geçemez/);
    expect(logAudit).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("saveVenueQuickAction (the köşk chip)", () => {
  const quick = (status: string, freeTables: string) =>
    saveVenueQuickAction(null, form({ status, freeTables }));

  it("writes only the override and the free tables, so wifi, noise, power and note stay", async () => {
    auth.role = "staff";
    const res = await quick("open", "5");
    expect(res.ok).toBe(true);
    expect(patchVenueStatus).toHaveBeenCalledWith({
      manualOverride: "open",
      freeTables: 5,
    });
    expect(updateVenueStatus).not.toHaveBeenCalled();
    expect(res.ok && res.message).toBe(
      "Köşk: Açık, boş masa 5 / 12. Uygulama 30 saniye içinde görür.",
    );
  });

  it("saves Yoğun as no free table alone: the open/closed is not written (F1)", async () => {
    const res = await quick("busy", "7");
    expect(patchVenueStatus).toHaveBeenCalledWith({ freeTables: 0 });
    expect(res.ok && res.message).toMatch(/^Köşk: Yoğun, boş masa 0 \/ 12\./);
    // The audit row names what was written, not the mode it left alone.
    expect(safeAudit).toHaveBeenLastCalledWith(
      expect.objectContaining({ payload: { freeTables: 0 } }),
    );
    // Otomatik with 0 free tables is the same room: the toast says so.
    patchVenueStatus.mockClear();
    const auto = await quick("auto", "0");
    expect(auto.ok && auto.message).toMatch(/^Köşk: Yoğun/);
  });

  it("writes an audit row with what changed, then revalidates the page", async () => {
    await quick("closed", "2");
    expect(safeAudit).toHaveBeenCalledWith({
      action: "update",
      entity: "venue_status",
      entityId: "main",
      payload: { manualOverride: "closed", freeTables: 2 },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/mobil/canli-durum");
  });

  it("refuses more free tables than the stored total, and logs nothing", async () => {
    patchVenueStatus.mockResolvedValueOnce(null);
    const res = await quick("auto", "13");
    expect(res.ok).toBe(false);
    expect(!res.ok && res.error).toMatch(/geçemez/);
    expect(safeAudit).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("refuses an unknown status or count before writing", async () => {
    for (const [status, free] of [
      ["busyish", "1"],
      ["open", "-1"],
      ["open", "1.5"],
      ["open", "1000"],
      ["", ""],
    ]) {
      const res = await quick(status, free);
      expect(res.ok, `${status}/${free}`).toBe(false);
    }
    expect(patchVenueStatus).not.toHaveBeenCalled();
  });

  it("has its own gate: the cashier is refused, nothing is written", async () => {
    auth.role = "cashier";
    await expect(quick("open", "1")).rejects.toThrow(/denied/);
    auth.role = null;
    await expect(quick("open", "1")).rejects.toThrow(/giris/);
    expect(patchVenueStatus).not.toHaveBeenCalled();
    expect(safeAudit).not.toHaveBeenCalled();
    expect(auth.sections).toEqual(["venue", "venue"]);
  });

  it("opens the gate before it reads the form: a refused caller learns nothing from a bad body", async () => {
    auth.role = "cashier";
    await expect(quick("busyish", "-5")).rejects.toThrow(/denied/);
    auth.role = null;
    await expect(quick("", "")).rejects.toThrow(/giris/);
    expect(patchVenueStatus).not.toHaveBeenCalled();
  });

  it("takes nothing else from the post: a table count, Wi-Fi or note sent along never reaches the save", async () => {
    auth.role = "staff";
    const res = await saveVenueQuickAction(
      null,
      form({
        status: "open",
        freeTables: "2",
        totalTables: "500",
        wifi: "down",
        noise: "low",
        power: "on",
        note: "Herkese bedava",
        manualOverride: "closed",
      }),
    );
    expect(res.ok).toBe(true);
    expect(patchVenueStatus).toHaveBeenCalledTimes(1);
    expect(patchVenueStatus).toHaveBeenCalledWith({
      manualOverride: "open",
      freeTables: 2,
    });
    expect(safeAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { manualOverride: "open", freeTables: 2 },
      }),
    );
  });

  it("writes nothing more than one patch, then the audit row, then the revalidation", async () => {
    await quick("open", "4");
    expect(patchVenueStatus.mock.invocationCallOrder[0]).toBeLessThan(
      safeAudit.mock.invocationCallOrder[0],
    );
    expect(safeAudit.mock.invocationCallOrder[0]).toBeLessThan(
      revalidatePath.mock.invocationCallOrder[0],
    );
    expect(updateVenueStatus).not.toHaveBeenCalled();
    expect(logAudit).not.toHaveBeenCalled();
  });

  it("says the database is unreachable instead of throwing", async () => {
    patchVenueStatus.mockRejectedValueOnce(
      Object.assign(new Error("down"), { __dbUnreachable: true }),
    );
    const res = await quick("open", "1");
    expect(res).toMatchObject({ ok: false });
    expect(!res.ok && res.error).toMatch(/ulaşılamıyor/);
    expect(safeAudit).not.toHaveBeenCalled();
  });
});

describe("venueQuickSignalAction (the chip's poll)", () => {
  it("hands the browser's cursor to venueSignal as it came, and its answer back", async () => {
    venueSignal.mockResolvedValueOnce({ status: null, cursor: "s2.x" });
    expect(await venueQuickSignalAction("s2.abc")).toEqual({
      status: null,
      cursor: "s2.x",
    });
    expect(venueSignal).toHaveBeenCalledWith("s2.abc");
    // It opens no gate of its own that could redirect a background poll:
    // venueSignal's is the gate (tests/admin-venue-signal.test.ts).
    expect(auth.sections).toEqual([]);
  });
});

describe("the page", () => {
  const render = async () => renderToStaticMarkup(await VenueStatusPage());

  it("opens to `venue`: owner, manager and Personel see it; the cashier and a signed-out visitor are sent away before any read", async () => {
    for (const role of ["owner", "manager", "staff"]) {
      auth.role = role;
      expect(await render(), role).toContain("Canlı durum");
    }
    expect(new Set(auth.sections)).toEqual(new Set(["venue"]));
    getVenueStatus.mockClear();
    getSettings.mockClear();
    auth.role = "cashier";
    await expect(render()).rejects.toThrow(/denied/);
    auth.role = null;
    await expect(render()).rejects.toThrow(/giris/);
    expect(getVenueStatus).not.toHaveBeenCalled();
    expect(getSettings).not.toHaveBeenCalled();
  });

  it("gives Personel the table count read-only, and owner and manager the field", async () => {
    auth.role = "staff";
    const staff = await render();
    expect(staff).not.toContain('name="totalTables"');
    expect(staff).toContain("data-venue-total-readonly");
    for (const role of ["owner", "manager"]) {
      auth.role = role;
      const html = await render();
      expect(html, role).toMatch(/<input[^>]*name="totalTables"/);
      expect(html, role).not.toContain("data-venue-total-readonly");
    }
  });

  it("every action in the file opens its own gate (rule 27)", () => {
    const actions = readFileSync(
      "src/app/admin/mobil/canli-durum/actions.ts",
      "utf8",
    );
    const exported = [
      ...actions.matchAll(/export async function (\w+)\(/g),
    ].map((m) => m[1]);
    expect(exported).toEqual([
      "saveVenueStatusAction",
      "saveVenueQuickAction",
      "venueQuickSignalAction",
    ]);
    const bodyOf = (name: string) => {
      const at = actions.indexOf(`export async function ${name}(`);
      const next = actions.indexOf("export async function", at + 1);
      return actions.slice(at, next === -1 ? undefined : next);
    };
    for (const name of ["saveVenueStatusAction", "saveVenueQuickAction"]) {
      // The gate is the first statement, before the form is read.
      const body = bodyOf(name);
      const gate = body.indexOf('await requireRole("venue")');
      expect(gate, name).toBeGreaterThan(-1);
      expect(gate, name).toBeLessThan(body.indexOf("formData.get("));
    }
    expect(bodyOf("venueQuickSignalAction")).toContain(
      "return venueSignal(cursor);",
    );
    expect(actions).not.toContain('requireRole("mobileApp")');
    // The three actions are the file's only exports: no helper is an
    // endpoint by accident.
    expect(actions.match(/^export /gm)).toHaveLength(3);
  });
});

describe("VenueStatusForm", () => {
  const defaults = {
    manualOverride: "auto" as const,
    freeTables: 3,
    totalTables: 12,
    wifi: "stable" as const,
    noise: "low" as const,
    power: true,
    note: "",
  };
  const html = renderToStaticMarkup(
    createElement(VenueStatusForm, { defaults }),
  );

  it("posts by hand, not through a form action React resets", () => {
    // Read from the source: with useHandPost (#148) ActionForm draws
    // React's javascript: guard as its action, the attribute the old
    // `<form action={fn}>` drew too, so the HTML alone cannot tell them
    // apart.
    const src = readFileSync(
      "src/app/admin/mobil/canli-durum/venue-status-form.tsx",
      "utf8",
    );
    expect(src).toMatch(/<ActionForm\b/);
    expect(src).not.toMatch(/<form\b|useActionState/);
    expect(html.match(/<form\b/g)).toHaveLength(1);
    expect(html).not.toContain("$ACTION");
  });

  it("uses the panel's inks and tells a manager who changes the hours", () => {
    expect(html).not.toMatch(/text-neutral-|text-red-600|text-emerald-/);
    expect(html).toContain("sahip değiştirir");
  });

  it("lets owner and manager edit the table count", () => {
    expect(html).toMatch(/<input[^>]*name="totalTables"/);
    expect(html).not.toContain("data-venue-total-readonly");
  });

  it("shows Personel the table count read-only, with nothing to post", () => {
    const staff = renderToStaticMarkup(
      createElement(VenueStatusForm, { defaults, canEditTotal: false }),
    );
    expect(staff).not.toContain('name="totalTables"');
    const field = /<input[^>]*data-venue-total-readonly=""[^>]*>/.exec(
      staff,
    )?.[0];
    expect(field).toBeDefined();
    expect(field).toContain('value="12"');
    expect(field).toContain('readOnly=""');
    expect(staff).toContain("Sahip ya da yönetici değiştirir.");
    // The free tables still post, capped at the stored count in the browser.
    const free = /<input[^>]*name="freeTables"[^>]*>/.exec(staff)?.[0];
    expect(free).toContain('max="12"');
    expect(html).toMatch(/<input[^>]*max="999"[^>]*name="freeTables"/);
  });
});
