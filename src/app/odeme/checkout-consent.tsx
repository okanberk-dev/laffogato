import Link from "next/link";
import type { MouseEvent } from "react";

import type { CheckoutDocSlug } from "./checkout-documents";

/**
 * The confirmations a distance sale needs before the order exists
 * (Mesafeli Sözleşmeler Yönetmeliği, CLAUDE.md rule 12). Confirming the
 * pre-contract information and accepting the contract are two separate acts,
 * so each document has its own box; one box for both bundled them into a
 * single tick. Neither box is ever pre-ticked.
 *
 * The server still reads ONE field, `legalConsent`, and records both
 * documents (`CHECKOUT_CONSENT_DOCS`) against it with the time, IP, browser
 * and document revision. That field is therefore rendered only once BOTH
 * boxes are ticked: with one box left empty the form carries no consent at
 * all and `startCheckoutAction` refuses the order. `tests/checkout-consent.test.ts`
 * renders every combination.
 *
 * No "use client" here on purpose: the module is pure markup plus a predicate,
 * imported by the checkout (a client component) and rendered directly by the
 * test.
 *
 * `form`: the one-page checkout keeps the boxes beside the pay button, away
 * from the order form the server reads; the hidden field names that form so
 * it still travels with it (and never with the card's own form).
 *
 * `onDocClick`: the checkout opens each document in a panel on the page,
 * filled with the order (ASK-OTH-2, 18 Eki 2026). The links keep their
 * address and new tab, so without it (or with a modifier key) they open the
 * document's own page as before.
 */
export interface CheckoutConsentTicks {
  /** Ön Bilgilendirme Formu read and confirmed. */
  preInfo: boolean;
  /** Mesafeli Satış Sözleşmesi read and accepted. */
  contract: boolean;
}

export const NO_CHECKOUT_CONSENT: CheckoutConsentTicks = {
  preInfo: false,
  contract: false,
};

/** True only when every checkout document has its own tick. */
export function checkoutConsentGiven(ticks: CheckoutConsentTicks): boolean {
  return ticks.preInfo && ticks.contract;
}

export function CheckoutConsent({
  ticks,
  onTick,
  disabled,
  form,
  onDocClick,
}: {
  ticks: CheckoutConsentTicks;
  onTick: (key: keyof CheckoutConsentTicks, ticked: boolean) => void;
  disabled: boolean;
  /** The id of the form the hidden `legalConsent` belongs to. */
  form?: string;
  /** Opens a document in the checkout's panel instead of a new tab. */
  onDocClick?: (
    event: MouseEvent<HTMLAnchorElement>,
    slug: CheckoutDocSlug,
  ) => void;
}) {
  const docClick = (slug: CheckoutDocSlug) =>
    onDocClick
      ? (event: MouseEvent<HTMLAnchorElement>) => onDocClick(event, slug)
      : undefined;
  return (
    <>
      <div
        className="checkout-consent"
        role="group"
        aria-label="Sözleşme onayları"
      >
        <div className="checkout-consent-row">
          <input
            id="consentPreInfo"
            type="checkbox"
            required
            checked={ticks.preInfo}
            onChange={(e) => onTick("preInfo", e.target.checked)}
            disabled={disabled}
          />
          <label htmlFor="consentPreInfo">
            <Link
              href="/hukuk/on-bilgilendirme-formu"
              target="_blank"
              onClick={docClick("on-bilgilendirme-formu")}
            >
              Ön Bilgilendirme Formu
            </Link>
            &apos;nu okudum, anladım ve onaylıyorum.
          </label>
        </div>
        <div className="checkout-consent-row">
          <input
            id="consentContract"
            type="checkbox"
            required
            checked={ticks.contract}
            onChange={(e) => onTick("contract", e.target.checked)}
            disabled={disabled}
          />
          <label htmlFor="consentContract">
            <Link
              href="/hukuk/mesafeli-satis-sozlesmesi"
              target="_blank"
              onClick={docClick("mesafeli-satis-sozlesmesi")}
            >
              Mesafeli Satış Sözleşmesi
            </Link>
            &apos;ni okudum, anladım ve onaylıyorum. Siparişimin ödeme
            yükümlülüğü doğurduğunu kabul ediyorum.
          </label>
        </div>
        {checkoutConsentGiven(ticks) && (
          <input type="hidden" name="legalConsent" value="on" form={form} />
        )}
      </div>
      <p className="checkout-consent-note">
        Onayların tarih, IP adresi, tarayıcı bilgisi ve belge sürümüyle
        siparişine kaydedilir. Kişisel verilerinin nasıl işlendiğini{" "}
        <Link href="/hukuk/kvkk-aydinlatma-metni" target="_blank">
          KVKK Aydınlatma Metni
        </Link>
        &apos;nde okuyabilirsin.
      </p>
    </>
  );
}
