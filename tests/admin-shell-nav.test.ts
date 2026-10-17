import { readFileSync } from "node:fs";

import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The panel's shell navigation (admin audit package 1c): the sidebar's
 * tokens and icons, the phone drawer as a modal dialog, the role's own
 * landing page behind every "back to the panel" link, the 2FA link for
 * every role, badges that re-read after an action, folded nav groups,
 * breadcrumbs, the top bar's search and its slot for later controls, the
 * page skeleton, the in-panel 404 for unknown addresses, and the layout's
 * answer when the session cannot be checked.
 *
 * The client pieces render here as the server renders them (no DOM in
 * this suite); their timing rules are tested through the pure seams
 * they run on (startNavCountPoll, syncDrawer, withoutDenied, ...).
 */

let pathname = "/admin";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  unstable_rethrow: vi.fn(),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
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
vi.mock("next/form", () => ({
  default: ({
    action,
    children,
    ...rest
  }: {
    action: string;
    children?: ReactNode;
  }) => createElement("form", { action, method: "get", ...rest }, children),
}));
vi.mock("next/font/google", () => ({
  Poppins: () => ({ variable: "font-poppins", className: "" }),
}));
vi.mock("@/app/admin/siparisler/actions", () => ({
  openOrderCountAction: vi.fn(async () => 3),
}));
vi.mock("@/app/admin/mobil/karaoke/actions", () => ({
  karaokeTodayCountAction: vi.fn(async () => 1),
}));
vi.mock("@/app/admin/actions", () => ({ logoutAction: vi.fn() }));

const session = vi.hoisted(() => ({
  read: (async () => null) as () => Promise<unknown>,
}));
vi.mock("@/lib/admin/auth", () => ({
  getAdminSession: () => session.read(),
}));
vi.mock("@/lib/admin/flash", () => ({ readAdminFlash: async () => null }));

const { breadcrumbTrail } = await import("@/lib/admin/nav-match");
const sidebar = await import("@/components/admin/admin-sidebar");
const { ToastProvider } = await import("@/components/admin/ui/toast");
const { PanelHomeProvider } = await import("@/components/admin/panel-home");
const { ADMIN_CHANGED_EVENT } =
  await import("@/components/admin/ui/admin-changed");
const AdminLayout = (await import("@/app/admin/layout")).default;

const read = (path: string) => readFileSync(path, "utf8");

const NAV = [
  {
    title: "Genel",
    items: [{ href: "/admin", label: "Genel bakış", section: "dashboard" }],
  },
  {
    title: "Katalog",
    items: [{ href: "/admin/urunler", label: "Ürünler", section: "products" }],
  },
  {
    title: "Satış",
    items: [
      { href: "/admin/siparisler", label: "Siparişler", section: "orders" },
      { href: "/admin/mobil/karaoke", label: "Karaoke", section: "karaoke" },
      { href: "/admin/musteriler", label: "Müşteriler", section: "customers" },
      { href: "/admin/bulten", label: "Bülten", section: "newsletter" },
      {
        href: "/admin/bulten/kampanya",
        label: "Kampanya e-postası",
        section: "newsletter",
        icon: "campaign",
      },
    ],
  },
];
const LINKS = NAV.flatMap((g) => g.items);

describe("breadcrumbs", () => {
  it("name the nav entry, then what lies below it", () => {
    const t = (p: string) =>
      breadcrumbTrail(p, LINKS).map((c) => [c.label, c.href]);
    expect(t("/admin/siparisler")).toEqual([["Siparişler", null]]);
    expect(t("/admin/siparisler/ord-12")).toEqual([
      ["Siparişler", "/admin/siparisler"],
      ["Ayrıntı", null],
    ]);
    expect(t("/admin/siparisler/yeni")).toEqual([
      ["Siparişler", "/admin/siparisler"],
      ["Yeni", null],
    ]);
    // No /admin/urunler/<id> page: the id is not a crumb of its own.
    expect(t("/admin/urunler/prd-0001/duzenle")).toEqual([
      ["Ürünler", "/admin/urunler"],
      ["Düzenle", null],
    ]);
    // A member has a page and an edit page under it.
    expect(t("/admin/musteriler/a%40b.com/duzenle")).toEqual([
      ["Müşteriler", "/admin/musteriler"],
      ["Ayrıntı", "/admin/musteriler/a%40b.com"],
      ["Düzenle", null],
    ]);
    // The longest entry wins, as in the sidebar.
    expect(t("/admin/bulten/kampanya/yeni")).toEqual([
      ["Kampanya e-postası", "/admin/bulten/kampanya"],
      ["Yeni", null],
    ]);
    expect(t("/admin/siparisler/")).toEqual([["Siparişler", null]]);
    expect(t("/admin/ara")).toEqual([]);
  });
});

