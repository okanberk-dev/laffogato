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
      <div style={{ display: "grid", gap: 10, marginTop: 2 }}>
        <label style={consentRowStyle}>
          <input
            type="checkbox"
            name="acceptedTerms"
            required
            defaultChecked={v.acceptedTerms}
            style={checkboxStyle}
          />
          <span>
            <a
              href="/hukuk/kullanim-sartlari"
              target="_blank"
              rel="noreferrer"
              style={consentLinkStyle}
            >
              Kullanım Şartları
            </a>{" "}
            ve{" "}
            <a
              href="/hukuk/gizlilik-politikasi"
              target="_blank"
              rel="noreferrer"
              style={consentLinkStyle}
            >
              Gizlilik Politikası
            </a>
            &apos;nı (KVKK aydınlatma metni dahil) okudum, kabul ediyorum.
          </span>
        </label>
        <label style={consentRowStyle}>
          <input
            type="checkbox"
            name="marketing"
            defaultChecked={v.marketing}
            style={checkboxStyle}
          />
          <span>
            Kampanya ve yeni ürünlerden e-posta ile haberdar olmak istiyorum.
          </span>
        </label>
        <label style={consentRowStyle}>
          <input
            type="checkbox"
            name="newsletter"
            defaultChecked={v.newsletter}
            style={checkboxStyle}
          />
          <span>Aylık bülten aboneliğine katılmak istiyorum.</span>
        </label>
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
    </form>
  );
}

const consentRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  fontSize: 12.5,
  lineHeight: 1.5,
  color: "var(--ink-mute)",
  cursor: "pointer",
};

const checkboxStyle: React.CSSProperties = {
  width: 18,
  height: 18,
  marginTop: 1,
  flexShrink: 0,
  accentColor: "var(--ink)",
  cursor: "pointer",
};

const consentLinkStyle: React.CSSProperties = {
  textDecoration: "underline",
  textUnderlineOffset: 2,
  color: "var(--ink)",
};
