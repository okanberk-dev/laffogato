import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDb, type Executor } from "@/lib/db/client";

/**
 * The deletes that went out on the first click with no word back: app
 * announcements, app slides, app posts, the shop hero slide, the story
 * milestones and press quotes, and the newsletter subscriber (plus its
 * "Pasifleştir", which the panel cannot undo). Each now sits behind ConfirmButton and answers an ActionResult; the
 * audit log only records a delete that removed a row, so the store deletes
 * report whether one did.
 */

const h = vi.hoisted(() => ({
  logAudit: vi.fn(async () => {}),
  setAdminFlash: vi.fn(async () => {}),
  requireRole: vi.fn(async () => ({ email: "patron@laffogato.net" })),
  store: {
    deleteAppAnnouncement: vi.fn(),
    deleteAppSlide: vi.fn(),
    deleteAppPost: vi.fn(),
    deleteShopHeroSlide: vi.fn(),
    deleteStoryEvent: vi.fn(),
    deletePress: vi.fn(),
    createStoryEvent: vi.fn(),
    updateStoryEvent: vi.fn(),
    createPress: vi.fn(),
    updatePress: vi.fn(),
  },
  newsletter: {
    deactivateNewsletterSubscriber: vi.fn(async () => {}),
    deleteNewsletterSubscriber: vi.fn(),
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/admin/auth", () => ({ requireRole: h.requireRole }));
vi.mock("@/lib/admin/audit", () => ({ logAudit: h.logAudit }));
vi.mock("@/lib/admin/flash", () => ({ setAdminFlash: h.setAdminFlash }));
vi.mock("@/lib/admin/store", () => h.store);
vi.mock("@/lib/newsletter/store", () => h.newsletter);
vi.mock("@/lib/admin/campaign-mail", () => ({ startCampaignSend: vi.fn() }));
vi.mock("@/lib/email/campaigns", () => ({
  campaignFromPost: vi.fn(),
  createCampaignEmail: vi.fn(),
  deleteCampaignEmail: vi.fn(),
}));

const announcements = await import("@/app/admin/mobil/duyurular/actions");
const slides = await import("@/app/admin/mobil/slaytlar/actions");
const posts = await import("@/app/admin/mobil/gonderiler/actions");
const hero = await import("@/app/admin/magaza-hero/actions");
const newsletter = await import("@/app/admin/bulten/actions");
const story = await import("@/app/admin/hikaye/actions");
const press = await import("@/app/admin/basin/actions");

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  for (const fn of Object.values(h.store)) fn.mockReset();
  h.newsletter.deleteNewsletterSubscriber.mockReset();
  h.newsletter.deactivateNewsletterSubscriber.mockClear();
  h.logAudit.mockClear();
  h.requireRole.mockClear();
});

const CASES = [
  {
    name: "app announcement",
    run: announcements.deleteAnnouncementAction,
    store: h.store.deleteAppAnnouncement,
    role: "mobileApp",
    entity: "app_announcement",
  },
  {
    name: "app slide",
    run: slides.deleteSlideAction,
    store: h.store.deleteAppSlide,
    role: "mobileApp",
    entity: "app_hero_slide",
  },
  {
    name: "app post",
    run: posts.deletePostAction,
    store: h.store.deleteAppPost,
    role: "mobileApp",
    entity: "app_post",
  },
  {
    name: "shop hero slide",
    run: hero.deleteSlideAction,
    store: h.store.deleteShopHeroSlide,
    role: "shopHero",
    entity: "shop_hero_slide",
  },
  {
    name: "story milestone",
    run: story.deleteStoryAction,
    store: h.store.deleteStoryEvent,
    role: "story",
    entity: "story",
  },
  {
    name: "press quote",
    run: press.deletePressAction,
    store: h.store.deletePress,
    role: "press",
    entity: "press",
  },
  {
    name: "newsletter subscriber",
    run: newsletter.deleteNewsletterSubscriberAction,
    store: h.newsletter.deleteNewsletterSubscriber,
    role: "newsletter",
    entity: "newsletter",
  },
] as const;

describe.each(CASES)("$name delete", ({ run, store, role, entity }) => {
  it("checks its role, deletes, audits and answers for the toast", async () => {
    store.mockResolvedValue(true);
    const res = await run(null, form({ id: "x-001" }));
    expect(h.requireRole).toHaveBeenCalledWith(role);
    expect(store).toHaveBeenCalledWith("x-001");
    expect(res.ok).toBe(true);
    expect(res.ok && res.message).toMatch(/silindi/);
    expect(h.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "delete", entity, entityId: "x-001" }),
    );
  });

  it("says a row was already gone, and audits nothing", async () => {
    store.mockResolvedValue(false);
    const res = await run(null, form({ id: "x-001" }));
    expect(res.ok).toBe(false);
    expect(res.ok ? "" : res.error).toMatch(/zaten silinmiş/);
    expect(h.logAudit).not.toHaveBeenCalled();
  });

  it("refuses a request with no id", async () => {
    const res = await run(null, form({}));
    expect(res.ok).toBe(false);
    expect(store).not.toHaveBeenCalled();
  });
});

