"use client";

import { useActionState } from "react";

import {
  resetPasswordAction,
  type ResetPasswordState,
} from "@/app/uye/actions";

const initial: ResetPasswordState = {};

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, initial);

  return (
    <form action={action} className="auth-form">
      <input type="hidden" name="token" value={token} />

      <label className="auth-field">
        <span className="auth-label">Yeni şifre</span>
        <input
          type="password"
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          disabled={pending}
        />
      </label>

      <label className="auth-field">
        <span className="auth-label">Yeni şifre (tekrar)</span>
        <input
          type="password"
          name="passwordConfirm"
          required
          minLength={8}
          autoComplete="new-password"
          disabled={pending}
        />
      </label>

      {state.error && (
        <div className="auth-alert" role="alert">
          {state.error}
        </div>
      )}

      <button
        type="submit"
        className="btn btn-primary btn-lg auth-submit"
        disabled={pending}
      >
        {pending ? "Kaydediliyor…" : "Şifreyi kaydet ve giriş yap"}
      </button>
    </form>
  );
}
