import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminNavGroup } from "@/components/admin/admin-sidebar";
import type { AdminRole } from "@/lib/admin/roles";

/**
 * The panel's information architecture (admin UI v2, UI-5): five groups,
 * items that own tabs (other existing pages, drawn as a strip by the
 * shell), a flat list for Personel and no nav chrome for the cashier. No
 * URL moved, so the guarantee that matters is that every role still
 * reaches exactly the pages it reached before, through an item or a tab.
 *
 * The nav is read the way the layout hands it to the sidebar (the sidebar
 * module is replaced by a recorder); the real sidebar renders below for
 * the markup.
 */

let pathname = "/admin";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
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
vi.mock("next/dynamic", async () => {
  const { NavIcon } = await import("@/components/admin/nav-icon");
  return { default: () => NavIcon };
});
vi.mock("next/font/google", () => ({
  Poppins: () => ({ variable: "font-poppins", className: "" }),
}));
vi.mock("@/app/admin/siparisler/actions", () => ({
  openOrderCountAction: vi.fn(async () => null),
}));
vi.mock("@/app/admin/mobil/karaoke/actions", () => ({
  karaokeTodayCountAction: vi.fn(async () => null),
}));
vi.mock("@/app/admin/ara/actions", () => ({ adminSearchAction: vi.fn() }));
vi.mock("@/app/admin/actions", () => ({ logoutAction: vi.fn() }));
vi.mock("@/components/admin/order-alerts", () => ({
  OrderAlerts: () => null,
}));

const session = vi.hoisted(() => ({ role: "owner" as string }));
vi.mock("@/lib/admin/auth", () => ({
  getAdminSession: async () => ({
    email: "x@laffogato.net",
    role: session.role,
    expiresAt: 0,
  }),
}));
vi.mock("@/lib/admin/flash", () => ({ readAdminFlash: async () => null }));

const captured = vi.hoisted(() => ({ props: null as unknown }));
vi.mock("@/components/admin/admin-sidebar", () => ({
  AdminSidebar: (props: unknown) => {
    captured.props = props;
    return null;
  },
}));

const AdminLayout = (await import("@/app/admin/layout")).default;
const sidebar = await vi.importActual<
  typeof import("@/components/admin/admin-sidebar")
>("@/components/admin/admin-sidebar");
const { ToastProvider } = await import("@/components/admin/ui/toast");
const { ADMIN_ICONS } = await import("@/components/admin/ui/icons");
const nav = await import("@/lib/admin/nav-match");
const { canAccess } = await import("@/lib/admin/roles");

const ROLES: AdminRole[] = ["owner", "manager", "staff", "cashier"];

async function navFor(role: AdminRole): Promise<AdminNavGroup[]> {
  session.role = role;
  captured.props = null;
  renderToStaticMarkup(
    await AdminLayout({ children: createElement("p", null, "PAGE") }),
  );
  const props = captured.props as { groups: AdminNavGroup[] } | null;
  if (!props) throw new Error(`no sidebar for ${role}`);
  return props.groups;
}

const NAV: Record<AdminRole, AdminNavGroup[]> = {
  owner: await navFor("owner"),
  manager: await navFor("manager"),
  staff: await navFor("staff"),
  cashier: await navFor("cashier"),
};

const items = (role: AdminRole) => NAV[role].flatMap((g) => g.items);
const hrefsOf = (role: AdminRole) =>
  new Set(
    items(role).flatMap((i) => [i.href, ...(i.tabs ?? []).map((t) => t.href)]),
  );

/**
 * What each role's nav reached on main before the regroup (29 entries in
 * six groups for the owner): the regroup moves entries into tabs, never
 * out of reach and never into a role's reach.
 */
