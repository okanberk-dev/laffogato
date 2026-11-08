import { readFileSync } from "node:fs";
import {
  createElement,
  createRef,
  type FunctionComponent,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FakeDocument, FakeForm, FakeWindow } from "./_support/fake-page";
import { expectReactGuard, formOpenTags } from "./_support/form-guard";

/**
 * The unsaved-changes guard (admin UI v2, UI-17, design §5 item 13). No DOM
 * in these tests: the rules are pure (the compare, the edit gate, the link
 * filter), the controller and the form glue run against fake `window`,
 * `document` and form objects that are real EventTargets, and the browser
 * pass in the PR body covers what only a browser can (a real confirm, a
 * real <Link>).
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
  redirect: vi.fn(),
  notFound: vi.fn(),
  unstable_rethrow: () => {},
  useRouter: () => ({ push() {}, refresh() {}, replace() {} }),
  usePathname: () => "/admin",
  useSearchParams: () => new URLSearchParams(),
}));

const guard = await import("@/components/admin/ui/unsaved-guard");
const registry = await import("@/components/admin/unsaved-guard");
const shell = await import("@/lib/admin/palette-shell");
const shortcutCore = await import("@/lib/admin/shortcut-core");

const read = (path: string) => readFileSync(path, "utf8");
/** A static or dynamic import of the guard module. */
const IMPORTS_GUARD = /(?:\bfrom|\bimport\s*\()\s*["'][^"']*unsaved-guard["']/;
const snap = (entries: Array<[string, unknown]>) => guard.snapshotOf(entries);
/** Entries as "name=value" (the value may hold more "="). */
const E = (...pairs: string[]): Array<[string, string]> =>
  pairs.map((p) => [p.slice(0, p.indexOf("=")), p.slice(p.indexOf("=") + 1)]);

// ── The compare ────────────────────────────────────────────────────────────

describe("snapshotOf: what counts as the same form", () => {
  it("ignores the order names come in, keeps the order of one name's values", () => {
    expect(snap(E("b=2", "a=1"))).toBe(snap(E("a=1", "b=2")));
    // A reordered list is a change: the position is the meaning.
    expect(snap(E("slot=x", "slot=y"))).not.toBe(snap(E("slot=y", "slot=x")));
  });

  it("tells a ticked box from an unticked one by the name being absent, and absent from empty", () => {
    expect(snap(E("isActive=on"))).not.toBe(snap([]));
    expect(snap(E("note="))).not.toBe(snap([]));
    // The roles of Bildirimler: several boxes, one name.
    const owner = snap(E("orderNotifyRoles=owner"));
    const both = snap(E("orderNotifyRoles=owner", "orderNotifyRoles=staff"));
    expect(owner).not.toBe(both);
    expect(snap(E("orderNotifyRoles=staff"))).not.toBe(owner);
    expect(snap(E("r=x"))).not.toBe(snap(E("r=x", "r=x")));
  });

  it("leaves file inputs out, a real FormData's included", () => {
    const form = (title: string, file?: File) => {
      const data = new FormData();
      data.append("title", title);
      if (file) data.append("photo", file);
      return guard.snapshotOf(data.entries());
    };
    const same = form("Kahve", new File(["abc"], "a.png"));
    expect(form("Kahve", new File(["xyz!"], "b.png"))).toBe(same);
    expect(form("Kahve")).toBe(same);
    // The text next to it still counts.
    expect(form("Kahve!", new File(["abc"], "a.png"))).not.toBe(same);
  });

  it("does not let one name and value read as another", () => {
    expect(snap(E("a=1=2"))).not.toBe(snap(E("a==1")));
    expect(snap([["a=1", "2"]])).not.toBe(snap([["a", "1=2"]]));
    expect(snap([["a", 'b"],["c']])).not.toBe(snap(E("a=b", "c=")));
    expect(snap([["a", "b\u0000c"]])).not.toBe(snap(E("a=b", "c=")));
  });

  it("is exact: case, spaces and the Turkish dotted İ count", () => {
    expect(snap(E("n=Kenya"))).not.toBe(snap(E("n=kenya")));
    expect(snap(E("n=Kenya "))).not.toBe(snap(E("n=Kenya")));
    expect(snap(E("n=İzmir"))).not.toBe(snap(E("n=Izmir")));
  });
});

describe("savedAnswer: the answer of a save that wrote", () => {
  it("takes a message with no error and nothing to confirm", () => {
    const ok = { message: "Kaydedildi." };
    expect(guard.savedAnswer(ok)).toBe(ok);
    expect(
      guard.savedAnswer({ message: "x", fieldErrors: { a: "b" } }),
    ).toEqual({ message: "x", fieldErrors: { a: "b" } });
  });

  it("refuses a refusal, a question, an empty answer and no answer", () => {
    expect(guard.savedAnswer({ error: "Hata" })).toBeNull();
    expect(guard.savedAnswer({ message: "x", error: "Hata" })).toBeNull();
    expect(
      guard.savedAnswer({ message: "x", confirm: { keys: [] } }),
    ).toBeNull();
    expect(guard.savedAnswer({ message: "" })).toBeNull();
    expect(guard.savedAnswer({})).toBeNull();
    expect(guard.savedAnswer(null)).toBeNull();
    expect(guard.savedAnswer(undefined)).toBeNull();
  });

  it("is the predicate the tab forms already use to toast a success", () => {
    for (const file of [
      "src/app/admin/ayarlar/settings-ui.tsx",
      "src/app/admin/mobil/ayarlar/app-config-ui.tsx",
    ]) {
      expect(read(file), file).toContain(
        "!result.confirm && result.message && !result.error",
      );
    }
  });
});

// ── The edit gate and the saved state ──────────────────────────────────────

/** A form's fields: [name, value] entries, read as the guard reads them. */
function page(initial: Array<[string, string]>) {
  const entries = initial.map((e): [string, string] => [...e]);
  return {
    read: () => snap(entries),
    set(name: string, value: string) {
      const hit = entries.find(([n]) => n === name);
      if (hit) hit[1] = value;
      else entries.push([name, value]);
    },
  };
}

describe("createFormGuard: dirty, refused, saved", () => {
  it("a form nobody touched is clean, whatever the page did to it by itself", () => {
    const f = page([["name", "Sirena"]]);
    const g = guard.createFormGuard(f.read);
    expect(g.dirty()).toBe(false);
    // A revalidation, a restored value, a late effect: not the operator's.
    f.set("name", "Sirena 2");
    f.set("slug", "sirena");
    expect(g.dirty()).toBe(false);
  });

  it("is dirty once the operator edited and the field differs, clean when typed back", () => {
    const f = page([["name", "Sirena"]]);
    const g = guard.createFormGuard(f.read);
    g.edit("name");
    expect(g.dirty()).toBe(false);
    f.set("name", "Sirena!");
    expect(g.dirty()).toBe(true);
    f.set("name", "Sirena");
    expect(g.dirty()).toBe(false);
  });

  it("compares only the fields the operator edited: what the page moves by itself never counts", () => {
    const f = page([
      ["title", "Eski"],
      ["version", "1"],
    ]);
    const g = guard.createFormGuard(f.read);
    g.edit("title");
    f.set("title", "Eski!");
    f.set("title", "Eski"); // typed back
    // A colleague's save re-rendered the page: an untouched field moved.
    f.set("version", "2");
    expect(g.dirty()).toBe(false);
    // An edit elsewhere does not make it count either.
    g.edit("title");
    f.set("title", "Yeni");
    expect(g.dirty()).toBe(true);
    f.set("title", "Eski");
    expect(g.dirty()).toBe(false);
    // A field the operator edits counts from its own saved value.
    g.edit("version");
    expect(g.dirty()).toBe(true);
    f.set("version", "1");
    expect(g.dirty()).toBe(false);
  });

  it("stays quiet after a save, once an edit is typed back", () => {
    // The independent review's case (F1): it failed at 47e2f892.
    const f = page([
      ["title", "Eski"],
      ["version", "1"],
    ]);
    const g = guard.createFormGuard(f.read);
    g.edit("title");
    f.set("title", "Yeni");
    g.submit();
    g.saved();
    f.set("version", "2"); // the revalidated page re-renders the hidden field
    expect(g.dirty()).toBe(false);
    g.edit("title");
    f.set("title", "Yeni!");
    f.set("title", "Yeni"); // typed back to what was saved
    expect(g.dirty()).toBe(false);
  });

  it("a refused save keeps the form dirty, and so does fixing it halfway", () => {
    const f = page([
      ["email", "ali@ornek"],
      ["version", "1"],
    ]);
    const g = guard.createFormGuard(f.read);
    g.edit("email");
    f.set("email", "ali@ornek.com");
    g.submit(); // posted, and the server answered with an error: no saved()
    expect(g.dirty()).toBe(true);
    // A second try that is also refused, with the page moving another field.
    f.set("email", "ali@ornek.co");
    g.edit("email");
    g.submit();
    f.set("version", "2");
    expect(g.dirty()).toBe(true);
  });

  it("a save that wrote clears it, and the next edit starts from what was saved", () => {
    const f = page([["email", "ali@ornek"]]);
    const g = guard.createFormGuard(f.read);
    g.edit("email");
    f.set("email", "ali@ornek.com");
    g.submit();
    g.saved();
    expect(g.dirty()).toBe(false);
    f.set("email", "veli@ornek.com");
    g.edit("email");
    expect(g.dirty()).toBe(true);
    // Back to what the save wrote: clean again, not to the page's old value.
    f.set("email", "ali@ornek.com");
    expect(g.dirty()).toBe(false);
  });

  it("what is typed while the save is in flight is still unsaved", () => {
    const f = page([
      ["note", ""],
      ["version", "1"],
    ]);
    const g = guard.createFormGuard(f.read);
    g.edit("note");
    f.set("note", "ilk");
    g.submit();
    g.edit("note");
    f.set("note", "ilk ve devamı"); // after the post left, before the answer
    g.saved();
    f.set("version", "2");
    expect(g.dirty()).toBe(true);
    // Typed back to what went: the page's own change still does not count.
    f.set("note", "ilk");
    expect(g.dirty()).toBe(false);
  });

  it("a page that moves a field after a save does not ask about it", () => {
    const f = page([["note", ""]]);
    const g = guard.createFormGuard(f.read);
    g.edit("note");
    f.set("note", "yazıldı");
    g.submit();
    g.saved();
    // The revalidated page brings a colleague's value for a field never touched.
    f.set("other", "başkası");
    expect(g.dirty()).toBe(false);
  });

  it("a saved answer that arrives with no post seen (a replayed Enter) takes the form as it is", () => {
    const f = page([["a", "1"]]);
    const g = guard.createFormGuard(f.read);
    g.edit("a");
    f.set("a", "2");
    g.saved();
    expect(g.dirty()).toBe(false);
  });

  it("a reset form is clean, and the defaults it went back to are the new baseline", () => {
    const f = page([["a", "1"]]);
    const g = guard.createFormGuard(f.read);
    g.edit("a");
    f.set("a", "2");
    expect(g.dirty()).toBe(true);
    // The page re-rendered with other defaults (a save elsewhere), and the
    // form went back to them.
    f.set("a", "3");
    g.reset();
    expect(g.dirty()).toBe(false);
    g.edit("a");
    f.set("a", "1"); // the old value is a change from what it is now
    expect(g.dirty()).toBe(true);
    f.set("a", "3");
    expect(g.dirty()).toBe(false);
  });

  it("only reads the form when an edit made it worth it", () => {
    const read = vi.fn(() => snap(E("a=1")));
    const g = guard.createFormGuard(read);
    expect(read).toHaveBeenCalledTimes(1); // the baseline
    g.dirty();
    g.dirty();
    expect(read).toHaveBeenCalledTimes(1);
    g.edit("a");
    g.dirty();
    expect(read).toHaveBeenCalledTimes(2);
  });
});

// ── The link filter ────────────────────────────────────────────────────────

const HERE = "https://laffogato.net/admin/ayarlar";

describe("linkAsksToLeave: which clicks leave the page", () => {
  const asks = (
    click: Partial<import("@/components/admin/ui/unsaved-guard").LinkClick> & {
      href: string;
    },
  ) => guard.linkAsksToLeave(click, HERE);

  it("another page of the panel does, by a relative or an absolute address", () => {
    expect(asks({ href: "/admin/siparisler" })).toBe(true);
    expect(asks({ href: "https://laffogato.net/admin/menu?durum=acik" })).toBe(
      true,
    );
    expect(asks({ href: "/admin/mobil/ayarlar", target: "_self" })).toBe(true);
    expect(asks({ href: "/admin/siparisler", target: "" })).toBe(true);
    expect(asks({ href: "/admin/siparisler", button: 0 })).toBe(true);
  });

  it("the same page does not, whatever the query or the hash", () => {
    expect(asks({ href: "/admin/ayarlar" })).toBe(false);
    expect(asks({ href: "/admin/ayarlar?sekme=email" })).toBe(false);
    expect(asks({ href: "#admin-main" })).toBe(false);
    expect(asks({ href: "/admin/ayarlar#kargo" })).toBe(false);
  });

  it("another origin, a protocol the site does not serve, or nothing readable does not", () => {
    expect(asks({ href: "https://example.com/admin/siparisler" })).toBe(false);
    expect(asks({ href: "http://laffogato.net/admin/siparisler" })).toBe(false);
    expect(asks({ href: "https://www.laffogato.net/admin/menu" })).toBe(false);
    expect(asks({ href: "mailto:info@laffogato.net" })).toBe(false);
    expect(asks({ href: "tel:+902160000000" })).toBe(false);
    expect(asks({ href: "javascript:void(0)" })).toBe(false);
    expect(asks({ href: "https://" })).toBe(false);
  });

  it("a new tab, a new window and a download do not: modifiers, target, download", () => {
    for (const mod of ["ctrlKey", "metaKey", "shiftKey", "altKey"] as const) {
      expect(asks({ href: "/admin/menu", [mod]: true }), mod).toBe(false);
    }
    expect(asks({ href: "/admin/menu", button: 1 })).toBe(false);
    expect(asks({ href: "/admin/menu", button: 2 })).toBe(false);
    expect(asks({ href: "/admin/menu", target: "_blank" })).toBe(false);
    expect(asks({ href: "/admin/menu", target: "_top" })).toBe(false);
    expect(asks({ href: "/admin/menu", target: "yeni" })).toBe(false);
    expect(asks({ href: "/admin/menu", download: true })).toBe(false);
  });

  it("a click something already handled, or a link that only opens a dialog here, does not", () => {
    expect(asks({ href: "/admin/menu", defaultPrevented: true })).toBe(false);
    expect(asks({ href: "/admin/ara", skip: true })).toBe(false);
    expect(guard.LINK_SKIP_SELECTOR).toContain("[data-admin-palette-trigger]");
    // The trigger is the one anchor in the shell that is a button.
    expect(read("src/components/admin/palette/trigger.tsx")).toContain(
      'data-admin-palette-trigger=""',
    );
  });

  it("leavesPage is the one rule the palette's question uses too", () => {
    expect(guard.leavesPage("/admin/siparisler", HERE)).toBe(true);
    expect(guard.leavesPage("/admin/ayarlar?sekme=kargo", HERE)).toBe(false);
    expect(guard.leavesPage("/admin/ayarlar/", HERE)).toBe(true);
  });
});

// ── The controller, the registry and the form glue ─────────────────────────

/** What the form's `read` is when it is the real thing: FormData's entries. */
const readOf = (form: FakeForm) => () => guard.snapshotOf(form.entries);

interface FakeLink {
  href: unknown;
  getAttribute(name: string): string | null;
  hasAttribute(name: string): boolean;
  closest(selector: string): unknown;
}

/** A link as `closest("a[href]")` finds it. */
function link(
  href: string,
  attrs: Record<string, string> = {},
  opts: { skip?: boolean } = {},
): FakeLink {
  const self: FakeLink = {
    href: new URL(href, HERE).href,
    getAttribute: (name) => attrs[name] ?? null,
    hasAttribute: (name) => name in attrs,
    closest: (selector) =>
      selector === "a[href]" ||
      (opts.skip && selector === guard.LINK_SKIP_SELECTOR)
        ? self
        : null,
  };
  return self;
}

type Mods = Partial<
  Record<
    "button" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey",
    number | boolean
  >
>;

describe("the controller, the registry and the forms", () => {
  let win: FakeWindow;
  let doc: FakeDocument;
  const mounted: Array<{ detach(): void }> = [];

  const mount = (form: FakeForm) => {
    const attached = guard.attachFormGuard(form, readOf(form));
    mounted.push(attached);
    return attached;
  };
  const clickOn = (target: unknown, mods: Mods = {}) => {
    const event = new Event("click", { bubbles: true, cancelable: true });
    Object.defineProperties(event, {
      target: { value: target },
      button: { value: mods.button ?? 0 },
      ctrlKey: { value: mods.ctrlKey ?? false },
      metaKey: { value: mods.metaKey ?? false },
      shiftKey: { value: mods.shiftKey ?? false },
      altKey: { value: mods.altKey ?? false },
    });
    doc.dispatchEvent(event);
    return event;
  };
  /** What the browser does on a reload: every live beforeunload listener runs. */
  const unload = () => {
    const event = {
      defaultPrevented: false,
      returnValue: undefined as unknown,
      preventDefault() {
        this.defaultPrevented = true;
      },
    };
    for (const handler of win.live("beforeunload")) handler(event);
    return event;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    win = new FakeWindow(HERE);
    doc = new FakeDocument();
    vi.stubGlobal("window", win);
    vi.stubGlobal("document", doc);
  });

  afterEach(() => {
    for (const m of mounted.splice(0)) m.detach();
    // The "said yes" window of the last test, and nothing pending.
    vi.runOnlyPendingTimers();
    expect(registry.hasUnsavedForm()).toBe(false);
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("one click listener, one beforeunload and one leave listener for any number of forms, gone with the last", () => {
    const handles = [new FakeForm(), new FakeForm(), new FakeForm()].map(
      (form) => mount(form),
    );
    expect(doc.count("added", "click")).toBe(1);
    // Capture phase: it runs before Next's <Link> hears the click.
    expect(doc.added.find((a) => a.type === "click")?.capture).toBe(true);
    expect(win.count("added", "beforeunload")).toBe(1);
    expect(win.count("added", guard.LEAVE_EVENT)).toBe(1);

    handles[0].detach();
    handles[1].detach();
    expect(doc.removed).toHaveLength(0);
    handles[2].detach();
    expect(doc.removed.map((a) => a.type)).toEqual(["click"]);
    expect(win.removed.map((a) => a.type).sort()).toEqual([
      "admin:leave",
      "beforeunload",
    ]);
    // Detaching twice releases nothing twice: the next page counts from zero.
    handles[2].detach();
    handles[0].detach();
    expect(doc.removed).toHaveLength(1);
    const next = mount(new FakeForm());
    expect(doc.count("added", "click")).toBe(2);
    next.detach();
    expect(doc.removed).toHaveLength(2);
  });

  it("a page that has no guarded form listens to nothing", () => {
    expect(doc.added).toHaveLength(0);
    expect(win.added).toHaveLength(0);
    // A click on a link, a reload and the palette's question go through.
    expect(clickOn(link("/admin/menu")).defaultPrevented).toBe(false);
    expect(win.confirm).not.toHaveBeenCalled();
    expect(unload().defaultPrevented).toBe(false);
    expect(shell.mayOpenPage("/admin/menu")).toBe(true);
  });

  it("asks once, in the question's own words, for a link that leaves a dirty form", () => {
    const form = new FakeForm([["name", "Sirena"]]);
    mount(form);
    expect(clickOn(link("/admin/menu")).defaultPrevented).toBe(false);
    expect(win.confirm).not.toHaveBeenCalled(); // clean

    form.type("name", "Sirena!");
    win.confirm.mockReturnValueOnce(false);
    const later = vi.fn();
    doc.addEventListener("click", later, true);
    const declined = clickOn(link("/admin/menu"));
    expect(win.confirm).toHaveBeenCalledTimes(1);
    expect(win.confirm).toHaveBeenCalledWith(
      "Kaydedilmemiş değişiklikler var. Sayfadan çıkılsın mı?",
    );
    expect(guard.UNSAVED_CONFIRM).toBe(
      "Kaydedilmemiş değişiklikler var. Sayfadan çıkılsın mı?",
    );
    // Swallowed whole: Next's <Link> (a later listener) never sees it.
    expect(declined.defaultPrevented).toBe(true);
    expect(later).not.toHaveBeenCalled();

    win.confirm.mockReturnValueOnce(true);
    const accepted = clickOn(link("/admin/menu"));
    expect(win.confirm).toHaveBeenCalledTimes(2);
    expect(accepted.defaultPrevented).toBe(false);
    expect(later).toHaveBeenCalledTimes(1);
  });

  it("asks once however many forms are dirty, and one dirty form among clean ones is enough", () => {
    const a = new FakeForm([["a", "1"]]);
    const b = new FakeForm([["b", "1"]]);
    const c = new FakeForm([["c", "1"]]);
    mount(a);
    mount(b);
    mount(c);
    b.type("b", "2");
    expect(registry.hasUnsavedForm()).toBe(true);
    expect(guard.isPanelDirty()).toBe(true);
    win.confirm.mockReturnValue(false);
    clickOn(link("/admin/menu"));
    expect(win.confirm).toHaveBeenCalledTimes(1);
    a.type("a", "2");
    c.type("c", "2");
    clickOn(link("/admin/menu"));
    expect(win.confirm).toHaveBeenCalledTimes(2);
  });

  it("never asks for what does not leave the page, a button, or a new tab", () => {
    const form = new FakeForm([["name", "Sirena"]]);
    mount(form);
    form.type("name", "Sirena!");
    win.confirm.mockReturnValue(false);
    const quiet = [
      clickOn(link("/admin/menu"), { ctrlKey: true }),
      clickOn(link("/admin/menu"), { metaKey: true }),
      clickOn(link("/admin/menu"), { shiftKey: true }),
      clickOn(link("/admin/menu"), { altKey: true }),
      clickOn(link("/admin/menu"), { button: 1 }),
      clickOn(link("/admin/menu", { target: "_blank" })),
      clickOn(link("/admin/menu", { download: "" })),
      clickOn(link("https://example.com/")),
      clickOn(link("mailto:info@laffogato.net")),
      clickOn(link("#admin-main")),
      clickOn(link("/admin/ayarlar?sekme=email")),
      clickOn(link("/admin/ara", {}, { skip: true })),
      // A submit button, a text field, the page itself: not links.
      clickOn({ closest: () => null }),
      clickOn(null),
      clickOn({}),
    ];
    for (const event of quiet) expect(event.defaultPrevented).toBe(false);
    expect(win.confirm).not.toHaveBeenCalled();
    // The same link by a plain click and by an explicit _self asks.
    clickOn(link("/admin/menu", { target: "_self" }));
    expect(win.confirm).toHaveBeenCalledTimes(1);
  });

  it("an SVG anchor, whose href is not an address, is left alone", () => {
    const form = new FakeForm([["a", "1"]]);
    mount(form);
    form.type("a", "2");
    const svg: FakeLink = {
      href: { baseVal: "/admin/menu" },
      getAttribute: () => null,
      hasAttribute: () => false,
      closest: (selector) => (selector === "a[href]" ? svg : null),
    };
    expect(clickOn(svg).defaultPrevented).toBe(false);
    expect(win.confirm).not.toHaveBeenCalled();
  });

  it("a reload or a closed tab gets the browser's own question while dirty, not otherwise", () => {
    const form = new FakeForm([["a", "1"]]);
    mount(form);
    expect(unload().defaultPrevented).toBe(false);
    form.type("a", "2");
    const asked = unload();
    expect(asked.defaultPrevented).toBe(true);
    expect(asked.returnValue).toBe("");
  });

  it("after a yes to our question the browser does not ask a second time, until a moment has passed", () => {
    const form = new FakeForm([["a", "1"]]);
    mount(form);
    form.type("a", "2");
    win.confirm.mockReturnValue(true);
    clickOn(link("/admin/menu")); // a plain anchor: the page really unloads next
    expect(unload().defaultPrevented).toBe(false);
    vi.advanceTimersByTime(1500);
    // Still here (the navigation never came): guarded again.
    expect(unload().defaultPrevented).toBe(true);
  });

  it("the palette's question: no for a no, yes for a yes, quiet when clean or on the same page", () => {
    const form = new FakeForm([["a", "1"]]);
    mount(form);
    expect(shell.mayOpenPage("/admin/menu")).toBe(true);
    expect(win.confirm).not.toHaveBeenCalled();

    form.type("a", "2");
    win.confirm.mockReturnValueOnce(false);
    expect(shell.mayOpenPage("/admin/menu")).toBe(false);
    expect(win.confirm).toHaveBeenCalledTimes(1);
    expect(win.confirm).toHaveBeenLastCalledWith(guard.UNSAVED_CONFIRM);

    win.confirm.mockReturnValueOnce(true);
    expect(shell.mayOpenPage("/admin/menu")).toBe(true);
    expect(win.confirm).toHaveBeenCalledTimes(2);

    // A deep link to a tab of the page the form is on: the page stays.
    expect(shell.mayOpenPage("/admin/ayarlar?sekme=kargo")).toBe(true);
    expect(win.confirm).toHaveBeenCalledTimes(2);
  });

  it("the palette and the guard name the same event", () => {
    expect(shell.PANEL_LEAVE_EVENT).toBe(guard.LEAVE_EVENT);
    let seen: unknown;
    win.addEventListener(shell.PANEL_LEAVE_EVENT, (e) => {
      seen = (e as CustomEvent).detail;
      expect(e.cancelable).toBe(true);
    });
    shell.mayOpenPage("/admin/karaoke");
    expect(seen).toBe("/admin/karaoke");
  });

  it("confirmLeave answers for a given page and for none", () => {
    const form = new FakeForm([["a", "1"]]);
    mount(form);
    const ask = vi.fn(() => false);
    expect(guard.confirmLeave("/admin/menu", { ask })).toBe(true); // clean
    form.type("a", "2");
    expect(guard.confirmLeave("/admin/menu", { ask })).toBe(false);
    expect(guard.confirmLeave(undefined, { ask })).toBe(false);
    expect(ask).toHaveBeenCalledTimes(2);
    expect(guard.confirmLeave("/admin/ayarlar?x=1", { ask })).toBe(true);
    expect(ask).toHaveBeenCalledTimes(2);
    expect(
      guard.confirmLeave("/admin/menu", {
        ask,
        here: "https://laffogato.net/admin/menu",
      }),
    ).toBe(true);
  });

  it("a refused save keeps the form guarded, a save that wrote clears it", () => {
    const form = new FakeForm([["email", "ali@ornek"]]);
    const attached = mount(form);
    form.type("email", "ali@ornek.com");
    const submit = form.submit();
    // The guard watches the post, it does not take part in it.
    expect(submit.defaultPrevented).toBe(false);
    expect(submit.cancelBubble).toBe(false);

    // The server said no: nothing tells the guard it was saved.
    win.confirm.mockReturnValue(false);
    clickOn(link("/admin/menu"));
    expect(win.confirm).toHaveBeenCalledTimes(1);
    expect(unload().defaultPrevented).toBe(true);

    // The next post is saved.
    form.submit();
    attached.saved();
    win.confirm.mockClear();
    expect(clickOn(link("/admin/menu")).defaultPrevented).toBe(false);
    expect(win.confirm).not.toHaveBeenCalled();
    expect(unload().defaultPrevented).toBe(false);
    expect(shell.mayOpenPage("/admin/menu")).toBe(true);

    // And it guards again from what was saved.
    form.type("email", "veli@ornek.com");
    expect(registry.hasUnsavedForm()).toBe(true);
  });

  it("the redirect after a save asks nothing: no link is clicked, nothing unloads", () => {
    const form = new FakeForm([["title", "Eski"]]);
    const attached = mount(form);
    form.type("title", "Yeni");
    form.submit();
    // The server action redirects: the router moves the page by itself (no
    // click on a link, no beforeunload), and the page's forms unmount.
    attached.detach();
    expect(registry.hasUnsavedForm()).toBe(false);
    expect(win.confirm).not.toHaveBeenCalled();
    expect(unload().defaultPrevented).toBe(false);
    expect(clickOn(link("/admin/bulten/kampanya")).defaultPrevented).toBe(
      false,
    );
    expect(doc.removed).toHaveLength(1);
  });

  it("a form that is gone traps nobody: no guard, no listener, no question", () => {
    const form = new FakeForm([["a", "1"]]);
    const attached = mount(form);
    form.type("a", "2");
    expect(registry.hasUnsavedForm()).toBe(true);
    attached.detach();
    expect(registry.hasUnsavedForm()).toBe(false);
    expect(clickOn(link("/admin/menu")).defaultPrevented).toBe(false);
    expect(unload().defaultPrevented).toBe(false);
    expect(shell.mayOpenPage("/admin/menu")).toBe(true);
    expect(win.confirm).not.toHaveBeenCalled();
    // What the form hears is detached too: a later edit changes nothing.
    form.type("a", "3");
    expect(registry.hasUnsavedForm()).toBe(false);
  });

  it("two operators: a field typed back stays quiet when a colleague's save moves the others", () => {
    // Uygulama ayarları: A types into one field and back; B saves the same
    // tab; A's save of another tab revalidates the page, and A's untouched
    // inputs follow the new defaults without an event.
    const form = new FakeForm([
      ["etaMin", "25"],
      ["closedMessage", "Kapalıyız."],
    ]);
    mount(form);
    form.type("etaMin", "30");
    form.type("etaMin", "25");
    form.set("closedMessage", "Bugün kapalıyız.");
    expect(registry.hasUnsavedForm()).toBe(false);
    expect(clickOn(link("/admin/menu")).defaultPrevented).toBe(false);
    expect(win.confirm).not.toHaveBeenCalled();
    expect(unload().defaultPrevented).toBe(false);
    // A real edit still asks.
    form.type("etaMin", "40");
    expect(registry.hasUnsavedForm()).toBe(true);
  });

  it("typing in a control with no name (the confirm dialog's phrase box) edits nothing", () => {
    const form = new FakeForm([["version", "1.0.0"]]);
    mount(form);
    form.input(null);
    form.set("version", "1.2.0"); // moved by the page, not by the operator
    expect(registry.hasUnsavedForm()).toBe(false);
    form.input("version");
    expect(registry.hasUnsavedForm()).toBe(true);
  });

  it("one form unmounting leaves the others guarded", () => {
    const a = new FakeForm([["a", "1"]]);
    const b = new FakeForm([["b", "1"]]);
    const ha = mount(a);
    mount(b);
    a.type("a", "2");
    b.type("b", "2");
    ha.detach();
    expect(registry.hasUnsavedForm()).toBe(true);
    win.confirm.mockReturnValue(false);
    expect(clickOn(link("/admin/menu")).defaultPrevented).toBe(true);
    expect(doc.removed).toHaveLength(0);
  });

  it("a form reset, once the fields have changed to their defaults, is clean and guarded from there", () => {
    const form = new FakeForm([["a", "1"]]);
    mount(form);
    form.type("a", "2");
    expect(registry.hasUnsavedForm()).toBe(true);
    form.dispatchEvent(new Event("reset"));
    // `reset` fires before the fields change: still as typed, then the tick.
    expect(registry.hasUnsavedForm()).toBe(true);
    form.set("a", "3");
    vi.advanceTimersByTime(1);
    expect(registry.hasUnsavedForm()).toBe(false);
    form.type("a", "1");
    expect(registry.hasUnsavedForm()).toBe(true);
  });

  it("a release called twice gives up one hold, not two", () => {
    const first = guard.acquireLeaveGuard();
    const second = guard.acquireLeaveGuard();
    first();
    first();
    first();
    expect(doc.removed).toHaveLength(0); // the second hold is still there
    second();
    expect(doc.removed.map((a) => a.type)).toEqual(["click"]);
    second();
    expect(doc.removed).toHaveLength(1);
  });

  it("answers for the product wizard's guard in the same registry; tracking alone holds no controller", () => {
    let fields = "name=";
    const wizard = registry.createUnsavedGuard(() => fields);
    const release = registry.trackUnsavedGuard(wizard);
    expect(guard.isPanelDirty()).toBe(false);
    wizard.touch();
    fields = "name=Kenya";
    expect(guard.isPanelDirty()).toBe(true);
    // The registry is only a registry (the single keys load it on every
    // page): the controller is held by the hook it is handed to, as the
    // wizard's is (`hold`, next test and the hooks test).
    expect(doc.added).toHaveLength(0);
    expect(win.added).toHaveLength(0);
    release();
    expect(guard.isPanelDirty()).toBe(false);
  });

  it("the product wizard under the controller: a link and the palette ask while it is dirty, a reload is one question, a yes silences both beforeunloads", () => {
    // What the wizard's hook does (../unsaved-guard with `hold`): its own
    // guard in the registry, its own beforeunload, and the controller.
    let fields = "name=";
    const wizard = registry.createUnsavedGuard(() => fields);
    const untrack = registry.trackUnsavedGuard(wizard);
    win.addEventListener("beforeunload", wizard.onBeforeUnload);
    const release = guard.acquireLeaveGuard();
    try {
      // Clean, then touched but the same: nothing asks.
      expect(clickOn(link("/admin/menu")).defaultPrevented).toBe(false);
      expect(shell.mayOpenPage("/admin/menu")).toBe(true);
      expect(unload().defaultPrevented).toBe(false);
      wizard.touch();
      expect(clickOn(link("/admin/menu")).defaultPrevented).toBe(false);
      expect(shell.mayOpenPage("/admin/menu")).toBe(true);
      expect(win.confirm).not.toHaveBeenCalled();

      // Dirty: the sidebar link and the palette ask, a no stays.
      fields = "name=Kenya";
      win.confirm.mockReturnValueOnce(false);
      expect(clickOn(link("/admin/urunler")).defaultPrevented).toBe(true);
      win.confirm.mockReturnValueOnce(false);
      expect(shell.mayOpenPage("/admin/siparisler")).toBe(false);
      expect(win.confirm).toHaveBeenCalledTimes(2);
      expect(win.confirm).toHaveBeenLastCalledWith(guard.UNSAVED_CONFIRM);

      // A reload: the wizard's beforeunload and the controller's answer the
      // one event the browser fires, so it asks its one question; ours
      // (confirm) is not asked.
      expect(win.live("beforeunload")).toHaveLength(2);
      expect(unload().defaultPrevented).toBe(true);
      expect(win.confirm).toHaveBeenCalledTimes(2);

      // A yes to a link that really unloads the page: neither listener asks
      // again for it. A moment later (the navigation never came) both do.
      win.confirm.mockReturnValueOnce(true);
      expect(clickOn(link("/admin/menu")).defaultPrevented).toBe(false);
      expect(unload().defaultPrevented).toBe(false);
      vi.advanceTimersByTime(1500);
      expect(unload().defaultPrevented).toBe(true);
      // The same for a yes in the palette.
      win.confirm.mockReturnValueOnce(true);
      expect(shell.mayOpenPage("/admin/menu")).toBe(true);
      expect(unload().defaultPrevented).toBe(false);
      vi.advanceTimersByTime(1500);
      expect(unload().defaultPrevented).toBe(true);
    } finally {
      release();
      untrack();
      win.removeEventListener("beforeunload", wizard.onBeforeUnload);
    }
    // Let go: the next page is held by nothing.
    expect(doc.removed.map((a) => a.type)).toEqual(["click"]);
    expect(win.live("beforeunload")).toHaveLength(0);
    expect(win.live(guard.LEAVE_EVENT)).toHaveLength(0);
  });
});

describe("the single keys and every guarded form", () => {
  it("hold back the page's letter while any new-style guard is dirty, as they do for the wizard", () => {
    const win = new FakeWindow(HERE);
    const doc = new FakeDocument();
    vi.stubGlobal("window", win);
    vi.stubGlobal("document", doc);
    const form = new FakeForm([["a", "1"]]);
    const attached = guard.attachFormGuard(form, readOf(form));
    try {
      const facts = {
        role: "owner" as const,
        pathname: "/admin/ayarlar",
        enabled: true,
        typing: false,
        dialogOpen: false,
      };
      const press = (
        key: string,
        now: number,
        state: typeof shortcutCore.SHORTCUT_IDLE,
      ) =>
        shortcutCore.readShortcut(
          state,
          { key, isTrusted: true },
          // What shortcuts.tsx reads: hasUnsavedForm().
          { ...facts, unsaved: registry.hasUnsavedForm(), now },
        );
      // Clean: `g s` opens Siparişler.
      expect(
        press("s", 1200, press("g", 1000, shortcutCore.SHORTCUT_IDLE).state)
          .command,
      ).toEqual({ kind: "go", href: "/admin/siparisler" });
      // Dirty: it opens nothing.
      form.type("a", "2");
      expect(registry.hasUnsavedForm()).toBe(true);
      expect(guard.isPanelDirty()).toBe(true);
      expect(
        press("s", 1200, press("g", 1000, shortcutCore.SHORTCUT_IDLE).state)
          .command,
      ).toBeNull();
    } finally {
      attached.detach();
      vi.unstubAllGlobals();
    }
  });
});

// ── Adoption and wiring ────────────────────────────────────────────────────

describe("adoption: one call in each of the four forms, the wizard's own guard kept", () => {
  it("Ayarlar hands the guard what its tabs already know, and keeps no beforeunload of its own", () => {
    const src = read("src/app/admin/ayarlar/settings-form.tsx");
    expect(src).toContain("useUnsavedFlag(dirtyTabs.size > 0);");
    expect(src).toContain(
      'import { useUnsavedFlag } from "@/components/admin/ui/unsaved-guard";',
    );
    expect(src).not.toContain("beforeunload");
    // The test mail form is not a setting: it stays out of the tabs' books.
    expect(read("src/app/admin/ayarlar/settings-form.tsx")).toContain(
      "trackDirty: false",
    );
  });

  it("Uygulama ayarları: the form every one of the eleven tabs is drawn by", () => {
    const src = read("src/app/admin/mobil/ayarlar/app-config-ui.tsx");
    expect(src).toContain(
      "useUnsavedGuard(ref, { saved: savedAnswer(state) });",
    );
    expect(src.match(/<form\s+ref=\{ref\}/g)).toHaveLength(1);
    // The eleven tabs build their form through it ("Uygulama bölümleri" is
    // the tenth, 6 Kas 2026; "Giriş yöntemleri" the eleventh, 8 Kas 2026).
    const tabs = read("src/app/admin/mobil/ayarlar/app-config-form.tsx");
    expect(tabs.match(/<ConfigForm form=\{form\}>/g)).toHaveLength(11);
  });

  it("the legal editor: its own ref handed to ActionForm", () => {
    const src = read("src/components/admin/legal-doc-form.tsx");
    expect(src).toContain("const formRef = useRef<HTMLFormElement>(null);");
    expect(src).toContain("useUnsavedGuard(formRef);");
    expect(src).toContain("<ActionForm action={action} formRef={formRef}");
    const kit = read("src/components/admin/action-form.tsx");
    expect(kit).toContain("formRef: outerRef,");
    expect(kit).toContain(
      "useImperativeHandle(outerRef, () => formRef.current as HTMLFormElement);",
    );
    // ActionForm itself imports no guard: every page that uses it would load it.
    expect(kit).not.toMatch(IMPORTS_GUARD);
  });

  it("the campaign composer: a ref on its form and the saved answer", () => {
    const src = read("src/app/admin/bulten/kampanya/campaign-mail-form.tsx");
    expect(src).toContain(
      "useUnsavedGuard(formRef, { saved: savedAnswer(state) });",
    );
    expect(src).toMatch(/<form\s+ref=\{formRef\}/);
    expect(src).toContain("useHandPost(");
  });

  it("the wizard keeps its own guard and beforeunload, and hands the hook the shared controller", () => {
    const wizard = read("src/components/admin/product-wizard.tsx");
    expect(wizard).toContain(
      'import { useUnsavedGuard } from "./unsaved-guard";',
    );
    // Only the controller is taken from the new file: its hooks are not.
    expect(wizard).toContain(
      'import { acquireLeaveGuard } from "./ui/unsaved-guard";',
    );
    expect(wizard).toContain(
      "useUnsavedGuard(formRef, { hold: acquireLeaveGuard });",
    );
    expect(wizard.match(/useUnsavedGuard\(/g)).toHaveLength(1);
    const legacy = read("src/components/admin/unsaved-guard.ts");
    expect(legacy).toContain(
      'window.addEventListener("beforeunload", guard.onBeforeUnload);',
    );
    // Held with the form, let go with it.
    expect(legacy).toContain("const release = hold?.();");
    expect(legacy).toMatch(/untrack\(\);\s+release\?\.\(\);/);
    // No cycle: the new file imports this one, this one imports React only
    // (the "said yes" moment is kept here, where both can read it).
    const specs = [
      ...legacy.matchAll(/^import (?!type\b)[^;]*?from "([^"]+)";/gm),
    ].map((m) => m[1]);
    expect(specs).toEqual(["react"]);
    expect(legacy).toMatch(/export function markLeaving\(\)/);
    expect(read("src/components/admin/ui/unsaved-guard.ts")).not.toMatch(
      /let leaving\b/,
    );
  });

  it("the single keys keep reading the registry the guards write to", () => {
    const layer = read("src/components/admin/shortcuts.tsx");
    expect(layer).toContain(
      "unsaved: !typing && !dialogOpen && hasUnsavedForm(),",
    );
    expect(layer).toContain('from "@/components/admin/unsaved-guard"');
    expect(read("src/components/admin/ui/unsaved-guard.ts")).toContain(
      "trackUnsavedGuard({ dirty: () => guard.dirty() })",
    );
  });
});

describe("adoption: the long forms that leave on save (21 Eki 2026)", () => {
  it("the menu item, the slides, the app's announcements and posts: GuardedActionForm", () => {
    for (const f of [
      "src/components/admin/menu-item-form.tsx",
      "src/app/admin/magaza-hero/slide-form.tsx",
      "src/app/admin/anasayfa-hero/slide-form.tsx",
      "src/app/admin/mobil/slaytlar/slide-form.tsx",
      "src/app/admin/mobil/duyurular/announcement-form.tsx",
      "src/app/admin/mobil/gonderiler/post-form.tsx",
    ]) {
      const src = read(f);
      expect(src, f).toContain("<GuardedActionForm");
      expect(src, f).not.toMatch(/<ActionForm\b/);
    }
    // The guard rides in its own file: ActionForm stays without it.
    const guarded = read("src/components/admin/guarded-action-form.tsx");
    expect(guarded).toContain("useUnsavedGuard(formRef);");
    expect(guarded).toContain("<ActionForm {...props} formRef={formRef} />");
    expect(read("src/components/admin/action-form.tsx")).not.toMatch(
      IMPORTS_GUARD,
    );
  });

  it("the promo form, posted by hand on its own <form>", () => {
    const src = read("src/components/admin/promo-form.tsx");
    expect(src).toContain("useUnsavedGuard(formRef);");
    expect(src).toMatch(/<form\s+ref=\{formRef\}/);
  });
});

describe("the palette asks by event: its chunk takes nothing", () => {
  it("the trigger asks before it opens a page, the list does not own the router", () => {
    const trigger = read("src/components/admin/palette/trigger.tsx");
    expect(trigger).toMatch(
      /if \(!mayOpenPage\(href\)\) return;\s+dialogRef\.current\?\.close\(\);\s+router\.push\(href\);/,
    );
    expect(trigger).toContain("navigate={navigate}");
    const list = read("src/components/admin/palette/palette.tsx");
    expect(list).toContain("navigate(target.href);");
    expect(list).not.toContain("useRouter");
    expect(list).not.toContain("router.push");
  });

  it("neither palette file imports the guard (the list is at its 45 KB, the trigger at its 3 KB)", () => {
    for (const file of [
      "src/components/admin/palette/palette.tsx",
      "src/components/admin/palette/trigger.tsx",
      "src/components/admin/palette/recents.ts",
      "src/lib/admin/palette-shell.ts",
      "src/lib/admin/palette-core.ts",
    ]) {
      expect(read(file), file).not.toMatch(IMPORTS_GUARD);
    }
  });

  it("the guard imports React and the registry, nothing of the shell or the server", () => {
    const src = read("src/components/admin/ui/unsaved-guard.ts");
    const specs = [
      ...src.matchAll(/^import (?!type\b)[^;]*?from "([^"]+)";/gm),
    ].map((m) => m[1]);
    expect(specs.sort()).toEqual(["../unsaved-guard", "react"]);
    expect(src).not.toMatch(/server-only|use server|@\/lib\//);
  });
});

describe("markup: the guard draws nothing", () => {
  const withKids = (
    type: unknown,
    props: Record<string, unknown>,
    ...children: ReactNode[]
  ) => createElement(type as FunctionComponent, props, ...children);

  it("ActionForm draws the same form with and without a ref handed in, React's guard included", async () => {
    const { ActionForm } = await import("@/components/admin/action-form");
    const action = async () => ({ ok: true as const, message: "" });
    const draw = (extra: Record<string, unknown>) =>
      renderToStaticMarkup(
        withKids(
          ActionForm,
          { action, className: "grid", ...extra },
          createElement("input", { name: "email" }),
        ),
      );
    const plain = draw({});
    expect(draw({ formRef: createRef() })).toBe(plain);
    expectReactGuard(formOpenTags(plain)[0]);
  });

  it("the legal editor and the campaign composer still draw their forms by hand", async () => {
    const { LegalDocForm } = await import("@/components/admin/legal-doc-form");
    const legal = renderToStaticMarkup(
      createElement(LegalDocForm, {
        initial: {
          slug: "kvkk-aydinlatma-metni",
          title: "KVKK",
          summary: "",
          effectiveDate: "",
          bodyMarkdown: "## Başlık",
          isPublished: false,
        },
        action: async () => ({ ok: true as const, message: "" }),
      }),
    );
    expect(formOpenTags(legal)).toHaveLength(1);
    expectReactGuard(formOpenTags(legal)[0]);
    expect(legal).toContain('name="bodyMarkdown"');
    expect(legal).toContain("Vazgeç");

    const { CampaignMailForm } =
      await import("@/app/admin/bulten/kampanya/campaign-mail-form");
    const composer = renderToStaticMarkup(
      createElement(CampaignMailForm, {
        action: async () => ({}),
        submitLabel: "Taslağı oluştur",
      }),
    );
    expectReactGuard(formOpenTags(composer)[0]);
    expect(composer).toContain('name="template"');
  });
});

// Spelled by code point: this file must not hold one itself.
const LONG_DASH = new RegExp(
  `[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`,
);

describe("copy", () => {
  it("has no long dash in the files this change adds or touches", () => {
    const files = [
      "src/components/admin/ui/unsaved-guard.ts",
      "src/components/admin/unsaved-guard.ts",
      "src/components/admin/product-wizard.tsx",
      "src/components/admin/palette/palette.tsx",
      "src/components/admin/palette/trigger.tsx",
      "src/lib/admin/palette-shell.ts",
      "src/components/admin/action-form.tsx",
      "src/components/admin/legal-doc-form.tsx",
      "src/app/admin/ayarlar/settings-form.tsx",
      "src/app/admin/mobil/ayarlar/app-config-ui.tsx",
      "src/app/admin/bulten/kampanya/campaign-mail-form.tsx",
      "tests/admin-unsaved-guard.test.ts",
      "tests/admin-unsaved-guard-hooks.test.ts",
      "tests/_support/fake-page.ts",
    ];
    for (const file of files) {
      expect(read(file), file).not.toMatch(LONG_DASH);
    }
  });
});
