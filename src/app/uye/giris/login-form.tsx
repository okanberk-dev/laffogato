"use client";

import { useActionState } from "react";

import { BusyDots } from "@/components/laffogato/busy-dots";

import { loginAction, type LoginFormState } from "../actions";

const initialState: LoginFormState = {};

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(loginAction, initialState);
  return (
    <form action={action} className="auth-form">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <div className="auth-field">
        <label htmlFor="login-email" className="auth-label">
          E-posta
        </label>
        <input
          id="login-email"
          name="email"
          type="email"
          required
          defaultValue={state.values?.email}
          autoComplete="email"
          placeholder="E-posta adresin"
        />
      </div>
      <div className="auth-field">
        <label htmlFor="login-password" className="auth-label">
          Şifre
        </label>
        <input
          id="login-password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
        />
      </div>
      {/* role="alert" so the failure is spoken the moment it appears; without
          it the form simply looked unchanged to a screen-reader user. */}
      {state.error && (
        <div role="alert" className="auth-alert">
          {state.error}
        </div>
      )}
      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary btn-lg auth-submit"
        aria-busy={pending}
      >
        {pending ? (
          <>
            <BusyDots />
            Giriş yapılıyor…
          </>
        ) : (
          "Giriş yap"
        )}
        {!pending && <span className="arrow">→</span>}
      </button>
    </form>
  );
}
