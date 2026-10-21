import { readFileSync } from "node:fs";

import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AdminRole } from "@/lib/admin/roles";
import type {
  ShortcutFacts,
  ShortcutKey,
  ShortcutState,
} from "@/lib/admin/shortcut-core";

/**
 * The panel's single-key shortcuts (admin UI v2, UI-8, design §4.4,
 * decision D7): `/`, `n`, `?` and `g` with a letter. The rules are pure
 * (shortcut-core.ts) and run here in node: every reason a key is left
 * alone, the `g` window, the Turkish second keys, the role's pages and the
 * switch. Then the switch's store, the sheet's and the sidebar's server
 * markup, the search box the `/` key focuses, the palette's new command
 * and its Oluştur-only view, and how the layer is loaded. The listener on
 * a real page was checked in a scripted browser (the PR's checklist).
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
// The sidebar draws its icons through next/dynamic; here the module is there.
vi.mock("next/dynamic", async () => {
  const { NavIcon } = await import("@/components/admin/nav-icon");
  return { default: () => NavIcon };
});
vi.mock("@/app/admin/siparisler/actions", () => ({
  openOrderSignalAction: vi.fn(async () => ({ count: null, cursor: "" })),
}));
vi.mock("@/app/admin/mobil/karaoke/actions", () => ({
  karaokeTodaySignalAction: vi.fn(async () => ({ count: null, cursor: "" })),
}));
vi.mock("@/app/admin/liste-arama/actions", () => ({
  listSearchAction: vi.fn(),
}));

const core = await import("@/lib/admin/shortcut-core");
const pref = await import("@/components/admin/shortcut-pref");
const palette = await import("@/lib/admin/palette-core");

const read = (path: string) => readFileSync(path, "utf8");
const ROLES: AdminRole[] = ["owner", "manager", "staff", "cashier"];

/** A plain keydown with nothing pressed but the key. */
const key = (k: string, over: Partial<ShortcutKey> = {}): ShortcutKey => ({
  key: k,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  isComposing: false,
  repeat: false,
  defaultPrevented: false,
  isTrusted: true,
  ...over,
});

const facts = (over: Partial<ShortcutFacts> = {}): ShortcutFacts => ({
  role: "owner",
  pathname: "/admin/siparisler",
  enabled: true,
  typing: false,
  dialogOpen: false,
  now: 10_000,
  ...over,
});

/** Keys in a row, `ms` apart, through the rules: the commands they gave. */
function press(
  keys: Array<string | ShortcutKey>,
  over: Partial<ShortcutFacts> = {},
  ms = 100,
) {
  let state: ShortcutState = core.SHORTCUT_IDLE;
  let now = over.now ?? 10_000;
  const out: Array<ReturnType<typeof core.readShortcut>> = [];
  for (const k of keys) {
    const step = core.readShortcut(
      state,
      typeof k === "string" ? key(k) : k,
      facts({ ...over, now }),
    );
    out.push(step);
    state = step.state;
    now += ms;
  }
  return out;
}

const last = (...args: Parameters<typeof press>) => press(...args).at(-1)!;

describe("what each key does", () => {
  it("`/` searches, `n` creates, `?` opens the sheet, and each takes the key's default", () => {
    expect(last(["/"])).toEqual({
      state: core.SHORTCUT_IDLE,
      command: { kind: "search" },
      handled: true,
    });
    expect(last(["n"]).command).toEqual({ kind: "new" });
    expect(last(["?"]).command).toEqual({ kind: "sheet" });
    for (const k of ["/", "n", "?"]) expect(last([k]).handled).toBe(true);
  });

  it("an unbound key is left to the page (its default stays)", () => {
    for (const k of [
      "a",
      "x",
      "Enter",
      " ",
      "Escape",
      "ArrowDown",
      "1",
      "Dead",
      "constructor",
      "__proto__",
    ]) {
      expect(last([k]), k).toEqual({
        state: core.SHORTCUT_IDLE,
        command: null,
        handled: false,
      });
    }
  });

  it("Shift is not a modifier here: `?` needs it, `/` is Shift+7 on Turkish-Q, Caps Lock's N is n", () => {
    // event.key already says which character the keyboard made.
    expect(last(["?"]).command).toEqual({ kind: "sheet" });
    expect(last(["/"]).command).toEqual({ kind: "search" });
    expect(last(["N"]).command).toEqual({ kind: "new" });
    expect(last(["G", "S"]).command).toEqual({
      kind: "go",
      href: "/admin/siparisler",
    });
  });

  it("`g` waits for its letter: the key is taken, nothing happens yet", () => {
    const [g] = press(["g"]);
    expect(g.command).toBeNull();
    expect(g.handled).toBe(true);
    expect(g.state.gAt).toBe(10_000);
  });
});

