import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FakeDocument, FakeForm, FakeWindow } from "./_support/fake-page";

/**
 * The two hooks' own bodies (admin UI v2, UI-17), run without a renderer: a
 * few lines of React stand in for useRef and useEffect (slots by call order,
 * an effect runs again only when its dependencies changed, cleanups run on
 * unmount), the page is a pair of fake EventTargets, and FormData reads a
 * fake form. What is checked is the wiring the pure tests cannot see: what
 * mounts, what each render repeats and what it does not, and that nothing
 * outlives its form.
 */

type Effect = () => void | (() => void);

const react = vi.hoisted(() => ({
  current: null as null | {
    ref(initial: unknown): { current: unknown };
    effect(run: Effect, deps?: unknown[]): void;
  },
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useRef: (initial: unknown) => react.current!.ref(initial),
    useEffect: (run: Effect, deps?: unknown[]) =>
      react.current!.effect(run, deps),
  };
});

const guard = await import("@/components/admin/ui/unsaved-guard");
const registry = await import("@/components/admin/unsaved-guard");

/** A component's life: render() repeats the hook, unmount() cleans up. */
function harness(hook: () => void) {
  const refs: Array<{ current: unknown }> = [];
  const effects: Array<{ deps?: unknown[]; cleanup?: void | (() => void) }> =
    [];
  let refAt = 0;
  let queue: Array<{ run: Effect; deps?: unknown[] }> = [];
  const frame = {
    ref(initial: unknown) {
      const slot = (refs[refAt] ??= { current: initial });
      refAt += 1;
      return slot;
    },
    effect(run: Effect, deps?: unknown[]) {
      queue.push({ run, deps });
    },
  };
  return {
    render() {
      refAt = 0;
      queue = [];
      react.current = frame;
      hook();
      react.current = null;
      queue.forEach(({ run, deps }, i) => {
        const before = effects[i];
        const same =
          before?.deps !== undefined &&
          deps !== undefined &&
          before.deps.length === deps.length &&
          deps.every((d, j) => Object.is(d, before.deps![j]));
        if (same) return;
        if (typeof before?.cleanup === "function") before.cleanup();
        effects[i] = { deps, cleanup: run() };
      });
    },
    unmount() {
      for (const e of effects.splice(0)) {
        if (typeof e.cleanup === "function") e.cleanup();
      }
    },
  };
}

const HERE = "https://laffogato.net/admin/bulten/kampanya/kmp-1";

/** FormData over a fake form: a copy of its entries, as the real one makes. */
class FakeFormData {
  private items: Array<[string, string]>;
  constructor(form: FakeForm) {
    this.items = form.entries.map((e): [string, string] => [...e]);
  }
  entries() {
    return this.items[Symbol.iterator]();
  }
}

