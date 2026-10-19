import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type {
  AdminCategory,
  AdminProduct,
  AdminSettings,
} from "@/lib/admin/store";
import { LEGAL_TAX_RATES, TAX_RATE_KEYS } from "@/lib/utils/kdv";

/**
 * The panel's KDV fields as markup: the product's select names its
 * category's rate and keeps a stored own rate selected, and Ayarlar > Vergi
 * has one required select per kind of sale (18 Eki 2026: a select like the
 * product's, the shipping fee its own).
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
      taxRates: { ...LEGAL_TAX_RATES },
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
    // Coffee beans: the köşk's food is 10% (18 Eki 2026).
    expect(select).toContain("Kategorinin oranı (%10)");
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

  it("the hint says the köşk's food is 10%, clothing and bags too", () => {
    const html = wizard();
    expect(html).toContain(
      "Köşkün sattığı gıda %10, giyim ve çanta %10, ekipman ve diğer hediyelik %20.",
    );
    expect(html).not.toContain("Kahve ve gıda %1");
  });
});

describe("Ayarlar > Vergi", () => {
  function taxTab(taxRates: Record<string, number>) {
    return renderToStaticMarkup(
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
          taxRates,
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
  }

  /** The `<select name="taxRate_<key>">` and what it holds. */
  function rateSelect(html: string, key: string): string {
    const m = html.match(
      new RegExp(`<select[^>]*name="taxRate_${key}"[\\s\\S]*?</select>`),
    );
    expect(m, key).not.toBeNull();
    return m![0];
  }

  it("has one required select per kind of sale, the shipping fee last", () => {
    const html = taxTab({ ...LEGAL_TAX_RATES });
    expect(TAX_RATE_KEYS).toEqual([
      "menu",
      "karaoke",
      "beans",
      "pantry",
      "gift",
      "gear",
      "merch",
      "shipping",
    ]);
    for (const key of TAX_RATE_KEYS) {
      const select = rateSelect(html, key);
      expect(select).toContain("required");
      for (const r of ["0", "1", "10", "20"]) {
        expect(select, `${key} ${r}`).toContain(`<option value="${r}"`);
      }
      // No free number field any more.
      expect(html).not.toMatch(
        new RegExp(`<input[^>]*name="taxRate_${key}"`),
      );
    }
    expect(rateSelect(html, "beans")).toMatch(/<option value="10" selected="">/);
    expect(rateSelect(html, "pantry")).toMatch(/<option value="10" selected="">/);
    expect(rateSelect(html, "shipping")).toMatch(
      /<option value="20" selected="">/,
    );
    expect(html).toContain("Kargo ve kurye ücreti");
    // The old single field is gone.
    expect(html).not.toContain('name="taxRatePct"');
  });

  it("a stored rate outside the four stays offered and selected, so a save never changes it unseen", () => {
    const html = taxTab({ ...LEGAL_TAX_RATES, menu: 8, beans: 1 });
    const menu = rateSelect(html, "menu");
    expect(menu).toMatch(/<option value="8" selected="">/);
    expect(menu.match(/<option /g)).toHaveLength(5);
    // 1 is one of the four: offered once, selected.
    const beans = rateSelect(html, "beans");
    expect(beans).toMatch(/<option value="1" selected="">/);
    expect(beans.match(/<option /g)).toHaveLength(4);
  });

  it("says the fee is its own line and gives the reviewed rates in the hints", () => {
    const html = taxTab({ ...LEGAL_TAX_RATES });
    expect(html).toContain(
      "Kargo ve kurye ücreti faturada ayrı kalemdir ve kendi oranını alır.",
    );
    expect(html).not.toContain("taşıdığı ürünün oranını alır");
    expect(html).toContain(
      "Paketli kahve: %10. Köşk kafe işletmesi olduğu için internetten satıp gönderdiği gıda da %10 sayılır (KDV GUT III/B-2.4.1).",
    );
    expect(html).toContain(
      "Matcha, bisküvi, krema, şurup gibi paketli gıda: %10, kahveyle aynı kural.",
    );
    expect(html).toContain(
      "Önlük, tişört gibi giyim ve çanta %10: o üründe %10 seç.",
    );
    expect(html).toContain(
      "Siparişteki kargo ve kurye ücreti ayrı bir taşıma hizmetidir: %20.",
    );
    expect(html).not.toMatch(/gıda: %1\b|%1\./);
  });
});
