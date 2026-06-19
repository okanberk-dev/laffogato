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
    <div>
      <form className="newsletter-form" action={action}>
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
          style={{ borderRadius: 999, whiteSpace: "nowrap" }}
          disabled={pending}
        >
          {pending ? "Gönderiliyor…" : "Abone ol"}{" "}
          <span className="arrow">→</span>
        </button>
      </form>
      {(state.message || state.error) && (
        <p
          role="status"
          style={{
            marginTop: 12,
            fontSize: 13,
            color: state.error ? "#fca5a5" : "rgba(255,255,255,0.85)",
          }}
        >
          {state.error ?? state.message}
        </p>
      )}
    </div>
  );
}
