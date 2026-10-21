import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  moveAnswer,
  readActiveForm,
  readMoveForm,
} from "@/lib/admin/list-order";
import { menuItemCopy, menuItemCopyHref } from "@/lib/admin/menu-panel";
import type { AdminMenuItem } from "@/lib/admin/store";

/**
 * The lists' one-click controls (21 Eki 2026): "Yayına al" / "Yayından
 * kaldır" in the row's ⋯ menu and ↑ / ↓ beside it, on the shop's and the
 * app's slides, the app's announcements and posts. The delete dialogs used
 * to send the operator into the form for the first, and the order was a
 * number typed on each record. Each action opens its own role gate, posts
 * the state asked for (never a flip), audits only what was written, and the
 * post's switch never mails the members.
 */

const h = vi.hoisted(() => ({
  logAudit: vi.fn(async () => {}),
  requireRole: vi.fn(async () => ({ email: "patron@laffogato.net" })),
  store: {
    setAppSlideActive: vi.fn(),
    moveAppSlide: vi.fn(),
    setAppAnnouncementActive: vi.fn(),
    moveAppAnnouncement: vi.fn(),
    setAppPostActive: vi.fn(),
    moveAppPost: vi.fn(),
  },
  mail: {
    startCampaignSend: vi.fn(),
    createCampaignEmail: vi.fn(),
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/admin/auth", () => ({ requireRole: h.requireRole }));
vi.mock("@/lib/admin/audit", () => ({ logAudit: h.logAudit }));
vi.mock("@/lib/admin/flash", () => ({ setAdminFlash: vi.fn() }));
vi.mock("@/lib/admin/store", () => h.store);
vi.mock("@/lib/admin/campaign-mail", () => ({
  startCampaignSend: h.mail.startCampaignSend,
}));
vi.mock("@/lib/email/campaigns", () => ({
  campaignFromPost: vi.fn(),
  createCampaignEmail: h.mail.createCampaignEmail,
  deleteCampaignEmail: vi.fn(),
}));

const slides = await import("@/app/admin/mobil/slaytlar/actions");
const announcements = await import("@/app/admin/mobil/duyurular/actions");
const posts = await import("@/app/admin/mobil/gonderiler/actions");

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  for (const fn of Object.values(h.store)) fn.mockReset();
  h.logAudit.mockClear();
  h.requireRole.mockClear();
  h.mail.startCampaignSend.mockClear();
  h.mail.createCampaignEmail.mockClear();
});

describe("the forms' fields", () => {
  it("a move needs a row and a way", () => {
    expect(readMoveForm(form({ id: "a", direction: "up" }))).toEqual({
      ok: true,
      id: "a",
      direction: "up",
    });
    expect(readMoveForm(form({ direction: "up" }))).toMatchObject({
      ok: false,
    });
    expect(readMoveForm(form({ id: "a", direction: "left" }))).toMatchObject({
      ok: false,
    });
  });

  it("the switch posts the state asked for, never a flip", () => {
    expect(readActiveForm(form({ id: "a", active: "1" }))).toEqual({
      ok: true,
      id: "a",
      isActive: true,
    });
    expect(readActiveForm(form({ id: "a", active: "0" }))).toEqual({
      ok: true,
      id: "a",
      isActive: false,
    });
    for (const active of ["", "true", "toggle"]) {
      expect(readActiveForm(form({ id: "a", active }))).toMatchObject({
        ok: false,
      });
    }
  });

  it("a move's answer names the record and the edge it met", () => {
    expect(moveAnswer("moved", "down", "Duyuru", "gone")).toEqual({
      ok: true,
      message: "Duyuru bir geriye alındı.",
      tone: "success",
    });
    expect(moveAnswer("edge", "up", "Duyuru", "gone")).toEqual({
      ok: false,
      error: "Duyuru zaten en başta.",
    });
    expect(moveAnswer("not_found", "up", "Duyuru", "gone")).toEqual({
      ok: false,
      error: "gone",
    });
  });
});

const SWITCHES = [
  {
    name: "app slide",
    run: slides.setSlideActiveAction,
    store: h.store.setAppSlideActive,
    entity: "app_hero_slide",
  },
  {
    name: "app announcement",
    run: announcements.setAnnouncementActiveAction,
    store: h.store.setAppAnnouncementActive,
    entity: "app_announcement",
  },
  {
    name: "app post",
    run: posts.setPostActiveAction,
    store: h.store.setAppPostActive,
    entity: "app_post",
  },
] as const;

describe.each(SWITCHES)("$name: Yayına al / Yayından kaldır", (c) => {
  it("checks the role, writes the state asked for and audits it", async () => {
    c.store.mockResolvedValue(true);
    const res = await c.run(null, form({ id: "x-1", active: "0" }));
    expect(h.requireRole).toHaveBeenCalledWith("mobileApp");
    expect(c.store).toHaveBeenCalledWith("x-1", false);
    expect(res).toMatchObject({ ok: true });
    // Phones read through a shared cache: never "hemen".
    expect(res.ok && res.message).toMatch(/birkaç dakika/);
    expect(h.logAudit).toHaveBeenCalledWith({
      action: "update",
      entity: c.entity,
      entityId: "x-1",
      payload: { isActive: false },
    });
  });

  it("refuses a flip request, and audits nothing for a row that is gone", async () => {
    expect(await c.run(null, form({ id: "x-1", active: "x" }))).toMatchObject({
      ok: false,
    });
    expect(c.store).not.toHaveBeenCalled();
    c.store.mockResolvedValue(false);
    expect(await c.run(null, form({ id: "x-1", active: "1" }))).toMatchObject({
      ok: false,
    });
    expect(h.logAudit).not.toHaveBeenCalled();
  });

  it("writes nothing when the role is refused", async () => {
    h.requireRole.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));
    await expect(
      c.run(null, form({ id: "x-1", active: "1" })),
    ).rejects.toThrow();
    expect(c.store).not.toHaveBeenCalled();
  });
});

