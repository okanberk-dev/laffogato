import { readFileSync } from "node:fs";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * The checkout's phone layout, held where a browser is not at hand: reading
 * order, focus, touch targets, the bar. (The pixels were checked in a real
 * browser at 375 and 320 px.)
 */

const checkout = readFileSync("src/app/odeme/checkout.tsx", "utf8");
const css = readFileSync("src/app/globals.css", "utf8");

/** The declarations of the first rule that starts with `selector {`. */
function rule(selector: string, from = 0): string {
  const at = css.indexOf(`\n${selector} {`, from);
  expect(at, selector).toBeGreaterThan(-1);
  return css.slice(at, css.indexOf("}", at));
}

describe("reading order and focus", () => {
  it("the summary comes before the form in the DOM, as it does on a phone", () => {
    expect(checkout.indexOf('className="co-side"')).toBeGreaterThan(-1);
    expect(checkout.indexOf('className="co-side"')).toBeLessThan(
      checkout.indexOf('className="co-main"'),
    );
    // Desktop keeps its columns through named grid areas, not DOM order.
    expect(css).toContain('grid-template-areas: "head head" "main side";');
  });

  it("each step's heading takes focus when the step changes", () => {
    for (const id of ["co-delivery-title", "co-pay-title"]) {
      expect(checkout).toMatch(
        new RegExp(`id="${id}"[\\s\\S]{0,40}tabIndex=\\{-1\\}`),
      );
    }
    // goToPayment, goToDelivery and Back/Forward all go through showStep.
    const uses = checkout.match(/showStep\(/g) ?? [];
    expect(uses.length).toBeGreaterThanOrEqual(3);
    expect(checkout).toMatch(/\.focus\(\{ preventScroll: true \}\)/);
  });

  it("a bad card field is scrolled to the middle, clear of the pay bar", () => {
    const card = readFileSync("src/app/odeme/card-payment.tsx", "utf8");
    expect(card).toContain('scrollIntoView({ block: "center" })');
    expect(css).toMatch(
      /html:has\(\.co-layout\[data-step="2"\]\) \{\s*scroll-padding-bottom: calc\(176px \+ env\(safe-area-inset-bottom\)\);/,
    );
  });
});

describe("phone sizes", () => {
  it("pads the end of the page once, not twice", () => {
    expect(css).not.toMatch(/\.co-layout\[data-step="2"\] \{\s*padding-bottom/);
    expect(css).toMatch(
      /\.co-chrome-body:has\(\.co-layout\[data-step="2"\]\) \+ \.co-chrome-foot \{\s*padding-bottom: calc\(176px/,
    );
  });

  it("every touch target is at least 44px", () => {
    expect(rule(".co-help")).toMatch(/width: 44px;\s*height: 44px;/);
    expect(rule(".co-qty button")).toMatch(/width: 44px;\s*height: 44px;/);
    expect(rule(".co-line-side .co-link")).toContain("min-height: 44px;");
    expect(rule(".co-link")).toContain("min-height: 44px;");
    expect(css).toMatch(
      /\.co-confirm \.checkout-consent-row \{[^}]*min-height: 44px;/,
    );
  });

  it("the promo input is 16px, so iOS does not zoom", () => {
    expect(css).toMatch(
      /\.co-summary \.checkout-promo input \{\s*font-size: 16px;/,
    );
  });

  it("a 320px header fits on one line: the number gives way to the word", () => {
    const at = css.lastIndexOf("@media (max-width: 350px)");
    expect(at).toBeGreaterThan(-1);
    const block = css.slice(at);
    expect(block).toMatch(/\.co-chrome-help-number \{\s*display: none;/);
    expect(block).toMatch(/\.co-chrome-help-label \{\s*display: inline;/);
    const chrome = readFileSync("src/app/odeme/checkout-chrome.tsx", "utf8");
    // The number is still what the link says to a screen reader.
    expect(chrome).toContain("aria-label={`Yardım: ${phone}`}");
  });
});

describe("what the summary and the notes must keep saying", () => {
  it("the free-shipping hint is in the summary, outside its collapsible body", () => {
    const summary = checkout.slice(checkout.indexOf('className="co-summary"'));
    const hint = summary.indexOf("co-freeship");
    expect(hint).toBeGreaterThan(-1);
    // After the body (whose last part is the totals list) closes, so a
    // closed summary on a phone still shows it.
    const totals = summary.indexOf('className="co-totals"');
    expect(totals).toBeGreaterThan(-1);
    expect(summary.slice(totals, hint)).toMatch(/<\/dl>\s*<\/div>/);
    // And not a second copy in step 1.
    expect(checkout.match(/checkout-freeship-hint/g)).toHaveLength(1);
  });

  it("the seller is named once, in full, beside the contract links, from the entity only", () => {
    const docs = checkout.slice(checkout.indexOf('className="co-docs"'));
    const block = docs.slice(0, docs.indexOf("</p>"));
    expect(block).toContain("co-docs-seller");
    expect(block).toContain("Satıcı: {sellerLine}");
    // The contract links and the withdrawal terms sit in the same block,
    // before any card field.
    for (const slug of [
      "on-bilgilendirme-formu",
      "mesafeli-satis-sozlesmesi",
      "iade-ve-cayma",
    ]) {
      expect(block).toContain(`href="/hukuk/${slug}"`);
    }
    const cardForm = checkout.search(/<CardPayment\s/);
    expect(cardForm).toBeGreaterThan(-1);
    expect(checkout.indexOf('className="co-docs"')).toBeLessThan(cardForm);
    // One identity line on the page: the summary no longer repeats it, and
    // no screen size hides it (it used to be name + MERSİS on a phone only).
    expect(checkout.match(/Satıcı:/g)).toHaveLength(1);
    expect(checkout).not.toContain("co-seller");
    expect(css).not.toMatch(/\.co-docs-seller \{\s*display: none;/);
    // Built from the entity fields the page passes, nothing typed here.
    const line = checkout.slice(
      checkout.indexOf("const sellerLine = ["),
      checkout.indexOf('.join(" · ");', checkout.indexOf("const sellerLine")),
    );
    for (const field of ["name", "address", "phone", "email", "mersis"]) {
      expect(line).toContain(`seller.${field}`);
    }
    const page = readFileSync("src/app/odeme/(checkout)/page.tsx", "utf8");
    expect(page).toContain("name: LEGAL_ENTITY.legalName");
    expect(page).toContain("address: LEGAL_ADDRESS_LINE");
  });

  it("says each thing once: the total beside the button, trust marks and 'Güvenli ödeme' once", () => {
    // The pay bar shows "Toplam (KDV dahil)" right above the button, so
    // the button no longer repeats the amount.
    const bar = checkout.slice(checkout.indexOf('className="co-paybar"'));
    expect(bar.slice(0, 400)).toContain("(KDV dahil)");
    expect(checkout).toMatch(
      /const payLabel = nothingToPay \? "Siparişi onayla" : "Siparişi onayla ve öde";/,
    );
    // The accepted-cards row is shown once (and not when there is nothing
    // to pay); the old row under the pay button repeated it with 3D Secure,
    // which the card form's own note already says.
    expect(checkout.match(/<AcceptedSchemes/g)).toHaveLength(1);
    expect(checkout).not.toContain('className="co-trust"');
    expect(checkout).toMatch(
      /\{nothingToPay \? null : \(\s*<div className="co-accepted">/,
    );
    expect(css).not.toMatch(/\n\.co-trust \{/);
    // "Güvenli ödeme" is in the checkout's own header on every step.
    expect(checkout).not.toContain("Güvenli ödeme");
    expect(css).not.toContain(".co-section-secure");
    const chrome = readFileSync("src/app/odeme/checkout-chrome.tsx", "utf8");
    expect(chrome).toContain("Güvenli ödeme");
  });
});

// ── the return notice above the gate panels ─────────────────────────────────

const settings = vi.hoisted(() => ({ value: { isShopOpen: true } as never }));
const customer = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("@/lib/admin/store", () => ({
  getPublicSettings: async () => settings.value,
}));
vi.mock("@/lib/customer/auth", () => ({
  getActiveCustomer: async () => customer.value,
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
  Checkout: () => createElement("div", { "data-checkout": "" }),
}));

describe("a return reason is said above the gate panels", () => {
  async function page(query: Record<string, string>) {
    const { default: OdemePage } = await import("@/app/odeme/(checkout)/page");
    return renderToStaticMarkup(
      await OdemePage({ searchParams: Promise.resolve(query) }),
    );
  }

  it("when the shop is closed", async () => {
    settings.value = { isShopOpen: false } as never;
    const html = await page({ odeme: "cok_deneme", dk: "30" });
    expect(html).toMatch(/role="alert"[^>]*>.*30 dakika sonra/);
    expect(html).toContain("Kartından para çekilmedi");
  });

  it("when nobody is signed in", async () => {
    settings.value = { isShopOpen: true } as never;
    customer.value = null;
    const html = await page({ error: "payment" });
    expect(html).toMatch(/role="alert"[^>]*>.*Ödeme tamamlanmadı/);
    expect(html).toContain("Sipariş için giriş yap");
  });

  it("when the e-mail is not verified", async () => {
    customer.value = { email: "a@b.c", emailVerified: false };
    const html = await page({ odeme: "reddedildi" });
    expect(html).toContain('role="alert"');
    expect(html).toContain("verify");
  });

  it("not as a gate notice when the checkout itself shows it", async () => {
    customer.value = {
      email: "a@b.c",
      emailVerified: true,
      name: "A",
      phone: "",
      addresses: [],
    };
    const html = await page({ odeme: "reddedildi" });
    expect(html).toContain("data-checkout");
    expect(html).not.toContain('role="alert"');
  });

  it("not at all without a reason, and never with a made-up one", async () => {
    settings.value = { isShopOpen: false } as never;
    expect(await page({})).not.toContain('role="alert"');
    expect(await page({ odeme: "<script>x</script>" })).not.toContain(
      "<script>",
    );
  });
});
