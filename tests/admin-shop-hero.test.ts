import { readFileSync } from "node:fs";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * /admin/magaza-hero (admin audit, catalog package 5c): the slide form
 * posts through ActionForm and its action answers an ActionResult. It used
 * to be a bare `<form action>` whose action returned nothing for a blank
 * title (React's form reset then wiped the form) and saved a blank title on
 * an edit (CAT-13); an edit of a deleted slide said "kaydedildi" (CAT-28);
 * the photo address and the button link were any text, and the photo went
 * into an unquoted CSS url() (CAT-27); the preview was a look-alike
 * (CAT-25); the delete logged an id only (CAT-20); the list inlined every
 * uploaded photo (CAT-08).
 */

const h = vi.hoisted(() => ({
  requireRole: vi.fn(async () => ({ email: "patron@laffogato.net" })),
  logAudit: vi.fn(async () => {}),
  setAdminFlash: vi.fn(async () => {}),
  revalidatePath: vi.fn(),
  redirect: vi.fn((to: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { to });
  }),
  store: {
    createShopHeroSlide: vi.fn(),
    updateShopHeroSlide: vi.fn(),
    deleteShopHeroSlide: vi.fn(),
    getShopHeroSlide: vi.fn(),
    listShopHeroSlides: vi.fn(),
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: h.revalidatePath }));
vi.mock("next/navigation", () => ({
  redirect: h.redirect,
  unstable_rethrow: (err: unknown) => {
    if (err instanceof Error && err.message === "NEXT_REDIRECT") throw err;
  },
}));
vi.mock("@/lib/admin/auth", () => ({ requireRole: h.requireRole }));
vi.mock("@/lib/admin/audit", () => ({ logAudit: h.logAudit }));
vi.mock("@/lib/admin/flash", () => ({ setAdminFlash: h.setAdminFlash }));
vi.mock("@/lib/admin/store", () => h.store);

const actions = await import("@/app/admin/magaza-hero/actions");
const { parseShopHeroForm, shopHeroCtaHref, shopHeroImage } =
  await import("@/lib/admin/shop-hero-schema");
const { SlideForm, SlidePreview } =
  await import("@/app/admin/magaza-hero/slide-form");

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const SLIDE = {
  title: "Eve servis · İtalyan ritüeli",
  subtitle: "İstanbul içi aynı gün.",
  imageUrl: "https://cdn.example.com/hero.jpg",
  ctaLabel: "Mağazaya gir",
  ctaHref: "#products",
  textTheme: "dark",
  sortOrder: "2",
  isActive: "on",
};

const STORED = {
  id: "shero-9",
  ...SLIDE,
  textTheme: "dark" as const,
  sortOrder: 2,
  isActive: true,
  createdAt: "2026-10-01T10:00:00.000Z",
  updatedAt: "2026-10-01T10:00:00.000Z",
};

beforeEach(() => {
  for (const fn of Object.values(h.store)) fn.mockReset();
  h.requireRole.mockReset();
  h.requireRole.mockResolvedValue({ email: "patron@laffogato.net" });
  h.logAudit.mockClear();
  h.setAdminFlash.mockClear();
  h.revalidatePath.mockClear();
  h.redirect.mockClear();
});

describe("saving a slide", () => {
  it("refuses a blank title on create under its field, and writes nothing", async () => {
    const res = await actions.createSlideAction(
      null,
      form({ ...SLIDE, title: "   " }),
    );
    expect(res).toMatchObject({
      ok: false,
      fieldErrors: { title: "Slaytın başlığını yaz." },
    });
    expect(h.store.createShopHeroSlide).not.toHaveBeenCalled();
    expect(h.logAudit).not.toHaveBeenCalled();
  });

  it("refuses a blank title on an edit too (it used to save '')", async () => {
    const res = await actions.updateSlideAction(
      "shero-9",
      null,
      form({ ...SLIDE, title: "" }),
    );
    expect(res).toMatchObject({
      ok: false,
      fieldErrors: { title: expect.any(String) },
    });
    expect(h.store.updateShopHeroSlide).not.toHaveBeenCalled();
  });

  it("creates with the checked input, audits the title and goes back to the list", async () => {
    h.store.createShopHeroSlide.mockImplementation(async (input) => ({
      ...STORED,
      ...input,
    }));
    await expect(actions.createSlideAction(null, form(SLIDE))).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(h.requireRole).toHaveBeenCalledWith("shopHero");
    expect(h.store.createShopHeroSlide).toHaveBeenCalledWith({
      title: SLIDE.title,
      subtitle: SLIDE.subtitle,
      imageUrl: SLIDE.imageUrl,
      ctaLabel: SLIDE.ctaLabel,
      ctaHref: "#products",
      textTheme: "dark",
      sortOrder: 2,
      isActive: true,
    });
    expect(h.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "create",
        entity: "shop_hero_slide",
        payload: expect.objectContaining({ title: SLIDE.title }),
      }),
    );
    expect(h.redirect).toHaveBeenCalledWith("/admin/magaza-hero");
  });

  it("says so when the slide was deleted while the form was open, and audits nothing", async () => {
    h.store.updateShopHeroSlide.mockResolvedValue(null);
    const res = await actions.updateSlideAction("shero-9", null, form(SLIDE));
    expect(res).toEqual({
      ok: false,
      error: "Bu slayt silinmiş; listeye dön.",
    });
    expect(h.logAudit).not.toHaveBeenCalled();
    expect(h.setAdminFlash).not.toHaveBeenCalled();
  });

  it("checks the role before reading the form", async () => {
    h.requireRole.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(
      actions.createSlideAction(null, form(SLIDE)),
    ).rejects.toThrow();
    await expect(
      actions.updateSlideAction("shero-9", null, form(SLIDE)),
    ).rejects.toThrow();
    expect(h.store.createShopHeroSlide).not.toHaveBeenCalled();
    expect(h.store.updateShopHeroSlide).not.toHaveBeenCalled();
  });

  it("refuses an unsafe photo address or button link and writes nothing", async () => {
    for (const bad of [
      { imageUrl: "http://cdn.example.com/hero.jpg" },
      { imageUrl: "javascript:alert(1)" },
      { imageUrl: "data:image/svg+xml;base64,PHN2Zz4=" },
      { ctaHref: "javascript:alert(1)" },
      { ctaHref: "//evil.example/x" },
      { ctaHref: "magaza" },
    ]) {
      const res = await actions.createSlideAction(
        null,
        form({ ...SLIDE, ...bad }),
      );
      expect(res.ok, JSON.stringify(bad)).toBe(false);
      const key = Object.keys(bad)[0];
      expect(res.ok ? {} : res.fieldErrors, key).toHaveProperty(key);
    }
    expect(h.store.createShopHeroSlide).not.toHaveBeenCalled();
  });
});

