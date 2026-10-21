import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The mobile-content actions that used to fail silently: a karaoke confirm
 * that clashed with another booking, and the slide / announcement / post
 * saves, which returned nothing on a blank title (so "Kaydet" looked dead)
 * or for a row someone had already deleted. They now answer an
 * ActionResult for ActionForm, with the refusal under its field (admin
 * audit CON-04).
 */

const setReservationStatus = vi.fn();
const logAudit = vi.fn();
const redirect = vi.fn();
const setAdminFlash = vi.fn();
const store = vi.hoisted(() => ({
  createAppSlide: vi.fn(),
  deleteAppSlide: vi.fn(),
  updateAppSlide: vi.fn(),
  createAppAnnouncement: vi.fn(),
  deleteAppAnnouncement: vi.fn(),
  updateAppAnnouncement: vi.fn(),
  createAppPost: vi.fn(),
  deleteAppPost: vi.fn(),
  updateAppPost: vi.fn(),
  setAppPostEmailCampaign: vi.fn(),
}));
const updateAppSlide = store.updateAppSlide;

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/admin/auth", () => ({ requireRole: vi.fn(async () => ({})) }));
vi.mock("@/lib/admin/audit", () => ({ logAudit }));
// A save leaves its toast in a cookie; there is no request here.
vi.mock("@/lib/admin/flash", () => ({ setAdminFlash }));
// The action reads the booking first and refuses an evening already gone
// (KAR-13); these bookings are all still ahead.
const getReservation = vi.fn(async (id: string) => ({
  id,
  date: "2099-09-10",
  startHour: 20,
  hours: 2,
  status: "pending",
}));
vi.mock("@/lib/mobile/karaoke", () => ({
  getReservation,
  setReservationStatus,
}));
vi.mock("@/lib/admin/store", () => store);
vi.mock("@/lib/admin/campaign-mail", () => ({ startCampaignSend: vi.fn() }));
vi.mock("@/lib/email/campaigns", () => ({
  campaignFromPost: vi.fn(),
  createCampaignEmail: vi.fn(),
  deleteCampaignEmail: vi.fn(),
}));

const { confirmReservationAction } =
  await import("@/app/admin/mobil/karaoke/actions");
const slides = await import("@/app/admin/mobil/slaytlar/actions");
const announcements = await import("@/app/admin/mobil/duyurular/actions");
const posts = await import("@/app/admin/mobil/gonderiler/actions");
const { updateSlideAction } = slides;

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  setReservationStatus.mockReset();
  for (const fn of Object.values(store)) fn.mockReset();
  logAudit.mockClear();
  redirect.mockClear();
  setAdminFlash.mockClear();
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
  it("refuses a titleless slide under its field, the same as creating one", async () => {
    const res = await updateSlideAction(
      "slide-1",
      null,
      form({ title: "   ", body: "x" }),
    );
    expect(res).toMatchObject({
      ok: false,
      fieldErrors: { title: "Başlık boş olamaz." },
    });
    expect(updateAppSlide).not.toHaveBeenCalled();
    expect(logAudit).not.toHaveBeenCalled();
  });

  it("says the row is gone, and audits nothing, when it was deleted meanwhile", async () => {
    updateAppSlide.mockResolvedValue(null);
    const res = await updateSlideAction(
      "slide-gone",
      null,
      form({ title: "Sonbahar" }),
    );
    expect(updateAppSlide).toHaveBeenCalled();
    expect(res.ok).toBe(false);
    expect(!res.ok && res.error).toMatch(/silinmiş/);
    expect(logAudit).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("audits a real update and goes back to the list with its toast", async () => {
    updateAppSlide.mockResolvedValue({ id: "slide-1", title: "Sonbahar" });
    await updateSlideAction("slide-1", null, form({ title: "Sonbahar" }));
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "app_hero_slide",
        entityId: "slide-1",
      }),
    );
    expect(setAdminFlash).toHaveBeenCalledWith('"Sonbahar" kaydedildi.');
    expect(redirect).toHaveBeenCalledWith("/admin/mobil/slaytlar");
  });
});

const SAVES = [
  {
    name: "slide",
    create: slides.createSlideAction,
    update: slides.updateSlideAction,
    created: store.createAppSlide,
    updated: store.updateAppSlide,
  },
  {
    name: "announcement",
    create: announcements.createAnnouncementAction,
    update: announcements.updateAnnouncementAction,
    created: store.createAppAnnouncement,
    updated: store.updateAppAnnouncement,
  },
  {
    name: "post",
    create: posts.createPostAction,
    update: posts.updatePostAction,
    created: store.createAppPost,
    updated: store.updateAppPost,
  },
] as const;

describe.each(SAVES)("$name save", ({ create, update, created, updated }) => {
  it("answers a blank title instead of returning nothing", async () => {
    const res = await create(null, form({ title: " \t " }));
    expect(res).toMatchObject({
      ok: false,
      error: "Formdaki uyarıları gider.",
    });
    expect(!res.ok && res.fieldErrors).toEqual({ title: "Başlık boş olamaz." });
    expect(created).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("refuses a start or end that is not a time, and an end before the start", async () => {
    const bad = await create(
      null,
      form({ title: "Ekim", startsAt: "30.10.2026", endsAt: "yarın" }),
    );
    expect(!bad.ok && bad.fieldErrors).toEqual({
      startsAt: "Başlangıç bir tarih ve saat olmalı.",
      endsAt: "Bitiş bir tarih ve saat olmalı.",
    });
    const backwards = await update(
      "x-1",
      null,
      form({
        title: "Ekim",
        startsAt: "2026-10-20T10:00",
        endsAt: "2026-10-19T10:00",
      }),
    );
    expect(!backwards.ok && backwards.fieldErrors).toEqual({
      endsAt: "Bitiş başlangıçtan sonra olmalı.",
    });
    expect(created).not.toHaveBeenCalled();
    expect(updated).not.toHaveBeenCalled();
  });

  it("creates one row per save and lands on the list", async () => {
    created.mockResolvedValue({
      id: "x-1",
      title: "Ekim",
      kind: "info",
      tone: "paper",
      isActive: true,
      startsAt: "",
      endsAt: "",
    });
    await create(null, form({ title: "Ekim" }));
    expect(created).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledTimes(1);
    expect(setAdminFlash).toHaveBeenCalledTimes(1);
  });
});

const DELETES = [
  {
    name: "slide",
    run: slides.deleteSlideAction,
    store: store.deleteAppSlide,
    list: "/admin/mobil/slaytlar",
  },
  {
    name: "announcement",
    run: announcements.deleteAnnouncementAction,
    store: store.deleteAppAnnouncement,
    list: "/admin/mobil/duyurular",
  },
  {
    name: "post",
    run: posts.deletePostAction,
    store: store.deleteAppPost,
    list: "/admin/mobil/gonderiler",
  },
] as const;

describe.each(DELETES)("$name delete", ({ run, store: remove, list }) => {
  it("does not promise the card left the phones at once (shared cache)", async () => {
    remove.mockResolvedValue(true);
    const res = await run(null, form({ id: "x-1" }));
    expect(res.ok && res.message).toMatch(/birkaç dakika içinde kalkar/);
    expect(res.ok && res.message).not.toMatch(/kalktı|hemen/);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("from the edit page's header, goes back to the list with the toast", async () => {
    remove.mockResolvedValue(true);
    await run(null, form({ id: "x-1", then: "list" }));
    expect(setAdminFlash).toHaveBeenCalledWith(
      expect.stringMatching(/silindi/),
    );
    expect(redirect).toHaveBeenCalledWith(list);
  });
});