describe("badges re-read after an action", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const setup = (visible = true) => {
    const target = new EventTarget();
    const read = vi.fn(async () => 4);
    const onCount = vi.fn();
    const stop = sidebar.startNavCountPoll({
      read,
      onCount,
      target,
      isVisible: () => visible,
      intervalMs: 60_000,
    });
    return { target, read, onCount, stop };
  };

  it("reads at once, then once a minute", async () => {
    const { read, onCount, stop } = setup();
    await vi.advanceTimersByTimeAsync(0);
    expect(read).toHaveBeenCalledTimes(1);
    expect(onCount).toHaveBeenLastCalledWith(4);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(read).toHaveBeenCalledTimes(2);
    stop();
  });

  it("re-reads on admin:changed instead of waiting the minute (KAR-23)", async () => {
    const { target, read, stop } = setup();
    await vi.advanceTimersByTimeAsync(0);
    target.dispatchEvent(new Event(ADMIN_CHANGED_EVENT));
    await vi.advanceTimersByTimeAsync(0);
    expect(read).toHaveBeenCalledTimes(2);
    // The minute starts again from the change.
    await vi.advanceTimersByTimeAsync(59_000);
    expect(read).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(read).toHaveBeenCalledTimes(3);
    stop();
  });

  it("reads again after a change that lands while a read is out", async () => {
    const target = new EventTarget();
    let release: (n: number) => void = () => {};
    const read = vi
      .fn<() => Promise<number | null>>()
      .mockImplementationOnce(() => new Promise((r) => (release = r)))
      .mockResolvedValue(2);
    const onCount = vi.fn();
    const stop = sidebar.startNavCountPoll({
      read,
      onCount,
      target,
      isVisible: () => true,
    });
    target.dispatchEvent(new Event(ADMIN_CHANGED_EVENT));
    expect(read).toHaveBeenCalledTimes(1);
    release(5);
    await vi.advanceTimersByTimeAsync(0);
    expect(read).toHaveBeenCalledTimes(2);
    expect(onCount).toHaveBeenLastCalledWith(2);
    stop();
  });

  it("stops listening when stopped, and skips a hidden tab", async () => {
    const { target, read, stop } = setup(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(read).not.toHaveBeenCalled();
    stop();
    target.dispatchEvent(new Event(ADMIN_CHANGED_EVENT));
    await vi.advanceTimersByTimeAsync(120_000);
    expect(read).not.toHaveBeenCalled();
  });

  it("a failed read leaves the badge alone and the poll running", async () => {
    const target = new EventTarget();
    const read = vi
      .fn<() => Promise<number | null>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(1);
    const onCount = vi.fn();
    const stop = sidebar.startNavCountPoll({
      read,
      onCount,
      target,
      isVisible: () => true,
      intervalMs: 1_000,
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(onCount).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(onCount).toHaveBeenLastCalledWith(1);
    stop();
  });
});

describe("drawer, groups, denied notice: the pure parts", () => {
  it("opens the dialog modally and closes it with the state", () => {
    const dialog = {
      open: false,
      showModal: vi.fn(function (this: { open: boolean }) {
        this.open = true;
      }),
      close: vi.fn(function (this: { open: boolean }) {
        this.open = false;
      }),
    };
    sidebar.syncDrawer(dialog, true);
    sidebar.syncDrawer(dialog, true);
    expect(dialog.showModal).toHaveBeenCalledTimes(1);
    sidebar.syncDrawer(dialog, false);
    sidebar.syncDrawer(dialog, false);
    expect(dialog.close).toHaveBeenCalledTimes(1);
    expect(() => sidebar.syncDrawer(null, true)).not.toThrow();
  });

  it("reads the folded groups defensively; the active group stays open", () => {
    expect([...sidebar.parseCollapsedGroups('["Katalog",3]')]).toEqual([
      "Katalog",
    ]);
    expect(sidebar.parseCollapsedGroups("not json").size).toBe(0);
    expect(sidebar.parseCollapsedGroups("").size).toBe(0);
    const folded = new Set(["Katalog", "Satış"]);
    expect(sidebar.navGroupOpen("Katalog", folded, "Satış")).toBe(false);
    expect(sidebar.navGroupOpen("Satış", folded, "Satış")).toBe(true);
    expect(sidebar.navGroupOpen("Genel", folded, null)).toBe(true);
  });

  it("drops only `denied` from the address", () => {
    expect(sidebar.withoutDenied("https://x.test/admin/kasa?denied=1")).toBe(
      "/admin/kasa",
    );
    expect(
      sidebar.withoutDenied("https://x.test/admin?denied=1&durum=acik#k"),
    ).toBe("/admin?durum=acik#k");
  });

  it("the dashboard no longer says it on its own (the shell does)", () => {
    const page = read("src/app/admin/page.tsx");
    expect(page).not.toMatch(/sp\.denied/);
    expect(read("src/components/admin/admin-sidebar.tsx")).toContain(
      "Bu sayfaya yetkin yok.",
    );
  });
});

const renderSidebar = (
  props: Partial<Parameters<typeof sidebar.AdminSidebar>[0]> = {},
) =>
  renderToStaticMarkup(
    createElement(
      ToastProvider,
      null,
      createElement(sidebar.AdminSidebar, {
        groups: NAV,
        email: "kasa@example.com",
        roleLabel: "Kasiyer",
        landingPath: "/admin/kasa",
        logout: () => {},
        canSearch: true,
        ...props,
      }),
    ),
  );

const tag = (html: string, re: RegExp) => {
  const m = re.exec(html);
  if (!m) throw new Error(`no match for ${re}`);
  return m[0];
};

describe("the sidebar and the top bar", () => {
  beforeEach(() => {
    pathname = "/admin/siparisler";
  });

  it("opens the drawer as a dialog from a 44 px button that says so (SHE-13, SHE-M03)", () => {
    const html = renderSidebar();
    const toggle = tag(html, /<button[^>]*aria-label="Menüyü aç"[^>]*>/);
    expect(toggle).toContain('aria-expanded="false"');
    expect(toggle).toContain('aria-controls="admin-nav-drawer"');
    expect(toggle).toContain('aria-haspopup="dialog"');
    expect(toggle).toMatch(/\bh-11 w-11\b/);
    const dialog = tag(html, /<dialog[^>]*>/);
    expect(dialog).toContain('id="admin-nav-drawer"');
    expect(dialog).toContain('aria-label="Menü"');
    // Closed until opened: no `open`, no second copy of the nav.
    expect(dialog).not.toMatch(/\sopen[=\s>]/);
    expect(html.match(/aria-label="Panel"/g)).toHaveLength(1);
    // The close button inside is 44 px too.
    expect(read("src/components/admin/admin-sidebar.tsx")).toMatch(
      /aria-label="Menüyü kapat"\s+className="[^"]*\bh-11 w-11\b/,
    );
  });

  it("keeps the shell off paper (SHE-08)", () => {
    const html = renderSidebar();
    expect(tag(html, /<aside[^>]*>/)).toContain("print:hidden");
    expect(tag(html, /<header[^>]*>/)).toContain("print:hidden");
    expect(tag(html, /<dialog[^>]*>/)).toContain("print:hidden");
    expect(read("src/app/admin/layout.tsx")).toContain(
      '<div className="lg:pl-64 print:pl-0">',
    );
  });

  it("sends the logo to the role's own landing page (SHE-25)", () => {
    const html = renderSidebar();
    const logos = html.match(
      /<a href="([^"]+)"[^>]*aria-label="L&#x27;Affogato Admin"/g,
    );
    expect(logos).toHaveLength(2);
    for (const a of logos!) expect(a).toContain('href="/admin/kasa"');
  });

  it("gives every role a 2FA link and a sign-out in the account block (SHE-25)", () => {
    const html = renderSidebar();
    expect(html).toMatch(
      /<a href="\/admin\/2fa-kurulum"[^>]*>.*?Güvenlik \/ 2FA<\/span><\/a>/,
    );
    expect(html).toContain('aria-label="Hesap"');
    expect(html).toContain("Çıkış");
  });

  it("leaves one slot for top-bar controls after the search", () => {
    const html = renderSidebar({
      actions: createElement("button", { id: "bell" }, "Zil"),
    });
    const header = html.slice(
      html.indexOf("<header"),
      html.indexOf("</header>"),
    );
    expect(header).toMatch(
      /<div data-admin-topbar-actions="" class="[^"]*"><button id="bell">Zil<\/button><\/div>/,
    );
    expect(header).toContain('action="/admin/ara"');
    expect(header.indexOf('action="/admin/ara"')).toBeLessThan(
      header.indexOf("data-admin-topbar-actions"),
    );
    expect(html.match(/data-admin-topbar-actions/g)).toHaveLength(1);
  });

  it("shows the search only to a role it covers; it works without JavaScript", () => {
    const html = renderSidebar();
    expect(html).toContain('<a href="/admin/ara" aria-label="Ara"');
    const form = tag(html, /<form[^>]*action="\/admin\/ara"[^>]*>/);
    expect(form).toContain('method="get"');
    expect(form).toContain('role="search"');
    const input = tag(html, /<input id="admin-top-search"[^>]*>/);
    expect(input).toContain('name="q"');
    expect(input).toContain('type="search"');
    // `hidden` below lg and `flex` from lg: no bare `flex` beside `hidden`.
    const classes = /class="([^"]*)"/.exec(form)![1].split(" ");
    expect(classes).toContain("hidden");
    expect(classes).toContain("lg:flex");
    expect(classes).not.toContain("flex");
    const none = renderSidebar({ canSearch: false });
    expect(none).not.toContain("/admin/ara");
    // Nothing for the wide bar to hold: it is not drawn there.
    expect(tag(none, /<header[^>]*>/)).toMatch(/\blg:hidden\b/);
    expect(tag(html, /<header[^>]*>/)).not.toMatch(/\blg:hidden\b/);
  });

  it("draws breadcrumbs below a nav entry, not on the entry's own page", () => {
    pathname = "/admin/siparisler/ord-12";
    const deep = renderSidebar();
    expect(deep.match(/aria-label="Konum"/g)).toHaveLength(2);
    expect(deep).toContain('<a href="/admin/siparisler" class=');
    expect(deep).toContain('aria-current="page"');
    pathname = "/admin/siparisler";
    expect(renderSidebar()).not.toContain('aria-label="Konum"');
  });

  it("uses the panel's tokens, not the site's green or the grey palette (SHE-05, SHE-18)", () => {
    const src = read("src/components/admin/admin-sidebar.tsx");
    expect(src).not.toMatch(/neutral-\d{3}/);
    expect(src).not.toContain("var(--brand");
    expect(src).not.toContain("#F3EADB");
    const html = renderSidebar();
    const active = tag(
      html,
      /<a href="\/admin\/siparisler"[^>]*aria-current="page"[^>]*>/,
    );
    expect(active).toContain("bg-[var(--admin-primary-soft)]");
    expect(active).toContain("text-[var(--admin-primary)]");
  });
});