describe("story and press saves answer too", () => {
  it("refuse a blank title under its field, on create and on edit", async () => {
    const created = await story.createStoryAction(null, form({ title: " " }));
    expect(created).toMatchObject({
      ok: false,
      fieldErrors: { title: "Başlığı yaz." },
    });
    const edited = await press.updatePressAction(
      "press-1",
      null,
      form({ name: "" }),
    );
    expect(edited).toMatchObject({
      ok: false,
      fieldErrors: { name: "Yayının adını yaz." },
    });
    expect(h.store.createStoryEvent).not.toHaveBeenCalled();
    expect(h.store.updatePress).not.toHaveBeenCalled();
  });

  it("say what was saved, and that a deleted row cannot be", async () => {
    h.store.createPress.mockResolvedValue({ id: "press-9", name: "Monocle" });
    expect(
      await press.createPressAction(null, form({ name: "Monocle" })),
    ).toMatchObject({ ok: true, message: "Monocle alıntısı eklendi." });
    h.store.updateStoryEvent.mockResolvedValue(null);
    expect(
      await story.updateStoryAction("story-1", null, form({ title: "1897" })),
    ).toEqual({ ok: false, error: "Bu dönem silinmiş; sayfayı yenile." });
  });
});

describe("newsletter Pasifleştir", () => {
  it("answers instead of nothing", async () => {
    const res = await newsletter.deactivateNewsletterAction(
      null,
      form({ id: "nws-0004" }),
    );
    expect(h.newsletter.deactivateNewsletterSubscriber).toHaveBeenCalledWith(
      "nws-0004",
    );
    expect(res).toMatchObject({ ok: true });
  });
});

describe("the store deletes say whether a row went", () => {
  let returned: Record<string, unknown>[] = [];
  const seen: string[] = [];
  const exec: Executor = async ({ text }) => {
    seen.push(text);
    if (/^DELETE /.test(text))
      return { rows: returned, rowCount: returned.length };
    // The seed checks: the tables are not empty.
    if (/count\(\*\)/i.test(text)) return { rows: [{ count: 3 }], rowCount: 1 };
    return { rows: [{ id: "seeded" }], rowCount: 1 };
  };

  it.each([
    "deleteAppAnnouncement",
    "deleteAppSlide",
    "deleteAppPost",
    "deleteShopHeroSlide",
    "deleteStoryEvent",
    "deletePress",
  ] as const)("%s", async (fn) => {
    vi.resetModules();
    vi.doMock("@/lib/db", async (importOriginal) => {
      const real = await importOriginal<typeof import("@/lib/db")>();
      const db = createDb(exec);
      return { ...real, getDb: () => db };
    });
    vi.doUnmock("@/lib/admin/store");
    const real = await import("@/lib/admin/store");
    returned = [{ id: "x-001" }];
    expect(await real[fn]("x-001")).toBe(true);
    expect(seen.find((t) => /^DELETE /.test(t))).toMatch(/RETURNING "id"$/);
    returned = [];
    expect(await real[fn]("x-001")).toBe(false);
  });
});
