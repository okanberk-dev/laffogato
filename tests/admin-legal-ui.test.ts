import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { expectReactGuard, formOpenTags } from "./_support/form-guard";

import { LEGAL_UPDATED } from "@/lib/legal/meta";

/**
 * The legal screens as the server renders them (/admin/hukuk, the editor,
 * the draft preview), with the store mocked:
 *
 * - "Varsayılana döndür" opens a confirm instead of posting on one click
 *   (CON-02), and the archive offers "Geri yükle" the same way.
 * - The status pills are the kit's Badge (CON-07); a draft row links to its
 *   preview (CON-10), which only the owner's `legal` section opens.
 * - The editor starts a new override with no date (CON-M01), says which
 *   version orders record for a checkout document, posts through ActionForm
 *   (no React form reset, CON-03), and draws "Vazgeç" as one link (CON-22),
 *   the publish checkbox in a fieldset (CON-05) and the Markdown box at the
 *   field's own size (CON-27).
 */

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    prefetch: _prefetch,
    ...rest
  }: {
    href: string;
    children?: ReactNode;
    prefetch?: boolean;
  }) => createElement("a", { href, ...rest }, children),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  unstable_rethrow: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn(),
}));
const requireRole = vi.hoisted(() => vi.fn(async (_section: string) => ({})));
vi.mock("@/lib/admin/auth", () => ({ requireRole }));

const STAMP = "2030-03-10T09:00:00.000Z";
const MSS = "mesafeli-satis-sozlesmesi";
const KVKK = "kvkk-aydinlatma-metni";
const IADE = "iade-ve-cayma";

const overrides = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
const text = (slug: string, patch: Record<string, unknown> = {}) => ({
  slug,
  title: "",
  summary: "",
  effectiveDate: "10 Mart 2030",
  bodyMarkdown: "## Taslak başlığı\n\nTaslaktaki paragraf.",
  isPublished: false,
  updatedAt: STAMP,
  ...patch,
});
const ARCHIVED = {
  id: "7",
  slug: KVKK,
  title: "KVKK Aydınlatma Metni",
  summary: "",
  effectiveDate: "1 Mart 2030",
  isPublished: true,
  updatedAt: STAMP,
  archivedAt: STAMP,
  archivedBy: "patron@laffogato.net",
  reason: "reset",
};
vi.mock("@/lib/legal/store", () => ({
  listLegalDocOverrides: vi.fn(async () => overrides.value),
  getLegalDocOverride: vi.fn(
    async (slug: string) => overrides.value[slug] ?? null,
  ),
  listLegalOverrideArchive: vi.fn(async () => [ARCHIVED]),
  getLegalOverrideArchive: vi.fn(async (id: string) =>
    id === "7"
      ? { ...ARCHIVED, bodyMarkdown: "## Arşiv başlığı\n\nArşivdeki paragraf." }
      : null,
  ),
}));
const stub = () => vi.fn(async () => ({ ok: true as const, message: "" }));
vi.mock("@/app/admin/hukuk/actions", () => ({
  resetLegalDocAction: stub(),
  restoreLegalDocAction: stub(),
  updateLegalDocAction: stub(),
}));

type AsyncPage = (props: never) => Promise<ReturnType<typeof createElement>>;
async function render(path: string, props: Record<string, unknown> = {}) {
  const mod = (await import(path)) as { default: AsyncPage };
  return renderToStaticMarkup(await mod.default(props as never));
}

/** Every <button> whose visible text is `label`, as markup. */
function buttons(html: string, label: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)) {
    if (m[1].replace(/<[^>]+>/g, "").trim() === label) out.push(m[0]);
  }
  return out;
}

beforeEach(() => {
  overrides.value = {};
  requireRole.mockClear();
});

describe("/admin/hukuk", () => {
  it("asks before Varsayılana döndür and names the document", async () => {
    overrides.value = {
      [KVKK]: text(KVKK, { isPublished: true }),
      [IADE]: text(IADE),
    };
    const html = await render("@/app/admin/hukuk/page");
    const resets = buttons(html, "Varsayılana döndür");
    expect(resets).toHaveLength(2);
    for (const b of resets) {
      expect(b).toContain('aria-haspopup="dialog"');
      expect(b).not.toContain('type="submit"');
      expect(b).toMatch(/aria-label="Varsayılana döndür: [^"]+"/);
    }
    // No plain one-click form is left on the page.
    expect(html).not.toContain("javascript:throw");
    expect(requireRole).toHaveBeenCalledWith("legal");
  });

  it("draws the statuses as Badges and links a draft to its preview", async () => {
    overrides.value = {
      [KVKK]: text(KVKK, { isPublished: true }),
      [IADE]: text(IADE),
    };
    const html = await render("@/app/admin/hukuk/page");
    expect(html).toContain("Özel metin yayında");
    expect(html).toContain("Taslak");
    expect(html).toContain("Hazır metin");
    expect(html).not.toContain("bg-neutral-100 text-neutral-500");
    expect(html).toContain("bg-[var(--admin-warning-soft)]");
    expect(html).toContain(`href="/admin/hukuk/${IADE}/onizle"`);
    expect(html).not.toContain(`href="/admin/hukuk/${KVKK}/onizle"`);
    expect(html).toContain("Yayındakini aç");
  });

  it("draws one text action per row: the title opens Düzenle, the published page is an icon link", async () => {
    overrides.value = {
      [KVKK]: text(KVKK, { isPublished: true }),
      [IADE]: text(IADE),
    };
    const { LEGAL_DOCS } = await import("@/lib/legal/documents");
    const html = await render("@/app/admin/hukuk/page");
    const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/'/g, "&#x27;");
    const rows = html.split("<li").slice(1);
    for (const doc of LEGAL_DOCS) {
      const row = (
        rows.find((r) => r.includes(`href="/admin/hukuk/${doc.slug}"`)) ?? ""
      ).split("</li>")[0];
      expect(row, doc.slug).not.toBe("");
      // The title is the link to Düzenle.
      expect(row).toContain(`>${esc(doc.title)}</a>`);
      // Visible text buttons outside the ⋯ menu: Düzenle alone.
      const outside = row.split("<details")[0];
      const texts = [...outside.matchAll(/<a\b[^>]*>([^<]+)<\/a>/g)]
        .map((m) => m[1])
        .filter((t) => t !== esc(doc.title));
      expect(texts, doc.slug).toEqual(["Düzenle"]);
      // The published page: an icon-only link, named by its aria-label.
      expect(row).toContain(
        `aria-label="Yayındakini aç: ${esc(doc.title)} (yeni sekme)"`,
      );
    }
    expect(html).not.toContain("Yayındakini aç ↗");
    // The draft preview moved into the draft's ⋯ menu, next to the reset.
    expect(html).toContain(`href="/admin/hukuk/${IADE}/onizle"`);
  });

  it("lists the archive with a preview and a confirmed Geri yükle", async () => {
    const html = await render("@/app/admin/hukuk/page");
    expect(html).toContain("Varsayılana döndürüldü");
    expect(html).toContain(`href="/admin/hukuk/${KVKK}/onizle?arsiv=7"`);
    const restore = buttons(html, "Geri yükle");
    expect(restore).toHaveLength(1);
    expect(restore[0]).toContain('aria-haspopup="dialog"');
  });
});

