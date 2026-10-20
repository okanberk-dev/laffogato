import { readFileSync } from "node:fs";

import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * A list's saved views (admin UI v2, UI-11, design §5 #11): what a view may
 * keep of a list's address, its name, where it is stored and for whom, how
 * saving, the default and deleting behave, how a stored list is read back,
 * and the FilterBar's server markup (unchanged, with or without `views`).
 * The rules are pure (lib/admin/saved-views.ts) and run here in node; the
 * menu, the dialog and localStorage were checked in a scripted browser (the
 * PR's checklist).
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
  useLinkStatus: () => ({ pending: false }),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/siparisler",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  unstable_rethrow: vi.fn(),
}));
vi.mock("next/font/google", () => ({
  Poppins: () => ({ variable: "font-poppins", className: "" }),
}));
vi.mock("@/app/admin/siparisler/actions", () => ({
  openOrderSignalAction: vi.fn(async () => ({ count: null, cursor: "" })),
}));
vi.mock("@/app/admin/mobil/karaoke/actions", () => ({
  karaokeTodaySignalAction: vi.fn(async () => ({ count: null, cursor: "" })),
}));
vi.mock("@/app/admin/ara/actions", () => ({ adminSearchAction: vi.fn() }));
vi.mock("@/app/admin/actions", () => ({ logoutAction: vi.fn() }));
vi.mock("@/components/admin/order-alerts", () => ({
  OrderAlerts: () => null,
}));
const session = vi.hoisted(() => ({
  role: "owner" as string,
  email: "x@laffogato.net",
}));
vi.mock("@/lib/admin/auth", () => ({
  getAdminSession: async () => ({
    email: session.email,
    role: session.role,
    expiresAt: 0,
  }),
}));
vi.mock("@/lib/admin/flash", () => ({ readAdminFlash: async () => null }));
vi.mock("@/components/admin/admin-sidebar", () => ({
  AdminSidebar: () => null,
}));

process.env.ADMIN_SESSION_SECRET ??=
  "test-secret-for-the-palette-key-0123456789";

const lib = await import("@/lib/admin/saved-views");
const store = await import("@/components/admin/ui/saved-views-store");
const { pageAccountKey } =
  await import("@/components/admin/ui/saved-views-key");
const { FilterBar } = await import("@/components/admin/ui/filter-bar");
const { SavedViews, focusMenuButton, NOT_KEPT } =
  await import("@/components/admin/ui/saved-views");
const { ORDER_FILTER_FIELDS } = await import("@/lib/admin/order-filters");
const { AUDIT_FILTER_FIELDS } = await import("@/lib/admin/audit-view");
const { parseFilters } = await import("@/lib/admin/list-params");
const { paletteAccountKey } = await import("@/lib/admin/palette-account");
const AdminLayout = (await import("@/app/admin/layout")).default;

const ORDERS = { searchNames: ["q"], pageParam: "sayfa" } as const;
const PATH = "/admin/siparisler";
const A = "0123456789abcdef";
const B = "fedcba9876543210";
const q = (sp: Record<string, string> | URLSearchParams) =>
  lib.viewQuery(sp, ORDERS);

const state = (
  views: Array<[string, string]>,
  defaultQuery: string | null = null,
) => ({
  views: views.map(([name, query]) => ({ name, query })),
  defaultQuery,
});

