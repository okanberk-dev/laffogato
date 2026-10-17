import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * /admin/anasayfa-hero's actions: each opens the `content` gate itself
 * (a Server Action is a public POST endpoint), refuses a bad form or an
 * unsafe link before anything is written, and audits and revalidates the
 * home page after a write.
 */

const h = vi.hoisted(() => ({
  requireRole: vi.fn(async () => ({ email: "patron@laffogato.net" })),
  logAudit: vi.fn(async () => {}),
  setAdminFlash: vi.fn(async () => {}),
  revalidatePath: vi.fn(),
  redirect: vi.fn((to: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { to });
  }),
  getSettings: vi.fn(async () => ({ heroImageUrl: "" })),
  store: {
    createHomeHeroSlide: vi.fn(),
    updateHomeHeroSlide: vi.fn(),
    deleteHomeHeroSlide: vi.fn(),
    setHomeHeroSlideActive: vi.fn(),
    moveHomeHeroSlide: vi.fn(),
    importDefaultHomeSlides: vi.fn(),
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: h.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: h.redirect }));
vi.mock("@/lib/admin/auth", () => ({ requireRole: h.requireRole }));
vi.mock("@/lib/admin/audit", () => ({ logAudit: h.logAudit }));
vi.mock("@/lib/admin/flash", () => ({ setAdminFlash: h.setAdminFlash }));
vi.mock("@/lib/admin/store", () => ({ getSettings: h.getSettings }));
vi.mock("@/lib/admin/home-hero", () => h.store);

const actions = await import("@/app/admin/anasayfa-hero/actions");

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const SLIDE = {
  kicker: "Ekim",
  titleLine1: "Sonbahar",
  titleLine2: "Menüsü",
  body: "Balkabağı latte geri döndü. Ekim boyunca köşkte.",
  imageSource: "/menu/matcha-latte-cut.webp",
  alt: "Buzlu bir latte",
  scene: "spice",
  primaryLabel: "Kampanyalar",
  primaryTarget: "link",
  primaryHref: "/kampanyalar",
  secondaryLabel: "Karaoke",
  secondaryTarget: "karaoke",
  sortOrder: "10",
  isActive: "on",
};

const STORED = {
  id: "hhero-9",
  titleLine1: "Sonbahar",
  titleLine2: "Menüsü",
  isActive: true,
};

beforeEach(() => {
  for (const fn of Object.values(h.store)) fn.mockReset();
  h.requireRole.mockReset();
  h.requireRole.mockResolvedValue({ email: "patron@laffogato.net" });
  h.logAudit.mockClear();
  h.setAdminFlash.mockClear();
  h.revalidatePath.mockClear();
  h.redirect.mockClear();
  h.getSettings.mockClear();
});

/** Each action with a request that would otherwise write. */
const CALLS = [
  ["create", () => actions.createHomeSlideAction(null, form(SLIDE))],
  ["update", () => actions.updateHomeSlideAction("hhero-9", null, form(SLIDE))],
  ["delete", () => actions.deleteHomeSlideAction(null, form({ id: "x" }))],
  [
    "toggle",
    () => actions.toggleHomeSlideAction(null, form({ id: "x", active: "1" })),
  ],
  [
    "move",
    () => actions.moveHomeSlideAction(null, form({ id: "x", direction: "up" })),
  ],
  ["import", () => actions.importDefaultHomeSlidesAction(null, form({}))],
] as const;

describe.each(CALLS)("%s", (_name, run) => {
  it("opens the content editors' gate before anything else", async () => {
    // requireRole redirects a signed-out or under-privileged caller; that is
    // a throw, and nothing after it may run.
    h.requireRole.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(run()).rejects.toThrow("NEXT_REDIRECT");
    expect(h.requireRole).toHaveBeenCalledWith("content");
    for (const fn of Object.values(h.store)) expect(fn).not.toHaveBeenCalled();
    expect(h.getSettings).not.toHaveBeenCalled();
    expect(h.logAudit).not.toHaveBeenCalled();
  });
});

