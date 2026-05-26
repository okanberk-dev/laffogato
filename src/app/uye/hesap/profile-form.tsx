"use client";

import { useActionState } from "react";

import { updateProfileAction, type UpdateProfileState } from "../actions";

const initial: UpdateProfileState = {};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid var(--ink-line)",
  background: "var(--bg-warm)",
  fontFamily: "inherit",
  fontSize: 16,
  color: "var(--ink)",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontFamily: "var(--mono)",
  fontSize: 10,
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  color: "var(--ink-mute)",
  marginBottom: 8,
};

export function ProfileForm({
  defaultName,
  defaultPhone,
  email,
}: {
  defaultName: string;
  defaultPhone: string;
  email: string;
}) {
  const [state, action, pending] = useActionState(updateProfileAction, initial);
  return (
    <form action={action} style={{ display: "grid", gap: 14 }}>
      <div>
        <label htmlFor="prof-name" style={labelStyle}>
          Ad Soyad
        </label>
        <input
          id="prof-name"
          name="name"
          type="text"
          defaultValue={defaultName}
          required
          minLength={2}
          autoComplete="name"
          style={inputStyle}
        />
      </div>
      <div>
        <label htmlFor="prof-phone" style={labelStyle}>
          Telefon
        </label>
        <input
          id="prof-phone"
          name="phone"
          type="tel"
          defaultValue={defaultPhone}
          autoComplete="tel"
          placeholder="+90 ___ ___ __ __"
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>E-posta</label>
        <div
          style={{
            ...inputStyle,
            background: "transparent",
            color: "var(--ink-mute)",
            cursor: "not-allowed",
          }}
        >
          {email}
        </div>
        <p style={{ marginTop: 6, fontSize: 11, color: "var(--ink-mute)" }}>
          E-posta değiştirilemez (siparişler bu adrese bağlı).
        </p>
      </div>
      {state.error && (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            fontSize: 13,
          }}
        >
          {state.error}
        </div>
      )}
      {state.message && (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            color: "#065f46",
            fontSize: 13,
          }}
        >
          {state.message}
        </div>
      )}
      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary btn-sm"
        style={{ justifySelf: "start", opacity: pending ? 0.7 : 1 }}
      >
        {pending ? "Kaydediliyor…" : "Kaydet"}
      </button>
    </form>
  );
}