describe("what a view keeps of the address", () => {
  it("the tab, the dropdowns and the sort, in one spelling", () => {
    expect(
      q({ yon: "asc", durum: "acik", teslimat: "table", sirala: "tarih" }),
    ).toBe("durum=acik&sirala=tarih&teslimat=table&yon=asc");
    expect(q({ teslimat: "table", durum: "acik" })).toBe(
      q({ durum: "acik", teslimat: "table" }),
    );
    expect(lib.viewHref(PATH, "durum=acik")).toBe(
      "/admin/siparisler?durum=acik",
    );
    expect(lib.viewHref(PATH, "")).toBe(PATH);
  });

  it("never the search, the page or the one-time notice", () => {
    expect(q({ q: "ayse", durum: "paid", sayfa: "3", denied: "1" })).toBe(
      "durum=paid",
    );
    // `q` goes on any list; the list's own boxes go by their names.
    const audit = {
      searchNames: AUDIT_FILTER_FIELDS.flatMap((f) =>
        f.type === "search" ? [f.name] : [],
      ),
      pageParam: "sayfa",
    };
    expect(audit.searchNames).toEqual(["actor", "entityId"]);
    expect(
      lib.viewQuery(
        { actor: "ali", entityId: "ord-1", q: "x", entity: "order" },
        audit,
      ),
    ).toBe("entity=order");
    expect(
      lib.viewQuery(
        { s: "2", kanal: "web" },
        { searchNames: [], pageParam: "s" },
      ),
    ).toBe("kanal=web");
  });

  it("drops any value that reads as an e-mail or a phone, whatever its name", () => {
    for (const value of [
      "ayse@laffogato.net",
      "a@b",
      "0532 123 45 67",
      "05321234567",
      "+90 (532) 123-45-67",
      "532.123.45.67",
      "ａ＠ｂ.co",
      "０５３２１２３４５６７",
    ]) {
      expect(q({ kanal: value, durum: "paid" }), value).toBe("durum=paid");
    }
    // Six digits is not a phone.
    expect(q({ no: "123456" })).toBe("no=123456");
  });

  it("drops a date as well (piiLike counts it), so a range is never kept", () => {
    expect(q({ bas: "2026-10-01", bit: "2026-10-31", kanal: "web" })).toBe(
      "kanal=web",
    );
  });

  it("drops odd names, empty, long and control values; the first of a repeated name; at most 16", () => {
    expect(
      q({ "1x": "a", "a b": "c", _path: "/x", $ACTION_ID: "y", ş: "z" }),
    ).toBe("");
    expect(q({ kanal: "" })).toBe("");
    expect(q({ kanal: "x".repeat(101) })).toBe("");
    expect(q({ kanal: "x".repeat(100) })).toBe(`kanal=${"x".repeat(100)}`);
    expect(q({ kanal: "we\u0000b" })).toBe("");
    expect(q(new URLSearchParams("kanal=web&kanal=app"))).toBe("kanal=web");
    const many: Record<string, string> = {};
    for (let i = 0; i < 20; i += 1)
      many[`p${String(i).padStart(2, "0")}`] = "1";
    expect(lib.viewParams(many, ORDERS)).toHaveLength(16);
  });
});

describe("a view's name", () => {
  it("is kept on one line, without invisible characters", () => {
    expect(lib.cleanViewName("  Masa\n  siparişleri ")).toEqual({
      ok: true,
      name: "Masa siparişleri",
    });
    expect(lib.cleanViewName("Ma​sa")).toEqual({ ok: true, name: "Masa" });
  });

  it("is at most 30 characters, and not empty", () => {
    expect(lib.SAVED_VIEW_NAME_MAX).toBe(30);
    expect(lib.cleanViewName("ğ".repeat(30)).ok).toBe(true);
    expect(lib.cleanViewName("ğ".repeat(31))).toEqual({
      ok: false,
      error: "Ad en fazla 30 karakter olabilir.",
    });
    for (const raw of ["", "   ", null, 42, undefined]) {
      expect(lib.cleanViewName(raw).ok).toBe(false);
    }
  });

  it("never an e-mail or a phone", () => {
    for (const raw of ["Ayşe ayse@x.co", "0532 123 45 67 siparişleri"]) {
      expect(lib.cleanViewName(raw)).toEqual({
        ok: false,
        error: "Adda e-posta ya da telefon numarası olmasın.",
      });
    }
  });
});

describe("where the views are kept", () => {
  it("per account and per list", () => {
    expect(lib.savedViewsStorageKey(A, "orders")).toBe(
      `laf_admin_views_v1:${A}:orders`,
    );
    expect(lib.savedViewsStorageKey(B, "orders")).not.toBe(
      lib.savedViewsStorageKey(A, "orders"),
    );
    expect(lib.savedViewsStorageKey(A, "karaoke")).not.toBe(
      lib.savedViewsStorageKey(A, "orders"),
    );
  });

  it("nowhere without the layout's account key or with an odd list key", () => {
    for (const account of [
      "",
      "ayse@laffogato.net",
      "0123456789ABCDEF",
      "abc",
    ]) {
      expect(lib.savedViewsStorageKey(account, "orders"), account).toBeNull();
    }
    for (const list of ["", "Orders", "a b", "x".repeat(33), "../x"]) {
      expect(lib.savedViewsStorageKey(A, list), list).toBeNull();
    }
  });

  it("under the palette's HMAC of the e-mail, never the address", () => {
    const key = lib.savedViewsStorageKey(
      paletteAccountKey("ayse@laffogato.net"),
      "orders",
    );
    expect(key).toMatch(/^laf_admin_views_v1:[0-9a-f]{16}:orders$/);
    expect(key).not.toContain("ayse");
  });
});