describe("when a key is left alone", () => {
  // Each case also forgets a waiting `g`: the letter after it is not a page.
  const cases: Array<[string, Partial<ShortcutKey>, Partial<ShortcutFacts>]> = [
    ["focus in a field", {}, { typing: true }],
    ["a dialog is open", {}, { dialogOpen: true }],
    ["an IME is composing", { isComposing: true }, {}],
    ["with ⌘", { metaKey: true }, {}],
    ["with Ctrl", { ctrlKey: true }, {}],
    ["with Alt (Option)", { altKey: true }, {}],
    ["with AltGr as Ctrl+Alt (Windows)", { ctrlKey: true, altKey: true }, {}],
    ["with AltGr reported apart", { altGraph: true }, {}],
    ["a control already took it", { defaultPrevented: true }, {}],
    ["a script sent it", { isTrusted: false }, {}],
    ["the switch is off", {}, { enabled: false }],
    ["for the cashier", {}, { role: "cashier" }],
    ["for no role", {}, { role: null }],
    ["on the Kasa", {}, { pathname: "/admin/kasa" }],
    ["under the Kasa", {}, { pathname: "/admin/kasa/okut" }],
  ];

  it.each(cases)("%s", (_name, over, place) => {
    for (const k of ["/", "n", "?", "g"]) {
      const step = core.readShortcut(
        core.SHORTCUT_IDLE,
        key(k, over),
        facts(place),
      );
      expect(step, k).toEqual({
        state: core.SHORTCUT_IDLE,
        command: null,
        handled: false,
      });
    }
    // `g`, then the letter under the same condition: no page, and `g` forgotten.
    const waiting = { gAt: 10_000 };
    const step = core.readShortcut(
      waiting,
      key("s", over),
      facts({ ...place, now: 10_100 }),
    );
    expect(step.command).toBeNull();
    expect(step.state).toEqual(core.SHORTCUT_IDLE);
  });

  it("names the reason", () => {
    const f = facts();
    expect(core.shortcutSkip(key("n"), f)).toBeNull();
    expect(core.shortcutSkip(key("n", { isTrusted: false }), f)).toBe(
      "synthetic",
    );
    expect(core.shortcutSkip(key("n"), { ...f, enabled: false })).toBe("off");
    expect(core.shortcutSkip(key("n"), { ...f, role: "cashier" })).toBe("off");
    expect(core.shortcutSkip(key("n"), { ...f, pathname: "/admin/kasa" })).toBe(
      "off",
    );
    expect(core.shortcutSkip(key("n", { defaultPrevented: true }), f)).toBe(
      "taken",
    );
    expect(core.shortcutSkip(key("Process"), f)).toBe("composing");
    expect(core.shortcutSkip(key("n", { isComposing: true }), f)).toBe(
      "composing",
    );
    expect(
      core.shortcutSkip(key("@", { ctrlKey: true, altKey: true }), f),
    ).toBe("modifier");
    expect(core.shortcutSkip(key("n"), { ...f, typing: true })).toBe("typing");
    expect(core.shortcutSkip(key("n"), { ...f, dialogOpen: true })).toBe(
      "dialog",
    );
  });

  it("an IME's placeholder key (Process) is never read as a letter", () => {
    expect(last(["g", "Process"]).command).toBeNull();
    expect(last(["Process"]).handled).toBe(false);
  });

  it("only the Kasa is off: other pages with kasa in their name are not", () => {
    expect(core.isTillPath("/admin/kasa")).toBe(true);
    expect(core.isTillPath("/admin/kasa/")).toBe(true);
    expect(core.isTillPath("/admin/kasalar")).toBe(false);
    expect(core.isTillPath("/admin")).toBe(false);
    expect(
      core.singleKeysActive({
        role: "owner",
        pathname: "/admin/raporlar/gun-sonu",
        enabled: true,
      }),
    ).toBe(true);
  });

  it("what counts as a field: input, textarea, select, contenteditable", () => {
    for (const tagName of ["INPUT", "TEXTAREA", "SELECT", "input", "select"]) {
      expect(core.typingTarget({ tagName }), tagName).toBe(true);
    }
    expect(core.typingTarget({ tagName: "DIV", isContentEditable: true })).toBe(
      true,
    );
    for (const tagName of ["BUTTON", "A", "BODY", "SUMMARY", "DIALOG"]) {
      expect(core.typingTarget({ tagName }), tagName).toBe(false);
    }
    expect(core.typingTarget(null)).toBe(false);
    expect(core.typingTarget(undefined)).toBe(false);
  });
});

