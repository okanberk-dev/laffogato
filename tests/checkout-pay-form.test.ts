import { readFileSync } from "node:fs";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CardPayment, PAY_FORM_ID } from "@/app/odeme/card-payment";
import type { CheckoutSavedCard } from "@/lib/checkout/start";
import {
  CARD_FORM_FIELDS,
  cardBrand,
  cardFieldErrors,
  formatCardNumber,
  formatExpiryInput,
  parseCardForm,
  reformatCardNumber,
} from "@/lib/payment/paynkolay-card";

/**
 * The card form on /odeme (docs/PAYNKOLAY.md §15.5, CLAUDE.md rule 28): a
 * native form that posts to /odeme/paynkolay, uncontrolled inputs with the
 * browser's card autofill, and nothing in it that can delete a saved card.
 * PayNkolay's published TEST card only.
 */

const CARDS: CheckoutSavedCard[] = [
  {
    tranId: "yes21405",
    last4: "6111",
    bank: "QNB",
    brand: "VISA",
    alias: "Kartım 6111",
  },
];

function render(over: Partial<Parameters<typeof CardPayment>[0]> = {}) {
  return renderToStaticMarkup(
    createElement(CardPayment, {
      mode: "card",
      nothingToPay: false,
      savedCards: [],
      savedCardsUnavailable: false,
      canSave: false,
      onPay: () => {},
      onRestored: () => {},
      onDeleteCard: async () => ({ ok: true as const, cards: [] }),
      busy: false,
      ...over,
    }),
  );
}

/** The `<form id="pay-form" …>…</form>` element, and the rest of the markup. */
function split(html: string) {
  const start = html.indexOf(`<form id="${PAY_FORM_ID}"`);
  const end = html.indexOf("</form>", start) + "</form>".length;
  expect(start).toBeGreaterThan(-1);
  return {
    form: html.slice(start, end),
    outside: html.slice(0, start) + html.slice(end),
  };
}

