import { readFileSync } from "node:fs";

import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { compile } from "tailwindcss";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AdminNavGroup } from "@/components/admin/admin-sidebar";
import type { AdminRole } from "@/lib/admin/roles";

/**
 * The laptop rail and the "Sıkı görünüm" switch (admin UI v2, UI-9, design
 * 3.6; the kit's compact classes are admin-compact-density.test.ts). The
 * rules are pure and run here directly. The markup is what the server
 * draws, which is always the wide, comfortable default, and the folded
 * rail as the sidebar draws it once the browser says so. No jsdom:
 * interaction (hover, Esc, a reload with the rail folded) is the PR's
 * browser pass.
 */

let pathname = "/admin/siparisler";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  unstable_rethrow: vi.fn(),
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
  Geist: () => ({ variable: "font-geist-sans", className: "" }),
  Geist_Mono: () => ({ variable: "font-geist-mono", className: "" }),
}));
vi.mock("@/app/admin/siparisler/actions", () => ({
  openOrderSignalAction: vi.fn(async () => ({ count: null, cursor: "" })),
}));
vi.mock("@/app/admin/mobil/karaoke/actions", () => ({
  karaokeTodaySignalAction: vi.fn(async () => ({ count: null, cursor: "" })),
}));
vi.mock("@/app/admin/actions", () => ({ logoutAction: vi.fn() }));
vi.mock("@/components/admin/order-alerts", () => ({ OrderAlerts: () => null }));

const session = vi.hoisted(() => ({ role: "owner" as string }));
vi.mock("@/lib/admin/auth", () => ({
  getAdminSession: async () => ({
    email: "x@laffogato.net",
    role: session.role,
    expiresAt: 0,
  }),
}));
vi.mock("@/lib/admin/flash", () => ({ readAdminFlash: async () => null }));

// The layout's sidebar is captured (its props are the role's nav); the real
// one is drawn below.
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
const core = await import("@/lib/admin/view-prefs-core");
const prefs = await import("@/components/admin/view-prefs");
const palette = await import("@/lib/admin/palette-core");
const { landingPathFor } = await import("@/lib/admin/roles");
const { searchSectionsFor } = await import("@/lib/admin/search");

const ROLES: AdminRole[] = ["owner", "manager", "staff", "cashier"];
const FULL = ["owner", "manager", "staff"] as const;

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
const LAYOUT = {} as Record<AdminRole, Awaited<ReturnType<typeof layoutFor>>>;
for (const role of ROLES) LAYOUT[role] = await layoutFor(role);

const read = (p: string) => readFileSync(p, "utf8");
/** How React writes text and attributes. */
const esc = (v: string) => v.replaceAll("&", "&amp;").replaceAll("'", "&#x27;");
const classOf = (tag: string) =>
  (/class="([^"]*)"/.exec(tag)?.[1] ?? "").replaceAll("&amp;", "&");
const tokens = (classes: string) => classes.split(/\s+/).filter(Boolean);

// ── The rules ─────────────────────────────────────────────────────────────

describe("the stored choices", () => {
  it("fold the rail only for a stored 'collapsed' and tighten only for a stored 'compact'", () => {
    expect(core.RAIL_PREF_KEY).toBe("laf_admin_rail_v1");
    expect(core.DENSITY_PREF_KEY).toBe("laf_admin_density_v1");
    expect(core.parseRailPref("collapsed")).toBe(true);
    expect(core.parseDensityPref("compact")).toBe(true);
    for (const raw of [
      null,
      undefined,
      "",
      "expanded",
      "comfortable",
      "1",
      "on",
    ]) {
      expect(core.parseRailPref(raw), String(raw)).toBe(false);
      expect(core.parseDensityPref(raw), String(raw)).toBe(false);
    }
    for (const raw of ["Collapsed", '"collapsed"', "collapsed ", "true"]) {
      expect(core.parseRailPref(raw), raw).toBe(false);
    }
    expect(core.railPrefValue(true)).toBe("collapsed");
    expect(core.railPrefValue(false)).toBe("expanded");
    expect(core.densityPrefValue(true)).toBe("compact");
    expect(core.densityPrefValue(false)).toBe("comfortable");
  });

  it("are for the roles with the full shell, never the cashier; the toast says when a touch screen ignores it", () => {
    for (const role of FULL)
      expect(core.viewPrefsForRole(role), role).toBe(true);
    for (const role of ["cashier", null, undefined] as const) {
      expect(core.viewPrefsForRole(role), String(role)).toBe(false);
    }
    expect(core.densityMessage(true, true)).toBe("Sıkı görünüm açık.");
    expect(core.densityMessage(false, true)).toBe("Sıkı görünüm kapalı.");
    expect(core.densityMessage(true, false)).toBe(
      "Sıkı görünüm açık. Dokunmatik ekranda uygulanmaz.",
    );
    expect(core.densityMessage(false, false)).toBe("Sıkı görünüm kapalı.");
  });
});