describe("`g` and a letter", () => {
  const PAGES: Record<string, string> = {
    b: "/admin",
    s: "/admin/siparisler",
    k: "/admin/mobil/karaoke",
    d: "/admin/kasa",
    m: "/admin/menu",
    u: "/admin/urunler",
    r: "/admin/raporlar",
  };

  it("opens each page for the owner", () => {
    for (const [letter, href] of Object.entries(PAGES)) {
      expect(last(["g", letter]), letter).toEqual({
        state: core.SHORTCUT_IDLE,
        command: { kind: "go", href },
        handled: true,
      });
    }
  });

  it("is role-gated: a page the role cannot open does nothing", () => {
    const opens = (role: AdminRole) =>
      Object.keys(PAGES).filter(
        (letter) => last(["g", letter], { role }).command?.kind === "go",
      );
    expect(opens("owner")).toEqual(["b", "s", "k", "d", "m", "u", "r"]);
    expect(opens("manager")).toEqual(["b", "s", "k", "d", "m", "u", "r"]);
    expect(opens("staff")).toEqual(["b", "s", "k", "d"]);
    expect(opens("cashier")).toEqual([]);
    // Staff on `g m`: nothing, and `m` itself is no key.
    expect(last(["g", "m"], { role: "staff" })).toEqual({
      state: core.SHORTCUT_IDLE,
      command: null,
      handled: false,
    });
  });

  it("each target asks for the section its page's requireRole asks for, and has the nav's name", () => {
    const layout = read("src/app/admin/layout.tsx");
    for (const g of core.GO_SHORTCUTS) {
      const page = read(`src/app${g.href}/page.tsx`);
      expect(page, g.href).toContain(`requireRole("${g.section}")`);
      expect(layout, g.href).toMatch(
        new RegExp(`href: "${g.href}",\\s*label: "${g.label}"`),
      );
    }
    expect(new Set(core.GO_SHORTCUTS.map((g) => g.key)).size).toBe(
      core.GO_SHORTCUTS.length,
    );
  });

  it("waits 1.5 s for the letter, not longer", () => {
    expect(last(["g", "s"], {}, 1500).command).toEqual({
      kind: "go",
      href: "/admin/siparisler",
    });
    expect(last(["g", "s"], {}, 1501).command).toBeNull();
    // A clock that went back is not "within" the window.
    const step = core.readShortcut(
      { gAt: 20_000 },
      key("s"),
      facts({ now: 19_000 }),
    );
    expect(step.command).toBeNull();
  });

  it("a late letter is read on its own: `g`, then `n` 2 s later, is `n`", () => {
    expect(last(["g", "n"], {}, 2000).command).toEqual({ kind: "new" });
  });

  it("another key after `g` is read on its own: `g /` searches, `g ?` opens the sheet", () => {
    expect(last(["g", "/"]).command).toEqual({ kind: "search" });
    expect(last(["g", "?"]).command).toEqual({ kind: "sheet" });
    expect(last(["g", "x"])).toEqual({
      state: core.SHORTCUT_IDLE,
      command: null,
      handled: false,
    });
  });

  it("`g g` starts the window again", () => {
    const [, again, s] = press(["g", "g", "s"], {}, 1000);
    expect(again.state.gAt).toBe(11_000);
    expect(s.command).toEqual({ kind: "go", href: "/admin/siparisler" });
  });

  it("the second key may come with its marks: ü is u, ş is s; ç, ö and ğ open nothing", () => {
    expect(last(["g", "ü"]).command).toEqual({
      kind: "go",
      href: "/admin/urunler",
    });
    expect(last(["g", "Ü"]).command).toEqual({
      kind: "go",
      href: "/admin/urunler",
    });
    expect(last(["g", "ş"]).command).toEqual({
      kind: "go",
      href: "/admin/siparisler",
    });
    expect(last(["g", "Ş"]).command).toEqual({
      kind: "go",
      href: "/admin/siparisler",
    });
    for (const k of ["ç", "ö", "ğ", "c", "o"]) {
      expect(last(["g", k]).command, k).toBeNull();
    }
    // Only the second key: ğ never starts a sequence, ü is no key alone.
    expect(last(["ğ", "s"]).command).toBeNull();
    expect(last(["ü"]).handled).toBe(false);
  });

  it("nothing on i or ı, in either case", () => {
    expect(core.GO_SHORTCUTS.map((g) => g.key)).not.toContain("i");
    expect(core.GO_SHORTCUTS.map((g) => g.key)).not.toContain("ı");
    for (const k of ["i", "ı", "I", "İ"]) {
      expect(last(["g", k]).command, k).toBeNull();
      expect(last([k]).handled, k).toBe(false);
    }
    // Caps Lock's I lowers the Turkish way.
    expect(core.typedKey("I")).toBe("ı");
    expect(core.typedKey("İ")).toBe("i");
  });

  it("unsaved changes on the page: the page's letter leaves nothing, the other keys still work", () => {
    for (const letter of ["b", "s", "k", "d", "m", "u", "r", "ü", "ş"]) {
      expect(last(["g", letter], { unsaved: true }), letter).toEqual({
        state: core.SHORTCUT_IDLE,
        command: null,
        handled: false,
      });
    }
    // "Guatemala" typed after the wizard's "+ Varyant ekle": the button
    // goes with the click, focus falls to the page, and G, u is `g u`.
    const wizard = { pathname: "/admin/urunler/yeni" };
    expect(
      press(["G", "u", "a"], { ...wizard, unsaved: true }).map(
        (s) => s.command,
      ),
    ).toEqual([null, null, null]);
    expect(last(["G", "r"], { ...wizard, unsaved: true }).command).toBeNull();
    // Without unsaved changes the letter goes, as before.
    expect(last(["G", "u"], wizard).command).toEqual({
      kind: "go",
      href: "/admin/urunler",
    });
    // Keys that stay on the page still work; `n` opens the palette there
    // (the layer follows no link while the form is unsaved).
    expect(last(["/"], { unsaved: true }).command).toEqual({ kind: "search" });
    expect(last(["?"], { unsaved: true }).command).toEqual({ kind: "sheet" });
    expect(last(["n"], { unsaved: true }).command).toEqual({ kind: "new" });
  });

  it("a lone modifier between `g` and its letter waits; a held key's repeats do nothing", () => {
    const shift = key("Shift");
    expect(last(["g", shift, "s"]).command).toEqual({
      kind: "go",
      href: "/admin/siparisler",
    });
    const [, held] = press(["n", key("n", { repeat: true })]);
    expect(held.command).toBeNull();
    expect(held.handled).toBe(false);
    const [, gHeld, s] = press(["g", key("g", { repeat: true }), "s"]);
    expect(gHeld.state.gAt).toBe(10_000);
    expect(s.command).toEqual({ kind: "go", href: "/admin/siparisler" });
  });

  it("the sheet lists the role's own pages", () => {
    expect(core.goShortcutsFor("staff").map((g) => g.label)).toEqual([
      "Genel bakış",
      "Siparişler",
      "Karaoke",
      "Kasa",
    ]);
    expect(core.goShortcutsFor("cashier")).toEqual([]);
    expect(core.goShortcutsFor(null)).toEqual([]);
  });
});