describe("saving, the default and deleting", () => {
  it("adds up to eight, then says why not", () => {
    let s: ReturnType<typeof lib.parseSavedViews> = lib.NO_SAVED_VIEWS;
    for (let i = 1; i <= 8; i += 1) {
      const r = lib.saveView(s, `Görünüm ${i}`, `durum=d${i}`);
      if (!r.ok) throw new Error(r.error);
      s = r.state;
    }
    expect(s.views).toHaveLength(8);
    expect(lib.saveView(s, "Dokuzuncu", "durum=d9")).toEqual({
      ok: false,
      error: "En fazla 8 görünüm kaydedilir. Yenisi için birini sil.",
    });
    // A name or a query already there is not a ninth.
    expect(lib.saveView(s, "görünüm 3", "durum=d9").ok).toBe(true);
    expect(lib.saveView(s, "Başka", "durum=d3").ok).toBe(true);
  });

  it("a name already used is that view, with the new query and its default", () => {
    const s = state(
      [
        ["İade", "durum=refunded"],
        ["Masa", "teslimat=table"],
      ],
      "durum=refunded",
    );
    const r = lib.saveView(s, "iade", "durum=refunded&kanal=app");
    if (!r.ok) throw new Error(r.error);
    expect(r.state).toEqual(
      state(
        [
          ["iade", "durum=refunded&kanal=app"],
          ["Masa", "teslimat=table"],
        ],
        "durum=refunded&kanal=app",
      ),
    );
  });

  it("a query already saved is renamed; one name and one query per view", () => {
    const s = state([
      ["Masa", "teslimat=table"],
      ["Kargo", "teslimat=shipping"],
    ]);
    const renamed = lib.saveView(s, "Masaya servis", "teslimat=table");
    if (!renamed.ok) throw new Error(renamed.error);
    expect(renamed.state.views.map((v) => v.name)).toEqual([
      "Masaya servis",
      "Kargo",
    ]);
    // "Kargo" takes Masa's query: the old Masa entry goes, no twin is left.
    const moved = lib.saveView(s, "Kargo", "teslimat=table");
    if (!moved.ok) throw new Error(moved.error);
    expect(moved.state.views).toEqual([
      { name: "Kargo", query: "teslimat=table" },
    ]);
  });

  it("refuses a bare list and a bad name", () => {
    expect(lib.saveView(lib.NO_SAVED_VIEWS, "Hepsi", "")).toEqual({
      ok: false,
      error: "Kaydedilecek bir sekme, süzgeç ya da sıralama yok.",
    });
    expect(lib.saveView(lib.NO_SAVED_VIEWS, " ", "durum=paid").ok).toBe(false);
  });

  it("the default is one of the views, or none; deleting it clears it", () => {
    const s = state([
      ["Masa", "teslimat=table"],
      ["Kargo", "teslimat=shipping"],
    ]);
    const d = lib.setDefaultView(s, "teslimat=shipping");
    expect(d.defaultQuery).toBe("teslimat=shipping");
    expect(lib.setDefaultView(d, "durum=paid")).toBe(d);
    expect(lib.setDefaultView(d, null).defaultQuery).toBeNull();
    expect(lib.removeView(d, "teslimat=shipping")).toEqual(
      state([["Masa", "teslimat=table"]]),
    );
    expect(lib.removeView(d, "teslimat=table").defaultQuery).toBe(
      "teslimat=shipping",
    );
  });
});

