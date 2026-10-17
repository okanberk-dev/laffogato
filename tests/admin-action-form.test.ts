import { readFileSync } from "node:fs";

import { createElement, type FunctionComponent, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

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
    // The answer is in (useNoResetSubmit clears the flag): the next one goes.
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

  it("ActionForm and ActionModal post by hand, never as a form action", () => {
    for (const path of [
      "src/components/admin/action-form.tsx",
      "src/components/admin/ui/action-modal.tsx",
    ]) {
      const src = readFileSync(path, "utf8");
      expect(src, path).toContain("useNoResetSubmit(formAction, pending");
    }
    // ActionModal's only form is the dialog's, and it has no action prop.
    const modal = readFileSync(
      "src/components/admin/ui/action-modal.tsx",
      "utf8",
    );
    expect(modal).not.toMatch(/<form[^>]*\saction=/);
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
    expect(html).toMatch(/^<form class="grid">/);
    expect(html).not.toContain("action=");
    expect(html).toContain('<button type="submit"');
    expect(html).toContain(">Kaydet<");
    // No refusal yet: no alert.
    expect(html).not.toContain('role="alert"');
  });

  it("ActionForm with a beforeSubmit check is still a plain form", () => {
    const html = renderToStaticMarkup(
      withKids(
        ActionForm,
        { action, beforeSubmit: () => false },
        createElement("input", { name: "name" }),
      ),
    );
    expect(html).toMatch(/^<form>/);
    expect(html).not.toContain("action=");
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
