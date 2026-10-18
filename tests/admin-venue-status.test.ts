import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Mobil → Canlı durum (admin audit CON-03, CON-07, CON-23, CON-25): the
 * form posts through ActionForm, so a refusal (more free tables than
 * tables) keeps every field as typed and names the field; the answer is an
 * ActionResult a toast or a role="alert" line can say.
 */

const updateVenueStatus = vi.fn(async (input: Record<string, unknown>) => ({
  ...input,
}));
const logAudit = vi.fn(async (_input: unknown) => {});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ unstable_rethrow: vi.fn() }));
vi.mock("@/lib/admin/auth", () => ({ requireRole: vi.fn(async () => ({})) }));
vi.mock("@/lib/admin/audit", () => ({ logAudit }));
vi.mock("@/lib/mobile/venue", () => ({
  updateVenueStatus,
  VENUE_OVERRIDES: ["auto", "open", "closed"],
  VENUE_WIFI_LEVELS: ["stable", "slow", "down"],
  VENUE_NOISE_LEVELS: ["low", "medium", "high"],
}));

const { saveVenueStatusAction } =
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
  updateVenueStatus.mockClear();
  logAudit.mockClear();
});

describe("saveVenueStatusAction", () => {
  it("refuses more free tables than tables under the field, and writes nothing", async () => {
    const res = await saveVenueStatusAction(
      null,
      form({ ...OK, freeTables: "14" }),
    );
    expect(res.ok).toBe(false);
    expect(!res.ok && res.fieldErrors?.freeTables).toMatch(/geçemez/);
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
});

describe("VenueStatusForm", () => {
  const html = renderToStaticMarkup(
    createElement(VenueStatusForm, {
      defaults: {
        manualOverride: "auto",
        freeTables: 3,
        totalTables: 12,
        wifi: "stable",
        noise: "low",
        power: true,
        note: "",
      },
    }),
  );

  it("posts by hand, not through a form action React resets", () => {
    expect(html).toMatch(/<form /);
    expect(html).not.toMatch(/<form[^>]*\saction=/);
  });

  it("uses the panel's inks and tells a manager who changes the hours", () => {
    expect(html).not.toMatch(/text-neutral-|text-red-600|text-emerald-/);
    expect(html).toContain("sahip değiştirir");
  });
});
