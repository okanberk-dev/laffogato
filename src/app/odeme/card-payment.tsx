"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type FormEvent,
  type Ref,
} from "react";

import { cx } from "@/components/laffogato/cx";
import type { CheckoutReturnField } from "@/lib/checkout/return-codes";
import type { CheckoutSavedCard } from "@/lib/checkout/start";
import {
  CARD_ALIAS_FIELD,
  CARD_ALIAS_MAX,
  CARD_FORM_FIELDS,
  MAX_SAVED_CARDS,
  cardBrand,
  cardFieldErrors,
  cvvLength,
  formatExpiryInput,
  reformatCardNumber,
  type CardField,
} from "@/lib/payment/paynkolay-card";

import { SchemeMark, schemeOfBrand } from "./scheme-marks";

/**
 * The card part of /odeme - the one client component the card is typed in
 * (operator, 16 Eki 2026; docs/PAYNKOLAY.md §15.5, CLAUDE.md rule 28).
 *
 * The rules this file is held to (`tests/checkout-pay-form.test.ts`,
 * `tests/saved-cards.test.ts`):
 *
 * - The inputs live in a NATIVE form, `<form method="post"
 *   action="/odeme/paynkolay">`, with no Server Action and no React state
 *   behind them: they are uncontrolled. The formatting handlers only rewrite
 *   the input's own value; the scheme drawn in the field is a data attribute
 *   on the DOM, not state. Nothing about the card is ever in React state, a
 *   storage, a log or a URL.
 * - The card is checked here with the server's own rules (`cardFieldErrors`
 *   ⊂ `parseCardForm`, pure) before anything is sent; the server checks it
 *   again.
 * - The pay press is handled by the page (`checkout.tsx`): it creates the
 *   order through a Server Action that reads a DIFFERENT form, then calls
 *   `submitToBank`, which writes the order's sealed payload into the hidden
 *   `d`/`s` inputs and submits this form natively. The answer is the bank's
 *   3D page, a full document.
 * - The pay button (in the order summary) is this form's only submit button,
 *   so Enter in a card field pays - or does nothing while the consent boxes
 *   are empty. The saved cards' "Sil" buttons sit OUTSIDE this form and are
 *   `type="button"`; deleting asks first and goes through its own action.
 * - Autocomplete stays on: `cc-name`, `cc-number`, `cc-exp`, `cc-csc`.
 *   Number and code are emptied on every `pageshow` (Back, bfcache).
 */

export const PAY_FORM_ID = "pay-form";

/** What the page may ask of the card form. */
export interface CardPaymentHandle {
  /** Checks the new-card fields and focuses the first bad one. */
  validate(): boolean;
  /** Writes the order's payload and posts the form to the bank's 3D page. */
  submitToBank(data: string, signature: string): void;
}

/** The URL's field name (`?alan=`) as the form's own field. */
const RETURN_FIELD: Record<CheckoutReturnField, CardField> = {
  ad: "holderName",
  numara: "number",
  skt: "expiry",
  guvenlik: "cvv",
};

const FIELD_ORDER: CardField[] = ["holderName", "number", "expiry", "cvv"];

const INPUT_ID: Record<CardField, string> = {
  holderName: "cc-name",
  number: "cc-number",
  expiry: "cc-exp",
  cvv: "cc-csc",
};

const RETURN_MESSAGE: Record<CardField, string> = {
  holderName: "Kart üzerindeki adı yaz.",
  number: "Kart numarası eksik ya da hatalı.",
  expiry: "Son kullanma tarihini kontrol et.",
  cvv: "Güvenlik kodunu kontrol et.",
};

export interface CardPaymentProps {
  /** `card`: typed here. `redirect`: the provider takes it on its own page. */
  mode: "card" | "redirect";
  /** Nothing to pay (a code covers it all): no card is asked for. */
  nothingToPay: boolean;
  savedCards: CheckoutSavedCard[];
  savedCardsUnavailable: boolean;
  canSave: boolean;
  /** The field a returned `kart_hatali` pointed at. */
  returnField?: CheckoutReturnField;
  /** The pay press - the page's handler (order first, then this form). */
  onPay: (event: FormEvent<HTMLFormElement>) => void;
  /** The page came back from the back-forward cache: drop the busy state. */
  onRestored: () => void;
  onDeleteCard: (
    tranId: string,
  ) => Promise<
    { ok: true; cards: CheckoutSavedCard[] } | { ok: false; message: string }
  >;
  busy: boolean;
  ref?: Ref<CardPaymentHandle>;
}

