import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * Every destructive control on the screens this round touched opens a
 * confirm dialog (ConfirmButton / ActionModal: a trigger with
 * aria-haspopup="dialog") instead of posting on the first click: the app
 * content and shop hero deletes, the newsletter subscriber, categories,
 * promos, tables (Pasifleştir, Kodu yenile), panel users and baristas, and
 * the customer page (pasifleştir, coupon revoke, -1 stamp, Hesabı sil).
 *
 * The pages render here as the server would render them, with their data
 * mocked; the actions are stubs, the markup is what is checked.
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
}));
vi.mock("@/lib/admin/auth", () => ({ requireRole: vi.fn(async () => ({})) }));

const STAMP = "2026-10-10T10:00:00.000Z";

vi.mock("@/lib/admin/store", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/admin/store")>();
  const base = {
    sortOrder: 1,
    isActive: true,
    createdAt: STAMP,
    updatedAt: STAMP,
  };
  return {
    ...real,
    listAppAnnouncements: vi.fn(async () => [
      {
        ...base,
        id: "aann-1",
        kind: "info",
        title: "Yeni saatler",
        body: "x",
        startsAt: "",
        endsAt: "",
      },
    ]),
    listAppSlides: vi.fn(async () => [
      {
        ...base,
        id: "aslide-1",
        eyebrow: "",
        title: "Sonbahar",
        body: "x",
        ctaLabel: "",
        ctaRoute: "",
        tone: "paper",
        image: "",
        startsAt: "",
        endsAt: "",
      },
    ]),
    listAppPosts: vi.fn(async () => [
      {
        ...base,
        id: "apost-1",
        kind: "event",
        title: "Karaoke gecesi",
        body: "x",
        image: "",
        linkUrl: "",
        linkLabel: "",
        startsAt: "",
        endsAt: "",
        emailCampaignId: "",
      },
    ]),
    listShopHeroSlides: vi.fn(async () => [
      {
        ...base,
        id: "shero-1",
        title: "Yeni harman",
        subtitle: "",
        imageUrl: "",
        ctaLabel: "",
        ctaHref: "",
        textTheme: "light",
      },
    ]),
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
    listProducts: vi.fn(async () => [{ id: "prd-1", cat: "beans" }]),
    listStoryEvents: vi.fn(async () => [
      { ...base, id: "story-1", year: "1897", title: "Bologna", body: "x" },
    ]),
    listPress: vi.fn(async () => [
      { ...base, id: "press-1", name: "Monocle", quote: "x" },
    ]),
    listPromos: vi.fn(async () => [
      {
        id: "prm-1",
        code: "GUZ10",
        kind: "pct",
        value: 10,
        minSubtotalMinor: 0,
        usageLimit: 0,
        usageCount: 0,
        expiresAt: "",
        isActive: true,
        createdAt: STAMP,
        updatedAt: STAMP,
      },
    ]),
  };
});
vi.mock("@/lib/newsletter/store", () => ({
  listNewsletterSubscribers: vi.fn(async () => [
    {
      id: "nws-1",
      email: "ayse@ornek.com",
      name: "",
      source: "footer",
      isActive: true,
      confirmToken: "",
      createdAt: STAMP,
      consentAt: STAMP,
      consentIp: "",
      consentText: "",
    },
  ]),
}));
vi.mock("@/lib/admin/cafe-tables", () => ({
  listCafeTables: vi.fn(async () => [
    {
      id: "tbl-0001",
      code: "ABCDEFGH23",
      name: "Bahçe 1",
      sortOrder: 1,
      isActive: true,
      createdAt: STAMP,
      updatedAt: STAMP,
      rotatedAt: STAMP,
    },
    {
      id: "tbl-0002",
      code: "ABCDEFGH24",
      name: "Bahçe 2",
      sortOrder: 2,
      isActive: false,
      createdAt: STAMP,
      updatedAt: STAMP,
      rotatedAt: STAMP,
    },
  ]),
}));
vi.mock("@/lib/admin/home-hero", () => {
  const slide = (id: string, sortOrder: number, isActive = true) => ({
    id,
    sortOrder,
    isActive,
    startsAt: "",
    endsAt: "",
    kicker: "Ekim",
    titleLine1: `Slayt ${id}`,
    titleLine2: "",
    body: "x.",
    image: "/menu/matcha-latte-cut.webp",
    alt: "Latte",
    scene: "matcha",
    primaryLabel: "Kampanyalar",
    primaryAction: "",
    primaryHref: "/kampanyalar",
    secondaryLabel: "",
    secondaryAction: "",
    secondaryHref: "",
    createdAt: STAMP,
    updatedAt: STAMP,
  });
  return {
    listHomeHeroSlides: vi.fn(async () => [
      slide("hhero-1", 10),
      slide("hhero-2", 20, false),
    ]),
    homeSlidePhoto: (s: { image: string }) => s.image,
  };
});
vi.mock("@/lib/admin/cafe-table-qr", () => ({
  tableQrSvg: vi.fn(async () => "<svg></svg>"),
}));