describe("the stores and the admin root's attributes", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const stubWindow = (storage: Partial<Storage>) => {
    const heard: Record<string, (e: unknown) => void> = {};
    vi.stubGlobal("window", {
      localStorage: storage,
      addEventListener: (type: string, fn: (e: unknown) => void) => {
        heard[type] = fn;
      },
      removeEventListener: () => {},
    });
    return heard;
  };

  it("read behind try/catch, write the encoded value, tell this tab's listeners and hear another tab's", () => {
    const data = new Map<string, string>();
    const heard = stubWindow({
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => void data.set(k, v),
    });
    let calls = 0;
    const stop = prefs.subscribeRailPref(() => void (calls += 1));
    expect(prefs.readRailPref()).toBe(false);
    prefs.writeRailPref(true);
    expect(data.get("laf_admin_rail_v1")).toBe("collapsed");
    expect(prefs.readRailPref()).toBe(true);
    prefs.writeRailPref(false);
    expect(data.get("laf_admin_rail_v1")).toBe("expanded");
    expect(calls).toBe(2);
    // Another tab: a storage event for the key, or a cleared storage.
    heard.storage({ key: "laf_admin_rail_v1" });
    heard.storage({ key: null });
    heard.storage({ key: "laf_admin_density_v1" });
    expect(calls).toBe(4);
    stop();
    prefs.writeRailPref(false);
    expect(calls).toBe(4);
    // The density is its own key.
    prefs.writeDensityPref(true);
    expect(data.get("laf_admin_density_v1")).toBe("compact");
    expect(prefs.readDensityPref()).toBe(true);
    expect(prefs.readRailPref()).toBe(false);
    prefs.writeDensityPref(false);
  });

  it("a storage that refuses (a private window) never throws: the default, then this tab's own choice", () => {
    stubWindow({
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    });
    expect(prefs.readRailPref()).toBe(false);
    expect(() => prefs.writeRailPref(true)).not.toThrow();
    expect(prefs.readRailPref()).toBe(true);
    prefs.writeRailPref(false);
    expect(prefs.readRailPref()).toBe(false);
    // Only the write refused: the tab still holds what was chosen.
    stubWindow({
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    });
    prefs.writeDensityPref(true);
    expect(prefs.readDensityPref()).toBe(true);
    prefs.writeDensityPref(false);
  });

  it("the choices go on [data-admin-root], the default takes them off, the cleanup too; no root, no error", () => {
    const attrs = new Map<string, string>();
    const root = {
      setAttribute: (n: string, v: string) => void attrs.set(n, v),
      removeAttribute: (n: string) => void attrs.delete(n),
    };
    const asked: string[] = [];
    vi.stubGlobal("document", {
      querySelector: (sel: string) => (asked.push(sel), root),
    });
    const undo = prefs.holdRootAttribute(core.RAIL_ATTR, core.RAIL_ATTR_VALUE);
    expect(asked).toEqual(["[data-admin-root]"]);
    expect(attrs.get("data-admin-rail")).toBe("on");
    undo();
    expect(attrs.has("data-admin-rail")).toBe(false);
    prefs.holdRootAttribute(core.DENSITY_ATTR, core.DENSITY_ATTR_VALUE);
    expect(attrs.get("data-admin-density")).toBe("compact");
    prefs.holdRootAttribute(core.DENSITY_ATTR, null);
    expect(attrs.has("data-admin-density")).toBe(false);
    vi.stubGlobal("document", { querySelector: () => null });
    expect(() =>
      prefs.holdRootAttribute("data-admin-rail", "on")(),
    ).not.toThrow();
  });
});

