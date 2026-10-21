import { readFileSync } from "node:fs";

import { createElement, type FunctionComponent, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { expectReactGuard, formOpenTags } from "./_support/form-guard";

/**
 * components/admin/action-form.tsx: the page form and the one-click button
 * that answer with a toast (Filament's notifications), for the plain forms
 * and toggles that used to answer nothing.
 */

vi.mock("next/navigation", () => ({
  // Next's own control flow is rethrown; anything else is not.
  unstable_rethrow: (err: unknown) => {
    if (err instanceof Error && err.message === "NEXT_REDIRECT") throw err;
  },
}));

const {
  ActionButton,
  ActionForm,
  FormMessage,
  SubmitButton,
  markFieldErrors,
  replayByHand,
  runPanelAction,
  submitByHand,
  withPanelCatch,
} = await import("@/components/admin/action-form");

describe("runPanelAction", () => {
  const fd = new FormData();

  it("passes the action's answer through", async () => {
    const ok = { ok: true as const, message: "Kaydedildi." };
    expect(await runPanelAction(async () => ok, null, fd)).toBe(ok);
  });

  it("turns a crash into a message instead of the error screen", async () => {
    const res = await runPanelAction(
      async () => {
        throw new Error("db down");
      },
      null,
      fd,
    );
    expect(res).toMatchObject({ ok: false });
    expect(res && !res.ok && res.error).toMatch(/Bir hata oldu/);
  });

  it("lets a redirect through, and reads a redirected action as no answer", async () => {
    await expect(
      runPanelAction(
        async () => {
          throw new Error("NEXT_REDIRECT");
        },
        null,
        fd,
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    const silent = (async () => undefined) as unknown as Parameters<
      typeof runPanelAction
    >[0];
    expect(await runPanelAction(silent, null, fd)).toBeNull();
  });
});

describe("hand-dispatched submit (React 19 form reset)", () => {
  // React 19 resets a `<form action={fn}>`'s uncontrolled fields before the
  // action runs, whatever it answers: a refused save came back with every
  // text field empty and every select and checkbox on its default. The
  // panel's forms post from onSubmit instead; these are the rules of that
  // post, without a browser (the reset itself is React's and needs a DOM).

  /** A stand-in form and submit event; FormData is read through the seam. */
  const setup = (opts: { beforeSubmit?: () => boolean | void } = {}) => {
    const form = { tagName: "FORM" } as unknown as HTMLFormElement;
    const submitter = { name: "intent" } as unknown as HTMLElement;
    const sent: FormData[] = [];
    const read: Array<HTMLElement | null> = [];
    const busy = { current: false };
    let prevented = 0;
    const event = () => ({
      preventDefault: () => {
        prevented += 1;
      },
      currentTarget: form,
      nativeEvent: { submitter } as unknown as Event,
    });
    const submit = () =>
      submitByHand(event(), {
        busy,
        dispatch: (fd) => sent.push(fd),
        beforeSubmit: opts.beforeSubmit,
        readForm: (f, s) => {
          expect(f).toBe(form);
          read.push(s);
          const fd = new FormData();
          fd.set("name", "Yeni ad");
          fd.set("intent", "save");
          return fd;
        },
        run: (fn) => fn(),
      });
    return {
      submit,
      sent,
      read,
      busy,
      submitter,
      prevented: () => prevented,
    };
  };

  it("never lets the browser post, and sends the form with its submit button", () => {
    const t = setup();
    expect(t.submit()).toBe(true);
    expect(t.prevented()).toBe(1);
    expect(t.sent).toHaveLength(1);
    expect(t.sent[0].get("name")).toBe("Yeni ad");
    // The button that was pressed is read with the form (two-button forms).
    expect(t.read).toEqual([t.submitter]);
  });

  it("a second submit before the answer dispatches nothing", () => {
    const t = setup();
    t.submit();
    expect(t.submit()).toBe(false);
    expect(t.submit()).toBe(false);
    expect(t.sent).toHaveLength(1);
    // Every press is still kept from posting the page natively.
    expect(t.prevented()).toBe(3);
    // The answer is in (useHandPost clears the flag): the next one goes.
    t.busy.current = false;
    expect(t.submit()).toBe(true);
    expect(t.sent).toHaveLength(2);
  });

  it("beforeSubmit returning false cancels the post and keeps the form free", () => {
    const t = setup({ beforeSubmit: () => false });
    expect(t.submit()).toBe(false);
    expect(t.sent).toHaveLength(0);
    expect(t.busy.current).toBe(false);
    expect(t.prevented()).toBe(1);
    // Anything but false lets it through.
    const ok = setup({ beforeSubmit: () => undefined });
    expect(ok.submit()).toBe(true);
  });

  it("a submit React replays after hydration posts once, through the same gate", () => {
    // An Enter before hydration meets React's guard; React keeps every such
    // press and hands each one's FormData to the form's action once the
    // page is live, not to onSubmit. With the bare dispatcher as the action
    // three presses were three posts (three coupons, three stamps).
    const busy = { current: false };
    const sent: FormData[] = [];
    const replay = (beforeSubmit?: () => boolean | void) =>
      replayByHand(new FormData(), {
        busy,
        dispatch: (fd) => sent.push(fd),
        beforeSubmit,
        run: (fn) => fn(),
      });
    expect(replay()).toBe(true);
    expect(replay()).toBe(false);
    expect(replay()).toBe(false);
    expect(sent).toHaveLength(1);
    // A hand submit while that answer is out is dropped as well.
    let prevented = 0;
    const handed = submitByHand(
      {
        preventDefault: () => {
          prevented += 1;
        },
        currentTarget: {} as HTMLFormElement,
        nativeEvent: {} as Event,
      },
      { busy, dispatch: (fd) => sent.push(fd), run: (fn) => fn() },
    );
    expect(handed).toBe(false);
    expect(prevented).toBe(1);
    expect(sent).toHaveLength(1);
    // The answer is in: the next press goes.
    busy.current = false;
    expect(replay()).toBe(true);
    expect(sent).toHaveLength(2);
  });

  it("a replayed submit is dropped when the form has a beforeSubmit check", () => {
    // The check needs the form and its button, which a replay no longer
    // has: nothing is posted, and the operator presses again.
    const busy = { current: false };
    const sent: FormData[] = [];
    const posted = replayByHand(new FormData(), {
      busy,
      dispatch: (fd) => sent.push(fd),
      beforeSubmit: () => true,
      run: (fn) => fn(),
    });
    expect(posted).toBe(false);
    expect(sent).toHaveLength(0);
    expect(busy.current).toBe(false);
  });

  it("ActionForm and ActionModal post by hand; the action is only React's guard", () => {
    for (const path of [
      "src/components/admin/action-form.tsx",
      "src/components/admin/ui/action-modal.tsx",
    ]) {
      const src = readFileSync(path, "utf8");
      expect(src, path).toContain("useHandPost(formAction, pending");
      // The form has an action too, next to the onSubmit that prevents it:
      // React draws its guard for an Enter before hydration and skips the
      // action of a prevented submit (no reset). Without it the browser
      // GETs the page with the fields in the address.
      expect(src, path).toMatch(
        /<form\s+(?:ref=\{formRef\}\s+)?action=\{post\.action\}\s+onSubmit=\{post\.onSubmit\}/,
      );
    }
  });
});

describe("withPanelCatch (forms with their own state shape)", () => {
  type LegacyState = { error: string | null; message: string | null };
  const initial: LegacyState = { error: null, message: null };
  const failed = (prev: LegacyState): LegacyState => ({
    ...prev,
    error: "Bir hata oldu.",
  });

  it("passes the answer through", async () => {
    const run = withPanelCatch<LegacyState>(
      async () => ({ error: null, message: "Kaydedildi." }),
      failed,
    );
    expect(await run(initial, new FormData())).toEqual({
      error: null,
      message: "Kaydedildi.",
    });
  });

  it("turns a crash into the form's own refusal, keeping the old state", async () => {
    const prev = { error: null, message: "eski" };
    const seen: unknown[] = [];
    const run = withPanelCatch<LegacyState>(
      async () => {
        throw new Error("db down");
      },
      (p, err) => {
        seen.push(err);
        return failed(p);
      },
    );
    expect(await run(prev, new FormData())).toEqual({
      error: "Bir hata oldu.",
      message: "eski",
    });
    expect(seen[0]).toBeInstanceOf(Error);
  });

  it("rethrows a redirect", async () => {
    const run = withPanelCatch<LegacyState>(async () => {
      throw new Error("NEXT_REDIRECT");
    }, failed);
    await expect(run(initial, new FormData())).rejects.toThrow("NEXT_REDIRECT");
  });
});

/** createElement with children as arguments (the props type requires them). */
const withKids = (
  type: unknown,
  props: Record<string, unknown>,
  ...children: ReactNode[]
) => createElement(type as FunctionComponent, props, ...children);

describe("markup", () => {
  const action = async () => ({ ok: true as const, message: "" });

  it("ActionForm submits by hand (typed values survive a refusal)", () => {
    const html = renderToStaticMarkup(
      withKids(
        ActionForm,
        { action, className: "grid" },
        createElement("input", { name: "name" }),
        createElement(FormMessage),
        createElement(SubmitButton, null, "Kaydet"),
      ),
    );
    expect(html).toMatch(/^<form class="grid" action="javascript:[^"]*">/);
    expectReactGuard(formOpenTags(html)[0]);
    expect(html).toContain('<button type="submit"');
    expect(html).toContain(">Kaydet<");
    // No refusal yet: no alert.
    expect(html).not.toContain('role="alert"');
  });

  it("ActionForm with a beforeSubmit check draws the same guard", () => {
    const html = renderToStaticMarkup(
      withKids(
        ActionForm,
        { action, beforeSubmit: () => false },
        createElement("input", { name: "name" }),
      ),
    );
    expect(html).toMatch(/^<form action="javascript:[^"]*">/);
    expectReactGuard(formOpenTags(html)[0]);
  });

  it("ActionButton posts its hidden fields with one submit", () => {
    const html = renderToStaticMarkup(
      withKids(
        ActionButton,
        { action, hidden: { id: "tbl-0002", isActive: "true" } },
        "Etkinleştir",
      ),
    );
    expect(html).toContain('<input type="hidden" name="id" value="tbl-0002"/>');
    expect(html).toContain('name="isActive" value="true"');
    expect(html).toMatch(/<button type="submit"[^>]*>Etkinleştir<\/button>/);
  });
});

describe("accessibility", () => {
  const action = async () => ({ ok: true as const, message: "" });

  it("ActionButton can name its row for a screen reader", () => {
    // A list of identical "Tükendi" buttons tells a screen reader nothing.
    const html = renderToStaticMarkup(
      withKids(
        ActionButton,
        { action, hidden: { id: "mnu-1" }, ariaLabel: "Tükendi: Latte" },
        "Tükendi",
      ),
    );
    expect(html).toContain('aria-label="Tükendi: Latte"');
    expect(html).toContain(">Tükendi</button>");
  });

  /** Just enough of a DOM element for markFieldErrors. */
  class FakeControl {
    attrs = new Map<string, string>();
    constructor(init: Record<string, string>) {
      for (const [k, v] of Object.entries(init)) this.attrs.set(k, v);
    }
    getAttribute(n: string) {
      return this.attrs.get(n) ?? null;
    }
    setAttribute(n: string, v: string) {
      this.attrs.set(n, v);
    }
    removeAttribute(n: string) {
      this.attrs.delete(n);
    }
  }
  const errorId = (name: string) => `f-err-${name}`;

  it("ties a refused field to its message and returns it for focus", () => {
    const name = new FakeControl({ name: "name" });
    const price = new FakeControl({ name: "price", "aria-describedby": "hint" });
    const id = new FakeControl({ name: "id", type: "hidden" });
    const first = markFieldErrors(
      [id, name, price],
      { price: "Fiyatı yaz.", id: "x" },
      errorId,
    );
    expect(first).toBe(price);
    expect(price.getAttribute("aria-invalid")).toBe("true");
    // An existing description is kept, the message is added.
    expect(price.getAttribute("aria-describedby")).toBe("hint f-err-price");
    expect(name.getAttribute("aria-invalid")).toBeNull();
    expect(id.getAttribute("aria-invalid")).toBeNull();
  });

  it("clears the marks once the field is fine, keeping its own description", () => {
    const price = new FakeControl({ name: "price", "aria-describedby": "hint" });
    markFieldErrors([price], { price: "Fiyatı yaz." }, errorId);
    expect(markFieldErrors([price], {}, errorId)).toBeNull();
    expect(price.getAttribute("aria-invalid")).toBeNull();
    expect(price.getAttribute("aria-describedby")).toBe("hint");
    const bare = new FakeControl({ name: "name" });
    markFieldErrors([bare], { name: "Adı yaz." }, errorId);
    markFieldErrors([bare], {}, errorId);
    expect(bare.getAttribute("aria-describedby")).toBeNull();
  });
});