const OWNER_BEFORE = [
  "/admin",
  "/admin/menu",
  "/admin/urunler",
  "/admin/kategoriler",
  "/admin/magaza-hero",
  "/admin/basin",
  "/admin/hikaye",
  "/admin/icerik",
  "/admin/anasayfa-hero",
  "/admin/mobil/slaytlar",
  "/admin/mobil/duyurular",
  "/admin/mobil/gonderiler",
  "/admin/mobil/canli-durum",
  "/admin/mobil/fal-bildirimleri",
  "/admin/mobil/ayarlar",
  "/admin/siparisler",
  "/admin/mobil/karaoke",
  "/admin/kasa",
  "/admin/masalar",
  "/admin/musteriler",
  "/admin/bulten",
  "/admin/bulten/kampanya",
  "/admin/promosyon",
  "/admin/stok-hareketleri",
  "/admin/raporlar",
  "/admin/hukuk",
  "/admin/olay-kaydi",
  "/admin/kullanicilar",
  "/admin/ayarlar",
];
const OWNER_ONLY = [
  "/admin/hukuk",
  "/admin/olay-kaydi",
  "/admin/kullanicilar",
  "/admin/ayarlar",
];
const BEFORE: Record<AdminRole, string[]> = {
  owner: OWNER_BEFORE,
  manager: OWNER_BEFORE.filter((h) => !OWNER_ONLY.includes(h)),
  staff: [
    "/admin",
    "/admin/siparisler",
    "/admin/mobil/karaoke",
    "/admin/kasa",
    "/admin/stok-hareketleri",
  ],
  cashier: ["/admin/kasa"],
};

describe("what each role sees", () => {
  it("owner 21 items in 5 groups, manager 18 in 5, staff 5 flat, cashier no chrome", () => {
    const groupTitles = ["Bugün", "Katalog", "Pazarlama", "İçerik", "Yönetim"];
    expect(NAV.owner.map((g) => g.title)).toEqual(groupTitles);
    expect(NAV.manager.map((g) => g.title)).toEqual(groupTitles);
    expect(items("owner")).toHaveLength(21);
    expect(items("manager")).toHaveLength(18);
    expect(items("staff").map((i) => i.label)).toEqual([
      "Genel bakış",
      "Siparişler",
      "Karaoke",
      "Kasa",
      "Stok",
    ]);
    expect(nav.navIsFlat(NAV.staff)).toBe(true);
    expect(nav.navIsFlat(NAV.manager)).toBe(false);
    expect(items("cashier").map((i) => i.href)).toEqual(["/admin/kasa"]);
    expect(nav.hasNavChrome(NAV.cashier)).toBe(false);
    for (const role of ["owner", "manager", "staff"] as const) {
      expect(nav.hasNavChrome(NAV[role]), role).toBe(true);
    }
  });

  it("every role reaches exactly the pages it reached before (items and tabs)", () => {
    expect(BEFORE.owner).toHaveLength(29);
    expect(BEFORE.manager).toHaveLength(25);
    for (const role of ROLES) {
      expect([...hrefsOf(role)].sort(), role).toEqual([...BEFORE[role]].sort());
    }
  });

  it("draws no empty group, and no item twice", () => {
    for (const role of ROLES) {
      for (const g of NAV[role])
        expect(g.items.length, g.title).toBeGreaterThan(0);
      const hrefs = items(role).map((i) => i.href);
      expect(new Set(hrefs).size, role).toBe(hrefs.length);
    }
  });

  it("filters tabs by role: an item opens its first permitted tab, one tab draws no strip", () => {
    const ayarlar = (role: AdminRole) =>
      items(role).find((i) => i.label === "Ayarlar");
    expect(ayarlar("owner")?.href).toBe("/admin/ayarlar");
    expect(ayarlar("owner")?.tabs?.map((t) => t.label)).toEqual([
      "Site",
      "Uygulama",
    ]);
    expect(ayarlar("manager")?.href).toBe("/admin/mobil/ayarlar");
    expect(ayarlar("manager")?.tabs?.map((t) => t.href)).toEqual([
      "/admin/mobil/ayarlar",
    ]);
    expect(
      nav.sectionTabsFor("/admin/mobil/ayarlar", items("manager")),
    ).toBeNull();
    expect(ayarlar("staff")).toBeUndefined();
    // Every tab a role is shown is a tab its section lets it open.
    for (const role of ROLES) {
      for (const item of items(role)) {
        expect(canAccess(item.section as never, role), item.href).toBe(true);
        for (const tab of item.tabs ?? []) {
          const section = (tab as { section?: string }).section;
          expect(canAccess(section as never, role), tab.href).toBe(true);
        }
      }
    }
  });

  it("visibleNav drops an item whose tabs are all closed, and the group it empties", () => {
    const groups = nav.visibleNav(
      [
        {
          title: "A",
          items: [
            {
              href: "/admin/ayarlar",
              label: "Ayarlar",
              section: "settings",
              tabs: [
                { href: "/admin/ayarlar", label: "Site", section: "settings" },
              ],
            },
          ],
        },
        {
          title: "B",
          items: [
            {
              href: "/admin/ayarlar",
              label: "Ayarlar",
              section: "settings",
              tabs: [
                { href: "/admin/ayarlar", label: "Site", section: "settings" },
                {
                  href: "/admin/mobil/ayarlar",
                  label: "Uygulama",
                  section: "mobileApp",
                },
              ],
            },
            { href: "/admin/kasa", label: "Kasa", section: "till" },
          ],
        },
      ],
      (section) => canAccess(section, "manager"),
    );
    expect(groups.map((g) => g.title)).toEqual(["B"]);
    expect(groups[0].items.map((i) => [i.href, i.section])).toEqual([
      ["/admin/mobil/ayarlar", "mobileApp"],
      ["/admin/kasa", "till"],
    ]);
  });

  it("takes the role check as a predicate: roles.ts imports nav-match, never the other way round", () => {
    const src = readFileSync("src/lib/admin/nav-match.ts", "utf8");
    const imports = src.match(/^import [^;]+;$/gm) ?? [];
    expect(imports).toEqual(['import type { AdminSection } from "./roles";']);
    expect(readFileSync("src/lib/admin/roles.ts", "utf8")).toContain(
      'import { withDenied } from "./nav-match";',
    );
  });
});