describe("the rail's tooltips: hover and focus-visible show them, Esc and leaving put them away", () => {
  const control = (props = new Map<string, string>()) => ({
    props,
    el: {
      getBoundingClientRect: () => ({ top: 200.4, height: 40 }),
      style: { setProperty: (n: string, v: string) => void props.set(n, v) },
      removeAttribute: (n: string) => void props.delete(n),
      setAttribute: (n: string, v: string) => void props.set(n, v),
    },
  });

  it("arriving puts the tooltip level with the control and lifts an earlier Esc", () => {
    const { el, props } = control(new Map([["data-tip-off", ""]]));
    core.placeRailTip(el);
    expect(props.get("--tip-y")).toBe("220px");
    expect(props.has("data-tip-off")).toBe(false);
  });

  it("Esc hides the tooltip of every control under the pointer or holding keyboard focus; leaving shows it again", () => {
    const a = control();
    const b = control();
    let selector = "";
    core.dismissRailTips({
      querySelectorAll: (s: string) => ((selector = s), [a.el, b.el]),
    });
    // `:focus-visible`, not `:focus`: a click's focus is not a keyboard's.
    expect(selector).toBe("[data-rail-link]:is(:hover, :focus-visible)");
    expect(a.props.get("data-tip-off")).toBe("");
    expect(b.props.get("data-tip-off")).toBe("");
    core.releaseRailTip(a.el);
    expect(a.props.has("data-tip-off")).toBe(false);
    expect(b.props.has("data-tip-off")).toBe(true);
  });
});

// ── The palette's command ─────────────────────────────────────────────────

describe("Komutlar: Sıkı görünüm", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const entry = (role: AdminRole) =>
    palette
      .commandEntries(role, { soundOn: true })
      .find((e) => e.id === "cmd:density");

  it("is there for the roles that have the palette, and not for the cashier", () => {
    for (const role of FULL) {
      expect(entry(role), role).toMatchObject({
        label: "Sıkı görünüm",
        command: "toggleDensity",
      });
      expect(entry(role)?.href).toBeUndefined();
    }
    expect(entry("cashier")).toBeUndefined();
    expect(palette.commandEntries(null, { soundOn: true })).toEqual([]);
    // The palette is the roles whose record search covers something.
    for (const role of ROLES) {
      expect(Boolean(entry(role)), role).toBe(
        searchSectionsFor(role).length > 0,
      );
    }
  });

  it("is found by what an operator types", () => {
    const entries = palette.commandEntries("owner", { soundOn: true });
    for (const q of [
      "sıkı",
      "siki",
      "Sıkı gör",
      "yogun",
      "compact",
      "kompakt",
    ]) {
      expect(palette.rankEntries(entries, q)[0]?.label, q).toBe("Sıkı görünüm");
    }
  });

  it("runs as an event on window: the list's chunk, at its budget, holds no density code", () => {
    const seen: string[] = [];
    const target = new EventTarget();
    target.addEventListener(core.DENSITY_TOGGLE_EVENT, () =>
      seen.push("density"),
    );
    target.addEventListener(palette.SHORTCUT_SHEET_EVENT, () =>
      seen.push("sheet"),
    );
    vi.stubGlobal("window", target);
    palette.runPaletteCommand("toggleDensity");
    palette.runPaletteCommand("shortcutSheet");
    expect(seen).toEqual(["density", "sheet"]);
    const list = read("src/components/admin/palette/palette.tsx");
    expect(list).not.toMatch(/density/i);
    expect(list).toContain("runPaletteCommand(target.command);");
  });
});

// ── What the server draws: the wide, comfortable default ─────────────────

const NAV = (role: AdminRole = "owner") => LAYOUT[role].groups;
const bodyOf = (over: Record<string, unknown> = {}, groups = NAV()) =>
  renderToStaticMarkup(
    createElement(sidebar.AdminSidebarBody, {
      groups,
      email: "x@laffogato.net",
      roleLabel: "Sahip",
      landingPath: "/admin",
      logout: () => {},
      pathname: "/admin/siparisler",
      counts: { orders: 7, karaoke: 120 },
      idPrefix: "t",
      shortcuts: true,
      density: true,
      ...over,
    } as Parameters<typeof sidebar.AdminSidebarBody>[0]),
  );
