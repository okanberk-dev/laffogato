"use client";

import { useActionState } from "react";

import { BusyDots } from "@/components/laffogato/busy-dots";

import { changePasswordAction, type PasswordFormState } from "../../actions";

const initial: PasswordFormState = {};

export function PasswordForm() {
  const [state, action, pending] = useActionState(
    changePasswordAction,
    initial,
  );
  return (
    <form action={action} style={{ display: "grid", gap: 16, maxWidth: 480 }}>
      <div className="account-field">
        <label htmlFor="pw-current">Mevcut şifre</label>
        <input
          id="pw-current"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
        />
      </div>
      <div className="account-field">
        <label htmlFor="pw-new">Yeni şifre</label>
        <input
          id="pw-new"
          name="newPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
        <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
          En az 8 karakter.
        </p>
      </div>
      <div className="account-field">
        <label htmlFor="pw-confirm">Yeni şifre (tekrar)</label>
        <input
          id="pw-confirm"
          name="newPasswordConfirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>
      {state.error && (
        <div className="account-msg" data-tone="error">
          {state.error}
        </div>
      )}
      {state.message && (
        <div className="account-msg" data-tone="success">
          {state.message}
        </div>
      )}
      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary btn-wide"
        style={{ justifySelf: "start" }}
        aria-busy={pending}
      >
        {pending ? (
          <>
            <BusyDots />
            Güncelleniyor…
          </>
        ) : (
          "Şifreyi güncelle"
        )}
      </button>
    </form>
  );
}