describe("the editor", () => {
  const edit = (slug: string) =>
    render("@/app/admin/hukuk/[slug]/page", {
      params: Promise.resolve({ slug }),
    });

  it("starts a new override with no date, not the coded one", async () => {
    const html = await edit(MSS);
    const date =
      html.match(/<input\b[^>]*name="effectiveDate"[^>]*>/)?.[0] ?? "";
    expect(date).not.toContain(`value="${LEGAL_UPDATED}"`);
    expect(date).not.toMatch(/value="[^"]+"/);
    expect(date).toContain('maxLength="60"');
  });

  it("keeps a saved override's own date", async () => {
    overrides.value = { [MSS]: text(MSS, { effectiveDate: "12 Mart 2030" }) };
    const html = await edit(MSS);
    expect(html).toMatch(
      /<input\b[^>]*name="effectiveDate"[^>]*value="12 Mart 2030"/,
    );
  });

  it("says which version orders record for a checkout document only", async () => {
    expect(await edit(MSS)).toContain(
      `Onaylar şu an <strong>${LEGAL_UPDATED}</strong> sürümünü kaydediyor`,
    );
    expect(await edit(KVKK)).not.toContain("sürümünü kaydediyor");
  });

  it("posts by hand, with one Vazgeç link and the checkbox in a fieldset", async () => {
    const html = await edit(KVKK);
    // ActionForm: onSubmit posts; the action is only React's guard.
    const tags = formOpenTags(html);
    expect(tags).toHaveLength(1);
    expectReactGuard(tags[0]);
    expect(html).not.toMatch(/<a\b[^>]*>\s*<button/);
    expect(html).toMatch(/<a[^>]*href="\/admin\/hukuk"[^>]*>Vazgeç<\/a>/);
    const fieldset = html.match(/<fieldset[\s\S]*?<\/fieldset>/)?.[0] ?? "";
    expect(fieldset).toContain('name="isPublished"');
    expect(fieldset).toContain("<legend");
    // No label around the checkbox's own label.
    expect(html).not.toMatch(/<label[^>]*>(?:(?!<\/label>)[\s\S])*<label/);
  });

  it("draws the Markdown box in monospace at the field's own size", async () => {
    const html = await edit(KVKK);
    const body =
      html.match(/<textarea\b[^>]*name="bodyMarkdown"[^>]*>/)?.[0] ?? "";
    expect(body).toContain("ui-monospace");
    expect(body).not.toMatch(/font-size/);
    expect(body).toContain('maxLength="60000"');
    const tag = (name: string) =>
      html.match(
        new RegExp(`<(?:input|textarea)\\b[^>]*name="${name}"[^>]*>`),
      )?.[0] ?? "";
    expect(tag("title")).toContain('maxLength="200"');
    expect(tag("summary")).toContain('maxLength="600"');
  });
});

describe("the preview", () => {
  const preview = (slug: string, arsiv?: string) =>
    render("@/app/admin/hukuk/[slug]/onizle/page", {
      params: Promise.resolve({ slug }),
      searchParams: Promise.resolve(arsiv ? { arsiv } : {}),
    });

  it("renders the saved draft, owner only", async () => {
    overrides.value = { [IADE]: text(IADE) };
    const html = await preview(IADE);
    expect(requireRole).toHaveBeenCalledWith("legal");
    expect(html).toContain("Taslak başlığı");
    expect(html).toContain("Taslaktaki paragraf.");
    expect(html).toContain("sitede görünmüyor");
  });

  it("renders an archived text of the same document only", async () => {
    expect(await preview(KVKK, "7")).toContain("Arşivdeki paragraf.");
    const other = await preview(IADE, "7");
    expect(other).not.toContain("Arşivdeki paragraf.");
    expect(other).toContain("Bu arşiv kaydı yok");
  });

  it("says so when there is no saved text", async () => {
    expect(await preview(IADE)).toContain("Kayıtlı özel metin yok");
  });
});
