import { readFileSync } from "node:fs";

import { createElement, type FunctionComponent, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { compile } from "tailwindcss";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminNavGroup } from "@/components/admin/admin-sidebar";
import type { AdminRole } from "@/lib/admin/roles";

/**
 * The phone's bottom bar (admin UI v2, UI-7, design §5): the counter's
 * pages one tap away below `lg`, for every role with nav chrome. The slots
 * come from the role's own nav (the layout's NAV_GROUPS through
 * visibleNav, read here the way nav-ia reads them), so a slot is always a
 * page the role may open. Its room at the bottom is one variable on the
 * admin root, `--admin-bottom-inset`, that the other bottom-edge surfaces
 * add to their own distance. Interaction (the keyboard, a dialog, the
 * bulk bar, an alert) is checked in the browser pass; here the rules, the
 * markup and the CSS those classes compile to.
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
// The badge polls' actions, under both of their names: main renamed them
// (#185, the cursor polls: openOrderSignalAction, karaokeTodaySignalAction)
// after this branch was cut, and a mock without the name the shell imports
// throws on the first render. Static markup never runs the polls.
vi.mock("@/app/admin/siparisler/actions", () => ({
  openOrderCountAction: vi.fn(async () => null),
  openOrderSignalAction: vi.fn(async () => ({ count: null, cursor: "" })),
}));
vi.mock("@/app/admin/mobil/karaoke/actions", () => ({
  karaokeTodayCountAction: vi.fn(async () => null),
  karaokeTodaySignalAction: vi.fn(async () => ({ count: null, cursor: "" })),
}));
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
const { BulkActionBar } = await import("@/components/admin/bulk");
const { BottomBar } = await import("@/components/admin/ui/bottom-bar");
const core = await import("@/lib/admin/bottom-bar-core");
const { activeNavPlace } = await import("@/lib/admin/nav-match");
const { landingPathFor } = await import("@/lib/admin/roles");

const ROLES: AdminRole[] = ["owner", "manager", "staff", "cashier"];

async function layoutFor(role: AdminRole) {
  session.role = role;
  captured.props = null;
  const html = renderToStaticMarkup(
    await AdminLayout({ children: createElement("p", null, "PAGE") }),
  );
  const props = captured.props as { groups: AdminNavGroup[] } | null;
  if (!props) throw new Error(`no sidebar for ${role}`);
  return { html, groups: props.groups };
}

// One role at a time: the session and the recorder are shared.
const LAYOUT = {} as Record<AdminRole, Awaited<ReturnType<typeof layoutFor>>>;
for (const role of ROLES) LAYOUT[role] = await layoutFor(role);
const NAV = (role: AdminRole) => LAYOUT[role].groups;

const slotsFor = (role: AdminRole, groups = NAV(role)) =>
  core.bottomBarSlots(groups, landingPathFor(role), sidebar.BADGE_LINKS);
const labels = (slots: ReturnType<typeof slotsFor>) =>
  slots.map((s) =>
    s.kind === "more" ? core.BOTTOM_BAR_MORE_LABEL : s.item.label,
  );

const renderShell = (role: AdminRole) =>
  renderToStaticMarkup(
    createElement(
      ToastProvider,
      null,
      createElement(sidebar.AdminSidebar, {
        groups: NAV(role),
        email: "x@laffogato.net",
        roleLabel: role,
        landingPath: landingPathFor(role),
        logout: () => {},
        canSearch: false,
      }),
    ),
  );

/** The bar's markup: from its <nav> to the end of the shell. */
const barOf = (html: string) => {
  const at = html.indexOf('data-admin-tabbar=""');
  if (at === -1) return "";
  const start = html.lastIndexOf("<nav", at);
  return html.slice(start, html.indexOf("</nav>", at) + 6);
};

const read = (p: string) => readFileSync(p, "utf8");
const withKids = (
  type: unknown,
  props: Record<string, unknown> | null,
  ...children: ReactNode[]
) => createElement(type as FunctionComponent, props, ...children);

