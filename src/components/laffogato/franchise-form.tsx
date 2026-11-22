"use client";

import Link from "@/components/link";
import {
  startTransition,
  useActionState,
  useEffect,
  useId,
  useRef,
  type FormEvent,
  type ReactNode,
} from "react";

import { submitFranchiseApplicationAction } from "@/app/franchise/actions";
import {
  BUDGET_OPTIONS,
  EXPERIENCE_OPTIONS,
  FRANCHISE_FIELDS,
  FRANCHISE_HONEYPOT,
  FRANCHISE_LIMITS,
  FRANCHISE_PRIVACY_PATH,
  FRANCHISE_RETENTION_MONTHS,
  LOCATION_OPTIONS,
  TIMELINE_OPTIONS,
  type FranchiseField,
  type FranchiseFormState,
  type FranchiseOption,
} from "@/lib/franchise/franchise-core";

import { BusyDots } from "./busy-dots";

const initial: FranchiseFormState = {};

/**
 * The /franchise application (22 Kas 2026). Field names are the action's
 * contract (FRANCHISE_FIELDS, docs/FRONTEND-SINIR.md §2); the consent box
 * starts unticked.
 *
 * Posted by hand (preventDefault + the action in a transition) so a refused
 * submit keeps everything typed: a form `action` would reset the fields
 * after every answer. Without JavaScript the same action still runs from
 * the form's own `action`. The server decides; there is no second copy of
 * the rules here, only `required` hints for the browser's own form fill.
 */
