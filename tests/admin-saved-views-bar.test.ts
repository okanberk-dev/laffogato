import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * The FilterBar's side of a list's saved views (admin UI v2, UI-11): what
 * the bar was before and still is without `views`, what it draws around the
 * menu once the page is in the browser, that a menu which cannot load is not
 * drawn instead of taking the list down, what the bar loads statically (it
 * comes with the kit into most panel pages), and the menu's own markup for a
 * stored list (the eight-view scroll, the default's mark). The rules are in
 * admin-saved-views.test.ts; clicks, the dialog and focus are in the PR's
 * browser checklist.
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
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  unstable_rethrow: vi.fn(),
}));
// The lazy menu is a placeholder here that shows what the bar hands it; the
// real menu is drawn by the last describe, on its own.
vi.mock("next/dynamic", () => ({
  default:
    () =>
    (props: {
      storageKey: string;
      pathname: string;
      address: unknown;
      pageParam: string;
      touched?: unknown;
      className?: string;
    }) =>
      createElement("span", {
        "data-lazy-menu": "",
        "data-storage-key": props.storageKey,
        "data-pathname": props.pathname,
        "data-address": JSON.stringify(props.address),
        "data-page-param": props.pageParam,
        "data-touched": typeof props.touched,
        "data-class": props.className,
      }),
}));
// The bar's answer to "is the page in the browser": the server has none.
const page = vi.hoisted(() => ({ key: null as string | null }));
vi.mock("@/components/admin/ui/saved-views-key", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/components/admin/ui/saved-views-key")
  >()),
  useSavedViewsKey: (listKey: string | undefined) =>
    listKey ? page.key : null,
}));

// The dialogs the real menu draws, with the props it gives them.
const modals = vi.hoisted(() => ({
  props: [] as Array<Record<string, unknown>>,
}));
vi.mock("@/components/admin/ui/action-modal", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/components/admin/ui/action-modal")>();
  return {
    ...actual,
    ActionModal: (props: Parameters<typeof actual.ActionModal>[0]) => {
      modals.props.push(props as unknown as Record<string, unknown>);
      return createElement(actual.ActionModal, props);
    },
  };
});

const { FilterBar } = await import("@/components/admin/ui/filter-bar");
const { SavedViewsBoundary, TOUCH_EVENTS, watchFirstTouch } =
  await import("@/components/admin/ui/saved-views-key");
const { SavedViews } = await import("@/components/admin/ui/saved-views");
const { ORDER_FILTER_FIELDS } = await import("@/lib/admin/order-filters");
const { parseFilters } = await import("@/lib/admin/list-params");
type Fields = Parameters<typeof parseFilters>[1];

const PATH = "/admin/siparisler";
const KEY = "laf_admin_views_v1:0123456789abcdef:orders";

// Fields of the test's own: the chips below are frozen from origin/main's
// bar, and must not move when the orders list's labels do.
const FIELDS: Fields = [
  { type: "search", name: "q", label: "Ara", placeholder: "No, ad" },
  {
    type: "select",
    name: "kanal",
    label: "Kanal",
    options: [
      { value: "web", label: "Web" },
      { value: "app", label: "Uygulama" },
    ],
  },
];

const bar = (
  sp: Record<string, string>,
  {
    remembered,
    ...extra
  }: { remembered?: string } & Record<string, unknown> = {},
) =>
  renderToStaticMarkup(
    createElement(FilterBar, {
      fields: FIELDS,
      searchParams: sp,
      values: {
        ...parseFilters(sp, FIELDS),
        ...(remembered ? { q: remembered } : {}),
      },
      pathname: PATH,
      label: "Filtreler",
      ...extra,
    }),
  );

/** React draws a function action as a javascript: URL; its text is React's. */
const plain = (html: string) =>
  html.replace(/action="javascript:[^"]*"/g, 'action="FN"');

