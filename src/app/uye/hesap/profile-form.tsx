"use client";

import { useActionState } from "react";

import { BusyDots } from "@/components/laffogato/busy-dots";

import { updateProfileAction, type UpdateProfileState } from "../actions";

const initial: UpdateProfileState = {};

export function ProfileForm({
  defaultName,
  defaultPhone,
  defaultBirthday,
  email,
}: {
  defaultName: string;
  defaultPhone: string;
  defaultBirthday: string;
  email: string;
}) {
  const [state, action, pending] = useActionState(updateProfileAction, initial);
  return (
    <form action={action} style={{ display: "grid", gap: 16 }}>
      <div className="account-field-row">
        <div className="account-field">
          <label htmlFor="prof-name">Ad Soyad</label>
          <input
            id="prof-name"
            name="name"
            type="text"
            defaultValue={defaultName}
            required
            minLength={2}
            autoComplete="name"
          />
        </div>
        <div className="account-field">
          <label htmlFor="prof-phone">Telefon</label>
          <input
            id="prof-phone"
            name="phone"
            type="tel"
            defaultValue={defaultPhone}
            autoComplete="tel"
            placeholder="+90 ___ ___ __ __"
          />
        </div>
      </div>
      <div className="account-field-row">
        <div className="account-field">
          <label htmlFor="prof-birthday">Doğum tarihi</label>
          <input
            id="prof-birthday"
            name="birthday"
            type="date"
            defaultValue={defaultBirthday}
          />
        </div>
        <div className="account-field">
          <label>E-posta</label>
          <div className="account-readonly">{email}</div>
          <p style={{ marginTop: 4, fontSize: 12, color: "var(--muted)" }}>
            E-posta değiştirilemez (siparişler bu adrese bağlı).
          </p>
        </div>
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
        className="btn btn-primary btn-sm"
        style={{ justifySelf: "start" }}
        aria-busy={pending}
      >
        {pending ? (
          <>
            <BusyDots />
            Kaydediliyor…
          </>
        ) : (
          "Kaydet"
        )}
      </button>
    </form>
  );
}
