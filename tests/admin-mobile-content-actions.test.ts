import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The two mobile-content actions that used to fail silently: a karaoke
 * confirm that clashed with another booking, and a slide update for a row
 * someone had already deleted. Both wrote an audit row (or none) and returned
 * void, so the panel looked like the work had been done.
 */

const setReservationStatus = vi.fn();
const updateAppSlide = vi.fn();
const logAudit = vi.fn();
const redirect = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/admin/auth", () => ({ requireRole: vi.fn(async () => ({})) }));
vi.mock("@/lib/admin/audit", () => ({ logAudit }));
// A save leaves its toast in a cookie; there is no request here.
vi.mock("@/lib/admin/flash", () => ({ setAdminFlash: vi.fn() }));
vi.mock("@/lib/mobile/karaoke", () => ({ setReservationStatus }));
vi.mock("@/lib/admin/store", () => ({
  createAppSlide: vi.fn(),
  deleteAppSlide: vi.fn(),
  updateAppSlide,
}));

const { confirmReservationAction } =
  await import("@/app/admin/mobil/karaoke/actions");
const { updateSlideAction } =
  await import("@/app/admin/mobil/slaytlar/actions");

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  setReservationStatus.mockReset();
  updateAppSlide.mockReset();
  logAudit.mockClear();
  redirect.mockClear();
});

describe("confirmReservationAction", () => {
  it("says why nothing happened when the hour is already taken", async () => {
    // `setReservationStatus` used to answer a bare null for all four reasons,
    // so the panel printed one sentence listing every one of them. It now
    // names the reason, and each asks something different of the staff member.
    setReservationStatus.mockResolvedValue({
      ok: false,
      reason: "slot_taken",
    });
    const state = await confirmReservationAction(null, form({ id: "krk-1" }));
    expect(state.ok).toBe(false);
    expect(!state.ok && state.error).toContain(
      "başka bir onaylı rezervasyonda",
    );
    expect(logAudit).not.toHaveBeenCalled();
  });

  it("tells a deleted booking apart from a lost race", async () => {
    setReservationStatus.mockResolvedValue({ ok: false, reason: "not_found" });
    const gone = await confirmReservationAction(null, form({ id: "krk-1" }));
    expect(!gone.ok && gone.error).toContain("bulunamadı");
    setReservationStatus.mockResolvedValue({ ok: false, reason: "raced" });
    const raced = await confirmReservationAction(null, form({ id: "krk-1" }));
    expect(!raced.ok && raced.error).toContain("az önce başka biri");
  });

  it("confirms and audits the booking it actually moved", async () => {
    setReservationStatus.mockResolvedValue({
      ok: true,
      reservation: { id: "krk-1", date: "2026-09-10", startHour: 20 },
    });
    const state = await confirmReservationAction(null, form({ id: "krk-1" }));
    expect(state.ok && state.message).toBeTruthy();
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "karaoke_reservation",
        entityId: "krk-1",
        payload: expect.objectContaining({ status: "confirmed" }),
      }),
    );
  });
});

describe("updateSlideAction", () => {
  it("refuses a titleless slide, the same as creating one", async () => {
    await updateSlideAction("slide-1", form({ title: "   ", body: "x" }));
    expect(updateAppSlide).not.toHaveBeenCalled();
    expect(logAudit).not.toHaveBeenCalled();
  });

  it("does not audit an update to a row that is no longer there", async () => {
    updateAppSlide.mockResolvedValue(null);
    await updateSlideAction("slide-gone", form({ title: "Sonbahar" }));
    expect(updateAppSlide).toHaveBeenCalled();
    expect(logAudit).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("audits a real update", async () => {
    updateAppSlide.mockResolvedValue({ id: "slide-1", title: "Sonbahar" });
    await updateSlideAction("slide-1", form({ title: "Sonbahar" }));
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "app_hero_slide",
        entityId: "slide-1",
      }),
    );
  });
});
