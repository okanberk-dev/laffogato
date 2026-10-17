import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  CONTENT_FIELDS,
  contentDefaults,
  planContentSave,
} from "@/lib/admin/content-fields";
import { DbQueryError, DbUnreachableError } from "@/lib/db/health";

/**
 * Site Metinleri (/admin/icerik):
 *
 * - A story or founder field cannot be saved empty (it blanked /hikaye's
 *   lede and the app's founder card); the home intro band's two keys can,
 *   that is its off switch (CON-13, D23).
 * - A value back on its default drops its override, so the default reaches
 *   the site again ("Varsayılana dön"); "Tümünü kaydet" used to store every
 *   key and freeze the defaults out.
 * - An over-long value is refused under its field, not cut (CON-15).
 * - A database failure answers in Turkish, never with Postgres's message
 *   (CON-16).
 * - The form posts by hand (no React reset, CON-03), its hints say where
 *   the text appears instead of the raw key (CON-14), and the save bar has
 *   a ground (CON-28).
 */

const saveSiteContent = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/lib/admin/site-content", async () => {
  const fields = await import("@/lib/admin/content-fields");
  return {
    saveSiteContent,
    getSiteContent: vi.fn(async () => fields.contentDefaults()),
  };
});
vi.mock("@/lib/admin/auth", () => ({ requireRole: vi.fn(async () => ({})) }));
const safeAudit = vi.hoisted(() => vi.fn(async () => true));
vi.mock("@/lib/admin/audit", () => ({ safeAudit }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  unstable_rethrow: vi.fn(),
}));

const { saveContentAction } = await import("@/app/admin/icerik/actions");
const { ContentForm } = await import("@/app/admin/icerik/content-form");
const { default: AdminContentPage } = await import("@/app/admin/icerik/page");

const DEFAULTS = contentDefaults();

function form(patch: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ ...DEFAULTS, ...patch })) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("planContentSave", () => {
  it("refuses an empty story or founder text and allows the home band's off switch", () => {
    const plan = planContentSave({
      ...DEFAULTS,
      "story.hero.lede": "   ",
      "story.founder.name": "",
      "home.hero.lede": "",
      "home.hero.eyebrow": "",
    });
    expect(Object.keys(plan.fieldErrors).sort()).toEqual([
      "story.founder.name",
      "story.hero.lede",
    ]);
    expect(plan.upserts).toMatchObject({
      "home.hero.lede": "",
      "home.hero.eyebrow": "",
    });
  });

  it("drops the override of a value back on its default", () => {
    const plan = planContentSave({
      ...DEFAULTS,
      "story.founder.role": "Kurucu · Kavurucu",
    });
    expect(plan.upserts).toEqual({ "story.founder.role": "Kurucu · Kavurucu" });
    expect(plan.deletes.sort()).toEqual(
      CONTENT_FIELDS.map((f) => f.key)
        .filter((k) => k !== "story.founder.role")
        .sort(),
    );
  });

  it("refuses an over-long value instead of cutting it", () => {
    const plan = planContentSave({ "story.founder.bio": "x".repeat(2001) });
    expect(plan.fieldErrors["story.founder.bio"]).toBe(
      "En fazla 2.000 karakter olabilir; şu an 2.001.",
    );
    expect(plan.upserts).toEqual({});
    expect(
      planContentSave({ "story.founder.name": "y".repeat(201) }).fieldErrors[
        "story.founder.name"
      ],
    ).toMatch(/^En fazla 200 karakter/);
  });

  it("trims and normalises line breaks, and leaves keys the form did not send", () => {
    const plan = planContentSave({ "story.founder.bio": "  Bir.\r\nİki.  " });
    expect(plan.upserts).toEqual({ "story.founder.bio": "Bir.\nİki." });
    expect(plan.deletes).toEqual([]);
  });
});

describe("saveContentAction", () => {
  it("refuses an emptied story field under it and writes nothing", async () => {
    const r = await saveContentAction(null, form({ "story.hero.lede": "" }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.fieldErrors?.["story.hero.lede"]).toMatch(/boş kalamaz/);
    expect(saveSiteContent).not.toHaveBeenCalled();
  });

  it("saves the plan and answers with a toast", async () => {
    const r = await saveContentAction(
      null,
      form({ "home.hero.lede": "Yeni giriş." }),
    );
    expect(r).toEqual({
      ok: true,
      message: "Site metinleri kaydedildi.",
      tone: "success",
    });
    expect(saveSiteContent).toHaveBeenCalledWith(
      expect.objectContaining({
        upserts: { "home.hero.lede": "Yeni giriş." },
      }),
    );
  });

  it("answers a refused query in Turkish, without the database's message", async () => {
    saveSiteContent.mockRejectedValueOnce(
      new DbQueryError(
        "saveSiteContent",
        'relation "site_content" does not exist',
        "42P01",
        400,
      ),
    );
    const r = await saveContentAction(null, form({}));
    expect(r).toEqual({
      ok: false,
      error: "Kaydedilemedi. Biraz sonra tekrar dene.",
    });
  });

  it("says so when the database cannot be reached", async () => {
    saveSiteContent.mockRejectedValueOnce(
      new DbUnreachableError("saveSiteContent", "connect ECONNREFUSED"),
    );
    const r = await saveContentAction(null, form({}));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/^Veritabanına şu an ulaşılamıyor/);
  });
});

describe("ContentForm", () => {
  const html = renderToStaticMarkup(
    createElement(ContentForm, { content: DEFAULTS }),
  );

  it("posts by hand: not a React action form", () => {
    expect(html).not.toContain("javascript:throw");
    expect(html).toMatch(/<form\b/);
  });

  it("says where each text appears instead of its raw key", () => {
    for (const f of CONTENT_FIELDS) {
      expect(html).not.toContain(`>${f.key}<`);
      expect(html).toContain(f.hint);
    }
    expect(html).toContain("Kurucu adı (yalnız uygulamada)");
    expect(html).toContain("Ana sayfa giriş metni");
  });

  it("offers Varsayılana dön per field, without posting", () => {
    const resets = [
      ...html.matchAll(/<button\b[^>]*>Varsayılana dön<\/button>/g),
    ].map((m) => m[0]);
    expect(resets).toHaveLength(CONTENT_FIELDS.length);
    for (const b of resets) {
      expect(b).toContain('type="button"');
      expect(b).toMatch(/aria-label="Varsayılana dön: [^"]+"/);
    }
  });

  it("caps every field and draws the save bar on its own ground", () => {
    expect(html.match(/maxLength="(200|2000)"/g)).toHaveLength(
      CONTENT_FIELDS.length,
    );
    const bar = html.match(/<div class="sticky[^"]*"/)?.[0] ?? "";
    expect(bar).toContain("bg-[var(--admin-surface)]");
    expect(bar).toContain("border");
    expect(html).toContain("<h2");
    expect(html).not.toContain("<h3");
  });
});

describe("Site Metinleri page", () => {
  it("does not promise the app a five-minute update", async () => {
    // lafmobil keeps the story payload for a day (useStory staleTime: DAY,
    // persisted to disk), on top of the endpoint's five-minute CDN cache.
    const html = renderToStaticMarkup(await AdminContentPage());
    expect(html).not.toContain("5 dakika");
    expect(html).toContain("bir gün içinde");
  });
});
