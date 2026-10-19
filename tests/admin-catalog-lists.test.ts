import { readFileSync } from "node:fs";

import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BulkAnswerState } from "@/components/admin/bulk-answer";
import type {
  AdminMenuItem,
  AdminProduct,
  AdminStockMove,
} from "@/lib/admin/store";

/**
 * The catalog lists, admin audit package 5d (catalog-lists):
 *
 * - CAT-07 / CAT-08: Ürünler, Kafe menüsü and Stok handed whole rows to
 *   client components: every stored photo (data URLs of up to 2 MB), the
 *   cost price (to Personel on Stok), the SEO fields. Kategoriler read every
 *   photo to count products.
 * - CAT-16: the stock ledger stopped at the newest 500 moves, unsaid.
 * - CAT-19: the product search missed İ, I and ı.
 * - CAT-30, CAT-14, CAT-10, CAT-17, CAT-23, CAT-26, CAT-11, CAT-21: kit
 *   lists with tabs, paging, a row Aktif toggle and view pages, each
 *   variant's stock, Turkish menu tags, bulk throws answered in place,
 *   controls named after their row, kit tones, a guard on the wizard.
 *
 * No DOM library is installed: pages are read as server markup, the
 * client components' props are captured on the way in, and the browser-only
 * parts run against small fakes.
 */

const STAMP = "2026-10-10T10:00:00.000Z";
const DATA_URL = `data:image/png;base64,${"A".repeat(64)}`;

const h = vi.hoisted(() => ({
  products: [] as unknown[],
  thumbs: {} as Record<string, string>,
  product: null as unknown,
  menu: [] as unknown[],
  menuItem: null as unknown,
  moves: [] as unknown[],
  moveCount: 0,
  listStockMoves: vi.fn(),
  countStockMoves: vi.fn(),
  listProducts: vi.fn(async () => {
    throw new Error("listProducts reads every photo");
  }),
  bulkUpdateProducts: vi.fn(async () => ({ updated: 1 })),
  safeAudit: vi.fn(async () => true),
  props: {} as Record<string, unknown>,
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
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  redirect: vi.fn(),
  unstable_rethrow: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/admin/auth", () => ({
  requireRole: vi.fn(async () => ({ email: "m@ornek.com", role: "manager" })),
}));
vi.mock("@/lib/admin/audit", () => ({
  logAudit: vi.fn(async () => {}),
  safeAudit: h.safeAudit,
}));
vi.mock("@/lib/admin/flash", () => ({ setAdminFlash: vi.fn(async () => {}) }));
vi.mock("@/lib/admin/store", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/admin/store")>();
  return {
    ...real,
    listProducts: h.listProducts,
    listProductsForPanel: vi.fn(async () => h.products),
    listProductThumbs: vi.fn(async (ids: string[]) =>
      Object.fromEntries(
        Object.entries(h.thumbs).filter(([id]) => ids.includes(id)),
      ),
    ),
    getProduct: vi.fn(async () => h.product),
    listCategories: vi.fn(async () => [
      {
        id: "cat-1",
        slug: "beans",
        label: "Çekirdek",
        icon: "◯",
        sortOrder: 1,
      },
      { id: "cat-2", slug: "gift", label: "Hediye", icon: "◯", sortOrder: 2 },
    ]),
    getSettings: vi.fn(async () => ({
      taxRates: {
        menu: 10,
        karaoke: 20,
        beans: 1,
        pantry: 1,
        gift: 20,
        gear: 20,
        merch: 20,
      },
    })),
    listMenuItems: vi.fn(async () => h.menu),
    getMenuItem: vi.fn(async () => h.menuItem),
    listStockMoves: h.listStockMoves,
    countStockMoves: h.countStockMoves,
    bulkUpdateProducts: h.bulkUpdateProducts,
  };
});
// The client lists render for real; their props are kept for the checks.
vi.mock("@/components/admin/products-list", async (importOriginal) => {
  const real =
    await importOriginal<typeof import("@/components/admin/products-list")>();
  return {
    ...real,
    ProductsList: (props: Record<string, unknown>) => {
      h.props.products = props;
      return createElement(real.ProductsList, props as never);
    },
  };
});
vi.mock("@/components/admin/menu-list", async (importOriginal) => {
  const real =
    await importOriginal<typeof import("@/components/admin/menu-list")>();
  return {
    ...real,
    MenuList: (props: Record<string, unknown>) => {
      h.props.menu = props;
      return createElement(real.MenuList, props as never);
    },
  };
});
vi.mock("@/components/admin/stock-adjust-form", async (importOriginal) => {
  const real =
    await importOriginal<
      typeof import("@/components/admin/stock-adjust-form")
    >();
  return {
    ...real,
    StockAdjustForm: (props: Record<string, unknown>) => {
      h.props.stock = props;
      return createElement(real.StockAdjustForm, props as never);
    },
  };
});

