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
