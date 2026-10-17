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

const { ActionButton, ActionForm, FormMessage, SubmitButton, runPanelAction } =
  await import("@/components/admin/action-form");

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