describe("the nav body", () => {
  const body = (
    over: Partial<Parameters<typeof sidebar.AdminSidebarBody>[0]> = {},
  ) =>
    renderToStaticMarkup(
      createElement(sidebar.AdminSidebarBody, {
        groups: NAV,
        email: "a@b.c",
        roleLabel: "Sahip",
        landingPath: "/admin",
        logout: () => {},
        pathname: "/admin/siparisler",
        counts: { orders: 7, karaoke: 3 },
        idPrefix: "t",
        onToggleGroup: () => {},
        ...over,
      }),
    );

  it("links the orders badge to the Açık tab, beside the row (ORD-21)", () => {
    const html = body();
    expect(html).toMatch(
      /<a href="\/admin\/siparisler\?durum=acik"[^>]*class="[^"]*\bmin-h-6 min-w-6\b[^"]*"[^>]*><span[^>]*>7<span class="sr-only"> Açık sipariş/,
    );
    const row = tag(html, /<a href="\/admin\/siparisler" [^]*?<\/a>/);
    expect(row).not.toContain("durum=acik");
    expect(row).not.toContain(">7<");
    // Karaoke keeps its badge inside its own row.
    expect(tag(html, /<a href="\/admin\/mobil\/karaoke" [^]*?<\/a>/)).toContain(
      ">3<",
    );
  });

  it("folds a group behind a button; the current page's group stays open", () => {
    const html = body({ collapsed: new Set(["Katalog", "Satış"]) });
    const katalog = tag(html, /<button type="button" id="t-nav-1-title"[^>]*>/);
    expect(katalog).toContain('aria-expanded="false"');
    expect(katalog).toContain('aria-controls="t-nav-1"');
    expect(tag(html, /<ul id="t-nav-1"[^>]*>/)).toContain("hidden");
    // Satış holds the current page: open, and not a toggle.
    expect(html).not.toMatch(/<button[^>]*id="t-nav-2-title"/);
    expect(tag(html, /<ul id="t-nav-2"[^>]*>/)).not.toContain("hidden");
    const genel = tag(html, /<button type="button" id="t-nav-0-title"[^>]*>/);
    expect(genel).toContain('aria-expanded="true"');
  });

  it("marks a clicked entry while its page loads (SHE-12)", () => {
    // One fixed-size bar in every nav link and the 2FA link.
    const bars = body().match(
      /class="pointer-events-none absolute inset-y-2 /g,
    );
    expect(bars).toHaveLength(LINKS.length + 1);
  });
});

