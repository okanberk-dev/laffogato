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
 * only) and reads through venueQuickStatusAction.
 */

const updateVenueStatus = vi.fn(async (input: Record<string, unknown>) => ({
  ...input,
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
vi.mock("@/lib/admin/store", () => ({
  getSettings: vi.fn(async () => ({
    weeklyHours: {
      mon: { open: "00:00", close: "24:00", closed: false },
      tue: { open: "00:00", close: "24:00", closed: false },
      wed: { open: "00:00", close: "24:00", closed: false },
      thu: { open: "00:00", close: "24:00", closed: false },
      fri: { open: "00:00", close: "24:00", closed: false },
      sat: { open: "00:00", close: "24:00", closed: false },
      sun: { open: "00:00", close: "24:00", closed: false },
    },
  })),
}));
vi.mock("@/lib/mobile/venue", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/mobile/venue")>();
  return {
    ...real,
    updateVenueStatus,
    patchVenueStatus,
    getVenueStatus,
  };
});

const { saveVenueQuickAction, saveVenueStatusAction, venueQuickStatusAction } =
  await import("@/app/admin/mobil/canli-durum/actions");
const { VenueStatusForm } =
  await import("@/app/admin/mobil/canli-durum/venue-status-form");

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
  logAudit.mockClear();
  safeAudit.mockClear();
  revalidatePath.mockClear();
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

  it("saves Yoğun as Otomatik with no free table", async () => {
    const res = await quick("busy", "7");
    expect(patchVenueStatus).toHaveBeenCalledWith({
      manualOverride: "auto",
      freeTables: 0,
    });
    expect(res.ok && res.message).toMatch(/^Köşk: Yoğun, boş masa 0 \/ 12\./);
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
    expect(auth.sections).toEqual(["venue", "venue"]);
  });

  it("says the database is unreachable instead of throwing", async () => {
    patchVenueStatus.mockRejectedValueOnce(
      Object.assign(new Error("down"), { __dbUnreachable: true }),
    );
    const res = await quick("open", "1");
    expect(res).toMatchObject({ ok: false });
    expect(!res.ok && res.error).toMatch(/ulaşılamıyor/);
  });
});

describe("venueQuickStatusAction (the chip's poll)", () => {
  it("answers the stored status and what the app shows", async () => {
    auth.role = "staff";
    expect(await venueQuickStatusAction()).toEqual({
      manualOverride: "auto",
      freeTables: 3,
      totalTables: 12,
      isOpen: true,
      saved: true,
    });
  });

  it("says nothing to the cashier or before sign-in, and never throws", async () => {
    auth.role = "cashier";
    expect(await venueQuickStatusAction()).toBeNull();
    auth.role = null;
    expect(await venueQuickStatusAction()).toBeNull();
    expect(getVenueStatus).not.toHaveBeenCalled();
    auth.role = "owner";
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    getVenueStatus.mockRejectedValueOnce(new Error("boom"));
    expect(await venueQuickStatusAction()).toBeNull();
    err.mockRestore();
  });
});

describe("the page", () => {
  it("opens to `venue` and reads the table-count right from `mobileApp`", () => {
    const src = readFileSync(
      "src/app/admin/mobil/canli-durum/page.tsx",
      "utf8",
    );
    expect(src).toContain('await requireRole("venue")');
    expect(src).not.toContain('requireRole("mobileApp")');
    expect(src).toContain('canAccess("mobileApp", session.role)');
    expect(src).toContain("canEditTotal={canEditTotal}");
    const actions = readFileSync(
      "src/app/admin/mobil/canli-durum/actions.ts",
      "utf8",
    );
    // Every action of the file opens its own gate (rule 27).
    expect(actions.match(/await requireRole\("venue"\)/g)).toHaveLength(2);
    expect(actions).toContain('canAccess("venue", session.role)');
    expect(actions).not.toContain('requireRole("mobileApp")');
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