// The actions themselves are tested in their own files; here they are stubs.
const stub = () => vi.fn(async () => ({ ok: true as const, message: "" }));
vi.mock("@/app/admin/mobil/duyurular/actions", () => ({
  deleteAnnouncementAction: stub(),
}));
vi.mock("@/app/admin/mobil/slaytlar/actions", () => ({
  deleteSlideAction: stub(),
}));
vi.mock("@/app/admin/mobil/gonderiler/actions", () => ({
  deletePostAction: stub(),
}));
vi.mock("@/app/admin/magaza-hero/actions", () => ({
  deleteSlideAction: stub(),
}));
vi.mock("@/app/admin/anasayfa-hero/actions", () => ({
  deleteHomeSlideAction: stub(),
  importDefaultHomeSlidesAction: stub(),
  moveHomeSlideAction: stub(),
  toggleHomeSlideAction: stub(),
}));
vi.mock("@/app/admin/bulten/actions", () => ({
  deactivateNewsletterAction: stub(),
  deleteNewsletterSubscriberAction: stub(),
}));
vi.mock("@/app/admin/kategoriler/actions", () => ({
  deleteCategoryAction: stub(),
}));
vi.mock("@/app/admin/hikaye/actions", () => ({
  createStoryAction: stub(),
  deleteStoryAction: stub(),
  updateStoryAction: stub(),
}));
vi.mock("@/app/admin/basin/actions", () => ({
  createPressAction: stub(),
  deletePressAction: stub(),
  updatePressAction: stub(),
}));
vi.mock("@/app/admin/promosyon/actions", () => ({
  deletePromoAction: stub(),
  setPromoActiveAction: stub(),
}));
vi.mock("@/app/admin/masalar/actions", () => ({
  rotateCafeTableCodeAction: stub(),
  setCafeTableActiveAction: stub(),
}));
vi.mock("@/app/admin/kullanicilar/actions", () => ({
  createAdminUserAction: stub(),
  deleteAdminUserAction: stub(),
  grantBaristaAction: stub(),
  resetAdminPasswordAction: stub(),
  revokeBaristaAction: stub(),
  saveAdminUserAction: stub(),
}));
vi.mock("@/app/admin/musteriler/actions", () => ({
  closeCustomerAccountAction: stub(),
  grantCustomerCouponAction: stub(),
  resendVerificationAction: stub(),
  revokeCustomerCouponAction: stub(),
  setCustomerActiveAction: stub(),
}));
vi.mock("@/app/admin/menu/actions", () => ({
  bulkMenuAction: vi.fn(async () => ({})),
  deleteMenuItemAction: stub(),
  setMenuItemActiveAction: stub(),
}));
vi.mock("@/app/admin/urunler/actions", () => ({
  bulkProductsAction: vi.fn(async () => ({})),
  deleteProductAction: stub(),
}));
vi.mock("@/app/admin/musteriler/[email]/actions", () => ({
  addCounterStampAction: stub(),
  reverseCounterStampAction: stub(),
}));

/** Every <button> whose text is `label`, as markup. */
function buttons(html: string, label: string): string[] {
  const out: string[] = [];
  const re = /<button\b[^>]*>([\s\S]*?)<\/button>/g;
  for (const m of html.matchAll(re)) {
    if (m[1].replace(/<[^>]+>/g, "").trim() === label) out.push(m[0]);
  }
  return out;
}

/**
 * `label` opens a dialog somewhere, and no button with it posts on its own:
 * each one opens a dialog or is switched off with its reason (aria-disabled).
 */