describe("the slots, per role", () => {
  it("owner and manager: Genel bakış, Siparişler, Karaoke, Kasa and Tümü", () => {
    for (const role of ["owner", "manager"] as const) {
      expect(labels(slotsFor(role)), role).toEqual([
        "Genel bakış",
        "Siparişler",
        "Karaoke",
        "Kasa",
        "Tümü",
      ]);
    }
  });

  it("staff: their five pages, open orders first and the dashboard last; no Tümü", () => {
    expect(labels(slotsFor("staff"))).toEqual([
      "Siparişler",
      "Karaoke",
      "Kasa",
      "Stok",
      "Genel bakış",
    ]);
  });

  it("staff with Canlı durum (UI-13): the first four and Tümü, with no change here", () => {
    const [today, ...rest] = NAV("staff");
    const groups = [
      {
        ...today,
        items: [
          ...today.items,
          {
            href: "/admin/mobil/canli-durum",
            label: "Canlı durum",
            section: "venue",
            icon: "appLive",
          },
        ],
      },
      ...rest,
    ];
    expect(labels(slotsFor("staff", groups))).toEqual([
      "Siparişler",
      "Karaoke",
      "Kasa",
      "Canlı durum",
      "Tümü",
    ]);
  });

  it("the cashier gets none: no nav chrome, no bar", () => {
    expect(slotsFor("cashier")).toEqual([]);
    expect(core.bottomBarSlots([], "/admin")).toEqual([]);
    expect(barOf(renderShell("cashier"))).toBe("");
    expect(renderShell("cashier")).not.toContain("data-admin-tabbar");
    // Not even computed: the shell asks for slots past the one-page
    // shell's own return, so a cashier runs none of the bar's code.
    const src = read("src/components/admin/admin-sidebar.tsx");
    expect(src.indexOf("bottomBarSlots(props.groups")).toBeGreaterThan(
      src.indexOf("if (!chrome) {"),
    );
    expect(src.match(/bottomBarSlots\(/g)).toHaveLength(1);
  });

  it("never more than five, and every slot is a page of the role's own nav", () => {
    for (const role of ROLES) {
      const slots = slotsFor(role);
      expect(slots.length, role).toBeLessThanOrEqual(core.BOTTOM_BAR_MAX);
      const mine = new Set(NAV(role).flatMap((g) => g.items));
      for (const s of slots) {
        if (s.kind === "link") expect(mine.has(s.item), role).toBe(true);
      }
      // "Tümü" only when something is left over for the drawer.
      const items = NAV(role).flatMap((g) => g.items).length;
      expect(
        slots.some((s) => s.kind === "more"),
        role,
      ).toBe(items > core.BOTTOM_BAR_MAX);
    }
  });

  it("Siparişler opens the Açık tab its badge counts; the others their own page", () => {
    const hrefs = slotsFor("owner").map((s) =>
      s.kind === "link" ? s.href : null,
    );
    expect(hrefs).toEqual([
      "/admin",
      "/admin/siparisler?durum=acik",
      "/admin/mobil/karaoke",
      "/admin/kasa",
      null,
    ]);
  });

  it("lights the current page's slot, else Tümü, else none", () => {
    const at = (role: AdminRole, path: string) => {
      const slots = slotsFor(role);
      const items = NAV(role).flatMap((g) => g.items);
      const i = core.activeBottomSlot(
        slots,
        activeNavPlace(path, items)?.item.href ?? null,
      );
      return i === -1 ? null : labels(slots)[i];
    };
    expect(at("owner", "/admin")).toBe("Genel bakış");
    expect(at("owner", "/admin/siparisler/ord-12")).toBe("Siparişler");
    expect(at("staff", "/admin/siparisler")).toBe("Siparişler");
    expect(at("owner", "/admin/mobil/karaoke/kr-1")).toBe("Karaoke");
    // Reached through the drawer: Tümü.
    expect(at("owner", "/admin/kategoriler")).toBe("Tümü");
    expect(at("manager", "/admin/2fa-kurulum")).toBe("Tümü");
    // Personel has no Tümü: nothing lit outside their five pages.
    expect(at("staff", "/admin/2fa-kurulum")).toBeNull();
    expect(at("staff", "/admin/stok-hareketleri")).toBe("Stok");
  });
});

describe("the bar's markup", () => {
  beforeEach(() => {
    pathname = "/admin/siparisler";
  });

  it("is a nav marked data-admin-tabbar, fixed to the bottom over the home indicator", () => {
    const bar = barOf(renderShell("owner"));
    const open = /<nav [^>]*>/.exec(bar)![0];
    expect(open).toContain('aria-label="Hızlı menü"');
    expect(open).toContain('data-admin-tabbar=""');
    const cls = /class="([^"]*)"/.exec(open)![1].split(" ");
    expect(cls).toEqual(
      expect.arrayContaining([
        "fixed",
        "inset-x-0",
        "bottom-0",
        "z-30",
        "pb-[env(safe-area-inset-bottom)]",
      ]),
    );
    // A row of 3.5rem, the height the root's inset reserves.
    expect(bar).toMatch(/<ul class="[^"]*\bh-14\b/);
    // After the drawer: the shell's last element.
    const html = renderShell("owner");
    expect(html.indexOf("data-admin-tabbar")).toBeGreaterThan(
      html.indexOf("</dialog>"),
    );
  });

  it("draws five 44 px slots, each an icon over its name", () => {
    const bar = barOf(renderShell("owner"));
    expect(bar.match(/<li /g)).toHaveLength(5);
    const targets = bar.match(/<(?:a|button) [^>]*>/g) ?? [];
    expect(targets).toHaveLength(5);
    for (const t of targets) expect(t, t).toMatch(/\bmin-h-11\b/);
    // Every slot draws a lucide icon (decorative) and its label.
    const icons = bar.match(/<svg [^>]*>/g) ?? [];
    expect(icons).toHaveLength(5);
    for (const svg of icons) {
      expect(svg).toContain('class="lucide ');
      expect(svg).toContain('aria-hidden="true"');
    }
    for (const label of [
      "Genel bakış",
      "Siparişler",
      "Karaoke",
      "Kasa",
      "Tümü",
    ]) {
      expect(bar).toContain(`>${label}</span>`);
    }
  });

  it("lights the current page with aria-current, once", () => {
    pathname = "/admin/siparisler/ord-12";
    const bar = barOf(renderShell("owner"));
    const lit = bar.match(/<a [^>]*aria-current="page"[^>]*>/g) ?? [];
    expect(lit).toHaveLength(1);
    expect(lit[0]).toContain('href="/admin/siparisler?durum=acik"');
    expect(lit[0]).toContain("text-[var(--admin-primary)]");
  });

  it("Tümü opens the shell's drawer, and focus comes back to it", () => {
    const bar = barOf(renderShell("owner"));
    const more = /<button [^>]*>/.exec(bar)![0];
    expect(more).toContain('type="button"');
    expect(more).toContain('aria-haspopup="dialog"');
    expect(more).toContain('aria-controls="admin-nav-drawer"');
    expect(more).toContain('aria-expanded="false"');
    // The drawer remembers which control opened it: the top bar's button
    // or this one.
    const src = read("src/components/admin/admin-sidebar.tsx");
    expect(src).toContain("onClick={(e) => openDrawer(e.currentTarget)}");
    expect(src).toContain("onMore={openDrawer}");
    expect(src).toContain("(openerRef.current ?? toggleRef.current)?.focus();");
    // Personel's five pages all fit: no Tümü.
    expect(barOf(renderShell("staff"))).not.toContain("<button");
  });

  it("shows the sidebar's badge counts, from the sidebar's own polls", () => {
    const html = renderToStaticMarkup(
      createElement(BottomBar, {
        slots: slotsFor("owner"),
        active: 1,
        counts: { orders: 7, karaoke: 120 },
        badgeTitles: { orders: "Açık sipariş", karaoke: "Bugünkü karaoke" },
        onMore: () => {},
        drawerId: "admin-nav-drawer",
        drawerOpen: false,
      }),
    );
    expect(html).toMatch(
      /href="\/admin\/siparisler\?durum=acik"[^]*?>7<span class="sr-only"> Açık sipariş<\/span>/,
    );
    expect(html).toMatch(/>99\+<span class="sr-only"> Bugünkü karaoke</);
    // A zero or an unknown count draws nothing.
    const none = renderToStaticMarkup(
      createElement(BottomBar, {
        slots: slotsFor("owner"),
        active: -1,
        counts: { orders: 0, karaoke: null },
        onMore: () => {},
        drawerId: "admin-nav-drawer",
        drawerOpen: false,
      }),
    );
    expect(none).not.toContain("sr-only");
    expect(none).not.toContain("aria-current");
    // No second poll: the bar asks for nothing itself, the sidebar hands it
    // the two counts its nav already reads.
    const bar = read("src/components/admin/ui/bottom-bar.tsx");
    expect(bar).not.toMatch(/@\/app\/admin|CountAction|useEffect|setInterval/);
    const src = read("src/components/admin/admin-sidebar.tsx");
    expect(src.match(/useNavCount\(/g)).toHaveLength(3);
    expect(src).toMatch(/<BottomBar[^>]*counts=\{counts\}/);
  });

  it("brings no library into the shell: lucide only through the lazy nav icon", () => {
    const bar = read("src/components/admin/ui/bottom-bar.tsx");
    expect(bar).not.toContain("lucide-react");
    expect(bar).not.toContain("@/components/admin/ui/icons");
    expect(bar).toMatch(
      /dynamic\(\s*\(\) =>\s*import\("@\/components\/admin\/nav-icon"\)/,
    );
    expect(bar).not.toContain("react-aria");
  });
});

