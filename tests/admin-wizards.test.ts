import { readFileSync } from "node:fs";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * The panel's create flows as wizards (operator, 22 Oct 2026: "fatura
 * oluşturma yeri gibi olan yerlere wizard yap ... güvenlik olarak da açık
 * olmasın ve hızlı olsun"), src/components/admin/ui/wizard.tsx:
 *
 * - a new promo code, a manual order, a campaign mail, a menu item and an
 *   app post open as steps; their edit pages stay one page;
 * - every field the action reads is still in the form (later steps are
 *   only `hidden`), so nothing is lost and no step fetches anything;
 * - the first step has no submit button (one post, from the summary), the
 *   form checks the steps itself (`noValidate`), and the server's own
 *   checks are unchanged: the wizard only spares the operator a refusal.
 */

vi.mock("@/lib/admin/store", () => ({
  MENU_CATEGORY_KEYS: ["matcha", "frozen"],
  MENU_CATEGORY_LABELS: { matcha: "Matcha", frozen: "Frozen" },
}));

const read = (f: string) => readFileSync(f, "utf8");
const noop = vi.fn(async () => ({ ok: true as const, message: "" }));

/** Posted names in the markup, in order, each once. */
function names(html: string): string[] {
  return [...new Set([...html.matchAll(/\sname="([^"]+)"/g)].map((m) => m[1]))];
}

/** The wizard's shape in server-rendered markup. */
function expectWizard(html: string, steps: number) {
  expect(html).toContain('aria-current="step"');
  const panels = [...html.matchAll(/<div data-step="(\d+)"[^>]*>/g)];
  expect(panels.map((m) => m[1])).toEqual(
    Array.from({ length: steps }, (_, i) => String(i + 1)),
  );
  // Only the first step is shown; the rest are in the DOM, hidden.
  expect(panels[0][0]).not.toContain("hidden");
  for (const p of panels.slice(1)) expect(p[0]).toContain("hidden");
  expect(html).toMatch(/<form[^>]*noValidate|<form[^>]*novalidate/i);
  expect(html).toContain("Sonraki adım");
  // One post, from the last step: no submit button on the first.
  expect(html).not.toMatch(/<button[^>]*type="submit"/);
}

describe("which pages are wizards", () => {
  it('the new pages pass mode="wizard"; the edit pages do not', () => {
    for (const f of [
      "src/app/admin/promosyon/yeni/page.tsx",
      "src/app/admin/bulten/kampanya/yeni/page.tsx",
      "src/app/admin/menu/yeni/page.tsx",
    ]) {
      expect(read(f), f).toContain('mode="wizard"');
    }
    expect(read("src/app/admin/mobil/gonderiler/yeni/page.tsx")).toContain(
      'mode="create"',
    );
    for (const f of [
      "src/app/admin/promosyon/[id]/duzenle/page.tsx",
      "src/app/admin/menu/[id]/duzenle/page.tsx",
    ]) {
      expect(read(f), f).not.toContain('mode="wizard"');
    }
    // The manual order is only ever made, never edited here: always steps.
    expect(read("src/components/admin/manual-order-form.tsx")).toContain(
      "<WizardFrame",
    );
  });

  it("the kit stays out of every page's shared bundle and adds no package", () => {
    expect(read("src/components/admin/ui/index.ts")).not.toContain("wizard");
    const kit = read("src/components/admin/ui/wizard.tsx");
    expect(kit.startsWith('"use client";')).toBe(true);
    for (const m of kit.matchAll(/from "([^"]+)"/g)) {
      expect(m[1], m[1]).toMatch(/^(react|next\/link|\.\.?\/)/);
    }
  });
});

describe("promo code", () => {
  it("a new code: two steps and a summary, every field posted", async () => {
    const { PromoForm } = await import("@/components/admin/promo-form");
    const html = renderToStaticMarkup(
      createElement(PromoForm, {
        action: vi.fn(),
        submitLabel: "Kodu oluştur",
        mode: "wizard",
      } as never),
    );
    expectWizard(html, 3);
    expect(names(html)).toEqual(
      expect.arrayContaining([
        "code",
        "kind",
        "valuePct",
        "minSubtotal",
        "usageLimit",
        "expiresAt",
        "isActive",
      ]),
    );
  });

  it("an edit is one page with its submit, and the browser's own checks", async () => {
    const { PromoForm } = await import("@/components/admin/promo-form");
    const html = renderToStaticMarkup(
      createElement(PromoForm, {
        action: vi.fn(),
        submitLabel: "Kaydet",
      } as never),
    );
    expect(html).not.toContain('aria-current="step"');
    expect(html).not.toContain("Sonraki adım");
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Kaydet<\/button>/);
    expect(html).not.toMatch(/<form[^>]*novalidate/i);
    // No summary step on an edit.
    expect(html).not.toContain("Kod kaydedilince");
  });
});