describe("every link lands on a page that lets the role in", () => {
  const ADMIN = join(process.cwd(), "src/app/admin");
  const pageOf = (href: string) =>
    join(ADMIN, href.replace(/^\/admin/, ""), "page.tsx");

  it("each item and tab href is a page whose requireRole is the item's or tab's section", () => {
    for (const role of ["owner", "manager"] as const) {
      for (const item of items(role)) {
        const links = item.tabs ?? [{ href: item.href, section: item.section }];
        for (const link of links as Array<{ href: string; section?: string }>) {
          const file = pageOf(link.href);
          expect(existsSync(file), link.href).toBe(true);
          const section =
            (link as { section?: string }).section ?? item.section;
          expect(readFileSync(file, "utf8"), link.href).toContain(
            `requireRole("${section}")`,
          );
        }
      }
    }
  });

  it("every admin page is reached by an item, a tab or one of their pages below", () => {
    const pages: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (name === "page.tsx")
          pages.push(
            `/admin${p.slice(ADMIN.length, -"/page.tsx".length)}`.replace(
              /\/$/,
              "",
            ),
          );
      }
    };
    walk(ADMIN);
    const EXEMPT = [
      "/admin/giris",
      "/admin/iki-asama",
      "/admin/2fa-kurulum",
      "/admin/ara",
      "/admin/[...rest]",
      "/admin/masalar/yazdir",
    ];
    const roots = [...hrefsOf("owner")];
    const unreached = pages.filter(
      (page) =>
        !EXEMPT.includes(page) &&
        !roots.some((r) =>
          r === "/admin"
            ? page === "/admin"
            : page === r || page.startsWith(`${r}/`),
        ),
    );
    expect(pages.length).toBeGreaterThan(50);
    expect(unreached).toEqual([]);
  });
});