/** The CSS Tailwind writes for the given classes (no preflight, no theme). */
async function cssFor(classes: string[]): Promise<string> {
  const compiler = await compile(
    "@theme { --breakpoint-lg: 64rem; --spacing: 0.25rem; } @tailwind utilities;",
    {},
  );
  return compiler.build(classes);
}
/** A tag's classes, as written (the markup escapes `&`). */
const classesOf = (tag: string) =>
  /class="([^"]*)"/.exec(tag)![1].replaceAll("&amp;", "&").split(" ");
const squash = (css: string) => css.replace(/\s+/g, " ");

describe("when the bar steps aside", () => {
  it("below lg only, never on paper, and not under the bulk bar, a dialog or a phone's keyboard", async () => {
    const open = /<nav [^>]*>/.exec(barOf(renderShell("owner")))![0];
    const cls = classesOf(open);
    for (const c of core.BOTTOM_BAR_HIDE) expect(cls).toContain(c);
    const css = squash(await cssFor(cls));
    expect(css).toMatch(
      /@media \(width >= 64rem\) \{ \.lg\\:hidden \{ display: none;/,
    );
    expect(css).toMatch(/@media print \{ \.print\\:hidden \{ display: none;/);
    expect(css).toMatch(
      /:root:has\(\[data-admin-bulk-bar\]\) \.[^{]+\{ display: none;/,
    );
    expect(css).toMatch(/:root:has\(dialog\[open\]\) \.[^{]+\{ display: none;/);
    // The keyboard: a focused text field, on a touch screen only.
    const keyboard =
      /@media \(pointer: coarse\) \{ :root:has\(:is\(([^{]+)\):focus\) \.[^{]+\{ display: none;/.exec(
        css,
      );
    expect(keyboard).not.toBeNull();
    const field = keyboard![1];
    expect(field).toContain("textarea");
    expect(field).toContain("[contenteditable]:not([contenteditable=false])");
    expect(field).toMatch(/^input:not\(/);
    // Not a box that opens no keyboard, nor a select (iOS keeps it
    // focused after its wheel closes).
    for (const t of ["checkbox", "radio", "submit", "button", "file", "date"]) {
      expect(field).toContain(`[type=${t}]`);
    }
    expect(field).not.toContain("select");
  });
});

describe("the shared bottom inset", () => {
  it("the admin root sets it while the bar is on the page below lg and no bulk bar replaced it, and the page ends that much higher", async () => {
    const root = /<div data-admin-root=""[^>]*>/.exec(LAYOUT.owner.html)![0];
    const cls = classesOf(root);
    const setter =
      "max-lg:has-[[data-admin-tabbar]]:not-has-[[data-admin-bulk-bar]]:[--admin-bottom-inset:calc(3.5rem+env(safe-area-inset-bottom))]";
    expect(cls).toContain(setter);
    expect(cls).toContain("pb-[var(--admin-bottom-inset,0px)]");
    expect(cls).toContain("print:pb-0");
    const css = squash(await cssFor(cls));
    expect(css).toMatch(
      /@media \(width < 64rem\) \{ \.[^{]+:has\(:is\(\[data-admin-tabbar\]\)\):not\(:has\(:is\(\[data-admin-bulk-bar\]\)\)\) \{ --admin-bottom-inset: calc\(3\.5rem \+ env\(safe-area-inset-bottom\)\);/,
    );
    // The same 3.5rem as the bar's h-14 row.
    expect(squash(await cssFor(["h-14"]))).toContain(
      "height: calc(var(--spacing) * 14)",
    );
    // The same class on every role's root (it is the shell's); only a page
    // with the bar matches it, so the cashier's and the sign-in screens'
    // inset stays unset.
    for (const role of ROLES) {
      expect(LAYOUT[role].html, role).toContain(setter);
    }
  });

  it("the toast stack and the bulk bar add it to their own distance from the bottom", () => {
    const toasts = renderToStaticMarkup(withKids(ToastProvider, null, "x"));
    const stack = classesOf(
      /<div class="pointer-events-none fixed [^"]*"/.exec(toasts)![0],
    );
    expect(stack).toContain("bottom-4");
    expect(stack).toContain("mb-[var(--admin-bottom-inset,0px)]");
    // Above the bulk bar, by its measured height, as before.
    expect(stack).toContain(
      "[:root:has([data-admin-bulk-bar])_&]:bottom-[var(--admin-bulk-space,8rem)]",
    );
    const selection = {
      selected: new Set(["a"]),
      has: () => true,
      toggle: () => {},
      set: () => {},
      clear: () => {},
      count: 1,
      ids: ["a"],
    };
    const bulk = renderToStaticMarkup(
      withKids(BulkActionBar, { selection, pending: false }, "x"),
    );
    const bar = classesOf(
      /<div [^>]*data-admin-bulk-bar=""[^>]*>/.exec(bulk)![0],
    );
    expect(bar).toContain("bottom-4");
    expect(bar).toContain("mb-[var(--admin-bottom-inset,0px)]");
  });

  it("the order alert sheet and the sticky save bars sit above the bar, not under it", () => {
    const alerts = read("src/components/admin/order-alerts.tsx");
    expect(alerts).toContain("bottom-[var(--admin-bottom-inset,0px)]");
    // The inset holds the home indicator: no second one inside the sheet.
    expect(alerts).toContain(
      "pb-[max(0.5rem,calc(env(safe-area-inset-bottom)-var(--admin-bottom-inset,0px)))]",
    );
    for (const p of [
      "src/app/admin/bulten/kampanya/campaign-mail-form.tsx",
      "src/app/admin/icerik/content-form.tsx",
    ]) {
      const src = read(p);
      expect(src, p).toContain(
        "sticky bottom-[calc(1rem+var(--admin-bottom-inset,0px))]",
      );
      expect(src, p).not.toContain("sticky bottom-4");
    }
    // No other bottom-pinned surface in the panel forgets it.
    const fixedBottom = [
      "src/components/admin/ui/toast.tsx",
      "src/components/admin/bulk.tsx",
      "src/components/admin/order-alerts.tsx",
    ];
    for (const p of fixedBottom) {
      expect(read(p), p).toContain("--admin-bottom-inset");
    }
  });

  it("adds no rule to the site's globals.css", () => {
    const css = read("src/app/globals.css");
    expect(css).not.toContain("admin-bottom-inset");
    expect(css).not.toContain("data-admin-tabbar");
  });
});
