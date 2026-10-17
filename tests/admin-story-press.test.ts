import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { parsePressForm, parseStoryForm } from "@/lib/admin/story-press-form";

/**
 * Hikaye and Basın (/admin/hikaye, /admin/basin):
 *
 * - An over-long period or quote is refused under its field; it used to be
 *   cut with .slice and saved with a success toast (CON-15).
 * - A press entry needs its quote: the story page draws it in quotation
 *   marks, an empty one showed as a bare pair (CON-15).
 * - The forms cap their fields, the cards are h2 under the page's h1, each
 *   repeated "Sil" names its row (CON-23), an empty list says so (CON-24),
 *   Basın no longer suggests the retired invented attributions nor a home
 *   page slot (CON-17), and Hikaye says "Hikaye sayfası" (CON-25).
 */

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children?: ReactNode }) =>
    createElement("a", { href }, children),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  unstable_rethrow: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/admin/auth", () => ({ requireRole: vi.fn(async () => ({})) }));
vi.mock("@/lib/admin/audit", () => ({ logAudit: vi.fn(async () => {}) }));

const STAMP = "2026-10-10T10:00:00.000Z";
const rows = vi.hoisted(() => ({
  story: [] as unknown[],
  press: [] as unknown[],
}));
const store = vi.hoisted(() => ({
  createStoryEvent: vi.fn(async (input: Record<string, unknown>) => ({
    id: "story-9",
    ...input,
  })),
  updateStoryEvent: vi.fn(
    async (id: string, input: Record<string, unknown>) => ({
      id,
      ...input,
    }),
  ),
  deleteStoryEvent: vi.fn(async () => true),
  createPress: vi.fn(async (input: Record<string, unknown>) => ({
    id: "press-9",
    ...input,
  })),
  updatePress: vi.fn(async (id: string, input: Record<string, unknown>) => ({
    id,
    ...input,
  })),
  deletePress: vi.fn(async () => true),
}));
vi.mock("@/lib/admin/store", () => ({
  ...store,
  listStoryEvents: vi.fn(async () => rows.story),
  listPress: vi.fn(async () => rows.press),
}));

const story = await import("@/app/admin/hikaye/actions");
const press = await import("@/app/admin/basin/actions");

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  rows.story = [];
  rows.press = [];
  vi.clearAllMocks();
});

describe("story and press parsing", () => {
  it("refuses an over-long value instead of cutting it", () => {
    const r = parseStoryForm(
      form({ year: "1897", title: "Bologna", body: "x".repeat(501) }),
    );
    expect(r.fieldErrors).toEqual({
      body: "Açıklama en fazla 500 karakter olabilir; şu an 501.",
    });
    expect(r.input.body).toHaveLength(501);
    expect(
      parseStoryForm(form({ title: "t".repeat(121), year: "1".repeat(13) }))
        .fieldErrors,
    ).toEqual({
      title: "Başlık en fazla 120 karakter olabilir; şu an 121.",
      year: "Yıl en fazla 12 karakter olabilir; şu an 13.",
    });
  });

  it("counts a line break once, as the browser's maxLength does", () => {
    const body = `${"x".repeat(249)}\r\n${"y".repeat(250)}`;
    const r = parseStoryForm(form({ title: "Bologna", body }));
    expect(r.fieldErrors).toEqual({});
    expect(r.input.body).toHaveLength(500);
  });

  it("requires a press quote and caps both fields", () => {
    expect(parsePressForm(form({ name: "Gazete" })).fieldErrors).toEqual({
      quote: "Yayının yazdığı cümleyi yaz.",
    });
    expect(
      parsePressForm(form({ name: "n".repeat(81), quote: "q".repeat(301) }))
        .fieldErrors,
    ).toEqual({
      name: "Yayın adı en fazla 80 karakter olabilir; şu an 81.",
      quote: "Alıntı en fazla 300 karakter olabilir; şu an 301.",
    });
  });
});

describe("story and press actions", () => {
  it("writes nothing when a story field is too long", async () => {
    const r = await story.createStoryAction(
      null,
      form({ title: "Bologna", body: "x".repeat(600) }),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.fieldErrors ?? {})).toEqual(["body"]);
    expect(store.createStoryEvent).not.toHaveBeenCalled();
    const u = await story.updateStoryAction(
      "story-1",
      null,
      form({ title: "t".repeat(130) }),
    );
    expect(u.ok).toBe(false);
    expect(store.updateStoryEvent).not.toHaveBeenCalled();
  });

  it("saves the whole text when it fits", async () => {
    const body = "x".repeat(500);
    const r = await story.createStoryAction(
      null,
      form({ title: "Bologna", body }),
    );
    expect(r.ok).toBe(true);
    expect(store.createStoryEvent).toHaveBeenCalledWith(
      expect.objectContaining({ body }),
    );
  });

  it("refuses a press entry without its quote", async () => {
    const r = await press.createPressAction(null, form({ name: "Gazete" }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.fieldErrors?.quote).toBe("Yayının yazdığı cümleyi yaz.");
    expect(store.createPress).not.toHaveBeenCalled();
    const u = await press.updatePressAction(
      "press-1",
      null,
      form({ name: "Gazete", quote: "" }),
    );
    expect(u.ok).toBe(false);
    expect(store.updatePress).not.toHaveBeenCalled();
  });
});

type AsyncPage = () => Promise<ReturnType<typeof createElement>>;
async function render(path: string) {
  const mod = (await import(path)) as { default: AsyncPage };
  return renderToStaticMarkup(await mod.default());
}

describe("the pages", () => {
  const base = {
    sortOrder: 1,
    isActive: true,
    createdAt: STAMP,
    updatedAt: STAMP,
  };

  it("say so when the list is empty", async () => {
    expect(await render("@/app/admin/hikaye/page")).toContain(
      "Henüz dönem yok",
    );
    expect(await render("@/app/admin/basin/page")).toContain(
      "Henüz basın alıntısı yok",
    );
  });

  it("Hikaye: h2 cards, capped fields, a named Sil, Hikaye sayfası", async () => {
    rows.story = [
      { ...base, id: "story-1", year: "1897", title: "Bologna", body: "x" },
    ];
    const html = await render("@/app/admin/hikaye/page");
    expect(html).not.toContain("<h3");
    expect(html).toContain("<h2");
    expect(html).toContain("Hikaye sayfasındaki");
    expect(html).not.toContain("Story sayfası");
    expect(html).toContain('aria-label="Sil: 1897 · Bologna"');
    expect(html.match(/maxLength="12"/g)).toHaveLength(2);
    expect(html.match(/maxLength="120"/g)).toHaveLength(2);
    expect(html.match(/maxLength="500"/g)).toHaveLength(2);
    expect(html).not.toContain("Henüz dönem yok");
  });

  it("Basın: neutral placeholders, no home page slot, capped fields", async () => {
    rows.press = [{ ...base, id: "press-1", name: "Gazete", quote: "Güzel." }];
    const html = await render("@/app/admin/basin/page");
    expect(html).not.toContain("Monocle");
    expect(html).not.toContain("Cereal");
    expect(html).not.toContain("The most considered");
    expect(html).not.toContain("Ana sayfa");
    expect(html).toContain("yalnız gerçekten yayımlanmış olanlar");
    expect(html).toContain('placeholder="Yayının adı"');
    expect(html).toContain('aria-label="Sil: Gazete"');
    expect(html.match(/maxLength="80"/g)).toHaveLength(2);
    expect(html.match(/maxLength="300"/g)).toHaveLength(2);
    expect(html).not.toContain("<h3");
  });
});