describe("reading the stored views back", () => {
  it("anything that is not a list of views is none", () => {
    for (const raw of [
      null,
      "",
      "{",
      "[]",
      "null",
      '"x"',
      '{"views":{}}',
      '{"views":[1,null,"x",[]]}',
    ]) {
      expect(lib.parseSavedViews(raw, ORDERS), String(raw)).toEqual(
        lib.NO_SAVED_VIEWS,
      );
    }
  });

  it("an edited entry loses what a view may not keep, through the same rules", () => {
    const raw = JSON.stringify({
      views: [
        { name: "Ayşe", query: "q=ayse&durum=paid&kanal=a%40b.co&sayfa=4" },
        { name: "Telefon", query: "teslimat=05321234567" },
        { name: "a@b.co", query: "durum=shipped" },
        { name: "", query: "durum=preparing" },
        { name: "Twin", query: "durum=paid" },
        { name: "ayşe", query: "teslimat=table" },
        { name: 7, query: "durum=completed" },
        { name: "Kargo", query: "?teslimat=shipping" },
      ],
      default: "kanal=a%40b.co&durum=paid",
    });
    expect(lib.parseSavedViews(raw, ORDERS)).toEqual(
      state(
        [
          ["Ayşe", "durum=paid"],
          ["Kargo", "teslimat=shipping"],
        ],
        "durum=paid",
      ),
    );
  });

  it("reads eight at most, and forgets a default that is not one of them", () => {
    const views = Array.from({ length: 10 }, (_, i) => ({
      name: `V${i}`,
      query: `durum=d${i}`,
    }));
    const read = lib.parseSavedViews(
      JSON.stringify({ views, default: "durum=d9" }),
      ORDERS,
    );
    expect(read.views).toHaveLength(8);
    expect(read.defaultQuery).toBeNull();
  });

  it("what is written is what is read", () => {
    const s = state(
      [
        ["Masa siparişleri", "durum=acik&teslimat=table"],
        ["Kargoya verilecek", "durum=paid&teslimat=shipping"],
      ],
      "durum=paid&teslimat=shipping",
    );
    expect(lib.parseSavedViews(lib.serializeSavedViews(s), ORDERS)).toEqual(s);
    expect(lib.serializeSavedViews(state([]))).toBe('{"views":[]}');
  });
});

describe("the default view on opening the list", () => {
  const s = state([["Masa", "teslimat=table"]], "teslimat=table");

  it("opens on a bare address with no remembered search", () => {
    expect(lib.defaultViewHref(s, PATH, {}, false)).toBe(
      "/admin/siparisler?teslimat=table",
    );
  });

  it("not over anything in the address, a search, or without a default", () => {
    for (const sp of [{ durum: "acik" }, { sirala: "tarih" }, { sayfa: "2" }]) {
      expect(lib.defaultViewHref(s, PATH, sp, false), JSON.stringify(sp)).toBe(
        null,
      );
    }
    expect(lib.defaultViewHref(s, PATH, {}, true)).toBeNull();
    expect(
      lib.defaultViewHref(state([["Masa", "teslimat=table"]]), PATH, {}, false),
    ).toBeNull();
  });
});

describe("the menu", () => {
  it("a bare list: nothing to save yet", () => {
    expect(lib.viewsMenu(lib.NO_SAVED_VIEWS, PATH, "")).toEqual({
      label: "Görünümler",
      entries: [],
      here: null,
      hereIsDefault: false,
      save: "plain",
    });
  });

  it("an unsaved view can be saved, until there are eight", () => {
    expect(lib.viewsMenu(lib.NO_SAVED_VIEWS, PATH, "durum=paid").save).toBe(
      "save",
    );
    const full = state(
      Array.from({ length: 8 }, (_, i) => [`V${i}`, `durum=d${i}`]),
    );
    expect(lib.viewsMenu(full, PATH, "durum=paid").save).toBe("full");
  });

  it("the open saved view names the button and is marked", () => {
    const s = state(
      [
        ["Masa", "teslimat=table"],
        ["Kargo", "teslimat=shipping"],
      ],
      "teslimat=table",
    );
    const menu = lib.viewsMenu(s, PATH, "teslimat=table");
    expect(menu.label).toBe("Görünüm: Masa");
    expect(menu.here).toEqual({ name: "Masa", query: "teslimat=table" });
    expect(menu.hereIsDefault).toBe(true);
    expect(menu.entries).toEqual([
      {
        name: "Masa",
        href: "/admin/siparisler?teslimat=table",
        isDefault: true,
        open: true,
        ariaLabel: "Masa, varsayılan, açık",
      },
      {
        name: "Kargo",
        href: "/admin/siparisler?teslimat=shipping",
        isDefault: false,
        open: false,
        ariaLabel: "Kargo",
      },
    ]);
    expect(lib.viewsMenu(s, PATH, "teslimat=shipping").hereIsDefault).toBe(
      false,
    );
  });
});

