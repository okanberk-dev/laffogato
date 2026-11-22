"use client";

import { useActionState } from "react";

import {
  subscribeNewsletterAction,
  type NewsletterFormState,
} from "@/app/newsletter/actions";
import { BusyDots } from "./busy-dots";

const initial: NewsletterFormState = {};

export function NewsletterForm() {
  const [state, action, pending] = useActionState(
    subscribeNewsletterAction,
    initial,
  );

  return (
    <form action={action}>
      <div className="newsletter-form">
        <input
          type="email"
          name="email"
          required
          aria-label="E-posta adresi"
          placeholder="E-posta adresini yaz"
          autoComplete="email"
          disabled={pending}
        />
        <button
          type="submit"
          className="newsletter-submit"
          disabled={pending}
          aria-busy={pending}
        >
          {pending ? (
            <>
              <BusyDots />
              <span className="sr-only">Gönderiliyor…</span>
            </>
          ) : (
            <>
              <span className="sr-only">Abone ol</span>
              <svg viewBox="0 0 44 8" fill="none" aria-hidden="true">
                <path
                  d="M0 4h43M39.5.5 43 4l-3.5 3.5"
                  stroke="currentColor"
                  strokeWidth="1"
                />
              </svg>
            </>
          )}
        </button>
      </div>

      {/* Ön işaretli olamaz: 6563 sayılı kanun ticari elektronik ileti için
          önceden AÇIK onay ister, ve onayın hangi metne verildiği kayda
          yazılır (src/lib/newsletter/store.ts → NEWSLETTER_CONSENT_TEXT). */}
      <label className="newsletter-consent">
        <input type="checkbox" name="consent" disabled={pending} />
        <span>
          Kampanya, yeni ürün ve etkinlik duyurularını e-posta ile almak
          istiyorum. Onayımı istediğim zaman geri çekebilirim.
        </span>
      </label>

      {(state.message || state.error) && (
        <p
          role="status"
          aria-live="polite"
          className={
            state.error ? "newsletter-status is-error" : "newsletter-status"
          }
        >
          {state.error ?? state.message}
        </p>
      )}
    </form>
  );
}
