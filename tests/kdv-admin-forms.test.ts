import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type {
  AdminCategory,
  AdminProduct,
  AdminSettings,
} from "@/lib/admin/store";
import { LEGAL_TAX_RATES } from "@/lib/utils/kdv";

/**
 * The panel's KDV fields as markup: the product's select names its
 * category's rate and keeps a stored own rate selected, and Ayarlar > Vergi
 * has one required whole-number field per kind of sale.
 */

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children?: ReactNode }) =>
    createElement("a", { href }, children),
}));
vi.mock("@/app/admin/ayarlar/actions", () => {
  const noop = async () => ({});
  return {
    saveEmailSenderAction: noop,
    saveGeneralAction: noop,
    saveHoursAction: noop,
    saveNotificationsAction: noop,
    saveSeoAction: noop,
    saveShippingAction: noop,
    saveTaxAction: noop,
    sendTestEmailAction: noop,
  };
});

vi.mock("@/app/admin/ayarlar/karaoke-actions", () => ({
  saveKaraokeAction: async () => ({}),
}));

const { ProductWizard } = await import("@/components/admin/product-wizard");
const { SettingsForm } = await import("@/app/admin/ayarlar/settings-form");

const CATEGORIES: AdminCategory[] = [
  { id: "c1", slug: "beans", label: "Kahve çekirdeği", icon: "", sortOrder: 0 },
  { id: "c2", slug: "gear", label: "Ekipman", icon: "", sortOrder: 1 },
];

function wizard(product?: Partial<AdminProduct>) {
  return renderToStaticMarkup(
    createElement(ProductWizard, {
      product: product as AdminProduct | undefined,
      categories: CATEGORIES,
      action: async () => ({}),
      submitLabel: "Kaydet",
      mode: "tabs",
      taxRates: { ...LEGAL_TAX_RATES, beans: 1 },
    }),
  );
}

/** The `<select name="taxRatePct">` and what it holds. */
function taxSelect(html: string): string {
  const m = html.match(/<select[^>]*name="taxRatePct"[\s\S]*?<\/select>/);
  expect(m, "taxRatePct select").not.toBeNull();
  return m![0];
}

describe("product wizard: KDV oranı", () => {
  it("a new product starts on its category's rate, named in the option", () => {
    const select = taxSelect(wizard());
    expect(select).toContain("Kategorinin oranı (%1)");
    expect(select).toMatch(/<option value="" selected="">/);
    for (const r of ["0", "1", "10", "20"]) {
      expect(select).toContain(`<option value="${r}"`);
    }
  });

  it("a product with its own rate keeps it selected", () => {
    const select = taxSelect(
      wizard({
        name: "Moka",
        cat: "gear",
        priceMinor: 120_000,
        taxRatePct: 10,
        variants: [],
        images: [],
        tags: [],
        notes: [],
      }),
    );
    expect(select).toMatch(/<option value="10" selected="">/);
    expect(select).toContain("Kategorinin oranı (%20)");
  });

  it("a stored rate outside the usual four is still offered, never lost", () => {
    const select = taxSelect(
      wizard({
        name: "Özel",
        cat: "beans",
        priceMinor: 1_000,
        taxRatePct: 8,
        variants: [],
        images: [],
        tags: [],
        notes: [],
      }),
    );
    expect(select).toMatch(/<option value="8" selected="">/);
  });
});

describe("Ayarlar > Vergi", () => {
  it("has one required whole-number field per kind of sale, filled from settings", () => {
    const html = renderToStaticMarkup(
      createElement(SettingsForm, {
        settings: {
          name: "L'Affogato",
          tagline: "",
          phone: "",
          email: "",
          address: "",
          heroImageUrl: "",
          isShopOpen: true,
          weeklyHours: Object.fromEntries(
            ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((d) => [
              d,
              { open: "09:00", close: "02:00", closed: false },
            ]),
          ),
          taxRates: { ...LEGAL_TAX_RATES, menu: 8 },
          shippingFlatMinor: 4900,
          shippingFreeThresholdMinor: 50000,
          courierFeeMinor: 5500,
          karaokeHourlyMinor: 100000,
          karaokeCapacity: 8,
          karaokeNotifyEmail: "",
          karaokePrepay: true,
          seoTitle: "",
          seoOgImageUrl: "",
          seoIndexable: true,
          notificationEmail: "",
          orderNotifyEnabled: true,
          orderNotifyRoles: ["owner"],
          orderNotifyEmails: "",
          emailFromName: "",
          emailFromAddress: "",
          emailReplyTo: "",
        } as unknown as AdminSettings,
        mail: {
          hasProvider: true,
          from: "L'Affogato <info@laffogato.net>",
          domain: "laffogato.net",
          status: "verified",
          ok: true,
          message: "",
        } as never,
      }),
    );
    for (const key of [
      "menu",
      "karaoke",
      "beans",
      "pantry",
      "gift",
      "gear",
      "merch",
    ]) {
      const input = html.match(
        new RegExp(`<input[^>]*name="taxRate_${key}"[^>]*>`),
      );
      expect(input, key).not.toBeNull();
      expect(input![0]).toContain("required");
      expect(input![0]).toContain('step="1"');
    }
    expect(html).toMatch(/name="taxRate_menu"[^>]*value="8"/);
    expect(html).toMatch(/name="taxRate_beans"[^>]*value="1"/);
    // The old single field is gone.
    expect(html).not.toContain('name="taxRatePct"');
  });
});