/** The chips' <ul>, from its tag to its end. */
const chipsOf = (html: string) => {
  const start = html.indexOf('<ul aria-label="Etkin filtreler"');
  return start < 0 ? "" : html.slice(start, html.indexOf("</ul>", start) + 5);
};

describe("without views the bar is what it was", () => {
  // Captured from origin/main's filter-bar.tsx (before UI-11) for a search
  // text (a post chip) and a dropdown (a link chip).
  const LI =
    'class="inline-flex items-center gap-1 rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface)] py-1 pr-1 pl-3 text-xs text-[var(--admin-text-soft)]"';
  const X =
    "inline-flex h-7 w-7 items-center justify-center rounded-full text-sm leading-none text-[var(--admin-text-soft)] hover:bg-[var(--admin-surface-2)] hover:text-[var(--admin-text)] focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/45 focus-visible:outline-none";
  const CHIPS =
    '<ul aria-label="Etkin filtreler" class="mt-2 flex flex-wrap gap-2">' +
    `<li ${LI}><span>Ara: <strong class="font-medium text-[var(--admin-text)]">ayşe</strong></span>` +
    '<form class="contents" action="FN">' +
    '<input type="hidden" name="_path" value="/admin/siparisler"/>' +
    '<input type="hidden" name="_do" value="clear"/>' +
    '<input type="hidden" name="_clear" value="q"/>' +
    '<input type="hidden" name="durum" value="acik"/>' +
    '<input type="hidden" name="kanal" value="app"/>' +
    `<button type="submit" class="${X}" aria-label="Filtreyi kaldır: Ara ayşe"><span aria-hidden="true">×</span></button></form></li>` +
    `<li ${LI}><span>Kanal: <strong class="font-medium text-[var(--admin-text)]">Uygulama</strong></span>` +
    `<a href="/admin/siparisler?durum=acik" aria-label="Filtreyi kaldır: Kanal Uygulama" class="${X}"><span aria-hidden="true">×</span></a></li></ul>`;

  it("the chips keep their place, their classes and their links, byte for byte", () => {
    const html = bar({ durum: "acik", kanal: "app" }, { remembered: "ayşe" });
    expect(chipsOf(plain(html))).toBe(CHIPS);
    // Straight after the forms: no row, no wrapper around them.
    expect(html).toMatch(/<\/form><ul aria-label="Etkin filtreler"/);
    expect(html).not.toContain("items-start gap-2");
  });

  it("with views, before the browser, it is the same markup", () => {
    for (const [sp, remembered] of [
      [{}, undefined],
      [{ durum: "acik", kanal: "app" }, "ayşe"],
    ] as const) {
      const without = bar(sp, { remembered });
      expect(bar(sp, { remembered, views: { key: "orders" } })).toBe(without);
    }
  });

  it("no chips, no row: the bar ends with its forms", () => {
    const html = bar({});
    expect(html).not.toContain("Etkin filtreler");
    expect(html).not.toContain("items-start gap-2");
    expect(html).not.toContain("data-lazy-menu");
  });
});

