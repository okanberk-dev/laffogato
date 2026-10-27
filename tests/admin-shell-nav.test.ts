import { readFileSync } from "node:fs";

import { createElement, type FunctionComponent, type ReactNode } from "react";
import { renderToReadableStream, renderToStaticMarkup } from "react-dom/server";
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
// The search action as the client layer sees a Server Action: a reference
// React can draw a progressive form for ($$FORM_ACTION) and match a posted
// form state against ($$IS_SIGNATURE_EQUAL). Its id is what a no-JS post
// names in the form state.
const searchRef = vi.hoisted(() => {
  const ID = "admin-search-action";
  const answers: unknown[] = [];
  const run = async (...args: unknown[]) => {
    answers.push(args);
    return { text: "", groups: null, tooShort: false, failed: false };
  };
  const encode = (prefix: string) => {
    const data = new FormData();
    data.append(`$ACTION_${prefix}:0`, JSON.stringify({ id: ID, bound: [] }));
    return {
      name: `$ACTION_REF_${prefix}`,
      method: "POST",
      encType: "multipart/form-data",
      data,
    };
  };
  const ref = Object.assign((...args: unknown[]) => run(...args), {
    $$FORM_ACTION: (prefix: string) => encode(prefix),
    // decodeFormState counts the bound state out: 0 for useActionState.
    $$IS_SIGNATURE_EQUAL: (id: string, bound: number) =>
      id === ID && bound === 0,
    bind: (_this: unknown, ...bound: unknown[]) =>
      Object.assign((...rest: unknown[]) => run(...bound, ...rest), {
        $$FORM_ACTION: (prefix: string) => encode(prefix),
      }),
  });
  return { ID, ref, answers };
});
vi.mock("@/app/admin/ara/actions", () => ({
  adminSearchAction: searchRef.ref,
}));
// The sidebar draws its icons through next/dynamic (a chunk of their own,
// so the cashier's Kasa loads no lucide). Here the module is simply there.
vi.mock("next/dynamic", async () => {
  const { NavIcon } = await import("@/components/admin/nav-icon");
  return { default: () => NavIcon };
});
vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "font-admin-sans", className: "" }),
}));
vi.mock("@/app/admin/siparisler/actions", () => ({
  openOrderSignalAction: vi.fn(async () => ({ count: 3, cursor: "" })),
}));
vi.mock("@/app/admin/mobil/karaoke/actions", () => ({
  karaokeTodaySignalAction: vi.fn(async () => ({ count: 1, cursor: "" })),
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
type PanelSignalAnswer =
  import("@/lib/admin/panel-signal-core").PanelSignalAnswer;
const sidebar = await import("@/components/admin/admin-sidebar");
const { ToastProvider } = await import("@/components/admin/ui/toast");
const { PanelHomeProvider } = await import("@/components/admin/panel-home");
const { ADMIN_CHANGED_EVENT } =
  await import("@/components/admin/ui/admin-changed");
const AdminLayout = (await import("@/app/admin/layout")).default;
const search = await import("@/components/admin/admin-search");
const { withDenied } = await import("@/lib/admin/nav-match");

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
    // A product has a view page (catalog lists, P2b): the edit page's
    // trail leads back to it.
    expect(t("/admin/urunler/prd-0001/duzenle")).toEqual([
      ["Ürünler", "/admin/urunler"],
      ["Ayrıntı", "/admin/urunler/prd-0001"],
      ["Düzenle", null],
    ]);
    const catalog = (p: string) =>
      breadcrumbTrail(p, [
        { href: "/admin/menu", label: "Menü" },
        { href: "/admin/kategoriler", label: "Kategoriler" },
      ]).map((c) => [c.label, c.href]);
    // No /admin/kategoriler/<id> page: the id is not a crumb of its own.
    expect(catalog("/admin/kategoriler/cat-1/duzenle")).toEqual([
      ["Kategoriler", "/admin/kategoriler"],
      ["Düzenle", null],
    ]);
    expect(catalog("/admin/menu/mnu-0001/duzenle")).toEqual([
      ["Menü", "/admin/menu"],
      ["Ayrıntı", "/admin/menu/mnu-0001"],
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
    const read = vi.fn(async (_cursor: string) => ({ count: 4, cursor: "" }));
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
    let release: (n: { count: number; cursor: string }) => void = () => {};
    const read = vi
      .fn<(cursor: string) => Promise<PanelSignalAnswer>>()
      .mockImplementationOnce(() => new Promise((r) => (release = r)))
      .mockResolvedValue({ count: 2, cursor: "" });
    const onCount = vi.fn();
    const stop = sidebar.startNavCountPoll({
      read,
      onCount,
      target,
      isVisible: () => true,
    });
    target.dispatchEvent(new Event(ADMIN_CHANGED_EVENT));
    expect(read).toHaveBeenCalledTimes(1);
    release({ count: 5, cursor: "" });
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

  it("sends the cursor back and keeps the number on an unchanged answer", async () => {
    const target = new EventTarget();
    const read = vi
      .fn<(cursor: string) => Promise<PanelSignalAnswer>>()
      .mockResolvedValueOnce({ count: 3, cursor: "s1.c1" })
      .mockResolvedValue({ unchanged: true });
    const onCount = vi.fn();
    const stop = sidebar.startNavCountPoll({
      read,
      onCount,
      target,
      isVisible: () => true,
      intervalMs: 1_000,
    });
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(read.mock.calls.map((c) => c[0])).toEqual(["", "s1.c1", "s1.c1"]);
    // The badge was set once and kept: unchanged sets nothing.
    expect(onCount.mock.calls).toEqual([[3]]);
    stop();
  });

  it("admin:changed drops the cursor: the read after an action is a full one", async () => {
    const target = new EventTarget();
    const read = vi
      .fn<(cursor: string) => Promise<PanelSignalAnswer>>()
      .mockResolvedValueOnce({ count: 3, cursor: "s1.c1" })
      .mockResolvedValue({ count: 2, cursor: "s1.c2" });
    const stop = sidebar.startNavCountPoll({
      read,
      onCount: vi.fn(),
      target,
      isVisible: () => true,
      intervalMs: 60_000,
    });
    await vi.advanceTimersByTimeAsync(0);
    target.dispatchEvent(new Event(ADMIN_CHANGED_EVENT));
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(read.mock.calls.map((c) => c[0])).toEqual(["", "", "s1.c2"]);
    stop();
  });

  it("a change that lands while a read is out does not keep that read's cursor", async () => {
    const target = new EventTarget();
    let release: (n: PanelSignalAnswer) => void = () => {};
    const read = vi
      .fn<(cursor: string) => Promise<PanelSignalAnswer>>()
      .mockImplementationOnce(() => new Promise((r) => (release = r)))
      .mockResolvedValue({ count: 1, cursor: "s1.c2" });
    const stop = sidebar.startNavCountPoll({
      read,
      onCount: vi.fn(),
      target,
      isVisible: () => true,
    });
    target.dispatchEvent(new Event(ADMIN_CHANGED_EVENT));
    release({ count: 4, cursor: "s1.before-the-change" });
    await vi.advanceTimersByTimeAsync(0);
    expect(read.mock.calls.map((c) => c[0])).toEqual(["", ""]);
    stop();
  });

  it("a failed read leaves the badge alone and the poll running", async () => {
    const target = new EventTarget();
    const read = vi
      .fn<(cursor: string) => Promise<PanelSignalAnswer>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({ count: 1, cursor: "" });
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

  it("adds `denied` to a landing path without breaking its own query", () => {
    expect(withDenied("/admin/kasa")).toBe("/admin/kasa?denied=1");
    expect(withDenied("/admin?durum=acik")).toBe("/admin?durum=acik&denied=1");
    expect(withDenied("/admin?denied=0")).toBe("/admin?denied=1");
    expect(
      sidebar.withoutDenied(`https://x.test${withDenied("/admin?a=1")}`),
    ).toBe("/admin?a=1");
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
        palette: { role: "owner", accountKey: "0123456789abcdef" },
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
    // The page card's left edge follows the sidebar's width (`--admin-side`,
    // 15.5rem or the rail's 4rem, UI-9); on paper the card is the page,
    // with no margin, corner or grey around it (Innex, 22 Eki 2026).
    const layout = read("src/app/admin/layout.tsx");
    expect(layout).toContain(
      'const PAGE_CARD_SIDE = "lg:ml-[calc(var(--admin-side,15.5rem)+1.25rem)]";',
    );
    expect(layout).toMatch(
      /const PAGE_CARD =\s*"[^"]*print:m-0 print:min-h-0 print:rounded-none";/,
    );
    expect(layout).toContain("print:bg-white");
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
    // The search (the palette's trigger since UI-6) comes first.
    expect(header).toContain("data-admin-palette-trigger");
    expect(header.indexOf("data-admin-palette-trigger")).toBeLessThan(
      header.indexOf("data-admin-topbar-actions"),
    );
    expect(html.match(/data-admin-topbar-actions/g)).toHaveLength(1);
  });

  it("shows the search only to a role it covers; without JavaScript it is a link to the results page", () => {
    // Admin UI v2, UI-6: the top bar's box became the ⌘K palette's trigger.
    // Its server markup is one link to /admin/ara (whose own box posts, so
    // the text is in no address). Innex (22 Eki 2026): a 44 px square on a
    // phone and, from `lg`, a search field with its words; the sidebar's
    // box with "Ctrl K" is gone (operator: the search "not Ctrl K").
    const html = renderSidebar();
    const header = html.slice(
      html.indexOf("<header"),
      html.indexOf("</header>"),
    );
    const trigger = tag(header, /<a [^>]*data-admin-palette-trigger[^>]*>/);
    expect(trigger).toContain('href="/admin/ara"');
    expect(trigger).toContain('aria-label="Sipariş, müşteri ya da sayfa ara"');
    expect(trigger).toContain('aria-haspopup="dialog"');
    expect(trigger).toContain('aria-keyshortcuts="Meta+K Control+K"');
    expect(html.match(/href="\/admin\/ara"/g)).toHaveLength(1);
    expect(html).not.toContain("data-admin-side-search");
    expect(html).not.toMatch(/Ctrl K|⌘K/);
    // No form and no text box in the bar any more: nothing typed there.
    expect(header).not.toContain("<form");
    expect(header).not.toContain('name="q"');
    const classes = /class="([^"]*)"/.exec(trigger)![1].split(" ");
    expect(classes).toEqual(
      expect.arrayContaining(["max-lg:size-11", "lg:w-72", "lg:flex"]),
    );
    const none = renderSidebar({ canSearch: false });
    expect(none).not.toContain("/admin/ara");
    expect(none).not.toContain("data-admin-palette-trigger");
    // Nothing for the wide bar to hold: it is not drawn there.
    expect(tag(none, /<header[^>]*>/)).toMatch(/\blg:hidden\b/);
    expect(tag(html, /<header[^>]*>/)).not.toMatch(/\blg:hidden\b/);
    // Without the palette's inputs there is no trigger either.
    expect(renderSidebar({ palette: undefined })).not.toContain(
      "data-admin-palette-trigger",
    );
  });

  it("with JavaScript, hands the text to the results page in memory, not in its address", () => {
    const target = new EventTarget();
    vi.stubGlobal("window", target);
    try {
      const heard = vi.fn();
      const stop = search.subscribeHandOff(heard);
      const push = vi.fn();
      search.sendToResultsPage("ayse@example.com", "/admin/siparisler", push);
      expect(push).toHaveBeenCalledWith("/admin/ara");
      expect(heard).toHaveBeenCalledTimes(1);
      expect(search.takeHandedOffSearch()).toBe("ayse@example.com");
      // Taken once.
      expect(search.takeHandedOffSearch()).toBeNull();
      // Already on the results page: no navigation, the page hears it.
      push.mockClear();
      search.sendToResultsPage("0532 123 45 67", "/admin/ara", push);
      expect(push).not.toHaveBeenCalled();
      expect(heard).toHaveBeenCalledTimes(2);
      expect(search.takeHandedOffSearch()).toBe("0532 123 45 67");
      stop();
    } finally {
      vi.unstubAllGlobals();
    }
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
    // Innex (22 Eki 2026): the current page is a grey row in the full ink,
    // whatever its group: no colour, no rule, and never the black row.
    expect(active).toContain("font-medium");
    expect(active).not.toContain("bg-[var(--admin-primary)]");
    expect(active).not.toContain("text-white");
    expect(active).toContain("bg-[var(--admin-panel)] text-[var(--admin-text)]");
    // A group's colour no longer tints its rows (it stays for the
    // dashboard's icon boxes, ui/hues.ts).
    pathname = "/admin/urunler";
    const catalog = renderSidebar();
    expect(
      tag(catalog, /<a href="\/admin\/urunler"[^>]*aria-current="page"[^>]*>/),
    ).toContain("bg-[var(--admin-panel)]");
    expect(catalog).not.toContain("--admin-hue-");
    pathname = "/admin/siparisler";
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

  it("draws five groups, each item with an icon of its own (UI-5, SHE-18, CON-19)", async () => {
    session.read = async () => ({
      email: "o@b.c",
      role: "owner",
      expiresAt: 0,
    });
    pathname = "/admin";
    const html = await render();
    const side = html.slice(html.indexOf("<aside"), html.indexOf("</aside>"));
    // Innex's small-capital titles, with no colour dot (22 Eki 2026).
    const titles = [
      ...side.matchAll(/id="side-nav-\d+-title"[^>]*>(?:<span>)?([^<]+)</g),
    ].map((m) => m[1]);
    expect(titles).toEqual([
      "Bugün",
      "Katalog",
      "Pazarlama",
      "İçerik",
      "Yönetim",
    ]);
    const rows = [
      ...side.matchAll(/<li class="relative"><a href="([^"]+)"[^]*?<\/a>/g),
    ];
    // 22 since Faturalar (e-Arşiv, 22 Ekim 2026, docs/EARSIV.md); 21 since
    // fA'L bildirimleri left the nav (27 Ekim 2026, fA'L retired).
    expect(rows).toHaveLength(21);
    // Each row draws a lucide icon, and no two rows draw the same one.
    const icons = rows.map((m) => /class="lucide ([^" ]+)/.exec(m[0])?.[1]);
    expect(icons.every(Boolean)).toBe(true);
    expect(new Set(icons).size).toBe(21);
    expect(side).not.toContain("Mağaza Hero");
    expect(html).toContain("PAGE");
  });

  it("a cashier's shell: no sidebar, menu button or drawer; logo, page name, account menu (UI-5)", async () => {
    session.read = async () => ({
      email: "k@b.c",
      role: "cashier",
      expiresAt: 0,
    });
    pathname = "/admin/kasa";
    const html = await render();
    expect(html).not.toContain("<aside");
    expect(html).not.toContain("admin-nav-drawer");
    expect(html).not.toContain("Menüyü aç");
    expect(html).not.toContain('aria-label="Panel"');
    expect(html).not.toContain("/admin/siparisler");
    expect(html).not.toContain("/admin/ara");
    const header = html.slice(
      html.indexOf("<header"),
      html.indexOf("</header>"),
    );
    expect(header).toMatch(
      /<a href="\/admin\/kasa"[^>]*aria-label="L&#x27;Affogato Admin"/,
    );
    expect(header).toMatch(/>Kasa<\/span>/);
    // The account menu: a native disclosure holding 2FA and Çıkış.
    expect(header).toContain("<details");
    expect(header).toContain('href="/admin/2fa-kurulum"');
    expect(header).toContain("Çıkış");
    // No icon chunk for the cashier: nothing lucide in the shell.
    expect(html).not.toContain('class="lucide');
    // Nothing to clear room for: the page card sits 8px off the window,
    // not right of a sidebar.
    expect(html).toContain(
      '<div id="admin-main" tabindex="-1" style="outline:none">',
    );
    expect(html).not.toContain("--admin-side,15.5rem");
    expect(html).toMatch(/data-admin-page-card="" class="[^"]* lg:ml-2"/);
    // The skip link is still the first thing to focus.
    expect(html.indexOf('href="#admin-main"')).toBeLessThan(
      html.indexOf("<header"),
    );
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
        createElement(
          PanelHomeProvider as FunctionComponent<{
            href: string;
            children?: ReactNode;
          }>,
          { href: "/admin/kasa" },
          el,
        ),
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

describe("the results page (no query in its address)", () => {
  const answer = {
    text: "ayşe",
    tooShort: false,
    failed: false,
    groups: [
      {
        section: "orders",
        label: "Siparişler",
        hits: [
          {
            href: "/admin/siparisler/ord-1",
            title: "#10001 · Ayşe Yılmaz",
            meta: ["Ödendi"],
            amountMinor: 18500,
            at: "2026-10-17T10:00:00.000Z",
          },
        ],
        more: true,
        listHref: "/admin/siparisler",
      },
    ],
  };

  // How Next draws /admin/ara for a no-JS post: the action ran, and its
  // answer is the form state, keyed by the permalink.
  const drawPosted = async (formState: unknown) => {
    const { AdminSearchResults } =
      await import("@/app/admin/ara/search-results");
    const stream = await renderToReadableStream(
      createElement(AdminSearchResults),
      {
        formState: formState as never,
      },
    );
    await stream.allReady;
    return new Response(stream).text();
  };

  it("draws a no-JS post's answer from the post itself", async () => {
    const html = await drawPosted([answer, "p/admin/ara", searchRef.ID, 0]);
    expect(html).toContain("#10001 · Ayşe Yılmaz");
    expect(html).toContain('href="/admin/siparisler/ord-1"');
    expect(html).toMatch(/İlk (<!-- -->)?5(<!-- -->)? sonuç · listeye git/);
    expect(html).toContain('href="/admin/siparisler"');
    // The box shows what was searched, and posts again the same way.
    expect(tag(html, /<input[^>]*id="admin-search-page"[^>]*>/)).toContain(
      'value="ayşe"',
    );
    const form = tag(html, /<form[^>]*action="\/admin\/ara"[^>]*>/);
    expect(form).toContain('method="POST"');
    // Nothing in the page links back to itself with the text.
    expect(html).not.toMatch(/href="[^"]*\?q=/);
    expect(html).not.toContain("ara?");
  });

  it("an answer posted for another form is not this page's", async () => {
    const html = await drawPosted([answer, "p/admin/kasa", searchRef.ID, 0]);
    expect(html).not.toContain("Ayşe Yılmaz");
    const other = await drawPosted([
      answer,
      "p/admin/ara",
      "another-action",
      0,
    ]);
    expect(other).not.toContain("Ayşe Yılmaz");
  });

  it("says a failed search is a failure, and keeps the box", async () => {
    const html = await drawPosted([
      { text: "ayşe", groups: null, tooShort: false, failed: true },
      "p/admin/ara",
      searchRef.ID,
      0,
    ]);
    expect(html).toMatch(/role="alert"[^>]*>Arama şu an yapılamadı/);
    expect(html).not.toContain("için sonuç yok");
    expect(tag(html, /<input[^>]*id="admin-search-page"[^>]*>/)).toContain(
      'value="ayşe"',
    );
  });

  it("the page reads no query from its address, and the box is no GET form", () => {
    const page = read("src/app/admin/ara/page.tsx");
    expect(page).not.toContain("searchParams");
    const box = read("src/components/admin/admin-search.tsx");
    expect(box).not.toContain("next/form");
    expect(box).not.toMatch(/method=["']get/i);
    const lib = read("src/lib/admin/search.ts");
    expect(lib).not.toMatch(/\?q=\$\{/);
  });
});