describe("names and icons", () => {
  it("keeps the 29 old names findable (label, tab or keyword)", () => {
    const fold = (s: string) => s.toLocaleLowerCase("tr-TR");
    const words = items("owner").flatMap((i) => [
      i.label,
      ...(i.tabs ?? []).map((t) => t.label),
      ...(i.keywords ?? []),
    ]);
    const found = (name: string) => words.some((w) => fold(w) === fold(name));
    const OLD = [
      "Genel bakış",
      "Menü",
      "Ürünler",
      "Kategoriler",
      "Mağaza vitrini",
      "Basın",
      "Hikaye",
      "Site Metinleri",
      "Anasayfa slaytları",
      "Slaytlar",
      "Duyurular",
      "Gönderiler",
      "Canlı durum",
      "fA'L bildirimleri",
      "Uygulama ayarları",
      "Siparişler",
      "Karaoke",
      "Kasa · damga",
      "Masalar · QR",
      "Müşteriler",
      "Bülten",
      "Kampanya e-postası",
      "Promosyon",
      "Stok",
      "Raporlar",
      "Yasal belgeler",
      "Olay kaydı",
      "Kullanıcılar",
      "Ayarlar",
    ];
    expect(OLD).toHaveLength(29);
    expect(OLD.filter((n) => !found(n))).toEqual([]);
  });

  it("finds an item by its old, English or everyday word", () => {
    const owner = (word: string) =>
      items("owner")
        .filter((i) =>
          (i.keywords ?? []).some(
            (k) =>
              k.toLocaleLowerCase("tr-TR") === word.toLocaleLowerCase("tr-TR"),
          ),
        )
        .map((i) => i.label);
    expect(owner("Mağaza Hero")).toEqual(["Slaytlar"]);
    expect(owner("Stok Hareketleri")).toEqual(["Stok"]);
    expect(owner("hero")).toEqual(["Slaytlar"]);
    expect(owner("slider")).toEqual(["Slaytlar"]);
    expect(owner("banner")).toEqual(["Slaytlar"]);
    expect(owner("vitrin")).toEqual(["Slaytlar"]);
    expect(owner("shop")).toEqual(["Ürünler"]);
    expect(owner("crm")).toEqual(["Müşteriler"]);
    expect(owner("qr")).toEqual(["Masalar"]);
    expect(owner("kupon")).toEqual(["Promosyonlar"]);
    expect(owner("damga")).toEqual(["Kasa"]);
    expect(owner("abone")).toEqual(["Bülten"]);
    expect(owner("fal")).toEqual(["fA'L bildirimleri"]);
  });

  it("every item names an icon of the map, and no two items share one", () => {
    const keys = items("owner").map((i) => i.icon ?? i.section);
    for (const key of keys)
      expect(Object.keys(ADMIN_ICONS), key).toContain(key);
    expect(
      new Set(keys.map((k) => ADMIN_ICONS[k as keyof typeof ADMIN_ICONS])).size,
    ).toBe(keys.length);
  });
});

describe("tabs in the shell", () => {
  it("a tab's path lights the item that owns it", () => {
    const place = (p: string, role: AdminRole = "owner") => {
      const hit = nav.activeNavPlace(p, items(role));
      return hit ? [hit.item.label, hit.tab?.label ?? null] : null;
    };
    expect(place("/admin/urunler")).toEqual(["Ürünler", "Ürünler"]);
    expect(place("/admin/kategoriler/yeni")).toEqual([
      "Ürünler",
      "Kategoriler",
    ]);
    expect(place("/admin/magaza-hero/hero-3")).toEqual(["Slaytlar", "Mağaza"]);
    expect(place("/admin/mobil/slaytlar/yeni")).toEqual([
      "Slaytlar",
      "Uygulama",
    ]);
    // The longest tab wins inside an item, as it does between items.
    expect(place("/admin/bulten/kampanya/yeni")).toEqual([
      "Bülten",
      "Kampanyalar",
    ]);
    expect(place("/admin/bulten")).toEqual(["Bülten", "Aboneler"]);
    expect(place("/admin/mobil/ayarlar", "manager")).toEqual([
      "Ayarlar",
      "Uygulama",
    ]);
    expect(place("/admin/menu/yeni")).toEqual(["Kafe menüsü", null]);
    expect(place("/admin/ara")).toBeNull();
  });

  it("breadcrumbs name the tab when it is not the item's first", () => {
    const t = (p: string, role: AdminRole = "owner") =>
      nav.breadcrumbTrail(p, items(role)).map((c) => [c.label, c.href]);
    expect(t("/admin/urunler/yeni")).toEqual([
      ["Ürünler", "/admin/urunler"],
      ["Yeni", null],
    ]);
    expect(t("/admin/kategoriler/yeni")).toEqual([
      ["Ürünler", "/admin/urunler"],
      ["Kategoriler", "/admin/kategoriler"],
      ["Yeni", null],
    ]);
    expect(t("/admin/kategoriler")).toEqual([
      ["Ürünler", "/admin/urunler"],
      ["Kategoriler", null],
    ]);
    expect(t("/admin/magaza-hero/hero-3")).toEqual([
      ["Slaytlar", "/admin/anasayfa-hero"],
      ["Mağaza", "/admin/magaza-hero"],
      ["Ayrıntı", null],
    ]);
    expect(t("/admin/anasayfa-hero/yeni")).toEqual([
      ["Slaytlar", "/admin/anasayfa-hero"],
      ["Yeni", null],
    ]);
    // A subscriber's page sits under Bülten's second tab, Aboneler.
    expect(t("/admin/bulten/sub-1")).toEqual([
      ["Bülten", "/admin/bulten/kampanya"],
      ["Aboneler", "/admin/bulten"],
      ["Ayrıntı", null],
    ]);
    expect(t("/admin/bulten/kampanya/cmp-1")).toEqual([
      ["Bülten", "/admin/bulten/kampanya"],
      ["Ayrıntı", null],
    ]);
    // A product's view page sits under the item's first tab: no tab crumb.
    expect(t("/admin/urunler/prd-1/duzenle")).toEqual([
      ["Ürünler", "/admin/urunler"],
      ["Ayrıntı", "/admin/urunler/prd-1"],
      ["Düzenle", null],
    ]);
    // A manager's Ayarlar is Uygulama ayarları alone: no tab crumb.
    expect(t("/admin/mobil/ayarlar", "manager")).toEqual([["Ayarlar", null]]);
  });

  it("draws the strip only on a tab's own page", () => {
    const strip = (p: string) => {
      const s = nav.sectionTabsFor(p, items("owner"));
      return s ? [s.item.label, s.activeHref] : null;
    };
    expect(strip("/admin/urunler")).toEqual(["Ürünler", "/admin/urunler"]);
    expect(strip("/admin/kategoriler/")).toEqual([
      "Ürünler",
      "/admin/kategoriler",
    ]);
    expect(strip("/admin/bulten")).toEqual(["Bülten", "/admin/bulten"]);
    expect(strip("/admin/kategoriler/yeni")).toBeNull();
    expect(strip("/admin/magaza-hero/hero-3")).toBeNull();
    expect(strip("/admin/bulten/kampanya/yeni")).toBeNull();
    expect(strip("/admin/menu")).toBeNull();
    expect(strip("/admin")).toBeNull();
  });
});