describe("manual order", () => {
  it("lines, customer, payment, summary; the lines still post as `items`", async () => {
    const { ManualOrderForm } =
      await import("@/components/admin/manual-order-form");
    const html = renderToStaticMarkup(
      createElement(ManualOrderForm, {
        products: [
          {
            id: "prd-1",
            name: "Çekirdek",
            priceMinor: 32_000,
            stock: 4,
            variants: [],
          },
        ],
        shipping: {
          courierFeeMinor: 5_500,
          shippingFlatMinor: 4_900,
          shippingFreeThresholdMinor: 50_000,
        },
        action: async () => ({}),
        clientOrderId: "attempt-0001",
      }),
    );
    expectWizard(html, 4);
    expect(names(html)).toEqual(
      expect.arrayContaining([
        "items",
        "clientOrderId",
        "fulfillment",
        "customerName",
        "customerEmail",
        "customerPhone",
        "shippingAddress",
        "status",
        "paymentMethod",
        "promoCode",
        "internalNote",
      ]),
    );
  });
});

describe("menu item", () => {
  it("basics, price, picture, tags and allergens, summary; nothing left out", async () => {
    const { MenuItemForm } = await import("@/components/admin/menu-item-form");
    const html = renderToStaticMarkup(
      createElement(MenuItemForm, {
        action: noop,
        submitLabel: "Menüye ekle",
        cancelHref: "/admin/menu",
        saveAndNew: true,
        mode: "wizard",
      }),
    );
    expectWizard(html, 5);
    expect(names(html)).toEqual(
      expect.arrayContaining([
        "name",
        "desc",
        "categoryKey",
        "price",
        "priceL",
        "sortOrder",
        "taxRatePct",
        "image",
        "backdrop",
        "vessel",
        "hue",
        "tags",
        "allergens",
        "isActive",
      ]),
    );
  });

  it("an edit keeps the one-page form with both buttons", async () => {
    const { MenuItemForm } = await import("@/components/admin/menu-item-form");
    const html = renderToStaticMarkup(
      createElement(MenuItemForm, {
        action: noop,
        submitLabel: "Kaydet",
        cancelHref: "/admin/menu",
      }),
    );
    expect(html).not.toContain("Sonraki adım");
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Kaydet<\/button>/);
  });
});

describe("app post", () => {
  it("a new post is a wizard and keeps the member mail box and its confirm", () => {
    const src = read("src/app/admin/mobil/gonderiler/post-form.tsx");
    expect(src).toContain("<WizardActionForm");
    expect(src).toContain("beforeSubmit={gateCheck}");
    // The edit stays the guarded one-page form.
    expect(src).toContain("<GuardedActionForm");
  });
});

describe("the ActionForm side (menu item, app post)", () => {
  it("a refusal opens its step, Enter moves on, the browser check is the kit's", () => {
    const form = read("src/components/admin/action-form.tsx");
    expect(form).toContain("wizard.openErrors(result.fieldErrors)");
    expect(form).toContain(
      "onKeyDown={wizard?.enabled ? wizard.onKeyDown : undefined}",
    );
    expect(form).toContain("noValidate={wizard?.enabled || undefined}");
    const wrapper = read("src/components/admin/wizard-action-form.tsx");
    // The steps' check first, then the form's own (a confirm dialog).
    expect(wrapper).toContain(
      "wizard.beforeSubmit() && beforeSubmit?.(form, submitter) !== false",
    );
    expect(wrapper).toContain("useUnsavedGuard(formRef);");
  });
});