describe("aria-keyshortcuts, written while the keys work", () => {
  it("/ on the search box (or on the trigger without one), n on the primary link", () => {
    expect(core.shortcutHints(true, { hasSearch: true })).toEqual({
      search: "/",
      newLink: "n",
      trigger: "Meta+K Control+K",
    });
    expect(core.shortcutHints(true, { hasSearch: false })).toEqual({
      search: "/",
      newLink: "n",
      trigger: "Meta+K Control+K /",
    });
  });

  it("off: none, and the trigger keeps only the palette's keys", () => {
    for (const hasSearch of [true, false]) {
      expect(core.shortcutHints(false, { hasSearch })).toEqual({
        search: null,
        newLink: null,
        trigger: core.PALETTE_KEYSHORTCUTS,
      });
    }
  });

  it("the trigger's server value is the palette's keys", async () => {
    const { PaletteTrigger } =
      await import("@/components/admin/palette/trigger");
    const html = renderToStaticMarkup(
      createElement(PaletteTrigger, {
        groups: [],
        role: "owner",
        accountKey: "0123456789abcdef",
      }),
    );
    expect(html).toContain(`aria-keyshortcuts="${core.PALETTE_KEYSHORTCUTS}"`);
  });
});

describe("the switch (Tek tuş kısayolları)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is on unless it was turned off", () => {
    expect(pref.parseShortcutPref(null)).toBe(true);
    expect(pref.parseShortcutPref(undefined)).toBe(true);
    expect(pref.parseShortcutPref("on")).toBe(true);
    expect(pref.parseShortcutPref("junk")).toBe(true);
    expect(pref.parseShortcutPref("off")).toBe(false);
  });

  it("is stored per browser and tells its listeners", () => {
    const store = new Map<string, string>();
    const listeners: Array<() => void> = [];
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
      },
      addEventListener: () => {},
      removeEventListener: () => {},
    });
    let heard = 0;
    const stop = pref.subscribeShortcutPref(() => {
      heard += 1;
    });
    listeners.push(stop);
    expect(pref.readShortcutPref()).toBe(true);
    pref.writeShortcutPref(false);
    expect(store.get(pref.SHORTCUT_PREF_KEY)).toBe("off");
    expect(pref.readShortcutPref()).toBe(false);
    pref.writeShortcutPref(true);
    expect(store.get(pref.SHORTCUT_PREF_KEY)).toBe("on");
    expect(heard).toBe(2);
    stop();
    pref.writeShortcutPref(true);
    expect(heard).toBe(2);
  });

  it("a storage that refuses (private window) still holds the choice for this tab", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new Error("SecurityError");
        },
        setItem: () => {
          throw new Error("QuotaExceededError");
        },
      },
      addEventListener: () => {},
      removeEventListener: () => {},
    });
    expect(() => pref.writeShortcutPref(false)).not.toThrow();
    expect(pref.readShortcutPref()).toBe(false);
    pref.writeShortcutPref(true);
    expect(pref.readShortcutPref()).toBe(true);
  });
});