describe("the layout", () => {
  const page = createElement("p", null, "PAGE");
  const render = async () =>
    renderToStaticMarkup(await AdminLayout({ children: page }));

  it("gives each Mobil Uygulama entry its own icon and says Mağaza vitrini (SHE-18, CON-19, SHE-22)", async () => {
    session.read = async () => ({
      email: "o@b.c",
      role: "owner",
      expiresAt: 0,
    });
    pathname = "/admin";
    const html = await render();
    expect(html).toContain("Mağaza vitrini");
    expect(html).not.toContain("Mağaza Hero");
    const icons = [
      "slaytlar",
      "duyurular",
      "gonderiler",
      "canli-durum",
      "fal-bildirimleri",
      "ayarlar",
    ].map((p) =>
      tag(html, new RegExp(`<a href="/admin/mobil/${p}"[^]*?</svg>`)).replace(
        /^[^]*?<svg/,
        "<svg",
      ),
    );
    expect(new Set(icons).size).toBe(6);
    expect(html).toContain("PAGE");
  });

  it("a cashier's shell: the till as home, no search", async () => {
    session.read = async () => ({
      email: "k@b.c",
      role: "cashier",
      expiresAt: 0,
    });
    pathname = "/admin/kasa";
    const html = await render();
    expect(html).toContain('href="/admin/kasa"');
    expect(html).not.toContain("/admin/siparisler");
    expect(html).not.toContain("/admin/ara");
    expect(html).toContain("/admin/2fa-kurulum");
  });

  it("an unreachable session check shows the shell with a notice, not the sign-in (SHE-11)", async () => {
    session.read = async () => {
      throw Object.assign(new Error("panel account unreadable"), {
        code: "ADMIN_SESSION_UNAVAILABLE",
      });
    };
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const html = await render();
    spy.mockRestore();
    expect(html).toContain('data-admin-root=""');
    expect(html).toMatch(/role="alert"[^>]*>.*Oturumun şu an doğrulanamıyor\./);
    // The page still renders (it throws into admin/error.tsx itself).
    expect(html).toContain("PAGE");
    expect(html).not.toContain("admin-nav-drawer");
  });

  it("recognises the marker property too, and lets any other error through", async () => {
    const marked = new Error("x");
    Object.defineProperty(marked, "__adminSessionUnavailable", { value: true });
    session.read = async () => {
      throw marked;
    };
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await render()).toContain("Oturumun şu an doğrulanamıyor.");
    spy.mockRestore();
    session.read = async () => {
      throw new Error("bug");
    };
    await expect(render()).rejects.toThrow("bug");
  });

  it("signed out: the bare wrapper", async () => {
    session.read = async () => null;
    const html = await render();
    expect(html).toContain("PAGE");
    expect(html).not.toContain("admin-nav-drawer");
    expect(html).not.toContain('role="alert"');
  });
});