describe("the browser's storage", () => {
  const memory = () => {
    const m = new Map<string, string>();
    return {
      m,
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
    };
  };
  const refusing = {
    getItem: () => {
      throw new Error("SecurityError");
    },
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
    removeItem: () => {
      throw new Error("SecurityError");
    },
  };

  it("reads and writes one key; none left removes it", () => {
    const mem = memory();
    const key = `laf_admin_views_v1:${A}:orders`;
    const s = state([["Masa", "teslimat=table"]]);
    expect(store.writeViews(key, s, mem)).toBe(true);
    expect(store.readViews(key, mem)).toBe(lib.serializeSavedViews(s));
    expect(store.writeViews(key, state([]), mem)).toBe(true);
    expect(mem.m.has(key)).toBe(false);
    expect(store.readViews(key, mem)).toBe("");
    expect(store.readViews(null, mem)).toBe("");
  });

  it("a browser that refuses storage leaves the menu empty, never a throw", () => {
    expect(store.readViews("k", refusing)).toBe("");
    expect(
      store.writeViews("k", state([["Masa", "teslimat=table"]]), refusing),
    ).toBe(false);
    expect(store.writeViews("k", state([]), null)).toBe(false);
  });

  it("a refused write names what refuses one, not a private window", () => {
    // Private windows write to localStorage today (the view goes when the
    // window closes): blaming them sent the operator after the wrong cause.
    expect(NOT_KEPT).toBe(
      "Kaydedilemedi: tarayıcı bu siteye veri yazdırmıyor (site verisi kapalı ya da yer dolu).",
    );
    const doc = readFileSync("docs/ADMIN.md", "utf8");
    const section = doc.slice(doc.indexOf("## Kayıtlı görünümler"));
    expect(section).not.toMatch(/Gizli pencerede[^.]*kaydedilemez/);
    expect(section).toMatch(
      /Gizli pencerede kaydedilen\s+görünüm o pencere kapanınca gider\./,
    );
  });

  it("the account key is the admin root's, if it is one", () => {
    const root = (value: string | null) => ({
      querySelector: (sel: string) =>
        sel === "[data-admin-root]"
          ? ({ getAttribute: () => value } as unknown as Element)
          : null,
    });
    expect(pageAccountKey(root(A))).toBe(A);
    expect(pageAccountKey(root("ayse@laffogato.net"))).toBe("");
    expect(pageAccountKey(root(null))).toBe("");
    expect(pageAccountKey({ querySelector: () => null })).toBe("");
  });
});