describe("the sheet's server markup", () => {
  const sheet = async (
    over: Partial<
      Parameters<
        (typeof import("@/components/admin/ui/shortcut-sheet"))["ShortcutSheet"]
      >[0]
    > = {},
  ) => {
    const { ShortcutSheet } =
      await import("@/components/admin/ui/shortcut-sheet");
    return renderToStaticMarkup(
      createElement(ShortcutSheet, {
        role: "owner",
        paletteKey: "⌘K",
        enabled: true,
        onToggle: () => {},
        onClose: () => {},
        ...over,
      }),
    );
  };

  it("is a native dialog, named by its title, closed by a dialog form without JavaScript's help", async () => {
    const html = await sheet();
    expect(html).toMatch(
      /^<dialog [^>]*aria-labelledby="admin-shortcut-sheet-title"/,
    );
    expect(html).toContain(
      '<h2 id="admin-shortcut-sheet-title" class="text-base font-semibold text-[var(--admin-text)]">Klavye kısayolları</h2>',
    );
    expect(html).toMatch(
      /<form method="dialog"><button type="submit" aria-label="Kapat" class="[^"]*\bh-11 w-11\b/,
    );
    // Closed until the layer opens it.
    expect(html).not.toMatch(/<dialog [^>]*\sopen(=|\s|>)/);
  });

  it("lists the keys in Turkish, and the role's own `g` pages only", async () => {
    const owner = await sheet();
    for (const text of [
      "Paleti aç (yazarken de)",
      "Pencereyi kapat",
      "Listenin arama kutusu; yoksa palet",
      "Sayfanın Yeni düğmesi; yoksa Oluştur",
      "Kısayol listesi",
      "Genel bakış",
      "Siparişler",
      "Karaoke",
      "Kasa",
      "Kafe menüsü",
      "Ürünler",
      "Raporlar",
    ]) {
      expect(owner, text).toContain(text);
    }
    expect(owner).toContain(">⌘K</kbd>");
    expect(owner).toMatch(
      />g<\/kbd><span[^>]*>sonra<\/span><kbd[^>]*>s<\/kbd>/,
    );
    const staff = await sheet({ role: "staff", paletteKey: "Ctrl K" });
    expect(staff).toContain(">Ctrl K</kbd>");
    expect(staff).toContain("Siparişler");
    for (const text of ["Kafe menüsü", "Ürünler", "Raporlar"]) {
      expect(staff, text).not.toContain(text);
    }
    // No long dashes in anything this PR shows.
    expect(owner).not.toMatch(/[–—]/);
  });

  it("names the marked letters that stand for the role's own `g` letters, no others", async () => {
    expect(core.markedFormsOf("u")).toEqual(["ü"]);
    expect(core.markedFormsOf("s")).toEqual(["ş"]);
    expect(core.markedFormsOf("b")).toEqual([]);
    const owner = await sheet();
    expect(owner).toContain(
      "İkinci harfe 1,5 saniye içinde bas; s yerine ş, u yerine ü de olur.",
    );
    // Staff have no `g u`; ç, ö and ğ stand for no page at all.
    const staff = await sheet({ role: "staff" });
    expect(staff).toContain(
      "İkinci harfe 1,5 saniye içinde bas; s yerine ş de olur.",
    );
    for (const html of [owner, staff]) {
      expect(html).not.toContain("işaretsiz");
      expect(html).not.toMatch(/yerine [çöğ]/);
      expect(html).not.toContain("ü, ş, ç, ö, ğ");
    }
  });

  it("carries the switch, and says where the keys stand", async () => {
    const on = await sheet();
    expect(on).toMatch(
      /<button type="button" role="switch" aria-checked="true"[^>]*><span class="flex-1">Tek tuş kısayolları<\/span><span aria-hidden="true" data-on=""/,
    );
    expect(on).toContain(
      "Açık. Aynı düğme menünün altındaki Hesap bölümünde de var.",
    );
    const off = await sheet({ enabled: false, paletteKey: "Ctrl K" });
    expect(off).toContain('role="switch" aria-checked="false"');
    expect(off).toContain("Kapalı. Ctrl K çalışmaya devam eder.");
    const till = await sheet({ pausedHere: true });
    expect(till).toContain('aria-checked="true"');
    expect(till).toContain(
      "Kasa&#x27;da kapalı: okutulan ve yazılan kodlar buraya gelir.",
    );
  });
});