describe("unknown addresses, the skeleton, the way back", () => {
  it("answers an unknown /admin address with the panel's 404 (SHE-20)", async () => {
    const Page = (await import("@/app/admin/[...rest]/page")).default;
    expect(() => Page()).toThrow("NEXT_NOT_FOUND");
  });

  it("shows a skeleton while a page loads, still under reduced motion", async () => {
    const Loading = (await import("@/app/admin/loading")).default;
    const html = renderToStaticMarkup(createElement(Loading));
    expect(html).toContain('aria-busy="true"');
    expect(html).toMatch(/role="status"[^>]*>Sayfa yükleniyor/);
    expect(html).toContain("motion-safe:animate-pulse");
  });

  it("'Panele dön' goes to the role's landing page; 'Tekrar dene' fetches again", async () => {
    const NotFound = (await import("@/app/admin/not-found")).default;
    const AdminError = (await import("@/app/admin/error")).default;
    const inPanel = (el: ReturnType<typeof createElement>) =>
      renderToStaticMarkup(
        createElement(PanelHomeProvider, { href: "/admin/kasa" }, el),
      );
    expect(inPanel(createElement(NotFound))).toMatch(
      /<a href="\/admin\/kasa"[^>]*>Panele dön<\/a>/,
    );
    const err = Object.assign(new Error("x"), { digest: "d1" });
    expect(
      inPanel(createElement(AdminError, { error: err, retry: () => {} })),
    ).toMatch(/<a href="\/admin\/kasa"[^>]*>Panele dön<\/a>/);
    // Outside the provider (signed-out screens): /admin.
    expect(renderToStaticMarkup(createElement(NotFound))).toContain(
      'href="/admin"',
    );
    const src = read("src/app/admin/error.tsx");
    expect(src).toContain("onClick={() => retry()}");
    expect(src).not.toContain("onClick={reset}");
  });
});