function expectConfirmed(html: string, label: string) {
  const found = buttons(html, label);
  expect(
    found.some((b) => b.includes('aria-haspopup="dialog"')),
    `no "${label}" dialog trigger`,
  ).toBe(true);
  for (const b of found) {
    expect(b, label).toMatch(/aria-haspopup="dialog"|aria-disabled="true"/);
    expect(b, label).not.toContain('type="submit"');
  }
}

type AsyncPage = (props: never) => Promise<ReturnType<typeof createElement>>;
async function renderPage(path: string, props: Record<string, unknown> = {}) {
  const mod = (await import(path)) as { default: AsyncPage };
  return renderToStaticMarkup(await mod.default(props as never));
}

describe("list pages", () => {
  it.each([
    ["@/app/admin/mobil/duyurular/page", {}],
    ["@/app/admin/mobil/slaytlar/page", {}],
    [
      "@/app/admin/mobil/gonderiler/page",
      { searchParams: Promise.resolve({}) },
    ],
    ["@/app/admin/magaza-hero/page", {}],
    ["@/app/admin/hikaye/page", {}],
    ["@/app/admin/basin/page", {}],
  ])("%s: Sil asks first", async (path, props) => {
    const html = await renderPage(path, props);
    expectConfirmed(html, "Sil");
  });

  it("anasayfa slaytları: Sil and the import ask first, reorder is one click", async () => {
    const html = await renderPage("@/app/admin/anasayfa-hero/page");
    expectConfirmed(html, "Sil");
    expectConfirmed(html, "Varsayılanları içe aktar");
    // ↑ only where there is a row above, ↓ only where there is one below
    // (the table and its phone cards each draw them).
    const labels = (re: RegExp) => [...new Set(html.match(re))];
    expect(labels(/aria-label="Öne al: [^"]+"/g)).toEqual([
      'aria-label="Öne al: Slayt hhero-2"',
    ]);
    expect(labels(/aria-label="Geriye al: [^"]+"/g)).toEqual([
      'aria-label="Geriye al: Slayt hhero-1"',
    ]);
    expect(html).toContain("Yayından kaldır");
    expect(html).toContain("Yayına al");
    expect(html).toContain("Sitede 1 slayt dönüyor.");
  });

  it("bülten: Pasifleştir and Sil both ask first", async () => {
    const html = await renderPage("@/app/admin/bulten/page");
    expectConfirmed(html, "Pasifleştir");
    expectConfirmed(html, "Sil");
  });

  it("kategoriler: Sil asks first, and says why it is off while products use it", async () => {
    const html = await renderPage("@/app/admin/kategoriler/page");
    expectConfirmed(html, "Sil");
    // Çekirdek holds a product: its Sil is disabled with the reason.
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain("Bu kategoride 1 ürün var.");
    expect(html).not.toContain("Shop · Tassonomia");
  });

  it("promosyon: Sil asks first; Aktif / Pasif is one click", async () => {
    const html = await renderPage("@/app/admin/promosyon/page");
    expectConfirmed(html, "Sil");
    const toggle = buttons(html, "Pasife al");
    expect(toggle.length).toBeGreaterThan(0);
    expect(toggle[0]).toContain('type="submit"');
  });

  it("masalar: Pasifleştir and Kodu yenile ask first, Etkinleştir does not", async () => {
    const html = await renderPage("@/app/admin/masalar/page");
    expectConfirmed(html, "Pasifleştir");
    expectConfirmed(html, "Kodu yenile");
    const on = buttons(html, "Etkinleştir");
    expect(on).toHaveLength(1);
    expect(on[0]).not.toContain("aria-haspopup");
    expect(html).not.toContain("window.confirm");
  });
});

describe("users and baristas", () => {
  it("Kullanıcıyı sil and Yetkiyi kaldır ask first", async () => {
    const { AdminUserRow, BaristaRow } =
      await import("@/app/admin/kullanicilar/user-forms");
    const user = renderToStaticMarkup(
      createElement(AdminUserRow, {
        user: {
          email: "kasa@laffogato.net",
          name: "Eda",
          role: "cashier",
          isActive: true,
          updatedAt: STAMP,
        },
        minPasswordLength: 12,
      }),
    );
    expectConfirmed(user, "Kullanıcıyı sil");
    const barista = renderToStaticMarkup(
      createElement(BaristaRow, {
        barista: {
          email: "bora@ornek.com",
          name: "Bora",
          isActive: true,
          grantedBy: "patron@laffogato.net",
          grantedAt: STAMP,
          updatedAt: STAMP,
        },
      }),
    );
    expectConfirmed(barista, "Yetkiyi kaldır");
  });
});