const tag = (html: string, id: string) =>
  html.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`))?.[0] ?? "";

describe("the pay form", () => {
  it("is a native POST to the payment route, with no Server Action", () => {
    const { form } = split(render());
    const open = form.slice(0, form.indexOf(">") + 1);
    expect(open).toContain('method="post"');
    expect(open).toContain('action="/odeme/paynkolay"');
    expect(open).not.toMatch(/javascript:|\$ACTION/);
    expect(form).not.toContain("$ACTION_ID");
    expect(form).toMatch(/<input type="hidden" name="d"/);
    expect(form).toMatch(/<input type="hidden" name="s"/);
    expect(form).toContain('name="return" value="checkout"');
  });

  it("names the card fields as the route reads them, with card autofill on", () => {
    const html = render();
    const fields: [string, string, string][] = [
      ["cc-name", CARD_FORM_FIELDS.holderName, "cc-name"],
      ["cc-number", CARD_FORM_FIELDS.number, "cc-number"],
      ["cc-exp", CARD_FORM_FIELDS.expiry, "cc-exp"],
      ["cc-csc", CARD_FORM_FIELDS.cvv, "cc-csc"],
    ];
    for (const [id, name, autocomplete] of fields) {
      const input = tag(html, id);
      expect(input, id).toContain(`name="${name}"`);
      // React writes the attribute camel-cased; HTML reads it either way.
      expect(input.toLowerCase(), id).toContain(
        `autocomplete="${autocomplete}"`,
      );
      // Uncontrolled: no value is ever rendered into a card field.
      expect(input, id).not.toMatch(/\svalue=/);
    }
    for (const id of ["cc-number", "cc-exp", "cc-csc"]) {
      expect(tag(html, id).toLowerCase(), id).toContain('inputmode="numeric"');
    }
    expect(html.toLowerCase()).not.toContain('autocomplete="off"');
  });

  it("has no submit button of its own: the pay button names it from outside", () => {
    const html = render({ savedCards: CARDS, canSave: true });
    expect(html).not.toMatch(/type="submit"/);
    const checkout = readFileSync("src/app/odeme/checkout.tsx", "utf8");
    const submits = [
      ...checkout.matchAll(/<button\s+type="submit"[\s\S]*?>/g),
    ].map((m) => m[0]);
    // The pay button, and the promo form's own "Uygula".
    const forPay = submits.filter((b) => b.includes("form={PAY_FORM_ID}"));
    expect(forPay).toHaveLength(1);
    expect(forPay[0]).toContain("disabled={placing || !consentGiven}");
  });

  it("keeps the saved cards' Sil outside the pay form, as plain buttons", () => {
    const { form, outside } = split(render({ savedCards: CARDS }));
    expect(form).not.toContain("Sil");
    expect(form).not.toContain("deleteCard");
    const sil = outside.match(/<button[^>]*>Sil<\/button>/)?.[0] ?? "";
    expect(sil).toContain('type="button"');
    // The radios still belong to the pay form, by its id.
    const radios = outside.match(/<input[^>]*type="radio"[^>]*>/g) ?? [];
    expect(radios).toHaveLength(2);
    for (const radio of radios) {
      expect(radio).toContain('name="cardChoice"');
      expect(radio).toContain(`form="${PAY_FORM_ID}"`);
    }
    // The first saved card is chosen; the token never reaches the page.
    expect(outside).toContain('value="yes21405"');
  });

  it("offers 'Bu kartı kaydet' unticked, and only when saving is possible", () => {
    expect(render()).not.toContain('name="saveCard"');
    const box = render({ canSave: true }).match(
      /<input[^>]*name="saveCard"[^>]*>/,
    )?.[0];
    expect(box).toBeTruthy();
    expect(box).not.toMatch(/checked/);
  });

  it("asks for no card when there is nothing to pay or the provider takes it", () => {
    expect(render({ nothingToPay: true })).not.toContain('id="cc-number"');
    expect(render({ mode: "redirect" })).not.toContain('id="cc-number"');
  });

  it("carries the trust note and the provider line", () => {
    const html = render();
    expect(html).toContain("Kart bilgilerini biz kaydetmeyiz");
    expect(html).toContain("3D Secure");
    expect(html).toContain("Tek çekim");
    expect(html).toContain("Ödeme altyapısı: PayNkolay");
  });
});

describe("card formatting on /odeme", () => {
  it("reads the scheme from the first digits", () => {
    expect(cardBrand("4155")).toBe("visa");
    expect(cardBrand("5412")).toBe("mastercard");
    expect(cardBrand("2221 00")).toBe("mastercard");
    expect(cardBrand("3714")).toBe("amex");
    expect(cardBrand("9792 03")).toBe("troy");
    // Troy's other issuer ranges (BKM), read after the other schemes.
    expect(cardBrand("6500 12")).toBe("troy");
    expect(cardBrand("65")).toBe("troy");
    expect(cardBrand("2205 12")).toBe("troy");
    // ...which leave the others alone: Mastercard 2221-2720, Visa 4, Amex.
    expect(cardBrand("2221 00")).toBe("mastercard");
    expect(cardBrand("2720 99")).toBe("mastercard");
    expect(cardBrand("2204 00")).toBe("unknown");
    expect(cardBrand("6")).toBe("unknown");
    expect(cardBrand("6011")).toBe("unknown");
    expect(cardBrand("6011")).toBe("unknown");
  });

  it("groups 4-4-4-4, and Amex 4-6-5", () => {
    expect(formatCardNumber("4155650100416111")).toBe("4155 6501 0041 6111");
    expect(formatCardNumber("371449635398431")).toBe("3714 496353 98431");
  });

  it("keeps the caret behind the same digit while reformatting", () => {
    // A digit typed after "4155 " (caret 6 in "4155 65") stays put.
    expect(reformatCardNumber("415565", 6)).toEqual({
      value: "4155 65",
      caret: 7,
    });
    expect(reformatCardNumber("4155650100416111999999", 22).value).toBe(
      "4155 6501 0041 6111 999",
    );
  });

  it("writes the expiry as AA/YY and keeps Chrome's AA/YYYY autofill", () => {
    expect(formatExpiryInput("0130", false)).toBe("01/30");
    expect(formatExpiryInput("3", false)).toBe("03/");
    expect(formatExpiryInput("1/", false)).toBe("01/");
    expect(formatExpiryInput("08/2029", false)).toBe("08/2029");
    expect(formatExpiryInput("01/", true)).toBe("01");
  });

  it("is never looser than the server: what the form accepts, the route accepts", () => {
    const now = new Date("2026-10-16T10:00:00Z");
    const values: Record<string, string> = {
      [CARD_FORM_FIELDS.holderName]: "ADA LOVELACE",
      [CARD_FORM_FIELDS.number]: "4155 6501 0041 6111",
      [CARD_FORM_FIELDS.expiry]: "01/30",
      [CARD_FORM_FIELDS.cvv]: "715",
    };
    const read = (n: string) => values[n];
    expect(cardFieldErrors(read, now)).toEqual({});
    expect(parseCardForm(read, now).ok).toBe(true);
    // And the specific messages the spec names.
    expect(
      cardFieldErrors(
        (n) =>
          ({ ...values, [CARD_FORM_FIELDS.number]: "4155650100416112" })[n],
        now,
      ).number,
    ).toBe("Kart numarası eksik ya da hatalı.");
    expect(
      cardFieldErrors(
        (n) => ({ ...values, [CARD_FORM_FIELDS.expiry]: "09/26" })[n],
        now,
      ).expiry,
    ).toBe("Son kullanma tarihi geçmiş.");
    expect(
      cardFieldErrors(
        (n) => ({ ...values, [CARD_FORM_FIELDS.cvv]: "71" })[n],
        now,
      ).cvv,
    ).toBe("Güvenlik kodu 3 haneli olmalı.");
    // Amex asks for 4.
    expect(
      cardFieldErrors(
        (n) =>
          ({
            ...values,
            [CARD_FORM_FIELDS.number]: "371449635398431",
            [CARD_FORM_FIELDS.cvv]: "123",
          })[n],
        now,
      ).cvv,
    ).toBe("Güvenlik kodu 4 haneli olmalı.");
  });

  it("no message carries what was typed", () => {
    const errs = cardFieldErrors(
      (n) =>
        ({
          [CARD_FORM_FIELDS.holderName]: "<b>",
          [CARD_FORM_FIELDS.number]: "4155650100416112",
          [CARD_FORM_FIELDS.expiry]: "99/99",
          [CARD_FORM_FIELDS.cvv]: "71",
        })[n],
    );
    const text = Object.values(errs).join(" ");
    expect(text).not.toContain("4155");
    expect(text).not.toContain("71 ");
    expect(text).not.toContain("<b>");
  });
});
