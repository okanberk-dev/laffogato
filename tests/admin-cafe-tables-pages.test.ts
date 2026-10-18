import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CafeTable } from "@/lib/admin/cafe-tables";

/**
 * Masalar on the panel's kit (admin audit P2b, KAR-05, KAR-14, KAR-17,
 * KAR-22, KAR-24): a list with tabs, a search box and a ⋯ menu per row; a
 * page per table with its QR and its actions; forms that keep what was
 * typed and have a way back; one table's card printable alone.
 */

const h = vi.hoisted(() => ({
  tables: [] as CafeTable[],
}));

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
  useLinkStatus: () => ({ pending: false }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  unstable_rethrow: vi.fn(),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/app/admin/masalar/actions", () => ({
  createCafeTableAction: vi.fn(),
  updateCafeTableAction: vi.fn(),
  rotateCafeTableCodeAction: vi.fn(),
  setCafeTableActiveAction: vi.fn(),
}));
vi.mock("@/lib/admin/auth", () => ({
  requireRole: vi.fn(async () => ({ email: "m@ornek.com", role: "manager" })),
}));
vi.mock("@/lib/admin/cafe-tables", () => ({
  listCafeTables: vi.fn(async () => h.tables),
  getCafeTable: vi.fn(
    async (id: string) => h.tables.find((t) => t.id === id) ?? null,
  ),
}));
vi.mock("@/lib/admin/cafe-table-qr", () => ({
  tableQrSvg: vi.fn(async (code: string) => `<svg data-code="${code}"></svg>`),
}));

const { default: ListPage } = await import("@/app/admin/masalar/page");
const { default: ViewPage } = await import("@/app/admin/masalar/[id]/page");
const { default: PrintPage } = await import("@/app/admin/masalar/yazdir/page");
const { default: NewPage } = await import("@/app/admin/masalar/yeni/page");
const { default: EditPage } =
  await import("@/app/admin/masalar/[id]/duzenle/page");
const panel = await import("@/lib/admin/cafe-tables-panel");

const html = (node: ReactNode) =>
  renderToStaticMarkup(node as ReturnType<typeof createElement>);

function table(over: Partial<CafeTable> = {}): CafeTable {
  return {
    id: "tbl-0003",
    code: "ABCDEFGH23",
    name: "Bahçe 3",
    sortOrder: 3,
    isActive: true,
    createdAt: "2026-10-15T10:00:00.000Z",
    updatedAt: "2026-10-15T10:00:00.000Z",
    rotatedAt: "",
    ...over,
  };
}

async function list(sp: Record<string, string> = {}) {
  return html(await ListPage({ searchParams: Promise.resolve(sp) }));
}

beforeEach(() => {
  h.tables = [
    table(),
    table({
      id: "tbl-0001",
      code: "QRSTVWXYZ1",
      name: "Pencere 1",
      sortOrder: 1,
    }),
    table({
      id: "tbl-0002",
      code: "MNPQRSTVW2",
      name: "Teras 2",
      sortOrder: 2,
      isActive: false,
    }),
  ];
});

describe("the list", () => {
  it("draws tabs with counts, the search, a row per table and its menu", async () => {
    const page = await list();
    for (const label of ["Tümü", "Aktif", "Pasif"]) {
      expect(page, label).toContain(label);
    }
    expect(page).toContain('role="search"');
    expect(page).toContain('href="/admin/masalar/tbl-0003"');
    expect(page).toContain("Bahçe 3 işlemleri");
    expect(page).toContain('href="/admin/masalar/yazdir?masa=tbl-0003"');
    expect(page).toContain('href="/admin/masalar/tbl-0003/qr"');
    // Sıra order: Pencere 1, Teras 2, Bahçe 3.
    expect(page.indexOf("Pencere 1")).toBeLessThan(page.indexOf("Bahçe 3"));
    expect(page).toContain("Kartları yazdır (2)");
  });

  it("the Pasif tab holds the inactive table only", async () => {
    const page = await list({ durum: "pasif" });
    expect(page).toContain('href="/admin/masalar/tbl-0002"');
    expect(page).not.toContain('href="/admin/masalar/tbl-0003"');
  });

  it("finds a table by name the Turkish way, or by code", () => {
    const opts = {
      tab: "tumu" as const,
      sort: panel.CAFE_TABLE_DEFAULT_SORT,
      page: 1,
    };
    const ids = (q: string) =>
      panel
        .cafeTablesList(h.tables, { ...opts, filters: { q } })
        .rows.map((t) => t.id);
    expect(ids("bahce")).toEqual(["tbl-0003"]);
    expect(ids("BAHÇE")).toEqual(["tbl-0003"]);
    expect(ids("xyz1")).toEqual(["tbl-0001"]);
    const res = panel.cafeTablesList(h.tables, {
      ...opts,
      filters: { q: "teras" },
    });
    expect(res.counts).toEqual({ tumu: 1, aktif: 0, pasif: 1 });
  });

  it("uses the kit's badge tones, not hand-picked emerald and neutral (KAR-17)", async () => {
    const page = await list();
    expect(page).not.toMatch(/emerald-|neutral-100|neutral-600/);
    expect(page).toContain("Aktif");
  });

  it("names every repeated control after its table (KAR-22)", async () => {
    const page = await list();
    expect(page).toContain('aria-label="Pasifleştir: Bahçe 3"');
    expect(page).toContain('aria-label="Kodu yenile: Bahçe 3"');
    expect(page).toContain('aria-label="Etkinleştir: Teras 2"');
    expect(page).toContain('aria-label="Bağlantıyı kopyala: Bahçe 3"');
  });

  it("says so, with the next step, when there is no table yet", async () => {
    h.tables = [];
    const page = await list();
    expect(page).toContain("Henüz masa yok.");
    expect(page).toContain('href="/admin/masalar/yeni"');
  });
});

