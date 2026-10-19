import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CHECKOUT_CONSENT_DOCS } from "@/lib/legal/meta";
import { LEGAL_TAX_RATES } from "@/lib/utils/kdv";

/**
 * What /odeme hands the checkout for its pre-contract information
 * (ASK-OTH-2, 18 Eki 2026): the two documents as /hukuk/[slug] reads them
 * (findLegalDoc + getPublishedLegalOverride) and the rate each product's
 * line will carry. Front end only: existing readers, no new query.
 */

const settings = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
const products = vi.hoisted(() => ({
  value: [] as unknown[],
  fail: false,
}));
const overrides = vi.hoisted(() => ({
  value: {} as Record<string, unknown>,
}));
const seen = vi.hoisted(() => ({
  props: null as Record<string, unknown> | null,
}));

vi.mock("@/lib/admin/store", () => ({
  getPublicSettings: async () => settings.value,
  listProductsForImport: async () => {
    if (products.fail) throw new Error("unreachable");
    return products.value;
  },
}));
vi.mock("@/lib/legal/store", () => ({
  getPublishedLegalOverride: async (slug: string) =>
    overrides.value[slug] ?? null,
}));
vi.mock("@/lib/customer/auth", () => ({
  getActiveCustomer: async () => ({
    email: "ayse@example.com",
    emailVerified: true,
    name: "Ayşe",
    phone: "",
    addresses: [],
  }),
}));
vi.mock("@/lib/payment/saved-cards", () => ({
  checkoutPaymentSetup: async () => ({
    mode: "card",
    savedCards: [],
    savedCardsUnavailable: false,
    canSave: false,
  }),
}));
vi.mock("@/components/customer/verify-notice", () => ({
  VerifyNotice: () => createElement("div", null, "verify"),
}));
vi.mock("@/components/laffogato/brand-mark", () => ({
  LafMark: () => createElement("span", null, "mark"),
}));
vi.mock("@/app/odeme/checkout", () => ({
  Checkout: (props: Record<string, unknown>) => {
    seen.props = props;
    return createElement("div", { "data-checkout": "" });
  },
}));

async function render() {
  const { default: OdemePage } = await import("@/app/odeme/(checkout)/page");
  renderToStaticMarkup(await OdemePage({ searchParams: Promise.resolve({}) }));
  expect(seen.props).not.toBeNull();
  return seen.props!;
}

beforeEach(() => {
  seen.props = null;
  settings.value = {
    isShopOpen: true,
    shippingFlatMinor: 6000,
    shippingFreeThresholdMinor: 100000,
    taxRates: { ...LEGAL_TAX_RATES },
  };
  products.value = [];
  products.fail = false;
  overrides.value = {};
});

describe("the documents the payment step opens", () => {
  it("are the two checkout documents, coded text when no override is live", async () => {
    const props = await render();
    const docs = props.documents as {
      slug: string;
      title: string;
      updatedAt: string;
      body: unknown;
    }[];
    expect(docs.map((d) => d.slug)).toEqual([...CHECKOUT_CONSENT_DOCS]);
    expect(docs[0].title).toBe("Ön Bilgilendirme Formu");
    expect(docs[1].title).toBe("Mesafeli Satış Sözleşmesi");
    const html = renderToStaticMarkup(docs[0].body as never);
    expect(html).toContain('class="legal-article"');
    expect(html).toContain("Ön Bilgilendirme");
  });

  it("show a published panel override, as /hukuk does", async () => {
    overrides.value = {
      "mesafeli-satis-sozlesmesi": {
        slug: "mesafeli-satis-sozlesmesi",
        title: "MSS (panel)",
        summary: "",
        effectiveDate: "20 Ekim 2026",
        bodyMarkdown: "Panelden yayımlanan metin.",
        isPublished: true,
        updatedAt: "2026-10-20T09:00:00.000Z",
      },
    };
    const docs = (await render()).documents as {
      title: string;
      updatedAt: string;
      body: unknown;
    }[];
    expect(docs[1].title).toBe("MSS (panel)");
    expect(docs[1].updatedAt).toBe("20 Ekim 2026");
    expect(renderToStaticMarkup(docs[1].body as never)).toContain(
      "Panelden yayımlanan metin.",
    );
  });
});

describe("the rates the KDV note reads", () => {
  it("are each product's own rate, else its category's, the rule the order stamps with", async () => {
    products.value = [
      { id: "prd-0001", cat: "beans", taxRatePct: null },
      { id: "prd-0005", cat: "gift", taxRatePct: 1 },
      { id: "prd-0007", cat: "gear" },
    ];
    settings.value = {
      ...settings.value,
      taxRates: { ...LEGAL_TAX_RATES, beans: 1, gear: 20 },
    };
    const kdv = (await render()).kdv as {
      products: Record<string, number>;
      shippingRatePct: number | null;
    };
    expect(kdv.products).toEqual({
      "prd-0001": 1,
      "prd-0005": 1,
      "prd-0007": 20,
    });
    // No shipping rate in the settings yet: the fee follows the goods.
    expect(kdv.shippingRatePct).toBeNull();
  });

  it("take the shipping fee's own rate once the settings carry one", async () => {
    settings.value = {
      ...settings.value,
      taxRates: { ...LEGAL_TAX_RATES, shipping: 20 },
    };
    const kdv = (await render()).kdv as { shippingRatePct: number | null };
    expect(kdv.shippingRatePct).toBe(20);
  });

  it("leave the note out, not the checkout, when the catalogue cannot be read", async () => {
    products.fail = true;
    const kdv = (await render()).kdv as {
      products: Record<string, number>;
      shippingRatePct: number | null;
    };
    expect(kdv).toEqual({ products: {}, shippingRatePct: null });
  });
});