describe("the markup", () => {
  const bar = (
    sp: Record<string, string>,
    extra: Record<string, unknown> = {},
  ) =>
    renderToStaticMarkup(
      createElement(FilterBar, {
        fields: ORDER_FILTER_FIELDS,
        searchParams: sp,
        values: parseFilters(sp, ORDER_FILTER_FIELDS),
        pathname: PATH,
        label: "Sipariş filtreleri",
        ...extra,
      }),
    );

  it("the bar's server markup is the same with views: nothing before the browser", () => {
    const cases: Array<Record<string, string>> = [
      {},
      { durum: "acik", kanal: "app" },
      { q: "ayse", teslimat: "table", bas: "2026-10-01" },
    ];
    for (const sp of cases) {
      const plain = bar(sp);
      expect(bar(sp, { views: { key: "orders" } })).toBe(plain);
      expect(plain).not.toContain("Görünüm");
    }
  });

  it("the menu itself is a details menu, its save turned off on a bare list", () => {
    const menu = (address: Record<string, string>) =>
      renderToStaticMarkup(
        createElement(SavedViews, {
          storageKey: `laf_admin_views_v1:${A}:orders`,
          pathname: PATH,
          address,
          fields: ORDER_FILTER_FIELDS,
          values: parseFilters(address, ORDER_FILTER_FIELDS),
          pageParam: "sayfa",
        }),
      );
    const bare = menu({});
    // The wrapper is focusMenuButton's root: `contents`, no box of its own.
    expect(bare).toMatch(/^<div class="contents"><details/);
    expect(bare).toContain("<span>Görünümler</span>");
    expect(bare).toContain('aria-disabled="true"');
    expect(bare).toContain("Önce bir sekme, süzgeç ya da sıralama seç.");
    const filtered = menu({ durum: "acik", teslimat: "table" });
    expect(filtered).toContain('aria-haspopup="dialog"');
    expect(filtered).toContain("Bu görünümü kaydet");
    expect(filtered).not.toContain('aria-disabled="true"');
  });

  it("hands the keyboard back to the menu button after a save, a delete or the default", () => {
    // Each swaps the menu's items: the dialog's trigger leaves the page
    // with its dialog before ActionModal can return the focus, and
    // "Varsayılan yap" sits in a menu that closes on the click. The
    // keyboard was left on <body> (checked in a browser: the kit's own
    // ActionModal in an ActionMenu lands on the menu's button).
    const focused: string[] = [];
    const root = {
      querySelector: (sel: string) =>
        sel === "summary" ? { focus: () => focused.push(sel) } : null,
    } as unknown as ParentNode;
    focusMenuButton(root);
    expect(focused).toEqual(["summary"]);
    expect(() => focusMenuButton(null)).not.toThrow();
    expect(() => focusMenuButton({ querySelector: () => null })).not.toThrow();

    const src = readFileSync("src/components/admin/ui/saved-views.tsx", "utf8");
    expect(src).toMatch(/<div ref=\{menuRoot\} className="contents">/);
    expect(src).toMatch(
      /const refocus = \(\) => focusMenuButton\(menuRoot\.current\);/,
    );
    // The save and the delete dialogs, and the default's toggle.
    expect(src.match(/onSuccess=\{refocus\}/g)).toHaveLength(2);
    expect(src).toMatch(
      /const toggleDefault = \(\) => \{\s+if \(!here\) return;\s+refocus\(\);/,
    );
  });

  it("the bar loads the menu as a chunk of its own, never with the page", () => {
    const bar = readFileSync("src/components/admin/ui/filter-bar.tsx", "utf8");
    expect(bar).toMatch(/import\("\.\/saved-views"\)/);
    expect(bar).not.toMatch(/from "\.\/saved-views(-store)?"/);
    // The always-loaded half needs only the key, not the rules or storage.
    const key = readFileSync(
      "src/components/admin/ui/saved-views-key.ts",
      "utf8",
    );
    expect(key).not.toMatch(/"@\/lib\/admin\/saved-views"|saved-views-store/);
    const keyLib = readFileSync("src/lib/admin/saved-views-key.ts", "utf8");
    expect(keyLib).not.toMatch(
      /from "\.\/(saved-views|pii-like|text-fold|list-params)"/,
    );
  });

  it("the orders list adopts it, with one prop", () => {
    const page = readFileSync("src/app/admin/siparisler/page.tsx", "utf8");
    expect(page).toContain('views={{ key: "orders" }}');
  });
});

describe("the layout's account key on the admin root", () => {
  const rootOf = async (role: string, email: string) => {
    session.role = role;
    session.email = email;
    const html = renderToStaticMarkup(
      await AdminLayout({ children: createElement("p", null, "PAGE") }),
    );
    return /<div data-admin-root=""[^>]*>/.exec(html)?.[0] ?? "";
  };

  it("is the palette's key for the roles with lists, and no address", async () => {
    for (const role of ["owner", "manager", "staff"]) {
      const root = await rootOf(role, "ayse@laffogato.net");
      expect(root, role).toContain(
        `data-admin-account="${paletteAccountKey("ayse@laffogato.net")}"`,
      );
      expect(root).not.toContain("ayse");
    }
  });

  it("is not there for the cashier", async () => {
    expect(await rootOf("cashier", "kasa@laffogato.net")).not.toContain(
      "data-admin-account",
    );
  });
});
