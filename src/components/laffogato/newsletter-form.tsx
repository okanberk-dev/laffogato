"use client";

import { useActionState } from "react";

import {
  subscribeNewsletterAction,
  type NewsletterFormState,
} from "@/app/newsletter/actions";

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
          placeholder="merhaba@example.com"
          autoComplete="email"
          disabled={pending}
        />
        <button
          type="submit"
          className="btn btn-gold btn-sm"
          /* No radius override: `.btn` resolves --r-btn, and this inline 999
             was the last capsule-shaped real button on the site — in the
             footer of every route. The field around it moved to the same
             radius so the two read as one control. */
          style={{ whiteSpace: "nowrap" }}
          disabled={pending}
        >
          {pending ? "Gönderiliyor…" : "Abone ol"}{" "}
          <span className="arrow">→</span>
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
          style={{
            marginTop: 12,
            fontSize: 13,
            color: state.error ? "#fca5a5" : "rgba(255,255,255,0.85)",
          }}
        >
          {state.error ?? state.message}
        </p>
      )}
    </form>
  );
}
