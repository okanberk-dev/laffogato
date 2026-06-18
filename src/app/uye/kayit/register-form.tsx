"use client";

import { useActionState } from "react";

import { registerAction, type RegisterFormState } from "../actions";

const initialState: RegisterFormState = {};

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

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, initialState);
  const v = state.values ?? {};

  return (
    <form action={action} style={{ display: "grid", gap: 14 }}>
      <div>
        <label htmlFor="reg-name" style={labelStyle}>
          Ad Soyad
        </label>
        <input
          id="reg-name"
          name="name"
          type="text"
          required
          defaultValue={v.name}
          autoComplete="name"
          minLength={2}
          style={inputStyle}
        />
      </div>
      <div>
        <label htmlFor="reg-email" style={labelStyle}>
          E-posta
        </label>
        <input
          id="reg-email"
          name="email"
          type="email"
          required
          defaultValue={v.email}
          autoComplete="email"
          style={inputStyle}
        />
      </div>
      <div>
        <label htmlFor="reg-phone" style={labelStyle}>
          Telefon
        </label>
        <input
          id="reg-phone"
          name="phone"
          type="tel"
          defaultValue={v.phone}
          autoComplete="tel"
          placeholder="+90 ___ ___ __ __"
          style={inputStyle}
        />
      </div>
      <div>
        <label htmlFor="reg-password" style={labelStyle}>
          Şifre (en az 8 karakter)
        </label>
        <input
          id="reg-password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          style={inputStyle}
        />
      </div>
      <div>
        <label htmlFor="reg-pwc" style={labelStyle}>
          Şifre (tekrar)
        </label>
        <input
          id="reg-pwc"
          name="passwordConfirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          style={inputStyle}
        />
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
      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary btn-lg"
        style={{
          width: "100%",
          justifyContent: "center",
          marginTop: 6,
          opacity: pending ? 0.7 : 1,
        }}
      >
        {pending ? "Oluşturuluyor…" : "Üyeliğimi oluştur"}
        <span className="arrow">→</span>
      </button>
      <p style={{ fontSize: 11, color: "var(--ink-mute)", lineHeight: 1.5, margin: 0, textAlign: "center" }}>
        Üye olarak{" "}
        <a href="#" style={{ textDecoration: "underline" }}>kullanım şartları</a>{" "}
        ve{" "}
        <a href="#" style={{ textDecoration: "underline" }}>gizlilik politikasını</a>{" "}
        kabul ediyorsun.
      </p>
    </form>
  );
}