describe("customer page", () => {
  it("pasifleştir and Hesabı sil ask first; re-activation is one click", async () => {
    const { CustomerActions } =
      await import("@/components/admin/customer-actions");
    const active = renderToStaticMarkup(
      createElement(CustomerActions, {
        email: "uye@ornek.com",
        isActive: true,
        emailVerified: true,
      }),
    );
    expectConfirmed(active, "Hesabı pasifleştir");
    expectConfirmed(active, "Hesabı sil");
    const closed = renderToStaticMarkup(
      createElement(CustomerActions, {
        email: "uye@ornek.com",
        isActive: false,
        emailVerified: true,
      }),
    );
    const back = buttons(closed, "Hesabı yeniden aktifleştir");
    expect(back).toHaveLength(1);
    expect(back[0]).not.toContain("aria-haspopup");
  });

  it("coupon revoke and the -1 stamp ask first", async () => {
    const { CustomerCoupons } =
      await import("@/components/admin/customer-coupons");
    const coupons = renderToStaticMarkup(
      createElement(CustomerCoupons, {
        email: "uye@ornek.com",
        coupons: [
          {
            id: "cpn-1",
            code: "LAF-HOS",
            kind: "fixed",
            value: 5000,
            source: "admin",
            isActive: true,
            redeemedAt: "",
            expiresAt: "",
            createdAt: STAMP,
          },
        ],
      } as never),
    );
    expectConfirmed(coupons, "Sil");

    const { CustomerStamps } =
      await import("@/components/admin/customer-stamps");
    const stamps = renderToStaticMarkup(
      createElement(CustomerStamps, {
        email: "uye@ornek.com",
        canReverse: true,
        loyalty: {
          tierLabel: "Bronz",
          stamps: 3,
          stampTarget: 6,
          rewardsReady: 0,
          lifetimeStamps: 3,
        },
        history: [],
      } as never),
    );
    expectConfirmed(stamps, "−1 düzeltme");
  });
});

describe("catalog lists", () => {
  const item = (over: Record<string, unknown>) => ({
    id: "mnu-0001",
    categoryKey: "matcha",
    name: "Çilekli Matcha",
    desc: "Taze çilek",
    priceMinor: 24_500,
    priceMinorL: 0,
    hue: "rose",
    image: "",
    tags: [],
    isActive: true,
    sortOrder: 0,
    updatedAt: STAMP,
    ...over,
  });

  it("menu: Tükendi / Satışa aç is one click, Sil asks first", async () => {
    const { MenuList } = await import("@/components/admin/menu-list");
    const html = renderToStaticMarkup(
      createElement(MenuList, {
        itemsByCategory: {
          matcha: [item({}), item({ id: "mnu-0002", isActive: false })],
        },
        categoryKeys: ["matcha"],
        categoryLabels: { matcha: "Matcha bar" },
      } as never),
    );
    expectConfirmed(html, "Sil");
    for (const label of ["Tükendi", "Satışa aç"]) {
      const found = buttons(html, label);
      expect(found.length, label).toBeGreaterThan(0);
      for (const b of found) {
        expect(b).toContain('type="submit"');
        expect(b).not.toContain("aria-haspopup");
      }
    }
  });

  it("products: Sil asks first", async () => {
    const { ProductsList } = await import("@/components/admin/products-list");
    const html = renderToStaticMarkup(
      createElement(ProductsList, {
        products: [
          {
            id: "prd-0001",
            name: "Sirena Espresso",
            tag: "Çekirdek",
            cat: "beans",
            sku: "SIRE",
            images: [],
            variants: [],
            priceMinor: 32_000,
            compareAtPriceMinor: 0,
            stock: 10,
            lowStockThreshold: 3,
            isActive: true,
            featured: false,
            isNew: false,
          },
        ],
        categories: [],
        labelByCat: { beans: "Çekirdek" },
      } as never),
    );
    expectConfirmed(html, "Sil");
  });
});
