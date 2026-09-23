"use client";

import { useActionState } from "react";

import { loginAction, type LoginFormState } from "../actions";

const initialState: LoginFormState = {};

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
  color: "var(--ink-soft)",
  marginBottom: 8,
};

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(loginAction, initialState);
  return (
    <form action={action} style={{ display: "grid", gap: 14 }}>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <div>
        <label htmlFor="login-email" style={labelStyle}>
          E-posta
        </label>
        <input
          id="login-email"
          name="email"
          type="email"
          required
          defaultValue={state.values?.email}
          autoComplete="email"
          style={inputStyle}
        />
      </div>
      <div>
        <label htmlFor="login-password" style={labelStyle}>
          Şifre
        </label>
        <input
          id="login-password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          style={inputStyle}
        />
      </div>
      {/* role="alert" so the failure is spoken the moment it appears; without
          it the form simply looked unchanged to a screen-reader user. */}
      {state.error && (
        <div
          role="alert"
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            background: "#f6e9ec",
            border: "1px solid #e1e5e0",
            color: "#bb251b",
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
        {pending ? "Giriş yapılıyor…" : "Giriş yap"}
        <span className="arrow">→</span>
      </button>
    </form>
  );
}