export function CardPayment({
  mode,
  nothingToPay,
  savedCards,
  savedCardsUnavailable,
  canSave,
  returnField,
  onPay,
  onRestored,
  onDeleteCard,
  busy,
  ref,
}: CardPaymentProps) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const dataRef = useRef<HTMLInputElement | null>(null);
  const signatureRef = useRef<HTMLInputElement | null>(null);
  const numberWrapRef = useRef<HTMLDivElement | null>(null);
  const cvvRef = useRef<HTMLInputElement | null>(null);

  const [cards, setCards] = useState<CheckoutSavedCard[]>(savedCards);
  const [choice, setChoice] = useState<string>(savedCards[0]?.tranId ?? "new");
  const [errors, setErrors] = useState<Partial<Record<CardField, string>>>(
    () =>
      returnField
        ? {
            [RETURN_FIELD[returnField]]:
              RETURN_MESSAGE[RETURN_FIELD[returnField]],
          }
        : {},
  );
  const [cvvHelp, setCvvHelp] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [cardsNote, setCardsNote] = useState<string | null>(null);
  /** "Bu kartı kaydet" is ticked: the card's name field shows. */
  const [saving, setSaving] = useState(false);

  const typesCard = mode === "card" && !nothingToPay;
  const isNew = choice === "new";

  /** The value of one of this form's fields, read from the DOM, never kept. */
  const read = useCallback((name: string): string => {
    const field = formRef.current?.elements.namedItem(name);
    return field instanceof HTMLInputElement ? field.value : "";
  }, []);

  /** The scheme shown in the number field and the code's length. DOM only. */
  const showScheme = useCallback((value: string) => {
    const brand = cardBrand(value);
    numberWrapRef.current?.setAttribute("data-brand", brand);
    const cvv = cvvRef.current;
    if (cvv) {
      cvv.maxLength = cvvLength(brand) === 4 ? 4 : 3;
      cvv.placeholder = cvvLength(brand) === 4 ? "4 hane" : "3 hane";
    }
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      validate() {
        if (!typesCard || !isNew) return true;
        const found = cardFieldErrors(read);
        setErrors(found);
        const first = FIELD_ORDER.find((f) => found[f]);
        if (!first) return true;
        // The fixed pay bar sits over the bottom of a phone's screen: bring
        // the field to the middle, then focus it without a second scroll.
        const el = document.getElementById(INPUT_ID[first]);
        el?.scrollIntoView({ block: "center" });
        el?.focus({ preventScroll: true });
        return false;
      },
      submitToBank(data: string, signature: string) {
        const form = formRef.current;
        if (!form || !dataRef.current || !signatureRef.current) return;
        dataRef.current.value = data;
        signatureRef.current.value = signature;
        // Native submission: no submit event, no React - the browser posts
        // this form and shows what comes back (the bank's 3D page).
        HTMLFormElement.prototype.submit.call(form);
      },
    }),
    [typesCard, isNew, read],
  );

  // Back from the bank (or any page) through the back-forward cache: the
  // number and the code are wiped, as on the standalone card page; a
  // restored page also gets its button back.
  useEffect(() => {
    const onShow = (event: PageTransitionEvent) => {
      const number = formRef.current?.elements.namedItem(
        CARD_FORM_FIELDS.number,
      );
      if (number instanceof HTMLInputElement) number.value = "";
      if (cvvRef.current) cvvRef.current.value = "";
      showScheme("");
      if (event.persisted) onRestored();
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, [onRestored, showScheme]);

  /** On blur: say what is wrong with a field the customer has filled in. */
  const checkOne = (field: CardField) => {
    const value = read(CARD_FORM_FIELDS[field]);
    const message = value.trim() ? cardFieldErrors(read)[field] : undefined;
    setErrors((prev) =>
      prev[field] === message ? prev : { ...prev, [field]: message },
    );
  };

  /** While typing: a fixed field drops its message. */
  const settle = (field: CardField) => {
    if (!errors[field]) return;
    if (!cardFieldErrors(read)[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const deleteCard = async (tranId: string) => {
    setDeleting(true);
    setCardsNote(null);
    const res = await onDeleteCard(tranId);
    setDeleting(false);
    setConfirming(null);
    if (!res.ok) {
      setCardsNote(res.message);
      return;
    }
    setCards(res.cards);
    setCardsNote("Kayıtlı kart silindi.");
    if (choice === tranId || !res.cards.some((c) => c.tranId === choice)) {
      setChoice(res.cards[0]?.tranId ?? "new");
    }
  };

  const describedBy = (field: CardField) =>
    errors[field] ? `${INPUT_ID[field]}-error` : undefined;

  return (
    <div className="co-pay">
      {typesCard && cards.length > 0 ? (
        <fieldset className="co-methods">
          <legend className="co-label">Kayıtlı kartların</legend>
          {cards.map((card, i) => {
            const id = `saved-card-${i}`;
            const mark = schemeOfBrand(card.brand);
            const meta = [card.bank, card.brand, card.alias]
              .filter(Boolean)
              .join(" · ");
            return (
              <div
                key={card.tranId}
                className={cx(
                  "co-method",
                  choice === card.tranId && "is-active",
                )}
              >
                <input
                  type="radio"
                  id={id}
                  name="cardChoice"
                  form={PAY_FORM_ID}
                  value={card.tranId}
                  checked={choice === card.tranId}
                  // Never `disabled` while paying: a disabled control is
                  // left out of the submission, and the route would read
                  // "new card" with no card in it.
                  onChange={() => {
                    if (!busy) setChoice(card.tranId);
                  }}
                />
                <label htmlFor={id} className="co-method-label">
                  {mark ? (
                    <SchemeMark name={mark} className="co-scheme" />
                  ) : null}
                  <span className="co-method-main tabular">
                    •••• {card.last4}
                  </span>
                  {meta ? <span className="co-method-meta">{meta}</span> : null}
                </label>
                {confirming === card.tranId ? (
                  <span className="co-method-confirm">
                    <span>Bu kart silinsin mi?</span>
                    <button
                      type="button"
                      className="co-link co-link-danger"
                      onClick={() => deleteCard(card.tranId)}
                      disabled={deleting}
                    >
                      {deleting ? "Siliniyor…" : "Evet, sil"}
                    </button>
                    <button
                      type="button"
                      className="co-link"
                      onClick={() => setConfirming(null)}
                      disabled={deleting}
                    >
                      Vazgeç
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="co-link"
                    aria-label={`•••• ${card.last4} kartını sil`}
                    onClick={() => setConfirming(card.tranId)}
                    disabled={busy || deleting}
                  >
                    Sil
                  </button>
                )}
              </div>
            );
          })}
          <div className={cx("co-method", isNew && "is-active")}>
            <input
              type="radio"
              id="saved-card-new"
              name="cardChoice"
              form={PAY_FORM_ID}
              value="new"
              checked={isNew}
              onChange={() => {
                if (!busy) setChoice("new");
              }}
            />
            <label htmlFor="saved-card-new" className="co-method-label">
              <span className="co-method-main">Yeni kartla öde</span>
            </label>
          </div>
          {cardsNote ? (
            <p className="co-quiet" role="status">
              {cardsNote}
            </p>
          ) : null}
        </fieldset>
      ) : null}
      {typesCard && savedCardsUnavailable ? (
        <p className="co-quiet">
          Kayıtlı kartların şu an gösterilemiyor; yeni kartla ödeyebilirsin.
        </p>
      ) : null}

      <form
        id={PAY_FORM_ID}
        ref={formRef}
        method="post"
        action="/odeme/paynkolay"
        autoComplete="on"
        noValidate
        onSubmit={onPay}
        className="co-pay-form"
      >
        <input type="hidden" name="d" defaultValue="" ref={dataRef} />
        <input type="hidden" name="s" defaultValue="" ref={signatureRef} />
        <input type="hidden" name="return" value="checkout" />
        {typesCard ? (
          <div className="co-card" id="new-card" hidden={!isNew}>
            <div className="co-field">
              <label className="co-label" htmlFor="cc-name">
                Kart üzerindeki ad
              </label>
              <input
                id="cc-name"
                name={CARD_FORM_FIELDS.holderName}
                className="input"
                type="text"
                autoComplete="cc-name"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={60}
                required={isNew}
                disabled={!isNew}
                aria-invalid={errors.holderName ? true : undefined}
                aria-describedby={describedBy("holderName")}
                onInput={() => settle("holderName")}
                onBlur={() => checkOne("holderName")}
              />
              {errors.holderName ? (
                <p className="co-field-error" id="cc-name-error">
                  {errors.holderName}
                </p>
              ) : null}
            </div>

            <div className="co-field">
              <label className="co-label" htmlFor="cc-number">
                Kart numarası
              </label>
              <div
                className="co-number"
                ref={numberWrapRef}
                data-brand="unknown"
              >
                <input
                  id="cc-number"
                  name={CARD_FORM_FIELDS.number}
                  className="input tabular"
                  type="text"
                  inputMode="numeric"
                  autoComplete="cc-number"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={23}
                  placeholder="0000 0000 0000 0000"
                  required={isNew}
                  disabled={!isNew}
                  aria-invalid={errors.number ? true : undefined}
                  aria-describedby={describedBy("number")}
                  onInput={(e) => {
                    const el = e.currentTarget;
                    const next = reformatCardNumber(
                      el.value,
                      el.selectionStart ?? el.value.length,
                    );
                    if (next.value !== el.value) {
                      el.value = next.value;
                      try {
                        el.setSelectionRange(next.caret, next.caret);
                      } catch {
                        // Some input types do not take a selection.
                      }
                    }
                    showScheme(next.value);
                    settle("number");
                  }}
                  onBlur={() => checkOne("number")}
                />
                <span className="co-number-scheme" aria-hidden="true">
                  {(["visa", "mastercard", "troy", "amex"] as const).map(
                    (name) => (
                      <SchemeMark
                        key={name}
                        name={name}
                        className={cx("co-scheme", `is-${name}`)}
                      />
                    ),
                  )}
                </span>
              </div>
              {errors.number ? (
                <p className="co-field-error" id="cc-number-error">
                  {errors.number}
                </p>
              ) : null}
            </div>

            <div className="co-field-row">
              <div className="co-field">
                <label className="co-label" htmlFor="cc-exp">
                  Son kullanma (AA/YY)
                </label>
                <input
                  id="cc-exp"
                  name={CARD_FORM_FIELDS.expiry}
                  className="input tabular"
                  type="text"
                  inputMode="numeric"
                  autoComplete="cc-exp"
                  maxLength={7}
                  placeholder="AA/YY"
                  required={isNew}
                  disabled={!isNew}
                  aria-invalid={errors.expiry ? true : undefined}
                  aria-describedby={describedBy("expiry")}
                  onInput={(e) => {
                    const el = e.currentTarget;
                    const native = e.nativeEvent as InputEvent;
                    const deletingText =
                      typeof native.inputType === "string" &&
                      native.inputType.startsWith("delete");
                    const next = formatExpiryInput(el.value, deletingText);
                    if (next !== el.value) el.value = next;
                    settle("expiry");
                  }}
                  onBlur={() => checkOne("expiry")}
                />
                {errors.expiry ? (
                  <p className="co-field-error" id="cc-exp-error">
                    {errors.expiry}
                  </p>
                ) : null}
              </div>
              <div className="co-field">
                <span className="co-label-row">
                  <label className="co-label" htmlFor="cc-csc">
                    Güvenlik kodu
                  </label>
                  <button
                    type="button"
                    className="co-help"
                    aria-expanded={cvvHelp}
                    aria-controls="cc-csc-help"
                    aria-label="Güvenlik kodu nerede?"
                    onClick={() => setCvvHelp((open) => !open)}
                  >
                    ?
                  </button>
                </span>
                <input
                  id="cc-csc"
                  name={CARD_FORM_FIELDS.cvv}
                  ref={cvvRef}
                  className="input tabular"
                  type="text"
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  maxLength={4}
                  placeholder="3 hane"
                  required={isNew}
                  disabled={!isNew}
                  aria-invalid={errors.cvv ? true : undefined}
                  aria-describedby={
                    cx(describedBy("cvv"), cvvHelp && "cc-csc-help") ||
                    undefined
                  }
                  onInput={(e) => {
                    const el = e.currentTarget;
                    const next = el.value.replace(/\D/g, "").slice(0, 4);
                    if (next !== el.value) el.value = next;
                    settle("cvv");
                  }}
                  onBlur={() => checkOne("cvv")}
                />
                <p className="co-help-text" id="cc-csc-help" hidden={!cvvHelp}>
                  Kartının arkasındaki 3 hane. American Express&apos;te kartın
                  önündeki 4 hane.
                </p>
                {errors.cvv ? (
                  <p className="co-field-error" id="cc-csc-error">
                    {errors.cvv}
                  </p>
                ) : null}
              </div>
            </div>

            {canSave && cards.length >= MAX_SAVED_CARDS ? (
              <p className="co-quiet">
                En çok {MAX_SAVED_CARDS} kart kaydedebilirsin. Bu kartı da
                kaydetmek için önce kayıtlı kartlarından birini sil.
              </p>
            ) : canSave ? (
              <div className="co-save">
                <label className="co-check">
                  <input
                    type="checkbox"
                    name="saveCard"
                    value="1"
                    onChange={(e) => setSaving(e.currentTarget.checked)}
                  />
                  <span>Bu kartı sonraki ödemeler için kaydet</span>
                </label>
                {saving ? (
                  <div className="co-field co-save-alias">
                    <label className="co-label" htmlFor="cc-alias">
                      Kartına bir ad ver{" "}
                      <span className="co-optional">(isteğe bağlı)</span>
                    </label>
                    <input
                      id="cc-alias"
                      name={CARD_ALIAS_FIELD}
                      className="input"
                      type="text"
                      autoComplete="off"
                      spellCheck={false}
                      maxLength={CARD_ALIAS_MAX}
                      placeholder="Örn. Maaş kartım"
                      disabled={!isNew}
                    />
                  </div>
                ) : null}
                <p className="co-quiet">
                  Kart, ödeme kuruluşu PayNkolay&apos;ın kart saklama hizmetinde
                  saklanır; biz kart numarasını, son kullanma tarihini ve
                  güvenlik kodunu tutmayız. Kayıtlı kartını bu sayfadan ya da
                  Hesabım › Kayıtlı kartlarım&apos;dan istediğin zaman
                  silebilirsin.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </form>

      {typesCard ? (
        <>
          <p className="co-installment">Tek çekim · taksit yok</p>
          <p className="co-trust-note">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4.5 7V5.2a3.5 3.5 0 0 1 7 0V7" />
              <rect x="3" y="7" width="10" height="7" rx="2" />
            </svg>
            <span>
              Kart bilgilerini biz kaydetmeyiz; ödeme için şifreli bağlantıyla
              yalnızca ödeme kuruluşuna iletilir. Ödemeyi kartını veren bankanın
              3D Secure ekranında onaylarsın.
            </span>
          </p>
          <p className="co-psp">
            Ödeme altyapısı: PayNkolay · N Kolay Ödeme ve Elektronik Para
            Kuruluşu A.Ş.
          </p>
        </>
      ) : nothingToPay ? (
        <p className="co-quiet">
          Ödenecek tutar yok; kart bilgisi gerekmiyor. Siparişi onaylaman
          yeterli.
        </p>
      ) : (
        <p className="co-quiet">
          Kartını bir sonraki adımda ödeme kuruluşunun güvenli sayfasında
          girersin ve ödemeyi bankanın 3D Secure ekranında onaylarsın.
        </p>
      )}
    </div>
  );
}
