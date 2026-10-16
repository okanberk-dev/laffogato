"use client";

import { useActionState } from "react";

import {
  requestPasswordResetAction,
  type ForgotPasswordState,
} from "@/app/uye/actions";
import { BusyDots } from "@/components/laffogato/busy-dots";

const initial: ForgotPasswordState = {};

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(
    requestPasswordResetAction,
    initial,
  );

  return (
    <form action={action} className="auth-form">
      <label className="auth-field">
        <span className="auth-label">E-posta</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="merhaba@example.com"
          disabled={pending}
        />
      </label>

      {state.error && (
        <div className="auth-alert" role="alert">
          {state.error}
        </div>
      )}
      {state.message && (
        <div className="auth-note" role="status" aria-live="polite">
          {state.message}
        </div>
      )}

      <button
        type="submit"
        className="btn btn-primary btn-lg auth-submit"
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? (
          <>
            <BusyDots />
            Gönderiliyor…
          </>
        ) : (
          "Sıfırlama bağlantısı gönder"
        )}
      </button>
    </form>
  );
}