describe("the user menu's switch", () => {
  const NAV = [
    {
      title: "Bugün",
      items: [
        { href: "/admin", label: "Genel bakış", section: "dashboard" },
        { href: "/admin/siparisler", label: "Siparişler", section: "orders" },
        { href: "/admin/kasa", label: "Kasa", section: "till" },
      ],
    },
  ];
  const render = async (role: AdminRole, groups = NAV) => {
    const sidebar = await import("@/components/admin/admin-sidebar");
    const { ToastProvider } = await import("@/components/admin/ui/toast");
    return renderToStaticMarkup(
      createElement(
        ToastProvider,
        null,
        createElement(sidebar.AdminSidebar, {
          groups,
          email: "a@laffogato.net",
          roleLabel: "Sahip",
          landingPath: "/admin",
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

  it.each(["owner", "manager", "staff"] as const)(
    "%s: in the account block, between Güvenlik / 2FA and Çıkış, on by default",
    async (role) => {
      pathname = "/admin/siparisler";
      const html = await render(role);
      const account = html.slice(html.indexOf('aria-label="Hesap"'));
      const sw =
        /<button type="button" role="switch" aria-checked="true"[^>]*>[^]*?<\/button>/.exec(
          account,
        )?.[0];
      expect(sw).toBeDefined();
      expect(sw).toContain("Tek tuş kısayolları");
      expect(sw).toMatch(/\bmin-h-11\b/);
      expect(account.indexOf("Güvenlik / 2FA")).toBeLessThan(
        account.indexOf("Tek tuş kısayolları"),
      );
      expect(account.indexOf("Tek tuş kısayolları")).toBeLessThan(
        account.indexOf("Çıkış"),
      );
      // The keys' hints are the layer's, after mount: none from the server
      // but the palette trigger's own.
      expect(html.match(/aria-keyshortcuts="[^"]*"/g)).toEqual([
        'aria-keyshortcuts="Meta+K Control+K"',
      ]);
    },
  );

  it("the cashier has neither the switch nor the layer", async () => {
    pathname = "/admin/kasa";
    const html = await render("cashier", [
      {
        title: "Bugün",
        items: [{ href: "/admin/kasa", label: "Kasa", section: "till" }],
      },
    ]);
    expect(html).not.toContain("Tek tuş kısayolları");
    expect(html).not.toContain('role="switch"');
    expect(html).not.toContain("aria-keyshortcuts");
  });

  it("the layer is a chunk of its own, asked for after hydration and only for the roles with single keys", () => {
    const src = read("src/components/admin/admin-sidebar.tsx");
    expect(src).toContain('import("@/components/admin/shortcuts")');
    expect(src).not.toMatch(
      /^import [^;]*from "@\/components\/admin\/shortcuts";/m,
    );
    expect(src).toContain(
      "{palette && shortcuts && <ShortcutLayer role={palette.role} />}",
    );
    expect(src).toContain(
      "const shortcuts = singleKeysForRole(palette?.role);",
    );
    // What every page loads is the role check alone: the rules ride in the
    // layer's chunk, and the palette's list chunk (at its 45 KB budget)
    // takes none of them.
    const valueFrom = (code: string, mod: string) =>
      new RegExp(`^import (?!type\\b)[^;]*from "${mod}";`, "m").test(code);
    expect(valueFrom(src, "@/lib/admin/shortcut-roles")).toBe(true);
    expect(valueFrom(src, "@/lib/admin/shortcut-core")).toBe(false);
    for (const f of [
      "src/lib/admin/palette-shell.ts",
      "src/lib/admin/palette-core.ts",
      "src/components/admin/palette/palette.tsx",
      "src/components/admin/palette/trigger.tsx",
    ]) {
      const code = read(f);
      expect(valueFrom(code, "./shortcut-core"), f).toBe(false);
      expect(valueFrom(code, "@/lib/admin/shortcut-core"), f).toBe(false);
    }
  });
});

describe("unsaved changes (the product wizard's guard)", () => {
  it("the guard module answers for every mounted guard and forgets a released one", async () => {
    const guard = await import("@/components/admin/unsaved-guard");
    expect(guard.hasUnsavedForm()).toBe(false);
    // A real guard: unsaved once the operator typed and the fields differ.
    let fields = "name=";
    const wizard = guard.createUnsavedGuard(() => fields);
    const release = guard.trackUnsavedGuard(wizard);
    expect(guard.hasUnsavedForm()).toBe(false);
    wizard.touch();
    fields = "name=Kenya";
    expect(guard.hasUnsavedForm()).toBe(true);
    // Another, clean guard does not hide it.
    const other = guard.trackUnsavedGuard({ dirty: () => false });
    expect(guard.hasUnsavedForm()).toBe(true);
    release();
    expect(guard.hasUnsavedForm()).toBe(false);
    other();
    expect(guard.hasUnsavedForm()).toBe(false);
  });

  it("the hook counts its form while mounted; the layer asks before it leaves the page", () => {
    const hook = read("src/components/admin/unsaved-guard.ts");
    expect(hook).toContain("const untrack = trackUnsavedGuard(guard);");
    expect(hook).toMatch(/return \(\) => \{\s*untrack\(\);/);
    expect(read("src/components/admin/product-wizard.tsx")).toContain(
      "useUnsavedGuard(formRef);",
    );
    const layer = read("src/components/admin/shortcuts.tsx");
    expect(layer).toContain(
      "unsaved: !typing && !dialogOpen && hasUnsavedForm(),",
    );
    expect(layer).toContain(
      "const link = hasUnsavedForm() ? null : newLink();",
    );
  });

  it("the sheet says so", async () => {
    const { ShortcutSheet } =
      await import("@/components/admin/ui/shortcut-sheet");
    const html = renderToStaticMarkup(
      createElement(ShortcutSheet, {
        role: "owner",
        paletteKey: "⌘K",
        enabled: true,
        onToggle: () => {},
        onClose: () => {},
      }),
    );
    expect(html).toContain(
      "tek tuşlar çalışmaz; kaydedilmemiş bir form varken sayfadan çıkmaz.",
    );
  });
});

describe("the layer itself", () => {
  it("draws nothing on the server (the sheet opens on a key)", async () => {
    const { AdminShortcuts } = await import("@/components/admin/shortcuts");
    expect(
      renderToStaticMarkup(createElement(AdminShortcuts, { role: "owner" })),
    ).toBe("");
  });

  it("listens once, in the bubble phase, and reads the rules (not its own)", () => {
    const src = read("src/components/admin/shortcuts.tsx");
    expect(src.match(/addEventListener\("keydown"/g)).toHaveLength(1);
    expect(src).toContain('window.addEventListener("keydown", onKey);');
    expect(src).toContain("readShortcut(");
    // A native dialog or a React Aria pop-over in the panel's portal node
    // (the calendar) both silence single keys (review of #197, F3).
    expect(src).toContain("dialog[open], [data-admin-portal] [role='dialog']");
    expect(src).toContain('getModifierState?.("AltGraph")');
    // A single key never presses a button: `n` follows a link only.
    expect(src).toContain(
      'el.matches("a[href]") ? el : el.querySelector("a[href]")',
    );
    // Read-only, like the palette: no Server Action.
    expect(src).not.toMatch(/from "@\/app\/[^"]*actions"/);
  });
});

describe("the `/` key's search box", () => {
  it("is the FilterBar's lead search box, and only that one", async () => {
    const { FilterBar } = await import("@/components/admin/ui/filter-bar");
    const { AUDIT_FILTER_FIELDS } = await import("@/lib/admin/audit-view");
    const { ORDER_FILTER_FIELDS } = await import("@/lib/admin/order-filters");
    const draw = (fields: typeof ORDER_FILTER_FIELDS, path: string) =>
      renderToStaticMarkup(
        createElement(FilterBar, { fields, searchParams: {}, pathname: path }),
      );
    const orders = draw(ORDER_FILTER_FIELDS, "/admin/siparisler");
    expect(orders.match(/data-admin-search=""/g)).toHaveLength(1);
    expect(orders).toMatch(
      /<input [^>]*type="search"[^>]*data-admin-search=""/,
    );
    // The audit log has two boxes (Kim, Kayıt no): the first one is the lead.
    const audit = draw(AUDIT_FILTER_FIELDS, "/admin/olay-kaydi");
    const boxes = audit.match(/<input [^>]*type="search"[^>]*>/g) ?? [];
    expect(boxes.length).toBeGreaterThan(1);
    expect(boxes[0]).toContain('data-admin-search=""');
    for (const box of boxes.slice(1)) {
      expect(box).not.toContain("data-admin-search");
    }
  });
});

describe("the palette's side", () => {
  it("Komutlar gains Klavye kısayolları for the roles with single keys", () => {
    for (const role of ["owner", "manager", "staff"] as const) {
      const entry = palette
        .commandEntries(role, { soundOn: true })
        .find((e) => e.id === "cmd:shortcuts");
      expect(entry, role).toMatchObject({
        label: "Klavye kısayolları",
        command: "shortcutSheet",
      });
      expect(entry?.href).toBeUndefined();
    }
    expect(
      palette
        .commandEntries("cashier", { soundOn: true })
        .some((e) => e.id === "cmd:shortcuts"),
    ).toBe(false);
    const found = palette.rankEntries(
      palette.commandEntries("owner", { soundOn: true }),
      "kisayol",
    );
    expect(found[0]?.label).toBe("Klavye kısayolları");
  });

  it("an open request names its view; anything else is the whole palette", () => {
    expect(palette.paletteViewOf("create")).toBe("create");
    for (const v of [
      "all",
      undefined,
      null,
      "",
      "CREATE",
      { view: "create" },
    ]) {
      expect(palette.paletteViewOf(v)).toBe("all");
    }
  });

  it("the trigger opens on the layer's request; the list shows Oluştur alone in the create view", () => {
    const trigger = read("src/components/admin/palette/trigger.tsx");
    expect(trigger).toContain(
      "window.addEventListener(PALETTE_OPEN_EVENT, onOpen);",
    );
    expect(trigger).toContain("show(paletteViewOf((e as CustomEvent).detail))");
    expect(trigger).toMatch(/<Body\b[^>]*?\bview=\{view\}/);
    const list = read("src/components/admin/palette/palette.tsx");
    expect(list).toContain('const all = view !== "create";');
    expect(list).toContain('const search = useRecordSearch(all ? text : "");');
    expect(list).toContain("if (!query && all) {");
    expect(list).toContain('if (all) section("go", "Git", entryItems(go));');
    expect(list).toContain('section("create", "Oluştur", entryItems(create));');
    expect(list).toContain(
      'if (all) section("commands", "Komutlar", entryItems(commands));',
    );
    // The commands the shell answers (the sheet, since UI-9 the density
    // too) close the palette first (one dialog at a time), then go out as
    // an event; the order sound is the one command the list runs itself.
    expect(list).toMatch(
      /target\.command !== "toggleSound"\) \{\s*close\(\);\s*runPaletteCommand\(target\.command\);/,
    );
  });
});

describe("roles", () => {
  it("single keys for owner, manager and staff; never the cashier", async () => {
    const roles = await import("@/lib/admin/shortcut-roles");
    expect(core.singleKeysForRole).toBe(roles.singleKeysForRole);
    expect(ROLES.filter((r) => core.singleKeysForRole(r))).toEqual([
      "owner",
      "manager",
      "staff",
    ]);
    expect(core.singleKeysForRole(null)).toBe(false);
    expect(core.singleKeysForRole(undefined)).toBe(false);
  });
});