const shellOf = (role: AdminRole) => {
  pathname = role === "cashier" ? "/admin/kasa" : "/admin/siparisler";
  return renderToStaticMarkup(
    createElement(
      ToastProvider,
      null,
      createElement(sidebar.AdminSidebar, {
        groups: NAV(role),
        email: "x@laffogato.net",
        roleLabel: role,
        landingPath: landingPathFor(role),
        logout: () => {},
        canSearch: role !== "cashier",
        palette:
          role === "cashier"
            ? undefined
            : { role, accountKey: "0123456789abcdef" },
      }),
    ),
  );
};

describe("the first markup is the wide, comfortable sidebar", () => {
  it("carries no rail and no density: nothing on the admin root, no tooltip, one fold button saying 'daralt'", () => {
    for (const role of FULL) {
      const html = shellOf(role);
      const layout = LAYOUT[role].html;
      expect(layout, role).toMatch(/<div data-admin-root=""/);
      for (const word of ["data-admin-rail", "data-admin-density"]) {
        expect(layout, `${role} ${word}`).not.toContain(word);
      }
      for (const word of [
        "data-rail-link",
        "data-tip-off",
        "--tip-y",
        "genişlet",
      ]) {
        expect(html, `${role} ${word}`).not.toContain(word);
      }
      const fold = /<button[^>]*aria-label="Menüyü daralt"[^>]*>/.exec(
        html,
      )?.[0];
      expect(fold, role).toContain('aria-expanded="true"');
      expect(fold).toContain('aria-controls="admin-side"');
      expect(fold).toContain('title="Menüyü daralt"');
      expect(fold).toMatch(/\bh-11 w-11\b/);
      // In the desktop column only: the closed drawer draws no body.
      expect(html.match(/aria-label="Menüyü daralt"/g), role).toHaveLength(1);
      expect(html).toContain('<aside id="admin-side"');
    }
  });

  it("the sidebar's width is one variable, 17.5rem by default, that the sidebar, top bar, tab strip, page edge and bulk bar read", () => {
    const html = shellOf("owner");
    expect(/<aside[^>]*>/.exec(html)?.[0]).toContain(
      "w-[var(--admin-side,17.5rem)]",
    );
    expect(/<header[^>]*>/.exec(html)?.[0]).toContain(
      "lg:ml-[var(--admin-side,17.5rem)]",
    );
    expect(read("src/components/admin/admin-sidebar.tsx")).toContain(
      'className="mt-3 lg:mt-0 lg:ml-[var(--admin-side,17.5rem)] print:hidden"',
    );
    expect(read("src/components/admin/bulk.tsx")).toContain(
      "lg:left-[calc(var(--admin-side,17.5rem)+1rem)]",
    );
    for (const p of [
      "src/components/admin/admin-sidebar.tsx",
      "src/components/admin/bulk.tsx",
      "src/app/admin/layout.tsx",
    ]) {
      expect(read(p), p).not.toMatch(
        /lg:(?:ml|pl)-64|[ "]w-64 border-r|calc\((?:16|17\.5)rem/,
      );
    }
    for (const role of FULL) {
      expect(LAYOUT[role].html, role).toContain(
        'class="lg:pl-[var(--admin-side,17.5rem)] print:pl-0"',
      );
    }
    expect(LAYOUT.cashier.html).toContain(
      '<div id="admin-main" tabindex="-1" class="print:pl-0"',
    );
  });

  it("the root says 17.5rem and, once the shell wrote data-admin-rail=on, 4rem: compiled, the attribute wins", async () => {
    const compiler = await compile(
      "@theme { --breakpoint-lg: 64rem; --spacing: 0.25rem; } @tailwind utilities;",
      {},
    );
    for (const role of ROLES) {
      const root = /<div data-admin-root=""[^>]*>/.exec(LAYOUT[role].html)![0];
      const cls = tokens(classOf(root));
      expect(cls, role).toContain("[--admin-side:17.5rem]");
      expect(cls, role).toContain("data-[admin-rail=on]:[--admin-side:4rem]");
      const css = compiler.build(cls).replace(/\s+/g, " ");
      expect(css).toContain("{ --admin-side: 17.5rem; }");
      expect(css).toMatch(/\[data-admin-rail="on"\] \{ --admin-side: 4rem; \}/);
    }
    // Nothing in the site's stylesheet: the layout's classes carry it all.
    const css = read("src/app/globals.css");
    for (const word of [
      "data-admin-density",
      "data-admin-rail",
      "admin-side",
    ]) {
      expect(css).not.toContain(word);
    }
  });
});

describe("the account block's Sıkı görünüm", () => {
  it("is a switch between the single-key switch and Çıkış, off on the server, with a note a touch screen sees", () => {
    for (const role of FULL) {
      const html = shellOf(role);
      const account = html.slice(html.indexOf('aria-label="Hesap"'));
      const sw =
        /<button type="button" role="switch" aria-checked="false" aria-describedby="([^"]+)"[^>]*>[^]*?<\/button>/.exec(
          account,
        );
      expect(sw, role).not.toBeNull();
      expect(sw![0]).toContain("Sıkı görünüm");
      expect(sw![0]).not.toContain('data-on=""');
      expect(sw![0]).toMatch(/\bmin-h-11\b/);
      const hint = new RegExp(
        `<p id="${sw![1]}" class="([^"]*)">([^<]*)</p>`,
      ).exec(account);
      expect(hint?.[2]).toBe("Dokunmatik ekranda uygulanmaz.");
      // Said on a touch screen only: hidden for a pointer that can aim.
      expect(tokens(hint![1])).toEqual(
        expect.arrayContaining(["hidden", "pointer-coarse:block"]),
      );
      const at = (text: string) => account.indexOf(text);
      expect(at("Tek tuş kısayolları")).toBeLessThan(at("Sıkı görünüm"));
      expect(at("Sıkı görünüm")).toBeLessThan(at("Çıkış"));
    }
  });

  it("the cashier's shell has none of it, and the code that runs it is past the early return", () => {
    const html = shellOf("cashier");
    for (const word of [
      "Sıkı görünüm",
      "Menüyü daralt",
      "data-rail-link",
      'role="switch"',
      "<aside",
    ]) {
      expect(html, word).not.toContain(word);
    }
    const src = read("src/components/admin/admin-sidebar.tsx");
    const body = src.slice(src.indexOf("export function AdminSidebar("));
    const earlyReturn = body.indexOf("if (!chrome) {");
    for (const name of ["useRailPref", "useDensityPref", "ViewPrefs"]) {
      expect(body.slice(0, earlyReturn), name).not.toContain(name);
    }
    expect(body.indexOf("<ViewPrefs />")).toBeGreaterThan(earlyReturn);
  });
});