it("putting a post on from the list never mails the members", async () => {
  h.store.setAppPostActive.mockResolvedValue(true);
  await posts.setPostActiveAction(
    null,
    form({ id: "apost-1", active: "1", emailMembers: "on" }),
  );
  expect(h.mail.createCampaignEmail).not.toHaveBeenCalled();
  expect(h.mail.startCampaignSend).not.toHaveBeenCalled();
});

const MOVES = [
  {
    name: "app slide",
    run: slides.moveSlideAction,
    store: h.store.moveAppSlide,
    noun: "Slayt",
  },
  {
    name: "app announcement",
    run: announcements.moveAnnouncementAction,
    store: h.store.moveAppAnnouncement,
    noun: "Duyuru",
  },
  {
    name: "app post",
    run: posts.movePostAction,
    store: h.store.moveAppPost,
    noun: "Gönderi",
  },
] as const;

describe.each(MOVES)("$name: ↑ / ↓", (c) => {
  it("moves a place and audits the move", async () => {
    c.store.mockResolvedValue("moved");
    const res = await c.run(null, form({ id: "x-1", direction: "up" }));
    expect(c.store).toHaveBeenCalledWith("x-1", "up");
    expect(res).toEqual({
      ok: true,
      message: `${c.noun} bir öne alındı.`,
      tone: "success",
    });
    expect(h.logAudit).toHaveBeenCalledTimes(1);
  });

  it("says so at the edge and audits nothing", async () => {
    c.store.mockResolvedValue("edge");
    const res = await c.run(null, form({ id: "x-1", direction: "down" }));
    expect(res).toEqual({ ok: false, error: `${c.noun} zaten en sonda.` });
    expect(h.logAudit).not.toHaveBeenCalled();
  });
});

describe("Kopyala on a menu item", () => {
  const item = {
    id: "mnu-0042",
    name: "Çilekli Matcha",
    isActive: true,
    priceMinor: 24_500,
  } as AdminMenuItem;

  it("starts the new item's form from this one, off the menu, named a copy", () => {
    const copy = menuItemCopy(item);
    expect(copy).toMatchObject({
      name: "Çilekli Matcha (kopya)",
      isActive: false,
      priceMinor: 24_500,
    });
    // The original is not touched.
    expect(item.isActive).toBe(true);
    expect(menuItemCopy({ ...item, name: "x".repeat(120) }).name).toHaveLength(
      120,
    );
  });

  it("opens the create page, never an edit of the original", () => {
    expect(menuItemCopyHref("mnu-0042")).toBe(
      "/admin/menu/yeni?kopya=mnu-0042",
    );
  });
});
