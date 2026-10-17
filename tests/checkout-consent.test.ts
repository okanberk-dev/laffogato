import { readFileSync } from "node:fs";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  CheckoutConsent,
  checkoutConsentGiven,
  type CheckoutConsentTicks,
  NO_CHECKOUT_CONSENT,
} from "@/app/odeme/checkout-consent";
import { CHECKOUT_CONSENT_DOCS } from "@/lib/legal/meta";

/**
 * The checkout's distance-selling consent (CLAUDE.md rule 12): one box for the
 * Ön Bilgilendirme Formu and one for the Mesafeli Satış Sözleşmesi, both
 * unticked, and no order until both are ticked.
 *
 * The server reads a single field, `legalConsent === "on"`, and records every
 * CHECKOUT_CONSENT_DOCS document against it. So the proof that "one tick is
 * not enough" is the rendered form itself: with either box empty it must not
 * carry `legalConsent` at all, whatever the button does.
 */

const render = (ticks: CheckoutConsentTicks, disabled = false) =>
  renderToStaticMarkup(
    createElement(CheckoutConsent, { ticks, onTick: () => {}, disabled }),
  );

/** Every <input …> tag in the markup. */
const inputs = (html: string) => html.match(/<input\b[^>]*>/g) ?? [];
const checkboxes = (html: string) =>
  inputs(html).filter((tag) => /type="checkbox"/.test(tag));
const carriesConsent = (html: string) => /name="legalConsent"/.test(html);

const ALL: [string, CheckoutConsentTicks][] = [
  ["neither box", { preInfo: false, contract: false }],
  ["only the Ön Bilgilendirme box", { preInfo: true, contract: false }],
  ["only the Mesafeli Satış box", { preInfo: false, contract: true }],
  ["both boxes", { preInfo: true, contract: true }],
];