describe("a table's page", () => {
  it("shows the QR, the link, the details and one row of same-size actions (KAR-05)", async () => {
    const page = html(
      await ViewPage({ params: Promise.resolve({ id: "tbl-0003" }) }),
    );
    expect(page).toContain('data-code="ABCDEFGH23"');
    expect(page).toContain("https://laffogato.net/masa/ABCDEFGH23");
    expect(page).toContain('href="/admin/masalar"');
    expect(page).toContain('href="/admin/masalar/tbl-0003/duzenle"');
    expect(page).toContain('href="/admin/masalar/yazdir?masa=tbl-0003"');
    expect(page).toContain("Yenilenmedi");
    // No 12 px control next to a 14 px one: no text-xs on any button or link
    // of the actions row.
    const actions = page.slice(page.indexOf("Düzenle") - 400);
    expect(actions).not.toMatch(/<(a|button)[^>]*class="[^"]*text-xs/);
    // The copy is announced (a live region next to the button).
    expect(page).toMatch(/role="status" aria-live="polite"/);
  });

  it("answers 404 for an unknown table and for an id that is not one", async () => {
    await expect(
      ViewPage({ params: Promise.resolve({ id: "tbl-9999" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(
      ViewPage({ params: Promise.resolve({ id: "ord-1" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("the forms (KAR-14, KAR-24)", () => {
  it("post by hand, so a refusal keeps what was typed, and have a way back", async () => {
    const created = html(await NewPage());
    expect(created).not.toContain("action=");
    expect(created).toContain('name="name"');
    expect(created).toContain("← Masalar");
    expect(created).toMatch(/href="\/admin\/masalar"[^>]*>Vazgeç</);

    const edited = html(
      await EditPage({ params: Promise.resolve({ id: "tbl-0003" }) }),
    );
    expect(edited).not.toContain("action=");
    expect(edited).toContain('name="sortOrder"');
    expect(edited).toMatch(/href="\/admin\/masalar\/tbl-0003"[^>]*>Vazgeç</);
  });
});

describe("the print sheet (KAR-24)", () => {
  async function print(sp: Record<string, string> = {}) {
    return html(await PrintPage({ searchParams: Promise.resolve(sp) }));
  }

  it("prints every active table, or one table's card alone", async () => {
    const all = await print();
    expect(all).toContain('data-code="ABCDEFGH23"');
    expect(all).toContain('data-code="QRSTVWXYZ1"');
    expect(all).not.toContain('data-code="MNPQRSTVW2"');

    const one = await print({ masa: "tbl-0003" });
    expect(one).toContain('data-code="ABCDEFGH23"');
    expect(one).not.toContain('data-code="QRSTVWXYZ1"');
    expect(one).toContain("Bahçe 3 kartı");
    expect(one).toContain('href="/admin/masalar/tbl-0003"');
  });

  it("a ?masa= that names no table prints nothing, not every card", async () => {
    for (const masa of ["tbl-9999", "x; drop"]) {
      const page = await print({ masa });
      expect(page, masa).not.toContain("data-code=");
      expect(page, masa).toContain("Bu masa bulunamadı.");
    }
  });
});