describe("saving a slide", () => {
  it("creates, audits, revalidates the home page and goes back to the list", async () => {
    h.store.createHomeHeroSlide.mockResolvedValue(STORED);
    await expect(
      actions.createHomeSlideAction(null, form(SLIDE)),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(h.store.createHomeHeroSlide).toHaveBeenCalledWith(
      expect.objectContaining({
        titleLine1: "Sonbahar",
        image: "/menu/matcha-latte-cut.webp",
        primaryHref: "/kampanyalar",
        primaryAction: "",
        secondaryAction: "karaoke",
        sortOrder: 10,
        isActive: true,
      }),
    );
    expect(h.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "create",
        entity: "home_hero_slide",
        entityId: "hhero-9",
      }),
    );
    expect(h.revalidatePath).toHaveBeenCalledWith("/");
    expect(h.revalidatePath).toHaveBeenCalledWith("/admin/anasayfa-hero");
    expect(h.redirect).toHaveBeenCalledWith("/admin/anasayfa-hero");
  });

  it.each([
    "javascript:alert(document.cookie)",
    "JAVASCRIPT:alert(1)",
    "data:text/html;base64,PHNjcmlwdD4=",
    "http://example.com/",
    "//evil.example/",
    "/\\evil.example",
    "https://user:pw@evil.example/",
  ])("refuses the link %s under its field and writes nothing", async (href) => {
    const res = await actions.createHomeSlideAction(
      null,
      form({ ...SLIDE, primaryHref: href }),
    );
    expect(res.ok).toBe(false);
    expect(res.ok ? {} : res.fieldErrors).toHaveProperty("primaryHref");
    expect(h.store.createHomeHeroSlide).not.toHaveBeenCalled();
    expect(h.logAudit).not.toHaveBeenCalled();
  });

  it("takes an https link to another site", async () => {
    h.store.createHomeHeroSlide.mockResolvedValue(STORED);
    await expect(
      actions.createHomeSlideAction(
        null,
        form({
          ...SLIDE,
          secondaryTarget: "link",
          secondaryHref: "https://www.instagram.com/laffogato/",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(h.store.createHomeHeroSlide).toHaveBeenCalledWith(
      expect.objectContaining({
        secondaryAction: "",
        secondaryHref: "https://www.instagram.com/laffogato/",
      }),
    );
  });

  it("answers a bad form with every refused field and writes nothing", async () => {
    const res = await actions.updateHomeSlideAction(
      "hhero-9",
      null,
      form({ ...SLIDE, titleLine1: "", alt: "", imageSource: "/x.png" }),
    );
    expect(res).toMatchObject({
      ok: false,
      error: "Formdaki uyarıları gider.",
    });
    expect(Object.keys(res.ok ? {} : (res.fieldErrors ?? {}))).toEqual(
      expect.arrayContaining(["titleLine1", "alt"]),
    );
    expect(h.store.updateHomeHeroSlide).not.toHaveBeenCalled();
  });

  it("says so when the slide was deleted while the form was open", async () => {
    h.store.updateHomeHeroSlide.mockResolvedValue(null);
    const res = await actions.updateHomeSlideAction(
      "hhero-9",
      null,
      form(SLIDE),
    );
    expect(res).toEqual({
      ok: false,
      error: "Bu slayt silinmiş; listeye dön.",
    });
    expect(h.logAudit).not.toHaveBeenCalled();
  });
});

describe("the list's one-click actions", () => {
  it("deletes behind the confirm and audits only a real delete", async () => {
    h.store.deleteHomeHeroSlide.mockResolvedValue(true);
    const ok = await actions.deleteHomeSlideAction(null, form({ id: "x" }));
    expect(ok).toMatchObject({
      ok: true,
      message: expect.stringMatching(/silindi/),
    });
    expect(h.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "delete", entityId: "x" }),
    );
    h.logAudit.mockClear();
    h.store.deleteHomeHeroSlide.mockResolvedValue(false);
    const gone = await actions.deleteHomeSlideAction(null, form({ id: "x" }));
    expect(gone.ok).toBe(false);
    expect(h.logAudit).not.toHaveBeenCalled();
    const none = await actions.deleteHomeSlideAction(null, form({}));
    expect(none.ok).toBe(false);
  });

  it("switches a slide on and off", async () => {
    h.store.setHomeHeroSlideActive.mockResolvedValue(STORED);
    const on = await actions.toggleHomeSlideAction(
      null,
      form({ id: "x", active: "1" }),
    );
    expect(h.store.setHomeHeroSlideActive).toHaveBeenLastCalledWith("x", true);
    expect(on).toMatchObject({ ok: true, message: "Slayt yayına alındı." });
    await actions.toggleHomeSlideAction(null, form({ id: "x", active: "0" }));
    expect(h.store.setHomeHeroSlideActive).toHaveBeenLastCalledWith("x", false);
  });

  it("reorders, and says why a move did nothing", async () => {
    h.store.moveHomeHeroSlide.mockResolvedValue("moved");
    expect(
      await actions.moveHomeSlideAction(
        null,
        form({ id: "x", direction: "down" }),
      ),
    ).toMatchObject({ ok: true });
    expect(h.store.moveHomeHeroSlide).toHaveBeenCalledWith("x", "down");
    expect(h.revalidatePath).toHaveBeenCalledWith("/");

    h.store.moveHomeHeroSlide.mockResolvedValue("edge");
    expect(
      await actions.moveHomeSlideAction(
        null,
        form({ id: "x", direction: "up" }),
      ),
    ).toEqual({ ok: false, error: "Slayt zaten en başta." });

    h.store.moveHomeHeroSlide.mockClear();
    expect(
      await actions.moveHomeSlideAction(
        null,
        form({ id: "x", direction: "sideways" }),
      ),
    ).toMatchObject({ ok: false });
    expect(h.store.moveHomeHeroSlide).not.toHaveBeenCalled();
  });

  it("imports the defaults with the first photo setting, and says when none was missing", async () => {
    h.getSettings.mockResolvedValue({
      heroImageUrl: "https://cdn.example.com/hero.webp",
    });
    h.store.importDefaultHomeSlides.mockResolvedValue({ added: 4, total: 4 });
    const res = await actions.importDefaultHomeSlidesAction(null, form({}));
    expect(h.store.importDefaultHomeSlides).toHaveBeenCalledWith({
      firstImage: "https://cdn.example.com/hero.webp",
    });
    expect(res).toMatchObject({ ok: true, tone: "success" });
    expect(h.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ payload: { imported: 4 } }),
    );

    h.logAudit.mockClear();
    h.store.importDefaultHomeSlides.mockResolvedValue({ added: 0, total: 4 });
    const again = await actions.importDefaultHomeSlidesAction(null, form({}));
    expect(again).toMatchObject({ ok: true, tone: "warning" });
    expect(h.logAudit).not.toHaveBeenCalled();
  });
});