describe("checkout consent: two boxes, both required", () => {
  it("starts with both boxes unticked", () => {
    expect(NO_CHECKOUT_CONSENT).toEqual({ preInfo: false, contract: false });
    const html = render(NO_CHECKOUT_CONSENT);
    const boxes = checkboxes(html);
    expect(boxes).toHaveLength(2);
    for (const box of boxes) {
      expect(box).not.toMatch(/\bchecked\b/);
      // `required`: even with the button forced on, the browser will not
      // submit the form while a box is empty.
      expect(box).toMatch(/\brequired\b/);
    }
    expect(carriesConsent(html)).toBe(false);
  });

  it("gives each document its own box, label and link", () => {
    const html = render(NO_CHECKOUT_CONSENT);
    const ids = checkboxes(html).map((tag) => tag.match(/id="([^"]+)"/)?.[1]);
    expect(new Set(ids).size).toBe(2);

    // One box per document the server records the consent against, so the
    // record never claims a document the customer had no box for.
    expect(CHECKOUT_CONSENT_DOCS).toHaveLength(2);
    const labels = [
      ...html.matchAll(/<label for="([^"]+)">([\s\S]*?)<\/label>/g),
    ];
    expect(labels.map((m) => m[1]).sort()).toEqual([...ids].sort());
    for (const slug of CHECKOUT_CONSENT_DOCS) {
      const own = labels.filter((m) => m[2].includes(`href="/hukuk/${slug}"`));
      expect(own, `a label linking only /hukuk/${slug}`).toHaveLength(1);
      // Each label links exactly one document: no box covers both again.
      expect(own[0][2].match(/href="\/hukuk\//g)).toHaveLength(1);
    }
  });

  it.each(ALL)(
    "with %s ticked, the form carries legalConsent only when both are",
    (_, ticks) => {
      const html = render(ticks);
      const both = ticks.preInfo && ticks.contract;
      expect(checkoutConsentGiven(ticks)).toBe(both);
      expect(carriesConsent(html)).toBe(both);
      if (both) {
        expect(html).toMatch(
          /<input type="hidden" name="legalConsent" value="on"\/>/,
        );
      }
      // The boxes echo the state they were given, nothing more.
      const [pre, contract] = checkboxes(html);
      expect(/\bchecked\b/.test(pre)).toBe(ticks.preInfo);
      expect(/\bchecked\b/.test(contract)).toBe(ticks.contract);
    },
  );

  it("locks both boxes while the order is being placed", () => {
    for (const box of checkboxes(render(NO_CHECKOUT_CONSENT, true))) {
      expect(box).toMatch(/\bdisabled\b/);
    }
  });

  it("names the order form on the hidden consent field, so it travels with the order and never with the card", () => {
    // The consent boxes sit beside the pay button, outside the order form the
    // action reads; only this `form` attribute ties the hidden `legalConsent`
    // to it. Without it every order is refused as "no consent" and nothing
    // else fails - so it is rendered and read here.
    const both = { preInfo: true, contract: true };
    const named = renderToStaticMarkup(
      createElement(CheckoutConsent, {
        ticks: both,
        onTick: () => {},
        disabled: false,
        form: "order-form",
      }),
    );
    const hidden = named.match(/<input[^>]*name="legalConsent"[^>]*>/)?.[0];
    expect(hidden).toBeTruthy();
    expect(hidden).toContain('form="order-form"');
    expect(hidden).toContain('value="on"');
    // Without it the field belongs to whichever form contains it.
    expect(
      render(both).match(/<input[^>]*name="legalConsent"[^>]*>/)?.[0],
    ).not.toContain("form=");
    // And the checkout wires the one to the other.
    const checkout = readFileSync("src/app/odeme/checkout.tsx", "utf8");
    expect(checkout).toContain('export const ORDER_FORM_ID = "order-form";');
    expect(checkout).toMatch(/form=\{ORDER_FORM_ID\}/);
    expect(checkout).toMatch(/<form\s+id=\{ORDER_FORM_ID\}/);
  });

  it("the payment step starts unticked and gates its button on both boxes", () => {
    // The checkout owns the state; the markup above is what it renders.
    // These three lines are the whole of the wiring, so a redesign that
    // starts pre-ticked or enables the button on one box fails here. (The
    // one-page checkout replaced the 3-step wizard on 16 Eki 2026.)
    const wizard = readFileSync("src/app/odeme/checkout.tsx", "utf8");
    expect(wizard).toMatch(
      /useState<CheckoutConsentTicks>\(\s*NO_CHECKOUT_CONSENT\s*\)/,
    );
    expect(wizard).toContain(
      "const consentGiven = checkoutConsentGiven(consent);",
    );
    expect(wizard).toMatch(
      /type="submit"\s+disabled=\{placing \|\| !consentGiven\}/,
    );
    expect(wizard).toMatch(/<CheckoutConsent\s+ticks=\{consent\}/);
    // The hidden `legalConsent` rides with the ORDER form the action reads,
    // never with the card's native form.
    expect(wizard).toMatch(/<CheckoutConsent[\s\S]*?form=\{ORDER_FORM_ID\}/);
    // The single-box checkout must not come back beside the new one.
    expect(wizard).not.toContain('name="legalConsent"');
  });

  it("points to the KVKK notice as information, not as a third box, in sen", () => {
    const html = render(NO_CHECKOUT_CONSENT);
    const note = html.slice(html.indexOf('class="checkout-consent-note"'));
    expect(note).toContain('href="/hukuk/kvkk-aydinlatma-metni"');
    // An acknowledgement only: no box, no field for it.
    expect(checkboxes(html)).toHaveLength(2);
    expect(html).not.toMatch(/name="[^"]*kvkk/i);
    // What is recorded with the ticks is still said, in the site's "sen".
    expect(note).toContain("IP adresi");
    expect(note).toContain("belge sürümü");
    // In the words the contracts use for the same record.
    expect(note).toContain("tarayıcı bilgisi");
    expect(note).toMatch(/Kişisel verilerinin nasıl işlendiğini\s*<a /);
    expect(note).not.toMatch(/Onaylarınız|siparişinize|verilerinizin/);
  });
});
