import Link from "next/link";

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
}: {
  ticks: CheckoutConsentTicks;
  onTick: (key: keyof CheckoutConsentTicks, ticked: boolean) => void;
  disabled: boolean;
  /** The id of the form the hidden `legalConsent` belongs to. */
  form?: string;
}) {
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
            <Link href="/hukuk/on-bilgilendirme-formu" target="_blank">
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
            <Link href="/hukuk/mesafeli-satis-sozlesmesi" target="_blank">
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
        Onaylarınız; tarihi, IP adresi, tarayıcı bilgisi ve belge sürümü ile
        birlikte siparişinize işlenir. Kişisel verilerinizin işlenmesi hakkında
        bilgi için{" "}
        <Link href="/hukuk/kvkk-aydinlatma-metni" target="_blank">
          KVKK Aydınlatma Metni
        </Link>
        .
      </p>
    </>
  );
}
