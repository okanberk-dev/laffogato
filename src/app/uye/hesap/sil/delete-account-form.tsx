"use client";

import { useActionState, useState } from "react";

import { deleteAccountAction, type DeleteAccountState } from "../../actions";

const initial: DeleteAccountState = {};

export function DeleteAccountForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState(deleteAccountAction, initial);
  // The button stays out of reach until the member has typed their own address:
  // an irreversible action should take more than one stray click.
  const [typed, setTyped] = useState("");
  const confirmed = typed.trim().toLowerCase() === email.toLowerCase();

  return (
    <form action={action} style={{ display: "grid", gap: 16, maxWidth: 480 }}>
      <div className="account-field">
        <label htmlFor="del-email">
          Onaylamak için <strong>{email}</strong> yaz
        </label>
        <input
          id="del-email"
          name="confirmEmail"
          type="text"
          autoComplete="off"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          required
        />
      </div>
      <div className="account-field">
        <label htmlFor="del-password">Şifren</label>
        <input
          id="del-password"
          name="password"
          type="password"
          autoComplete="current-password"
        />
        <small>Sosyal hesapla giriş yaptıysan bu alanı boş bırak.</small>
      </div>
      {state.error && (
        <p role="alert" style={{ color: "var(--danger, #b3261e)", margin: 0 }}>
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending || !confirmed}>
        {pending ? "Siliniyor…" : "Hesabımı kalıcı olarak sil"}
      </button>
    </form>
  );
}