describe("the hooks", () => {
  let win: FakeWindow;
  let doc: FakeDocument;
  const mounted: Array<{ unmount(): void }> = [];

  const mount = (hook: () => void) => {
    const h = harness(hook);
    mounted.push(h);
    h.render();
    return h;
  };
  /** A click on a link to another page, as every live click listener hears it. */
  const askedAboutLeaving = () => {
    win.confirm.mockClear();
    const anchor = {
      href: "https://laffogato.net/admin/siparisler",
      getAttribute: () => null,
      hasAttribute: () => false,
      closest: (selector: string) => (selector === "a[href]" ? anchor : null),
    };
    const event = {
      target: anchor,
      button: 0,
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
      stopImmediatePropagation() {},
    };
    for (const handler of doc.live("click")) handler(event);
    return win.confirm.mock.calls.length > 0;
  };

  beforeEach(() => {
    win = new FakeWindow(HERE);
    doc = new FakeDocument();
    vi.stubGlobal("window", win);
    vi.stubGlobal("document", doc);
    vi.stubGlobal("FormData", FakeFormData);
  });

  afterEach(() => {
    for (const h of mounted.splice(0)) h.unmount();
    expect(registry.hasUnsavedForm()).toBe(false);
    vi.unstubAllGlobals();
  });

  describe("useUnsavedGuard", () => {
    const ref = (form: FakeForm | null) =>
      ({
        current: form,
      }) as unknown as import("react").RefObject<HTMLFormElement>;

    it("guards the form once it is mounted and lets go when it unmounts", () => {
      const form = new FakeForm([["title", "Eski"]]);
      const formRef = ref(form);
      const h = mount(() => guard.useUnsavedGuard(formRef));
      expect(doc.count("added", "click")).toBe(1);
      expect(registry.hasUnsavedForm()).toBe(false);
      form.type("title", "Yeni");
      expect(registry.hasUnsavedForm()).toBe(true);
      expect(askedAboutLeaving()).toBe(true);

      h.unmount();
      expect(registry.hasUnsavedForm()).toBe(false);
      expect(doc.count("removed", "click")).toBe(1);
      // Typing into a form that is gone changes nothing.
      form.type("title", "Daha yeni");
      expect(registry.hasUnsavedForm()).toBe(false);
    });

    it("does nothing without a form, or when it is off, and starts when it is turned on", () => {
      const none = ref(null);
      mount(() => guard.useUnsavedGuard(none));
      expect(doc.added).toHaveLength(0);

      const form = new FakeForm([["a", "1"]]);
      const formRef = ref(form);
      let enabled = false;
      const h = mount(() => guard.useUnsavedGuard(formRef, { enabled }));
      expect(doc.added).toHaveLength(0);
      enabled = true;
      h.render();
      expect(doc.count("added", "click")).toBe(1);
      form.type("a", "2");
      expect(registry.hasUnsavedForm()).toBe(true);
      enabled = false;
      h.render();
      expect(registry.hasUnsavedForm()).toBe(false);
      expect(doc.count("removed", "click")).toBe(1);
    });

    it("a render that changes nothing neither re-reads the form nor re-attaches it", () => {
      const form = new FakeForm([["a", "1"]]);
      const formRef = ref(form);
      const h = mount(() => guard.useUnsavedGuard(formRef));
      form.type("a", "2");
      h.render();
      h.render();
      expect(doc.count("added", "click")).toBe(1);
      expect(registry.hasUnsavedForm()).toBe(true);
    });

    it("a refused save stays guarded, a save that wrote clears it, once per answer", () => {
      const form = new FakeForm([["note", "ilk"]]);
      const formRef = ref(form);
      let saved: object | null = null;
      const h = mount(() => guard.useUnsavedGuard(formRef, { saved }));

      form.type("note", "ikinci");
      form.submit();
      // The answer is a refusal: `saved` stays null.
      h.render();
      expect(registry.hasUnsavedForm()).toBe(true);

      // The answer is a save: this object, once.
      form.submit();
      const answer = { message: "Taslak kaydedildi." };
      saved = answer;
      h.render();
      expect(registry.hasUnsavedForm()).toBe(false);

      // Typing after the save is unsaved, and a render with the same answer
      // does not call it saved again.
      form.type("note", "üçüncü");
      expect(registry.hasUnsavedForm()).toBe(true);
      h.render();
      expect(registry.hasUnsavedForm()).toBe(true);

      // A second save is a second answer object.
      form.submit();
      saved = { message: "Taslak kaydedildi." };
      h.render();
      expect(registry.hasUnsavedForm()).toBe(false);
    });

    it("what is typed after the post left, before its answer, stays unsaved", () => {
      const form = new FakeForm([["note", "ilk"]]);
      const formRef = ref(form);
      let saved: object | null = null;
      const h = mount(() => guard.useUnsavedGuard(formRef, { saved }));
      form.type("note", "gönderilen");
      form.submit();
      form.type("note", "gönderilen ve eklenen");
      saved = { message: "Kaydedildi." };
      h.render();
      expect(registry.hasUnsavedForm()).toBe(true);
    });

    it("mounting twice in a row (React's check in development) leaves one guard", () => {
      const form = new FakeForm([["a", "1"]]);
      const formRef = ref(form);
      const first = mount(() => guard.useUnsavedGuard(formRef));
      first.unmount();
      mount(() => guard.useUnsavedGuard(formRef));
      expect(doc.count("added", "click")).toBe(2);
      expect(doc.count("removed", "click")).toBe(1);
      form.type("a", "2");
      expect(registry.hasUnsavedForm()).toBe(true);
    });
  });

  describe("the product wizard's hook (../unsaved-guard, CAT-30) with the controller", () => {
    const ref = (form: FakeForm | null) =>
      ({
        current: form,
      }) as unknown as import("react").RefObject<HTMLFormElement>;
    const hold = guard.acquireLeaveGuard;
    /** The palette's question, as mayOpenPage sends it. */
    const paletteMay = (href: string) =>
      win.dispatchEvent(
        new CustomEvent(guard.LEAVE_EVENT, { cancelable: true, detail: href }),
      );

    it("holds the controller while mounted: a link and the palette ask once it is dirty, and everything goes with the form", () => {
      win.confirm.mockReturnValue(false);
      const form = new FakeForm([["name", ""]]);
      const formRef = ref(form);
      const h = mount(() => registry.useUnsavedGuard(formRef, { hold }));
      expect(doc.count("added", "click")).toBe(1);
      expect(doc.added.find((a) => a.type === "click")?.capture).toBe(true);
      expect(win.count("added", guard.LEAVE_EVENT)).toBe(1);
      // Its own beforeunload, kept, and the controller's.
      expect(win.live("beforeunload")).toHaveLength(2);

      // Clean: nothing asks.
      expect(askedAboutLeaving()).toBe(false);
      expect(paletteMay("/admin/menu")).toBe(true);
      expect(win.confirm).not.toHaveBeenCalled();

      form.type("name", "Kenya");
      expect(registry.hasUnsavedForm()).toBe(true);
      expect(askedAboutLeaving()).toBe(true);
      expect(paletteMay("/admin/menu")).toBe(false);

      // Typed back: clean again.
      form.type("name", "");
      expect(askedAboutLeaving()).toBe(false);

      h.unmount();
      expect(registry.hasUnsavedForm()).toBe(false);
      expect(doc.count("removed", "click")).toBe(1);
      expect(win.live(guard.LEAVE_EVENT)).toHaveLength(0);
      expect(win.live("beforeunload")).toHaveLength(0);
      // Typing into a form that is gone asks nothing.
      form.type("name", "Etiyopya");
      expect(paletteMay("/admin/menu")).toBe(true);
      expect(win.confirm).not.toHaveBeenCalled();
    });

    it("shares the one controller with the page's other forms, counted; mounting twice in a row leaves one hold", () => {
      const wizardForm = new FakeForm([["name", ""]]);
      const wizardRef = ref(wizardForm);
      const other = new FakeForm([["a", "1"]]);
      const otherRef = ref(other);
      const first = mount(() => registry.useUnsavedGuard(wizardRef, { hold }));
      // React's check in development: mount, unmount, mount.
      first.unmount();
      const wizard = mount(() => registry.useUnsavedGuard(wizardRef, { hold }));
      const page = mount(() => guard.useUnsavedGuard(otherRef));
      expect(doc.count("added", "click")).toBe(2);
      expect(doc.count("removed", "click")).toBe(1);
      expect(doc.live("click")).toHaveLength(1);

      wizard.unmount();
      expect(doc.live("click")).toHaveLength(1); // the other form still holds it
      page.unmount();
      expect(doc.live("click")).toHaveLength(0);
      expect(win.live(guard.LEAVE_EVENT)).toHaveLength(0);
      expect(win.live("beforeunload")).toHaveLength(0);
    });

    it("off, or without a form, holds nothing; without `hold` it is the old guard: its own beforeunload only", () => {
      mount(() => registry.useUnsavedGuard(ref(null), { hold }));
      const form = new FakeForm([["name", ""]]);
      const formRef = ref(form);
      mount(() => registry.useUnsavedGuard(formRef, { hold, enabled: false }));
      expect(doc.added).toHaveLength(0);
      expect(win.added).toHaveLength(0);

      const plain = mount(() => registry.useUnsavedGuard(formRef));
      expect(doc.added).toHaveLength(0);
      expect(win.added.map((a) => a.type)).toEqual(["beforeunload"]);
      plain.unmount();
    });
  });

  describe("useUnsavedFlag", () => {
    it("guards while the page says it is dirty, and only then", () => {
      let dirty = false;
      const h = mount(() => guard.useUnsavedFlag(dirty));
      expect(doc.added).toHaveLength(0);
      expect(registry.hasUnsavedForm()).toBe(false);

      dirty = true;
      h.render();
      expect(doc.count("added", "click")).toBe(1);
      expect(registry.hasUnsavedForm()).toBe(true);
      expect(askedAboutLeaving()).toBe(true);

      // The same answer on the next render changes nothing.
      h.render();
      expect(doc.count("added", "click")).toBe(1);

      dirty = false;
      h.render();
      expect(registry.hasUnsavedForm()).toBe(false);
      expect(doc.count("removed", "click")).toBe(1);
    });

    it("lets go with the page", () => {
      const h = mount(() => guard.useUnsavedFlag(true));
      expect(registry.hasUnsavedForm()).toBe(true);
      h.unmount();
      expect(registry.hasUnsavedForm()).toBe(false);
      expect(doc.count("removed", "click")).toBe(1);
    });

    it("shares the controller with the forms on the page", () => {
      const form = new FakeForm([["a", "1"]]);
      const formRef = {
        current: form,
      } as unknown as import("react").RefObject<HTMLFormElement>;
      const flag = mount(() => guard.useUnsavedFlag(true));
      mount(() => guard.useUnsavedGuard(formRef));
      expect(doc.count("added", "click")).toBe(1);
      flag.unmount();
      expect(doc.count("removed", "click")).toBe(0);
      expect(registry.hasUnsavedForm()).toBe(false);
    });
  });
});