describe("what the bar loads statically", () => {
  const read = (path: string) => readFileSync(path, "utf8");
  const ROOT = process.cwd();

  /** Value imports (import() and `import type` load nothing at once). */
  const valueImportsOf = (src: string) =>
    [
      ...src.matchAll(
        /\b(?:import|export)\s+(?!type\b)(?:[\w$*{}\s,]+?\s+from\s*)?["']([^"']+)["']/g,
      ),
    ].map((m) => m[1]);

  const resolve = (from: string, spec: string): string | null => {
    const base = spec.startsWith("@/")
      ? `src/${spec.slice(2)}`
      : relative(ROOT, join(ROOT, dirname(from), spec));
    for (const cand of [
      base,
      `${base}.ts`,
      `${base}.tsx`,
      `${base}/index.ts`,
    ]) {
      if (existsSync(join(ROOT, cand)) && statSync(join(ROOT, cand)).isFile()) {
        return cand;
      }
    }
    return null;
  };

  /** Everything a file brings along by value imports; a server action's body stays on the server. */
  const closure = (entry: string) => {
    const files = new Set<string>();
    const packages = new Set<string>();
    const stack = [entry];
    while (stack.length > 0) {
      const file = stack.pop()!;
      if (files.has(file)) continue;
      files.add(file);
      const src = read(file);
      if (file !== entry && /^\s*["']use server["']/m.test(src.slice(0, 400))) {
        continue;
      }
      for (const spec of valueImportsOf(src)) {
        if (spec.startsWith(".") || spec.startsWith("@/")) {
          const next = resolve(file, spec);
          if (next) stack.push(next);
        } else packages.add(spec);
      }
    }
    return { files, packages };
  };

  const BAR = "src/components/admin/ui/filter-bar.tsx";

  it("only what it always did, and the key half", () => {
    // The bar travels with the kit's barrel into most panel pages: a new
    // static import here lands on all of them. This list is the decision.
    expect([...new Set(valueImportsOf(read(BAR)))].sort()).toEqual(
      [
        "@/app/admin/liste-arama/actions",
        "@/components/laffogato/cx",
        // The date presets' links (UI-14): pure, no imports of their own.
        "@/lib/admin/date-presets",
        "@/lib/admin/list-params",
        "@/lib/admin/list-search-core",
        "../forms",
        "./link-pending",
        "./list-search-button",
        "./saved-views-key",
        "./styles",
        "./submit",
        // The hand-over rules of the date widget (UI-14): pure; the widget's
        // chunk itself is reached by import() alone.
        "./widget-loader",
        "next/dynamic",
        "next/link",
        "react",
      ].sort(),
    );
  });

  it("never reaches the menu, its rules, its storage or a UI library", () => {
    const { files, packages } = closure(BAR);
    for (const menu of [
      "src/components/admin/ui/saved-views.tsx",
      "src/components/admin/ui/saved-views-store.ts",
      "src/lib/admin/saved-views.ts",
      "src/components/admin/ui/action-modal.tsx",
      "src/components/admin/ui/toast.tsx",
    ]) {
      expect(files.has(menu), menu).toBe(false);
    }
    for (const pkg of packages) {
      expect(pkg, pkg).not.toMatch(
        /^(lucide-react|react-aria|react-stately|@internationalized\/)/,
      );
    }
    // The walk sees the key half it does bring.
    expect(files.has("src/components/admin/ui/saved-views-key.ts")).toBe(true);
    expect(files.has("src/lib/admin/saved-views-key.ts")).toBe(true);
  });

  it("nor the shell's own modules: the account key's shape has a file of its own", () => {
    // The key check once imported palette-shell.ts, and with it the roles,
    // the nav matching, the shortcut roles and piiLike came into the bar's
    // graph: modules the shell already carries, but the bar is not the shell
    // (and the bundler regroups what two entries share). Five modules for
    // one regular expression.
    const { files } = closure(BAR);
    for (const shell of [
      "src/lib/admin/palette-shell.ts",
      "src/lib/admin/roles.ts",
      "src/lib/admin/nav-match.ts",
      "src/lib/admin/shortcut-roles.ts",
      "src/lib/admin/pii-like.ts",
    ]) {
      expect(files.has(shell), shell).toBe(false);
    }
    expect(files.has("src/lib/admin/account-key.ts")).toBe(true);
    // Everything the bar's graph gained is the saved views' key half.
    const gained = [...files].filter((f) => /saved-views|account-key/.test(f));
    expect(gained.sort()).toEqual([
      "src/components/admin/ui/saved-views-key.ts",
      "src/lib/admin/account-key.ts",
      "src/lib/admin/saved-views-key.ts",
    ]);
  });

  it("the menu itself is reached by import() alone", () => {
    expect(read(BAR)).toMatch(
      /dynamic\(\s*\(\) => import\("\.\/saved-views"\)\.then\(\(m\) => m\.SavedViews\),\s*\{ ssr: false \},?\s*\)/,
    );
    const menu = closure("src/components/admin/ui/saved-views.tsx");
    // The walk sees the menu's own load (the rules and the storage).
    expect(menu.files.has("src/lib/admin/saved-views.ts")).toBe(true);
    expect(menu.files.has("src/components/admin/ui/saved-views-store.ts")).toBe(
      true,
    );
  });
});

describe("once the page is in the browser", () => {
  const withKey = <T>(run: () => T): T => {
    page.key = KEY;
    try {
      return run();
    } finally {
      page.key = null;
    }
  };

  it("the chips and the menu share one row, the menu at its end", () => {
    const html = withKey(() =>
      bar(
        { durum: "acik", kanal: "app", sayfa: "3", denied: "1" },
        { remembered: "ayşe", views: { key: "orders" } },
      ),
    );
    expect(html).toMatch(
      /<\/form><div class="mt-2 flex flex-wrap items-start gap-2"><ul aria-label="Etkin filtreler" class="flex min-w-0 flex-\[1_1_14rem\] flex-wrap gap-2 self-center">/,
    );
    // Both chips are still there, and the menu follows them.
    expect(html).toContain("Filtreyi kaldır: Ara ayşe");
    expect(html).toContain("Filtreyi kaldır: Kanal Uygulama");
    // The menu is the row's last item, and the row the bar's last.
    expect(html).toMatch(
      /<\/ul><span data-lazy-menu=""[^>]*><\/span><\/div><\/div>/,
    );
  });

  it("with no chip the menu is the row", () => {
    const html = withKey(() => bar({}, { views: { key: "orders" } }));
    expect(html).toContain(
      '<div class="mt-2 flex flex-wrap items-start gap-2"><span data-lazy-menu=""',
    );
    expect(html).not.toContain("Etkin filtreler");
  });

  it("hands the menu the key, the list's path and the address without the search", () => {
    const html = withKey(() =>
      bar(
        { durum: "acik", q: "ayse@x.co", sayfa: "3", denied: "1" },
        { remembered: "ayşe", views: { key: "orders" } },
      ),
    );
    const attr = (name: string) =>
      new RegExp(`data-${name}="([^"]*)"`).exec(html)?.[1] ?? "";
    expect(attr("storage-key")).toBe(KEY);
    expect(attr("pathname")).toBe(PATH);
    expect(attr("page-param")).toBe("sayfa");
    // And the question "has the operator started something?" (F2).
    expect(attr("touched")).toBe("function");
    expect(attr("class")).toBe("ml-auto");
    // The page and the notice may ride along (the rules drop them); the
    // typed search and the one-time notice never reach the menu.
    const address = JSON.parse(attr("address").replaceAll("&quot;", '"'));
    expect(address).toEqual({ durum: "acik", sayfa: "3" });
    expect(html).not.toContain("ayse@x.co");
  });

  it("no `views`, no row, whatever the page says", () => {
    const html = withKey(() => bar({ durum: "acik" }));
    expect(html).not.toContain("data-lazy-menu");
    expect(html).not.toContain("items-start gap-2");
  });
});

describe("a menu that cannot load", () => {
  it("is not drawn, and the list stays", () => {
    // A rejected import() throws out of the lazy component while it draws;
    // React hands that to the nearest boundary. Without this one it was
    // admin/error.tsx: the whole orders list became "Bu ekran yüklenemedi".
    expect(SavedViewsBoundary.getDerivedStateFromError()).toEqual({
      failed: true,
    });
    const boundary = new SavedViewsBoundary({ children: "menu" });
    expect(boundary.render()).toBe("menu");
    boundary.state = SavedViewsBoundary.getDerivedStateFromError();
    expect(boundary.render()).toBeNull();
  });

  it("the bar holds the lazy menu, and only it, in that boundary", () => {
    const src = readFileSync("src/components/admin/ui/filter-bar.tsx", "utf8");
    expect(src).toMatch(
      /<SavedViewsBoundary>\s*<SavedViews\b[\s\S]*?\/>\s*<\/SavedViewsBoundary>/,
    );
    // The chips are outside it: they must stay when the menu fails.
    expect(src.indexOf("{chipList(")).toBeLessThan(
      src.indexOf("<SavedViewsBoundary>"),
    );
  });
});

describe("the menu for a stored list", () => {
  /** A browser's storage that holds `raw`, for the one draw. */
  const drawn = (
    raw: string | null,
    address: Record<string, string>,
    extra: { values?: Record<string, string> } = {},
  ) => {
    const storage = { getItem: () => raw, setItem() {}, removeItem() {} };
    vi.stubGlobal("window", {
      localStorage: storage,
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent: () => true,
    });
    try {
      return renderToStaticMarkup(
        createElement(SavedViews, {
          storageKey: KEY,
          pathname: PATH,
          address,
          fields: ORDER_FILTER_FIELDS,
          values: extra.values ?? parseFilters(address, ORDER_FILTER_FIELDS),
          pageParam: "sayfa",
          touched: () => false,
        }),
      );
    } finally {
      vi.unstubAllGlobals();
    }
  };

  const TABS = [
    "acik",
    "pending_payment",
    "paid",
    "preparing",
    "shipped",
    "completed",
    "cancelled",
    "refunded",
  ];
  const eight = (defaultQuery?: string) =>
    JSON.stringify({
      views: TABS.map((tab, i) => ({
        name: `V${i + 1}`,
        query: `durum=${tab}`,
      })),
      default: defaultQuery,
    });

  it("eight views scroll inside the menu, the open one is marked, the default is named", () => {
    const html = drawn(eight("durum=paid"), { durum: "paid" });
    // One scroll box holds all eight (a page scroll would close the menu).
    expect(html).toContain("max-h-[min(15rem,35dvh)]");
    expect(html).toContain("overflow-y-auto");
    expect(html.match(/<form class="contents"/g)).toHaveLength(8);
    for (let i = 1; i <= 8; i += 1) {
      expect(html).toMatch(new RegExp(`aria-label="V${i}[",]`));
    }
    // The view on screen is the third, and the default.
    expect(html).toContain("<span>Görünüm: V3</span>");
    expect(html).toContain('aria-label="V3, varsayılan, açık"');
    expect(html.match(/>Varsayılan<\/span>/g)).toHaveLength(1);
    expect(html.match(/class="[^"]*\binvisible\b[^"]*">✓/g)).toHaveLength(7);
    // For the open view: the default's switch and the delete, no save.
    expect(html).toContain(">Varsayılandan çıkar<");
    expect(html).toContain(">Görünümü sil<");
    expect(html).not.toContain("Bu görünümü kaydet");
    // Each entry is a post to the view's address, as "Sıfırla" is.
    expect(html).toContain('name="_do" value="reset"');
    expect(html).toContain('name="durum" value="pending_payment"');
  });

  it("with eight saved, an unsaved view says why it cannot be", () => {
    const html = drawn(eight(), { durum: "paid", kanal: "app" });
    expect(html).toContain("<span>Görünümler</span>");
    expect(html).toContain("En fazla 8 görünüm. Yenisi için birini sil.");
    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toContain("Varsayılan yap");
  });

  it("the default's switch reads the other way for a view that is not the default", () => {
    const html = drawn(eight("durum=paid"), { durum: "shipped" });
    expect(html).toContain(">Varsayılan yap<");
    expect(html).not.toContain("Varsayılandan çıkar");
  });

  it("what was edited in storage is not shown: the same rules read it back", () => {
    const raw = JSON.stringify({
      views: [
        { name: "Ayşe", query: "q=ayse&durum=paid&kanal=a%40b.co&sayfa=4" },
        { name: "a@b.co", query: "durum=shipped" },
        { name: "Telefon", query: "teslimat=05321234567" },
      ],
    });
    const html = drawn(raw, {});
    expect(html.match(/<form class="contents"/g)).toHaveLength(1);
    expect(html).toContain('name="durum" value="paid"');
    for (const gone of ["ayse", "a@b.co", "05321234567", "sayfa"]) {
      expect(html, gone).not.toContain(gone);
    }
  });

  it("no stored list, a bare list: no saved views, the save is off with its reason", () => {
    const html = drawn(null, {});
    expect(html).not.toContain("Kayıtlı görünümler");
    expect(html).toContain("Önce bir sekme, süzgeç ya da sıralama seç.");
  });
});

describe("the operator's first touch, which keeps the default away", () => {
  it("a press, a key or a form sent counts, anywhere, even when stopped", () => {
    expect([...TOUCH_EVENTS]).toEqual(["pointerdown", "keydown", "submit"]);
    const page = new EventTarget();
    let touches = 0;
    const stop = watchFirstTouch(page, () => {
      touches += 1;
    });
    for (const type of ["pointermove", "scroll", "wheel", "focus", "click"]) {
      page.dispatchEvent(new Event(type));
    }
    expect(touches).toBe(0);
    for (const type of TOUCH_EVENTS) page.dispatchEvent(new Event(type));
    expect(touches).toBe(3);
    stop();
    page.dispatchEvent(new Event("pointerdown"));
    expect(touches).toBe(3);
  });

  it("listens in the capture phase, so a control that stops the event still counts", () => {
    const calls: Array<
      [string, boolean | AddEventListenerOptions | undefined]
    > = [];
    const target = {
      addEventListener: (
        type: string,
        _fn: unknown,
        options?: boolean | AddEventListenerOptions,
      ) => void calls.push([type, options]),
      removeEventListener: () => {},
    };
    watchFirstTouch(target, () => {});
    expect(calls).toEqual(
      TOUCH_EVENTS.map((type) => [type, { capture: true, passive: true }]),
    );
  });

  it("the bar asks it only for a list with views, once the page is in the browser", () => {
    const src = readFileSync("src/components/admin/ui/filter-bar.tsx", "utf8");
    expect(src).toMatch(
      /const touched = useTouchedSince\(viewsKey !== null\);/,
    );
    expect(src).toMatch(/touched=\{touched\}/);
  });
});

describe("saving or deleting a view stays in the browser", () => {
  it("both dialogs tell the panel nothing changed on the server", () => {
    modals.props.length = 0;
    // An open saved view: its delete dialog. An unsaved filter: the save.
    const TABS = ["acik", "paid"];
    const raw = JSON.stringify({
      views: TABS.map((tab, i) => ({
        name: `V${i + 1}`,
        query: `durum=${tab}`,
      })),
    });
    const withStorage = (
      stored: string | null,
      address: Record<string, string>,
    ) => {
      vi.stubGlobal("window", {
        localStorage: { getItem: () => stored, setItem() {}, removeItem() {} },
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent: () => true,
      });
      try {
        return renderToStaticMarkup(
          createElement(SavedViews, {
            storageKey: KEY,
            pathname: PATH,
            address,
            fields: ORDER_FILTER_FIELDS,
            values: parseFilters(address, ORDER_FILTER_FIELDS),
            pageParam: "sayfa",
            touched: () => false,
          }),
        );
      } finally {
        vi.unstubAllGlobals();
      }
    };
    expect(withStorage(raw, { durum: "paid" })).toContain(">Görünümü sil<");
    expect(withStorage(null, { durum: "acik", teslimat: "table" })).toContain(
      ">Bu görünümü kaydet<",
    );
    const drawnModals = modals.props.map((p) => [p.title, p.announce]);
    expect(drawnModals).toEqual([
      ["Görünümü sil", false],
      ["Görünümü kaydet", false],
    ]);
  });
});