const panel = await import("@/lib/admin/products-panel");
const menuPanel = await import("@/lib/admin/menu-panel");
const stockPanel = await import("@/lib/admin/stock-moves-panel");
const { bulkAnswer } = await import("@/components/admin/bulk-answer");
const { PANEL_ACTION_FAILED } = await import("@/components/admin/action-form");
const guard = await import("@/components/admin/unsaved-guard");
const productActions = await import("@/app/admin/urunler/actions");

type AsyncPage = (props: never) => Promise<ReturnType<typeof createElement>>;
async function renderPage(path: string, props: Record<string, unknown> = {}) {
  const mod = (await import(path)) as { default: AsyncPage };
  return renderToStaticMarkup(await mod.default(props as never));
}
const withSearch = (sp: Record<string, string> = {}) => ({
  searchParams: Promise.resolve(sp),
});
const read = (path: string) => readFileSync(path, "utf8");

function product(over: Partial<AdminProduct> = {}): AdminProduct {
  return {
    id: "prd-0001",
    name: "Sirena Espresso",
    slug: "sirena-espresso",
    sku: "SIRE-00001",
    tag: "Çekirdek",
    priceMinor: 32_000,
    compareAtPriceMinor: 0,
    costMinor: 12_345,
    desc: "Gizli tedarikçi notu",
    cat: "beans",
    img: "cream",
    images: [DATA_URL, DATA_URL],
    tags: ["nuts"],
    brand: "Sirena",
    notes: ["Kakao"],
    stock: 10,
    lowStockThreshold: 3,
    weightGrams: 250,
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
    id: "mnu-0001",
    categoryKey: "matcha",
    name: "Çilekli Matcha",
    desc: "Taze çilek",
    priceMinor: 24_500,
    priceMinorL: 0,
    hue: "rose",
    image: DATA_URL,
    tags: ["signature", "nuts"],
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

function move(i: number): AdminStockMove {
  return {
    id: `mov-${String(i).padStart(6, "0")}`,
    productId: "prd-0001",
    productName: "Sirena Espresso",
    delta: -1,
    stockAfter: 9,
    reason: "order_placed",
    note: "",
    orderId: "ord-0001",
    actor: "customer",
    createdAt: STAMP,
  };
}

beforeEach(() => {
  h.products = [];
  h.thumbs = {};
  h.product = null;
  h.menu = [];
  h.menuItem = null;
  h.moves = [];
  h.moveCount = 0;
  h.props = {};
  h.listStockMoves.mockReset();
  h.listStockMoves.mockImplementation(async () => h.moves);
  h.countStockMoves.mockReset();
  h.countStockMoves.mockImplementation(async () => h.moveCount);
  h.bulkUpdateProducts.mockClear();
  h.safeAudit.mockClear();
});

/** Every value under `value`, as JSON: what a client prop puts in the page. */
const payload = (value: unknown) => JSON.stringify(value);

describe("what the lists hand the browser (CAT-07, CAT-08)", () => {
  it("Ürünler: a served thumbnail, no photos, cost, description or SEO", async () => {
    h.products = [product()];
    h.thumbs = { "prd-0001": "/gorsel/urun/prd-0001/0?v=abc123def456" };
    const html = await renderPage("@/app/admin/urunler/page", withSearch());
    const props = payload(h.props.products);
    expect(props).toContain("/gorsel/urun/prd-0001/0?v=abc123def456");
    for (const secret of [
      "data:image",
      "costMinor",
      "12345",
      "seoTitle",
      "Gizli",
      '"images"',
    ]) {
      expect(props, secret).not.toContain(secret);
    }
    expect(html).not.toContain("data:image");
    expect(html).toContain('src="/gorsel/urun/prd-0001/0?v=abc123def456"');
  });

  it("toProductListRow keeps only what the list draws", () => {
    const row = panel.toProductListRow(
      product({
        variants: [
          {
            id: "var-1",
            name: "250 g",
            priceDeltaMinor: 0,
            stock: 4,
            sku: "V1",
            isActive: true,
          },
        ],
      }),
      undefined,
    );
    expect(Object.keys(row).sort()).toEqual(
      [
        "cat",
        "compareAtPriceMinor",
        "featured",
        "id",
        "isActive",
        "isNew",
        "lowStockThreshold",
        "name",
        "priceMinor",
        "sku",
        "slug",
        "stock",
        "tag",
        "thumb",
        "updatedAt",
        "variants",
      ].sort(),
    );
    expect(row.thumb).toBeNull();
    expect(row.variants).toEqual([
      { id: "var-1", name: "250 g", stock: 4, isActive: true },
    ]);
  });

  it("Stok: the correction form gets names and stock, never cost or photos", async () => {
    h.products = [
      product({
        variants: [
          {
            id: "var-1",
            name: "250 g",
            priceDeltaMinor: 500,
            stock: 4,
            sku: "V1",
            isActive: true,
          },
        ],
      }),
    ];
    await renderPage("@/app/admin/stok-hareketleri/page", withSearch());
    const props = payload(h.props.stock);
    expect(props).toContain("Sirena Espresso");
    expect(props).toContain('"stock":4');
    for (const secret of [
      "costMinor",
      "12345",
      "data:image",
      "priceMinor",
      "priceDeltaMinor",
      "seoTitle",
    ]) {
      expect(props, secret).not.toContain(secret);
    }
    expect(h.listProducts).not.toHaveBeenCalled();
  });

  it("Kafe menüsü: the rows carry no photo", async () => {
    h.menu = [menuItem()];
    await renderPage("@/app/admin/menu/page", withSearch());
    const props = payload(h.props.menu);
    expect(props).toContain("Çilekli Matcha");
    expect(props).not.toContain("data:image");
    expect(props).not.toContain('"image"');
    expect(props).not.toContain("backdrop");
  });

  it("Kategoriler counts from the list columns, not every photo", async () => {
    h.products = [product()];
    const html = await renderPage("@/app/admin/kategoriler/page");
    expect(h.listProducts).not.toHaveBeenCalled();
    expect(html).toContain("Bu kategoride 1 ürün var.");
    expect(html).toContain('aria-label="Sil: Çekirdek"');
  });
});

describe("Ürünler on the kit (CAT-19, CAT-30, CAT-14, CAT-26)", () => {
  const list = (
    products: AdminProduct[],
    filters: Record<string, string> = {},
    tab: Parameters<typeof panel.productsList>[1]["tab"] = "tumu",
    page = 1,
  ) =>
    panel.productsList(products, {
      tab,
      filters,
      sort: panel.PRODUCT_DEFAULT_SORT,
      page,
    });

  it("the search folds Turkish on both sides", () => {
    const rows = [
      product({ id: "a", name: "İtalyan Kavrum Espresso" }),
      product({ id: "b", name: "IRMAK Çekirdek" }),
      product({ id: "c", name: "Fındık Kreması" }),
    ];
    const ids = (q: string) => list(rows, { q }).rows.map((p) => p.id);
    expect(ids("italyan")).toEqual(["a"]);
    expect(ids("ırmak")).toEqual(["b"]);
    expect(ids("irmak")).toEqual(["b"]);
    expect(ids("FINDIK")).toEqual(["c"]);
    expect(panel.matchesProductSearch(rows[0], "SIRE-00001")).toBe(true);
  });

  it("the box shows the query as typed, not folded", async () => {
    h.products = [product({ name: "İtalyan Kavrum" })];
    const html = await renderPage(
      "@/app/admin/urunler/page",
      withSearch({ q: "İtalyan" }),
    );
    expect(html).toContain('value="İtalyan"');
    expect(html).not.toContain("i\u0307talyan");
  });

  it("tabs count with the filters applied; pages of 50", () => {
    const rows = [
      product({ id: "a", isActive: true, stock: 10 }),
      product({ id: "b", isActive: false, stock: 0 }),
      product({ id: "c", isActive: true, stock: 2, cat: "gift" }),
    ];
    expect(list(rows).counts).toEqual({
      tumu: 3,
      aktif: 2,
      pasif: 1,
      dusuk: 1,
      tukendi: 1,
    });
    expect(list(rows, { kategori: "gift" }).counts.tumu).toBe(1);
    expect(list(rows, {}, "tukendi").rows.map((p) => p.id)).toEqual(["b"]);
    const many = Array.from({ length: 120 }, (_, i) =>
      product({ id: `p${String(i).padStart(3, "0")}`, updatedAt: STAMP }),
    );
    const second = list(many, {}, "tumu", 2);
    expect(second.rows).toHaveLength(50);
    expect(second.total).toBe(120);
    expect(list(many, {}, "tumu", 9).page).toBe(3);
  });

  it("draws tabs, a labelled search, sort links and a ⋯ menu with Aktif / Pasif", async () => {
    h.products = [
      product(),
      product({
        id: "prd-0002",
        name: "Moka",
        slug: "moka",
        isActive: false,
        stock: 0,
      }),
    ];
    const html = await renderPage("@/app/admin/urunler/page", withSearch());
    expect(html).toContain('aria-label="Ürün sekmeleri"');
    expect(html).toContain("Stokta yok");
    expect(html).toMatch(/<label[^>]*for="[^"]+"[^>]*>Ara<\/label>/);
    expect(html).toContain("sirala=ad");
    expect(html).toContain('aria-label="Pasif yap: Sirena Espresso"');
    expect(html).toContain('aria-label="Aktif yap: Moka"');
    expect(html).toContain('href="/admin/urunler/prd-0001"');
    // The shop page only for an active product, in a new tab.
    expect(html).toContain('href="/magaza/urun/sirena-espresso"');
    expect(html).not.toContain('href="/magaza/urun/moka"');
    // The old GET form with "Uygula" under a raw select is gone: one bar.
    expect(html.match(/role="search"/g)).toHaveLength(1);
  });

  it("shows each variant's own stock beside the total", async () => {
    h.products = [
      product({
        stock: 4,
        variants: [
          {
            id: "var-1",
            name: "250 g",
            priceDeltaMinor: 0,
            stock: 4,
            sku: "",
            isActive: true,
          },
          {
            id: "var-2",
            name: "1 kg",
            priceDeltaMinor: 0,
            stock: 0,
            sku: "",
            isActive: true,
          },
        ],
      }),
    ];
    const html = await renderPage("@/app/admin/urunler/page", withSearch());
    expect(html).toMatch(/250 g:\s*<span[^>]*>4<\/span>/);
    expect(html).toMatch(/1 kg:\s*<span[^>]*>0<\/span>/);
  });

  it("the list files speak in kit tones, not raw palette or synthesized italic", () => {
    for (const path of [
      "src/app/admin/urunler/page.tsx",
      "src/components/admin/products-list.tsx",
      "src/components/admin/menu-list.tsx",
      "src/app/admin/menu/page.tsx",
      "src/app/admin/stok-hareketleri/page.tsx",
      "src/components/admin/stock-adjust-form.tsx",
      "src/app/admin/urunler/[id]/page.tsx",
      "src/app/admin/menu/[id]/page.tsx",
    ]) {
      const src = read(path);
      expect(src, path).not.toMatch(
        /\b(?:neutral|red|amber|green|blue|emerald)-\d{2,3}\b/,
      );
      expect(src, path).not.toContain("fontStyle");
      expect(src, path).not.toContain("--serif");
      expect(src, path).not.toContain("font-mono");
      expect(src, path).not.toMatch(/\bconfirm\(/);
      expect(src, path).not.toContain("rounded-full border");
    }
  });
});

describe("product and menu view pages (D37)", () => {
  it("a product's page: price, cost, each variant, served photos, actions", async () => {
    h.product = product({
      compareAtPriceMinor: 40_000,
      variants: [
        {
          id: "var-1",
          name: "250 g",
          priceDeltaMinor: 500,
          stock: 0,
          sku: "V1",
          isActive: true,
        },
      ],
    });
    const html = await renderPage("@/app/admin/urunler/[id]/page", {
      params: Promise.resolve({ id: "prd-0001" }),
    });
    expect(html).toContain("Sirena Espresso");
    expect(html).toContain("Maliyet");
    expect(html).toContain("250 g");
    expect(html).toContain("%1");
    expect(html).toMatch(/src="\/gorsel\/urun\/prd-0001\/0\?v=[0-9a-f]{12}"/);
    expect(html).toMatch(/src="\/gorsel\/urun\/prd-0001\/1\?v=[0-9a-f]{12}"/);
    expect(html).not.toContain("data:image");
    expect(html).toContain('href="/admin/urunler/prd-0001/duzenle"');
    expect(html).toContain('href="/admin/stok-hareketleri?productId=prd-0001"');
    expect(html).toContain('aria-label="Pasif yap: Sirena Espresso"');
  });

  it("an unknown product is a 404", async () => {
    h.product = null;
    await expect(
      renderPage("@/app/admin/urunler/[id]/page", {
        params: Promise.resolve({ id: "prd-9999" }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("a menu item's page: prices, Turkish tags, served photo, Tükendi", async () => {
    h.menuItem = menuItem({ priceMinorL: 28_000 });
    const html = await renderPage("@/app/admin/menu/[id]/page", {
      params: Promise.resolve({ id: "mnu-0001" }),
    });
    expect(html).toContain("Fiyat (L)");
    expect(html).toContain("İmza");
    expect(html).toContain("Sert kabuklu yemiş");
    expect(html).not.toContain(">signature<");
    expect(html).toMatch(/src="\/gorsel\/menu\/mnu-0001\?v=[0-9a-f]{12}"/);
    expect(html).not.toContain("data:image");
    expect(html).toContain('aria-label="Tükendi: Çilekli Matcha"');
  });
});

describe("Kafe menüsü on the kit (CAT-10, CAT-30)", () => {
  const rows = [
    menuPanel.toMenuListRow(menuItem({ id: "a", name: "İncir Latte" })),
    menuPanel.toMenuListRow(
      menuItem({
        id: "b",
        name: "Limonata",
        isActive: false,
        categoryKey: "cold",
      }),
    ),
  ];
  const keys = ["matcha", "cold", "hot"] as const;

  it("groups by category; filtered views drop empty groups", () => {
    const all = menuPanel.menuList(rows, {
      tab: "tumu",
      filters: {},
      categoryKeys: keys,
    });
    expect(all.groups.map((g) => g.key)).toEqual(["matcha", "cold", "hot"]);
    expect(all.counts).toEqual({ tumu: 2, satista: 1, tukendi: 1 });
    const sold = menuPanel.menuList(rows, {
      tab: "tukendi",
      filters: {},
      categoryKeys: keys,
    });
    expect(sold.groups.map((g) => g.key)).toEqual(["cold"]);
    const found = menuPanel.menuList(rows, {
      tab: "tumu",
      filters: { q: "incir" },
      categoryKeys: keys,
    });
    expect(found.groups.map((g) => g.rows.map((r) => r.id))).toEqual([["a"]]);
  });

  it("chips speak Turkish; an unknown word is shown as written and marked", () => {
    expect(menuPanel.menuTagChip("signature")).toEqual({
      label: "İmza",
      known: true,
    });
    expect(menuPanel.menuTagChip("IGP")).toEqual({
      label: "IGP",
      known: false,
    });
  });

  it("the page: tabs, search, Tükendi one click, Sil asks, no raw keys", async () => {
    h.menu = [menuItem(), menuItem({ id: "mnu-0002", tags: ["IGP"] })];
    const html = await renderPage("@/app/admin/menu/page", withSearch());
    expect(html).toContain('aria-label="Menü sekmeleri"');
    expect(html).toContain("İmza");
    expect(html).not.toMatch(/>\s*signature\s*</);
    expect(html).toContain("(uygulamada görünmez)");
    expect(html).toContain('aria-label="Sil: Çilekli Matcha"');
    expect(html).toContain('href="/admin/menu/mnu-0001"');
    // The category heading is the panel's own face, not a faked italic.
    expect(html).not.toContain("font-style:italic");
  });
});

describe("the stock ledger (CAT-16)", () => {
  it("pages through every move with the total count", async () => {
    h.products = [product()];
    h.moveCount = 250;
    h.moves = Array.from({ length: 100 }, (_, i) => move(i + 101));
    const html = await renderPage(
      "@/app/admin/stok-hareketleri/page",
      withSearch({ sayfa: "2" }),
    );
    expect(h.countStockMoves).toHaveBeenCalledWith({});
    expect(h.listStockMoves).toHaveBeenCalledWith({ limit: 100, offset: 100 });
    expect(html).toContain("Toplam 250 hareket.");
    expect(html).toContain("101-200 / 250");
    expect(html).toContain('aria-label="Sayfa 3"');
  });

  it("filters by product, reason and the köşk's days", async () => {
    h.products = [product()];
    await renderPage(
      "@/app/admin/stok-hareketleri/page",
      withSearch({
        productId: "prd-0001",
        reason: "manual_adjust",
        bas: "2026-10-01",
        bit: "2026-10-02",
      }),
    );
    const query = {
      productId: "prd-0001",
      reason: "manual_adjust",
      fromIso: "2026-09-30T21:00:00.000Z",
      beforeIso: "2026-10-02T21:00:00.000Z",
    };
    expect(h.countStockMoves).toHaveBeenCalledWith(query);
    expect(h.listStockMoves).toHaveBeenCalledWith({
      ...query,
      limit: 100,
      offset: 0,
    });
  });

  it("a page past the end shows the last one", async () => {
    h.moveCount = 150;
    await renderPage(
      "@/app/admin/stok-hareketleri/page",
      withSearch({ sayfa: "9" }),
    );
    expect(h.listStockMoves).toHaveBeenCalledWith({ limit: 100, offset: 100 });
  });

  it("a deleted product the audit log links to stays filterable", () => {
    const options = stockPanel.stockProductOptions(
      [{ id: "prd-0001", name: "Sirena" }],
      "prd-0042",
    );
    expect(options.at(-1)).toEqual({
      value: "prd-0042",
      label: "Silinmiş ürün (prd-0042)",
    });
    expect(
      stockPanel.stockProductOptions(
        [{ id: "prd-0001", name: "Sirena" }],
        "x y",
      ),
    ).toHaveLength(1);
  });

  it("reasons are kit badges and 'Siparişe git' is a 44 px link", async () => {
    h.moveCount = 1;
    h.moves = [move(1)];
    const html = await renderPage(
      "@/app/admin/stok-hareketleri/page",
      withSearch(),
    );
    const link = /<a[^>]*href="\/admin\/siparisler\/ord-0001"[^>]*>/.exec(
      html,
    )?.[0];
    expect(link).toContain("min-h-[44px]");
    expect(html).not.toContain("text-[10px] text-neutral-600");
    expect(html).toContain("bg-[var(--admin-info-soft)]");
  });
});

describe("bulk bars answer a throw in place (CAT-17)", () => {
  it("a thrown bulk action is 'Bir hata oldu…', not the error screen", async () => {
    const told: Array<[string, string | undefined]> = [];
    const run = bulkAnswer<BulkAnswerState>(
      async () => {
        throw new Error("timeout");
      },
      {
        tell: (m, tone) => told.push([m, tone]),
        describe: () => "ok",
      },
    );
    const next = await run({}, new FormData());
    expect(next.error).toBe(PANEL_ACTION_FAILED);
    expect(told).toEqual([[PANEL_ACTION_FAILED, "danger"]]);
  });

  it("a success is told once and handed on", async () => {
    const told: string[] = [];
    const onOk = vi.fn();
    const run = bulkAnswer<BulkAnswerState>(
      async () => ({ ok: { op: "deactivate", updated: 3 } }),
      {
        tell: (m) => told.push(m),
        describe: (ok) => `${ok.op}: ${ok.updated}`,
        onOk,
      },
    );
    await run({}, new FormData());
    expect(told).toEqual(["deactivate: 3"]);
    expect(onOk).toHaveBeenCalledWith({ op: "deactivate", updated: 3 });
  });

  it("both lists post their bar through it, by hand", () => {
    for (const path of [
      "src/components/admin/products-list.tsx",
      "src/components/admin/menu-list.tsx",
    ]) {
      const src = read(path);
      expect(src, path).toContain("bulkAnswer<");
      expect(src, path).toContain("useHandPost(formAction, pending)");
      expect(src, path).toContain("confirmPhrase={String(count)}");
    }
  });
});

describe("setProductActiveAction", () => {
  const form = (fields: Record<string, string>) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    return fd;
  };

  it("sets the state asked for and audits it", async () => {
    h.product = product();
    const res = await productActions.setProductActiveAction(
      null,
      form({ id: "prd-0001", isActive: "false" }),
    );
    expect(h.bulkUpdateProducts).toHaveBeenCalledWith(["prd-0001"], {
      kind: "deactivate",
    });
    expect(res).toMatchObject({
      ok: true,
      message: '"Sirena Espresso" mağazadan kaldırıldı (pasif).',
    });
    expect(h.safeAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "product",
        entityId: "prd-0001",
        payload: expect.objectContaining({ isActive: false }),
      }),
    );
  });

  it("refuses a flip without a state and a product that is gone", async () => {
    h.product = product();
    expect(
      await productActions.setProductActiveAction(
        null,
        form({ id: "prd-0001", isActive: "toggle" }),
      ),
    ).toMatchObject({ ok: false });
    h.product = null;
    expect(
      await productActions.setProductActiveAction(
        null,
        form({ id: "prd-0001", isActive: "true" }),
      ),
    ).toMatchObject({ ok: false, error: "Ürün bulunamadı; sayfayı yenile." });
    expect(h.bulkUpdateProducts).not.toHaveBeenCalled();
  });
});

describe("the product form asks before a reload drops it (CAT-30)", () => {
  const event = () => ({
    prevented: false,
    returnValue: undefined as unknown,
    preventDefault() {
      this.prevented = true;
    },
  });

  it("asks only once the operator changed something", () => {
    let fields = guard.formSignature([["name", "Sirena"]]);
    const g = guard.createUnsavedGuard(() => fields);
    const untouched = event();
    g.onBeforeUnload(untouched);
    expect(untouched.prevented).toBe(false);

    // An effect filled a field by itself: not the operator's change.
    fields = guard.formSignature([
      ["name", "Sirena"],
      ["slug", "sirena"],
    ]);
    const filled = event();
    g.onBeforeUnload(filled);
    expect(filled.prevented).toBe(false);

    g.touch();
    const changed = event();
    g.onBeforeUnload(changed);
    expect(changed.prevented).toBe(true);
    expect(changed.returnValue).toBe("");
    expect(g.dirty()).toBe(true);
  });

  it("a change typed back is no change", () => {
    let fields = guard.formSignature([["name", "Sirena"]]);
    const g = guard.createUnsavedGuard(() => fields);
    g.touch();
    fields = guard.formSignature([["name", "Sirena!"]]);
    expect(g.dirty()).toBe(true);
    fields = guard.formSignature([["name", "Sirena"]]);
    const e = event();
    g.onBeforeUnload(e);
    expect(e.prevented).toBe(false);
  });

  it("the wizard is guarded", () => {
    const src = read("src/components/admin/product-wizard.tsx");
    expect(src).toContain("useUnsavedGuard(formRef)");
    expect(src).toContain("ref={formRef}");
  });
});