const renderShell = (role: AdminRole) =>
  renderToStaticMarkup(
    createElement(
      ToastProvider,
      null,
      createElement(sidebar.AdminSidebar, {
        groups: NAV[role],
        email: "x@laffogato.net",
        roleLabel: role,
        landingPath: "/admin",
        logout: () => {},
        canSearch: false,
      }),
    ),
  );

describe("the shell's markup", () => {
  beforeEach(() => {
    pathname = "/admin";
  });

  it("draws the strip under the breadcrumbs, as links with the current one marked", () => {
    pathname = "/admin/kategoriler";
    const html = renderShell("owner");
    const strip = html.slice(
      html.indexOf('aria-label="Ürünler bölümleri"'),
      html.indexOf("</nav>", html.indexOf('aria-label="Ürünler bölümleri"')),
    );
    expect(strip).toMatch(
      /<a href="\/admin\/urunler" class="[^"]*\bmin-h-11\b/,
    );
    expect(strip).toMatch(/<a href="\/admin\/kategoriler" aria-current="page"/);
    expect(strip).not.toMatch(/<a href="\/admin\/urunler" aria-current/);
    // Each tab marks itself while its page loads, and the row scrolls on a
    // phone instead of wrapping.
    expect(
      strip.match(/data-link-pending|pointer-events-none absolute/g)?.length,
    ).toBe(2);
    expect(strip).toContain("overflow-x-auto");
    // Under the phone's breadcrumbs: the strip comes after them.
    expect(html.lastIndexOf('aria-label="Konum"')).toBeLessThan(
      html.indexOf('aria-label="Ürünler bölümleri"'),
    );
    // The item lights in the sidebar, not the tab's old entry.
    expect(html).toMatch(/<a href="\/admin\/urunler" aria-current="page"/);
    pathname = "/admin/kategoriler/yeni";
    expect(renderShell("owner")).not.toContain("bölümleri");
    pathname = "/admin/menu";
    expect(renderShell("owner")).not.toContain("bölümleri");
  });

  it("Personel's five items are one list, without group headers", () => {
    const html = renderShell("staff");
    const side = html.slice(html.indexOf("<aside"), html.indexOf("</aside>"));
    expect(side).not.toMatch(/-nav-\d+-title/);
    expect(side.match(/<ul /g)).toHaveLength(1);
    expect(side.match(/<li class="relative">/g)).toHaveLength(5);
    // The owner's are grouped.
    const owner = renderShell("owner");
    expect(owner).toContain('id="side-nav-0-title"');
  });

  it("opens with the skip link, aimed at the panel's main wrapper", () => {
    for (const role of ROLES) {
      const html = renderShell(role);
      const first = /<a [^>]*>/.exec(html)?.[0] ?? "";
      expect(first, role).toContain('href="#admin-main"');
      expect(html, role).toContain(">İçeriğe geç</a>");
    }
    expect(readFileSync("src/app/admin/layout.tsx", "utf8")).toContain(
      'id="admin-main"',
    );
  });

  it("the skip link's target draws no ring of its own: a click and an arrow key framed the whole page", async () => {
    // The wrapper takes focus from the skip link (tabindex -1), and so from
    // any click on the page's empty space too. The panel's one focus ring,
    // `[data-admin-root] :focus-visible` in globals.css, is unlayered, so
    // no Tailwind class turns it off: the first arrow key or PageDown after
    // such a click drew a 2 px espresso frame round the whole page (seen in
    // the browser). An inline style does.
    expect(readFileSync("src/app/globals.css", "utf8")).toMatch(
      /^\[data-admin-root\] :focus-visible \{\s+outline: 2px solid/m,
    );
    for (const role of ["owner", "cashier"] as const) {
      session.role = role;
      const html = renderToStaticMarkup(
        await AdminLayout({ children: createElement("p", null, "PAGE") }),
      );
      const wrapper = /<div id="admin-main"[^>]*>/.exec(html)?.[0] ?? "";
      expect(wrapper, role).toContain('tabindex="-1"');
      expect(wrapper, role).toContain('style="outline:none"');
    }
  });

  it("the skip link shows on focus: no sr-only, which the site's unlayered rule pins", () => {
    // globals.css has its own `.sr-only` outside any layer, and it beats
    // Tailwind's layered `focus:not-sr-only`: the focused link stayed a
    // clipped 32 px sliver (seen in the browser pass).
    expect(readFileSync("src/app/globals.css", "utf8")).toMatch(
      /^\.sr-only \{/m,
    );
    const html = renderShell("owner");
    const link = /<a [^>]*href="#admin-main"[^>]*>/.exec(html)?.[0] ?? "";
    expect(link).not.toContain("sr-only");
    expect(link).toMatch(/\bfixed\b/);
    expect(link).toContain("-translate-y-[calc(100%+1rem)]");
    expect(link).toContain("focus:translate-y-0");
    expect(link).toContain("min-h-11");
  });

  it("the regroup note: unseen until dismissed, never drawn on the server", () => {
    expect(sidebar.navNoteVisible("")).toBe(true);
    expect(sidebar.navNoteVisible("1")).toBe(false);
    expect(sidebar.navNoteVisible("garbage")).toBe(true);
    expect(sidebar.NAV_NOTE_KEY).toBe("laf_admin_nav_note_v1");
    // The server snapshot is "dismissed": no flash for whoever closed it.
    expect(renderShell("owner")).not.toContain("Menü sadeleşti");
    const src = readFileSync("src/components/admin/admin-sidebar.tsx", "utf8");
    // Only the grouped nav moved pages into tabs; Personel's flat list
    // gets no note about Kategoriler.
    expect(src).toContain("{!flat && <NavNote />}");
    expect(src).toMatch(
      /try \{\s+return window\.localStorage\.getItem\(NAV_NOTE_KEY\)/,
    );
    expect(src).toMatch(
      /try \{\s+window\.localStorage\.setItem\(NAV_NOTE_KEY, "1"\)/,
    );
    // Its close button is the panel's 44 px target, like the drawer's
    // (SHE-M03): it was a 36 px square.
    const close =
      /aria-label="Notu kapat"\s+className="([^"]+)"/.exec(src)?.[1] ?? "";
    expect(close).toMatch(/\bh-11\b/);
    expect(close).toMatch(/\bw-11\b/);
    const squares = [...src.matchAll(/\bh-(\d+) w-(\d+)\b/g)].map((m) => [
      Number(m[1]),
      Number(m[2]),
    ]);
    expect(squares.length).toBeGreaterThan(2);
    expect(squares.filter(([h, w]) => h < 11 || w < 11)).toEqual([]);
  });

  it("the sidebar file loads lucide only through the lazy icon module", () => {
    const src = readFileSync("src/components/admin/admin-sidebar.tsx", "utf8");
    expect(src).not.toContain("@/components/admin/ui/icons");
    expect(src).toMatch(
      /dynamic\(\s*\(\) =>\s*import\("@\/components\/admin\/nav-icon"\)/,
    );
    // The cashier's bar draws no icon at all (no chunk request).
    expect(renderShell("cashier")).not.toContain('class="lucide');
    expect(renderShell("staff")).toContain('class="lucide');
  });
});