// ── The folded rail ───────────────────────────────────────────────────────

const navOf = (html: string) =>
  html.slice(html.indexOf("<nav"), html.indexOf("</nav>"));
const itemsOf = (groups: AdminNavGroup[]) => groups.flatMap((g) => g.items);

describe("the folded rail", () => {
  const html = bodyOf({ rail: true, onToggleRail: () => {} });
  const nav = navOf(html);
  const items = itemsOf(NAV());

  it("keeps all 22 links (Faturalar since 22 Ekim 2026), each named by aria-label (a badge's count included) and none with a visible label", () => {
    const links = nav.match(/<a [^>]*data-rail-link=""[^>]*>/g) ?? [];
    expect(items).toHaveLength(22);
    expect(links).toHaveLength(22);
    for (const item of items) {
      const link = links.find((l) => l.includes(`href="${item.href}"`));
      expect(link, item.label).toBeDefined();
      expect(/aria-label="([^"]*)"/.exec(link!)?.[1], item.label).toMatch(
        new RegExp(`^${esc(item.label)}`),
      );
    }
    expect(html).toContain(
      'aria-label="Siparişler, 7 Açık sipariş (ödeme bekleyen · ödenen · hazırlanan · yolda ya da hazır)"',
    );
    expect(html).toContain(
      'aria-label="Karaoke, 99+ Bugünkü karaoke rezervasyonu (iptal edilmemiş)"',
    );
    // No label as text beside the icon, and no second link for the badge.
    expect(nav).not.toContain('class="truncate"');
    expect(nav).not.toContain("durum=acik");
  });

  it("names each as a tooltip: a hidden child that hover and focus-visible reveal, Esc and leaving put away", () => {
    const tips =
      nav.match(/<span aria-hidden="true" class="fixed [^"]*">/g) ?? [];
    expect(tips).toHaveLength(22);
    expect(tokens(classOf(tips[0] ?? ""))).toEqual(
      expect.arrayContaining([
        "hidden",
        "group-hover/tip:block",
        "group-focus-visible/tip:block",
        "group-data-[tip-off]/tip:hidden!",
        "top-[var(--tip-y,0px)]",
      ]),
    );
    expect(nav.match(/<a [^>]*class="group\/tip /g)).toHaveLength(22);
  });

  it("opens every group (a folded one has no title to unfold it), keeps the titles for screen readers, draws rules between", () => {
    const folded = bodyOf({
      rail: true,
      onToggleRail: () => {},
      collapsed: new Set(["Katalog", "Pazarlama", "İçerik"]),
    });
    expect(folded).not.toMatch(/<ul id="t-nav-\d"[^>]*\shidden/);
    expect(folded).not.toMatch(/<button[^>]*id="t-nav-\d-title"/);
    const titles = [
      ...folded.matchAll(/<div id="t-nav-\d-title" class="sr-only">([^<]+)</g),
    ].map((m) => m[1]);
    expect(titles).toEqual([
      "Bugün",
      "Katalog",
      "Pazarlama",
      "İçerik",
      "Yönetim",
    ]);
    expect(
      folded.match(/aria-hidden="true" class="mx-2 my-2 border-t/g),
    ).toHaveLength(4);
    // The wide sidebar folds them behind buttons.
    expect(bodyOf({ collapsed: new Set(["Katalog"]) })).toMatch(
      /<ul id="t-nav-1"[^>]*\shidden/,
    );
  });

  it("is 64 px of icons: the mark alone, a 44 px control that now says 'genişlet', no note, no scrollbar", () => {
    const brand =
      /<a href="\/admin"[^>]*aria-label="L&#x27;Affogato Admin"[^>]*>[^]*?<\/a>/.exec(
        html,
      )![0];
    expect(brand).not.toContain("Admin</span>");
    const toggle = /<button[^>]*aria-label="Menüyü genişlet"[^>]*>/.exec(
      html,
    )![0];
    expect(toggle).toContain('aria-expanded="false"');
    expect(toggle).toContain('aria-controls="admin-side"');
    expect(toggle).toContain("data-rail-link");
    expect(toggle).toMatch(/\bh-11 w-11\b/);
    expect(html).not.toContain("Menü sadeleşti");
    expect(classOf(/<nav [^>]*>/.exec(html)![0])).toContain(
      "[scrollbar-width:none]",
    );
    expect(classOf(/<nav [^>]*>/.exec(bodyOf())![0])).not.toContain(
      "scrollbar-width",
    );
  });

  it("keeps the account block behind an initial: 2FA, both switches and Çıkış open beside the rail", () => {
    const menu = /<details data-admin-account-menu=""[^]*?<\/details>/.exec(
      html,
    )![0];
    const summary = /<summary[^>]*>[^]*?<\/summary>/.exec(menu)![0];
    for (const part of ['aria-label="Hesap"', "data-rail-link", ">X</span>"]) {
      expect(summary, part).toContain(part);
    }
    expect(summary).toMatch(/\bh-11 w-11\b/);
    expect(classOf(/<section[^>]*>/.exec(menu)![0])).toContain("left-full");
    for (const text of [
      "x@laffogato.net",
      "Güvenlik / 2FA",
      "Tek tuş kısayolları",
      "Sıkı görünüm",
      "Çıkış",
    ]) {
      expect(menu, text).toContain(text);
    }
    // The wide sidebar has the same block behind its profile row (opening
    // upward, lafmaliyet's profile menu), not beside the rail.
    const wide = /<details data-admin-account-menu=""[^]*?<\/details>/.exec(
      bodyOf(),
    )![0];
    expect(classOf(/<section[^>]*>/.exec(wide)![0])).toContain("bottom-full");
    expect(classOf(/<section[^>]*>/.exec(wide)![0])).not.toContain("left-full");
  });

  it("is one flat list for Personel too; the drawer's body (no fold control) is never the rail but has the switch", () => {
    const staff = NAV("staff");
    const flat = bodyOf({ rail: true, onToggleRail: () => {} }, staff);
    expect(navOf(flat).match(/data-rail-link/g)).toHaveLength(
      itemsOf(staff).length,
    );
    expect(flat).toContain('<ul id="t-nav"');
    const drawer = bodyOf({ idPrefix: "drawer" });
    expect(drawer).not.toContain("Menüyü daralt");
    expect(drawer).not.toContain("data-rail-link");
    expect(drawer).toContain("Sıkı görünüm");
  });
});