describe("the slide's checked fields", () => {
  it("keeps a photo address from ending a CSS url() or an attribute", () => {
    const spaced = shopHeroImage("https://cdn.example.com/hero (1).jpg");
    expect(spaced).toEqual({
      ok: true,
      value: "https://cdn.example.com/hero%20%281%29.jpg",
    });
    const crafted = shopHeroImage(
      "https://cdn.example.com/a.jpg);position:fixed;inset:0;background:#c00;(",
    );
    expect(crafted.ok).toBe(true);
    expect(crafted.ok && crafted.value).not.toMatch(/[\s"'()]/);
    expect(shopHeroImage("https://user:pw@cdn.example.com/a.jpg").ok).toBe(
      false,
    );
    expect(shopHeroImage("").ok).toBe(true);
    expect(shopHeroImage("data:image/jpeg;base64,/9j/4AAQ").ok).toBe(true);
    expect(shopHeroImage("data:text/html;base64,PGI+").ok).toBe(false);
  });

  it("takes a site path, an anchor or an https link for the button", () => {
    expect(shopHeroCtaHref("/magaza/cekirdek")).toBe("/magaza/cekirdek");
    expect(shopHeroCtaHref("#products")).toBe("#products");
    expect(shopHeroCtaHref("https://laffogato.com/karaoke")).toBe(
      "https://laffogato.com/karaoke",
    );
    for (const bad of [
      "javascript:alert(1)",
      "http://laffogato.com",
      "//evil.example",
      "/\\evil.example",
      "/magaza x",
      "#",
      "magaza",
    ]) {
      expect(shopHeroCtaHref(bad), bad).toBeNull();
    }
  });

  it("wants the button's text and link together (the shop draws neither alone)", () => {
    const noLink = parseShopHeroForm(form({ ...SLIDE, ctaHref: "" }));
    expect(noLink).toMatchObject({
      ok: false,
      fieldErrors: { ctaHref: expect.any(String) },
    });
    const noText = parseShopHeroForm(form({ ...SLIDE, ctaLabel: "" }));
    expect(noText).toMatchObject({
      ok: false,
      fieldErrors: { ctaLabel: expect.any(String) },
    });
    const neither = parseShopHeroForm(
      form({ ...SLIDE, ctaLabel: "", ctaHref: "" }),
    );
    expect(neither.ok).toBe(true);
  });

  it("refuses an order outside 0-999 and a theme that is not on the list", () => {
    for (const sortOrder of ["-1", "1000", "1.5", "abc"]) {
      expect(
        parseShopHeroForm(form({ ...SLIDE, sortOrder })).ok,
        sortOrder,
      ).toBe(false);
    }
    expect(parseShopHeroForm(form({ ...SLIDE, sortOrder: "" }))).toMatchObject({
      ok: true,
      input: { sortOrder: 0 },
    });
    expect(
      parseShopHeroForm(form({ ...SLIDE, textTheme: "blue" })),
    ).toMatchObject({
      ok: false,
      fieldErrors: { textTheme: expect.any(String) },
    });
    expect(parseShopHeroForm(form({ ...SLIDE, isActive: "" }))).toMatchObject({
      ok: true,
      input: { isActive: false },
    });
  });
});

describe("deleting a slide", () => {
  it("logs the title it read before the delete", async () => {
    h.store.getShopHeroSlide.mockResolvedValue(STORED);
    h.store.deleteShopHeroSlide.mockResolvedValue(true);
    const res = await actions.deleteSlideAction(null, form({ id: "shero-9" }));
    expect(res.ok).toBe(true);
    expect(h.logAudit).toHaveBeenCalledWith({
      action: "delete",
      entity: "shop_hero_slide",
      entityId: "shero-9",
      payload: { title: SLIDE.title },
    });
    const read = h.store.getShopHeroSlide.mock.invocationCallOrder[0];
    const del = h.store.deleteShopHeroSlide.mock.invocationCallOrder[0];
    expect(read).toBeLessThan(del);
  });
});

describe("the form", () => {
  const html = renderToStaticMarkup(
    createElement(SlideForm, {
      action: async () => ({ ok: true as const, message: "" }),
      submitLabel: "Slaytı kaydet",
      defaults: { ...STORED },
    }),
  );

  it("posts by hand (ActionForm), never as a bare form action", () => {
    expect(html).toMatch(/<form[^>]*>/);
    expect(html).not.toMatch(/<form[^>]*\saction=/);
    const src = readFileSync(
      "src/app/admin/magaza-hero/slide-form.tsx",
      "utf8",
    );
    expect(src).toContain("<ActionForm");
    expect(src).toContain("<SubmitButton>");
    expect(src).not.toContain("history.back");
  });

  it("puts each refusal under its field", () => {
    const src = readFileSync(
      "src/app/admin/magaza-hero/slide-form.tsx",
      "utf8",
    );
    for (const name of [
      "title",
      "sortOrder",
      "subtitle",
      "imageUrl",
      "ctaLabel",
      "ctaHref",
      "textTheme",
    ]) {
      expect(src, name).toContain(`name="${name}"`);
    }
    expect(src).toContain("<FormMessage />");
  });

  it("'Vazgeç' is one link back to the list, not a button in a link", () => {
    const link = /<a[^>]*href="\/admin\/magaza-hero"[^>]*>([\s\S]*?)<\/a>/.exec(
      html,
    );
    expect(link?.[1]).toBe("Vazgeç");
  });

  it("shows the photo as an <img>, never inside a style attribute", () => {
    const crafted = renderToStaticMarkup(
      createElement(SlideForm, {
        action: async () => ({ ok: true as const, message: "" }),
        submitLabel: "Kaydet",
        defaults: {
          title: "A",
          imageUrl: "https://x.example/a.jpg);color:red;(",
        },
      }),
    );
    expect(crafted).toContain(
      '<img src="https://x.example/a.jpg);color:red;("',
    );
    // The preview's background (the live slide) quotes and escapes it.
    expect(crafted).not.toMatch(/url\(https/);
    expect(crafted).toContain(
      "url(&quot;https://x.example/a.jpg);color:red;(&quot;)",
    );
  });
});

describe("the preview is the shop's own slide", () => {
  const preview = (over: Partial<Parameters<typeof SlidePreview>[0]> = {}) =>
    renderToStaticMarkup(
      createElement(SlidePreview, {
        title: "Yenilebilir kup koleksiyonu",
        subtitle: "6'lı ve 12'li kutular.",
        imageUrl: "",
        ctaLabel: "Kuplar",
        ctaHref: "#products",
        textTheme: "light",
        ...over,
      }),
    );

  it("draws the live slide, active, with its eyebrow, title, accent and button", () => {
    const html = preview();
    expect(html).toContain('class="shop-hero-slider"');
    expect(html).toContain('class="shop-hero-slide"');
    expect(html).toContain('data-active="true"');
    expect(html).toContain("shop-hero-eyebrow");
    expect(html).toContain('class="shop-hero-title"');
    expect(html).toContain("shop-hero-title-accent");
    expect(html).toMatch(/class="btn btn-light btn-lg shop-hero-cta"/);
  });

  it("is marked as a site preview, out of the tab order and unclickable", () => {
    const html = preview();
    expect(html).toContain('data-site-preview=""');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toMatch(/\sinert=""/);
  });

  it("follows the theme the way the shop does", () => {
    expect(preview({ textTheme: "dark" })).toContain('data-theme="dark"');
    expect(preview({ ctaHref: "" })).not.toContain("shop-hero-cta");
  });
});

describe("the list", () => {
  it("serves an uploaded thumbnail by its path instead of inlining it", async () => {
    const data = `data:image/jpeg;base64,${"A".repeat(4000)}`;
    h.store.listShopHeroSlides.mockResolvedValue([
      { ...STORED, id: "shero-1", imageUrl: data },
      { ...STORED, id: "shero-2", imageUrl: "https://cdn.example.com/b.jpg" },
      { ...STORED, id: "shero-3", imageUrl: "" },
    ]);
    const { default: Page } = await import("@/app/admin/magaza-hero/page");
    const html = renderToStaticMarkup(await Page());
    expect(html).not.toContain("data:image");
    expect(html).toMatch(/<img src="\/gorsel\/hero\/shero-1\?v=[0-9a-f]+"/);
    expect(html).toContain('<img src="https://cdn.example.com/b.jpg"');
    expect(html).not.toContain("background-image");
    expect(html).toContain("görsel yok");
    // Both row actions in the kit's button shape, named for the slide.
    expect(html).toContain(`aria-label="Düzenle: ${SLIDE.title}"`);
    expect(html).toContain(`aria-label="Sil: ${SLIDE.title}"`);
    expect(html).not.toContain("Shop · Hero slider");
  });
});