export function FranchiseForm({ contactEmail }: { contactEmail: string }) {
  const [state, dispatch, pending] = useActionState(
    submitFranchiseApplicationAction,
    initial,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);
  const alertRef = useRef<HTMLParagraphElement>(null);
  const uid = useId();
  const idOf = (f: string) => `${uid}-${f}`;
  const errors = state.fieldErrors ?? {};

  // After an answer: the thank-you takes focus; a refusal sends focus to the
  // first field it names (or to the message when it names none).
  useEffect(() => {
    if (state.ok) {
      doneRef.current?.focus();
      return;
    }
    if (!state.error) return;
    const first = FRANCHISE_FIELDS.find((f) => state.fieldErrors?.[f]);
    const el = first
      ? formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)
      : null;
    (el ?? alertRef.current)?.focus();
  }, [state]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const data = new FormData(e.currentTarget);
    startTransition(() => dispatch(data));
  }

  if (state.ok) {
    return (
      <div className="franchise-done" role="status">
        <h3 ref={doneRef} tabIndex={-1} className="t-display">
          Başvurun bize ulaştı
        </h3>
        <p className="t-body">
          Teşekkürler. Başvurunu okuyup formda yazdığın telefondan ya da
          e-postadan sana ulaşacağız.
        </p>
        <p className="t-small t-muted">
          Eklemek istediğin bir şey olursa{" "}
          <a className="link-u" href={`mailto:${contactEmail}`}>
            {contactEmail}
          </a>{" "}
          adresine yazabilirsin.
        </p>
        <Link className="btn btn-wide" href="/">
          Anasayfaya dön
        </Link>
      </div>
    );
  }

  const describedBy = (f: FranchiseField, hint?: boolean) =>
    [hint ? `${idOf(f)}-hint` : "", errors[f] ? `${idOf(f)}-error` : ""]
      .filter(Boolean)
      .join(" ") || undefined;

  const fieldError = (f: FranchiseField) =>
    errors[f] ? (
      <p id={`${idOf(f)}-error`} className="field-error">
        {errors[f]}
      </p>
    ) : null;

  const text = (
    f: FranchiseField,
    label: ReactNode,
    props: {
      type?: string;
      autoComplete?: string;
      inputMode?: "text" | "email" | "tel";
      maxLength?: number;
      required?: boolean;
      full?: boolean;
    } = {},
  ) => (
    <div className={props.full ? "field franchise-field--full" : "field"}>
      <label className="field-label" htmlFor={idOf(f)}>
        {label}
      </label>
      <input
        id={idOf(f)}
        name={f}
        type={props.type ?? "text"}
        className="input"
        autoComplete={props.autoComplete}
        inputMode={props.inputMode}
        maxLength={props.maxLength}
        required={props.required}
        aria-invalid={errors[f] ? true : undefined}
        aria-describedby={describedBy(f)}
      />
      {fieldError(f)}
    </div>
  );

  const select = (
    f: FranchiseField,
    label: string,
    options: readonly FranchiseOption[],
  ) => (
    <div className="field">
      <label className="field-label" htmlFor={idOf(f)}>
        {label}
      </label>
      <select
        id={idOf(f)}
        name={f}
        className="select"
        defaultValue=""
        required
        aria-invalid={errors[f] ? true : undefined}
        aria-describedby={describedBy(f)}
      >
        <option value="" disabled>
          Seç
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {fieldError(f)}
    </div>
  );

  return (
    <form
      ref={formRef}
      className="franchise-form"
      action={dispatch}
      onSubmit={onSubmit}
      noValidate
      aria-describedby={state.error ? `${uid}-alert` : undefined}
    >
      {state.error ? (
        <p
          ref={alertRef}
          id={`${uid}-alert`}
          className="franchise-form-alert"
          role="alert"
          tabIndex={-1}
        >
          {state.error}
        </p>
      ) : null}

      <fieldset className="franchise-fieldset">
        <legend className="t-label">İletişim</legend>
        <div className="franchise-form-grid">
          {text("name", "Ad soyad", {
            autoComplete: "name",
            maxLength: FRANCHISE_LIMITS.name,
            required: true,
            full: true,
          })}
          {text("email", "E-posta", {
            type: "email",
            autoComplete: "email",
            inputMode: "email",
            maxLength: FRANCHISE_LIMITS.email,
            required: true,
          })}
          {text("phone", "Telefon", {
            type: "tel",
            autoComplete: "tel",
            inputMode: "tel",
            maxLength: FRANCHISE_LIMITS.phone,
            required: true,
          })}
          {text("city", "İl", {
            autoComplete: "address-level1",
            maxLength: FRANCHISE_LIMITS.city,
            required: true,
          })}
          {text(
            "district",
            <>
              İlçe <span className="t-muted">(isteğe bağlı)</span>
            </>,
            {
              autoComplete: "address-level2",
              maxLength: FRANCHISE_LIMITS.district,
            },
          )}
        </div>
      </fieldset>

      <fieldset className="franchise-fieldset">
        <legend className="t-label">Yatırım planı</legend>
        <div className="franchise-form-grid">
          {select("locationStatus", "Mekân", LOCATION_OPTIONS)}
          {select("budget", "Yatırım aralığı", BUDGET_OPTIONS)}
          {select("experience", "Deneyim", EXPERIENCE_OPTIONS)}
          {select("timeline", "Ne zaman başlamak istersin", TIMELINE_OPTIONS)}
          <div className="field franchise-field--full">
            <label className="field-label" htmlFor={idOf("message")}>
              Eklemek istediklerin{" "}
              <span className="t-muted">(isteğe bağlı)</span>
            </label>
            <textarea
              id={idOf("message")}
              name="message"
              className="textarea"
              rows={5}
              maxLength={FRANCHISE_LIMITS.message}
              aria-invalid={errors.message ? true : undefined}
              aria-describedby={describedBy("message", true)}
            />
            <p id={`${idOf("message")}-hint`} className="field-hint">
              Mekânın, şehrin ya da kendin hakkında bilmemizi istediklerin.
            </p>
            {fieldError("message")}
          </div>
        </div>
      </fieldset>

      {/* Off-screen and out of the tab order: people never fill it, form
          spam scripts do (src/app/franchise/actions.ts). */}
      <div className="franchise-hp" aria-hidden="true">
        <label htmlFor={idOf(FRANCHISE_HONEYPOT)}>Web siteniz</label>
        <input
          id={idOf(FRANCHISE_HONEYPOT)}
          name={FRANCHISE_HONEYPOT}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </div>

      <div className="franchise-form-foot">
        <p className="franchise-notice">
          Adını, iletişim bilgilerini ve yanıtlarını yalnız başvurunu
          değerlendirmek ve seninle iletişime geçmek için kullanırız. Başvurun{" "}
          {FRANCHISE_RETENTION_MONTHS} ay sonra silinir. Ayrıntı ve hakların:{" "}
          <Link href={FRANCHISE_PRIVACY_PATH}>KVKK Aydınlatma Metni</Link>.
        </p>
        {/* Starts unticked (docs/FRONTEND-SINIR.md §2). */}
        <div className="field">
          <label className="franchise-consent" htmlFor={idOf("consent")}>
            <input
              id={idOf("consent")}
              type="checkbox"
              name="consent"
              aria-invalid={errors.consent ? true : undefined}
              aria-describedby={describedBy("consent")}
            />
            <span>
              Aydınlatma metnini okudum; başvurum için benimle iletişime
              geçilmesini istiyorum.
            </span>
          </label>
          {fieldError("consent")}
        </div>
        <button
          type="submit"
          className="btn btn-dark btn-wide"
          disabled={pending}
          aria-busy={pending || undefined}
        >
          {pending ? (
            <>
              <BusyDots />
              <span className="sr-only">Gönderiliyor…</span>
            </>
          ) : (
            "Başvuruyu gönder"
          )}
        </button>
      </div>
    </form>
  );
}
