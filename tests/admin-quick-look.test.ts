import { readFileSync } from "node:fs";

import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AdminMenuItem,
  AdminProduct,
  AdminStockMove,
} from "@/lib/admin/store";

/**
 * A list's quick look (Innex's right drawer, recipe §3.8; 23 Eki 2026): a
 * row of Ürünler or Kafe menüsü opens its record over the list, in the
 * list's address (`?gor=<id>`). What is pinned: the address (the drawer
 * leaves the list's own links alone), what the drawer shows and what it
 * hands the browser (no stored photo, no cost), the owner-only history,
 * and the small helpers it is made of.
 */

const STAMP = "2026-10-20T10:00:00.000Z";
const DATA_URL = `data:image/png;base64,${"A".repeat(64)}`;

const h = vi.hoisted(() => ({
  role: "manager" as string,
  products: [] as unknown[],
  product: null as unknown,
  menu: [] as unknown[],
  moves: [] as unknown[],
  listStockMoves: vi.fn(),
  listAuditLogs: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    prefetch: _prefetch,
    scroll: _scroll,
    replace: _replace,
    ...rest
  }: {
    href: string;
    children?: ReactNode;
    prefetch?: boolean;
    scroll?: boolean;
    replace?: boolean;
  }) => createElement("a", { href, ...rest }, children),
  useLinkStatus: () => ({ pending: false }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  redirect: vi.fn(),
  unstable_rethrow: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock("@/lib/admin/auth", () => ({
  requireRole: vi.fn(async () => ({ email: "m@ornek.com", role: h.role })),
}));
vi.mock("@/lib/admin/audit", () => ({
  logAudit: vi.fn(async () => {}),
  safeAudit: vi.fn(async () => true),
  listAuditLogs: h.listAuditLogs,
}));
vi.mock("@/lib/admin/flash", () => ({ setAdminFlash: vi.fn(async () => {}) }));
vi.mock("@/lib/admin/store", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/admin/store")>();
  return {
    ...real,
    listProductsForPanel: vi.fn(async () => h.products),
    listProductThumbs: vi.fn(async () => ({})),
    getProduct: vi.fn(async () => h.product),
    listCategories: vi.fn(async () => [
      { id: "cat-1", slug: "gear", label: "Ekipman", icon: "◯", sortOrder: 1 },
    ]),
    getSettings: vi.fn(async () => ({
      taxRates: { menu: 10, gear: 20 },
      menuPricesEffectiveDate: "",
      menuPricesChangedAt: "",
    })),
    listMenuItems: vi.fn(async () => h.menu),
    listStockMoves: h.listStockMoves,
  };
});

const core = await import("@/lib/admin/quick-look-core");
const { timeAgo } = await import("@/lib/admin/time-ago");
const { menuAuditSummary } = await import("@/lib/admin/menu-panel");
const { formatTRY } = await import("@/components/admin/forms");

type AsyncPage = (props: never) => Promise<ReturnType<typeof createElement>>;
async function renderPage(path: string, sp: Record<string, string> = {}) {
  const mod = (await import(path)) as { default: AsyncPage };
  return renderToStaticMarkup(
    await mod.default({ searchParams: Promise.resolve(sp) } as never),
  );
}
const read = (path: string) => readFileSync(path, "utf8");
/** The drawer's markup alone. */
const drawer = (html: string) => {
  const at = html.indexOf("<dialog");
  return at < 0 ? "" : html.slice(at, html.indexOf("</dialog>", at));
};

function product(over: Partial<AdminProduct> = {}): AdminProduct {
  return {
    id: "prd-0006",
    name: "Moka - Bialetti",
    slug: "moka",
    sku: "MOKA-00006",
    tag: "3 fincanlık",
    priceMinor: 69_000,
    compareAtPriceMinor: 75_000,
    costMinor: 12_345,
    desc: "Gizli tedarikçi notu",
    cat: "gear",
    img: "cream",
    images: [DATA_URL],
    tags: [],
    brand: "Bialetti",
    notes: [],
    stock: 3,
    lowStockThreshold: 5,
    weightGrams: 600,
    taxRatePct: null,
    featured: false,
    isNew: false,
    isActive: true,
    seoTitle: "Gizli SEO başlığı",
    seoDescription: "Gizli SEO açıklaması",
    variants: [],
    updatedAt: STAMP,
    backdrop: null,
    backdropSource: "auto",
    backdropHex: null,
    photoCutout: false,
    vessel: null,
    ...over,
  };
}

function menuItem(over: Partial<AdminMenuItem> = {}): AdminMenuItem {
  return {
    id: "mnu-0004",
    categoryKey: "espresso",
    name: "L'Affogato",
    desc: "Bir top dondurma üzerine sıcak espresso.",
    priceMinor: 28_000,
    priceMinorL: 0,
    hue: "rose",
    image: DATA_URL,
    tags: ["signature"],
    allergens: null,
    isActive: true,
    sortOrder: 1,
    updatedAt: STAMP,
    backdrop: null,
    backdropSource: "auto",
    backdropHex: null,
    photoCutout: false,
    vessel: null,
    ...over,
  };
}

const move = (over: Partial<AdminStockMove> = {}): AdminStockMove => ({
  id: "mov-000001",
  productId: "prd-0006",
  productName: "Moka - Bialetti",
  delta: 6,
  stockAfter: 9,
  reason: "manual_adjust",
  note: "Tedarikçiden geldi",
  actor: "owner@laffogato.net",
  createdAt: STAMP,
  ...over,
});

beforeEach(() => {
  h.role = "manager";
  h.products = [product()];
  h.product = product();
  h.menu = [menuItem()];
  h.moves = [move()];
  h.listStockMoves.mockReset();
  h.listStockMoves.mockImplementation(async () => h.moves);
  h.listAuditLogs.mockReset();
  h.listAuditLogs.mockResolvedValue([]);
});

describe("the drawer's address (quick-look-core)", () => {
  it("reads ?gor= only as a record id", () => {
    expect(core.parseQuickLook({ gor: "prd-0006" })).toBe("prd-0006");
    expect(core.parseQuickLook({ gor: ["mnu-0004", "x"] })).toBe("mnu-0004");
    for (const bad of ["", "../x", "a b", "prd/0006", "x".repeat(65)]) {
      expect(core.parseQuickLook({ gor: bad }), bad).toBeNull();
    }
    expect(core.parseQuickLook({})).toBeNull();
  });

  it("keeps the list's params on the way in and out, and none of its own in the list's", () => {
    const sp = { durum: "aktif", sirala: "fiyat" };
    expect(core.quickLookHref(sp, "/admin/urunler", "prd-0006")).toBe(
      "/admin/urunler?durum=aktif&sirala=fiyat&gor=prd-0006",
    );
    expect(
      core.quickLookCloseHref({ ...sp, gor: "prd-0006" }, "/admin/urunler"),
    ).toBe("/admin/urunler?durum=aktif&sirala=fiyat");
    expect(core.withoutQuickLook({ ...sp, gor: "prd-0006" })).toEqual(sp);
  });

  it("tells the same list apart from another, whatever the spelling", () => {
    expect(
      core.sameListAddress(
        "/admin/urunler?a=1&b=x%20y",
        "/admin/urunler?b=x+y&a=1",
      ),
    ).toBe(true);
    expect(core.sameListAddress("/admin/urunler", "/admin/urunler?")).toBe(
      true,
    );
    expect(core.sameListAddress("/admin/urunler?a=1", "/admin/urunler")).toBe(
      false,
    );
    expect(core.sameListAddress("/admin/menu", "/admin/urunler")).toBe(false);
  });

  it("folds chips past four, but never behind a button for one", () => {
    const five = ["a", "b", "c", "d", "e"];
    expect(core.foldChips(five)).toEqual({ shown: five, folded: [] });
    expect(core.foldChips([...five, "f"])).toEqual({
      shown: ["a", "b", "c", "d"],
      folded: ["e", "f"],
    });
  });
});

describe("timeAgo, on the köşk's clock", () => {
  // Friday 23 Oct 2026, 00:30 in Tuzla (21:30Z on the 22nd).
  const now = new Date("2026-10-22T21:30:00.000Z");

  it("minutes, then hours today, then yesterday by the köşk's calendar", () => {
    expect(timeAgo("2026-10-22T21:29:40.000Z", now)).toBe("az önce");
    expect(timeAgo("2026-10-22T21:18:00.000Z", now)).toBe("12 dk önce");
    // 23:00 on the 22nd in Tuzla: an hour and a half ago, but yesterday.
    expect(timeAgo("2026-10-22T20:00:00.000Z", now)).toBe("dün 23:00");
    expect(timeAgo("2026-10-22T21:10:00.000Z", now)).toBe("20 dk önce");
  });

  it("days for a week, then the date; a clock ahead is now", () => {
    expect(timeAgo("2026-10-19T09:00:00.000Z", now)).toBe("4 gün önce");
    expect(timeAgo("2026-10-12T09:00:00.000Z", now)).toBe("12 Eki");
    expect(timeAgo("2025-12-30T09:00:00.000Z", now)).toBe("30 Ara 2025");
    expect(timeAgo("2026-10-22T22:00:00.000Z", now)).toBe("az önce");
    expect(timeAgo("dün", now)).toBe("");
  });

  it("hours on the same day", () => {
    const noon = new Date("2026-10-23T09:00:00.000Z");
    expect(timeAgo("2026-10-23T05:00:00.000Z", noon)).toBe("4 saat önce");
  });
});

describe("a menu item's history in words (menuAuditSummary)", () => {
  it("names what changed, in the menu's words", () => {
    const say = (action: string, payload: Record<string, unknown>) =>
      menuAuditSummary({ action, payload }, formatTRY);
    expect(say("create", { name: "x" })).toBe("Eklendi");
    expect(say("delete", {})).toBe("Silindi");
    expect(say("update", { isActive: false })).toBe("Tükendi işaretlendi");
    expect(say("update", { isActive: true })).toBe("Satışa açıldı");
    expect(say("update", { priceMinor: 21_500, priceMinorL: 24_500 })).toMatch(
      /^Fiyat ₺215,00 · L ₺245,00$/,
    );
    expect(say("update", { priceMinor: 21_500, priceMinorL: 0 })).toMatch(
      /^Fiyat ₺215,00$/,
    );
    expect(say("update", { allergens: ["sut"], name: "x" })).toBe(
      "Alerjenler güncellendi",
    );
    expect(say("update", { move: "up" })).toBe("Sırası değişti");
    expect(say("update", { name: "x", taxRatePct: 10 })).toBe("Güncellendi");
  });
});

describe("Ürünler's quick look", () => {
  it("a row opens it over the list, which keeps its own links", async () => {
    const html = await renderPage("@/app/admin/urunler/page", {
      durum: "aktif",
      gor: "prd-0006",
    });
    // The row's link is the drawer, with the list's tab.
    expect(html).toContain(
      'href="/admin/urunler?durum=aktif&amp;gor=prd-0006"',
    );
    // No other link on the page carries the drawer: a tab or a sort link
    // must not reopen it.
    const links = [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
    const withLook = links.filter((l) => l.includes("gor="));
    expect(new Set(withLook)).toEqual(
      new Set(["/admin/urunler?durum=aktif&amp;gor=prd-0006"]),
    );
    expect(drawer(html)).toContain('<a href="/admin/urunler?durum=aktif"');
  });

  it("shows the two states, the steps and the last moves", async () => {
    const html = drawer(
      await renderPage("@/app/admin/urunler/page", { gor: "prd-0006" }),
    );
    expect(html).toMatch(/^<dialog open="" aria-labelledby="[^"]+"/);
    expect(html).toContain("Moka - Bialetti");
    expect(html).toContain("Mağaza ürünü · Ekipman");
    expect(html).toContain("Satış durumu");
    expect(html).toContain("Stok durumu");
    expect(html).toContain("3 adet · düşük");
    expect(html).toContain("Stok güncelle");
    expect(html).toContain('href="/admin/urunler/prd-0006/duzenle#adim-2"');
    expect(html).toContain("Pasif yap");
    expect(html).toContain('href="/magaza/urun/moka"');
    expect(html).toContain("Tedarikçiden geldi");
    expect(html).toContain("Stok 9");
    // The bottom bar: the full page, and Düzenle as the one solid button.
    expect(html).toContain('href="/admin/urunler/prd-0006"');
    expect(html).toContain('href="/admin/urunler/prd-0006/duzenle"');
    expect(h.listStockMoves).toHaveBeenCalledWith({
      productId: "prd-0006",
      limit: 5,
    });
    // Its own toasts, inside the dialog (the panel's are behind a modal).
    expect(html).toContain('aria-live="polite"');
  });

  it("serves the photo by its path and hands over no cost, notes or SEO (CAT-07, CAT-08)", async () => {
    const html = await renderPage("@/app/admin/urunler/page", {
      gor: "prd-0006",
    });
    expect(drawer(html)).toContain('src="/gorsel/urun/prd-0006/0');
    for (const secret of [
      "data:image",
      "123,45",
      "Gizli tedarikçi notu",
      "Gizli SEO",
    ]) {
      expect(html, secret).not.toContain(secret);
    }
  });

  it("no drawer for junk or a product deleted since", async () => {
    expect(
      drawer(await renderPage("@/app/admin/urunler/page", { gor: "../x" })),
    ).toBe("");
    h.product = null;
    expect(
      drawer(await renderPage("@/app/admin/urunler/page", { gor: "prd-9999" })),
    ).toBe("");
  });
});

describe("Kafe menüsü's quick look", () => {
  it("says an item's allergens were never entered, and a manager gets no history", async () => {
    const html = drawer(
      await renderPage("@/app/admin/menu/page", { gor: "mnu-0004" }),
    );
    expect(html).toContain("L&#x27;Affogato");
    expect(html).toContain("Menü kalemi");
    expect(html).toContain("Girilmemiş");
    expect(html).toContain("Tükendi işaretle");
    expect(html).toContain('src="/gorsel/menu/mnu-0004');
    expect(html).not.toContain("data:image");
    // The audit log is the owner's.
    expect(h.listAuditLogs).not.toHaveBeenCalled();
    expect(html).toContain("Son değişiklik");
    expect(html).not.toContain("Son değişiklikler");
  });

  it("folds six allergens behind Tümünü göster", async () => {
    h.menu = [
      menuItem({
        allergens: [
          "gluten",
          "yumurta",
          "soya",
          "sut",
          "sert_kabuklu",
          "susam",
        ],
      }),
    ];
    const html = drawer(
      await renderPage("@/app/admin/menu/page", { gor: "mnu-0004" }),
    );
    expect(html).toContain("Tümünü göster (6)");
    h.menu = [menuItem({ allergens: [] })];
    expect(
      drawer(await renderPage("@/app/admin/menu/page", { gor: "mnu-0004" })),
    ).toContain("On dört gruptan hiçbirini içermiyor.");
  });

  it("the owner reads its last changes from the audit log", async () => {
    h.role = "owner";
    h.listAuditLogs.mockResolvedValue([
      {
        id: "aud-0000002",
        actor: "panel:Selin",
        action: "update",
        entity: "menu_item",
        entityId: "mnu-0004",
        payload: { name: "L'Affogato", priceMinor: 29_000, via: "panel" },
        createdAt: STAMP,
      },
    ]);
    const html = drawer(
      await renderPage("@/app/admin/menu/page", { gor: "mnu-0004" }),
    );
    expect(h.listAuditLogs).toHaveBeenCalledWith({
      entity: "menu_item",
      entityId: "mnu-0004",
      limit: 5,
    });
    expect(html).toContain("Son değişiklikler");
    expect(html).toMatch(/Fiyat ₺290,00/);
    expect(html).toContain("Yönetim paneli · Selin");
  });

  it("a menu row's link is its drawer", async () => {
    const html = await renderPage("@/app/admin/menu/page");
    expect(html).toContain('href="/admin/menu?gor=mnu-0004"');
  });
});

describe("the drawer's machinery", () => {
  it("is modal, closes back to the list and gives the row its focus back", () => {
    const src = read("src/components/admin/ui/quick-look.tsx");
    expect(src).toContain("dialog.showModal()");
    expect(src).toContain("router.back()");
    expect(src).toContain("router.replace(closeHref, { scroll: false })");
    expect(src).toMatch(/focus\(\{ preventScroll: true \}\)/);
  });

  it("the list's row links keep the scroll (the drawer opens over it)", () => {
    for (const file of [
      "src/components/admin/products-list.tsx",
      "src/components/admin/menu-list.tsx",
    ]) {
      const src = read(file);
      expect(src, file).toContain("rowLinkScroll={false}");
      expect(src, file).toContain("scroll={false}");
    }
  });
});
