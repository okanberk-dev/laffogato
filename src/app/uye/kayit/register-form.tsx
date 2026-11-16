"use client";

import { useActionState } from "react";

import { BusyDots } from "@/components/laffogato/busy-dots";

import { registerAction, type RegisterFormState } from "../actions";

const initialState: RegisterFormState = {};

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, initialState);
  const v = state.values ?? {};

  return (
    <form action={action} className="auth-form">
      <div className="auth-field">
        <label htmlFor="reg-name" className="auth-label">
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
        />
      </div>
      <div className="auth-field">
        <label htmlFor="reg-email" className="auth-label">
          E-posta
        </label>
        <input
          id="reg-email"
          name="email"
          type="email"
          required
          defaultValue={v.email}
          autoComplete="email"
          placeholder="E-posta adresin"
        />
      </div>
      <div className="auth-field">
        <label htmlFor="reg-phone" className="auth-label">
          Telefon <span className="auth-hint">(isteğe bağlı)</span>
        </label>
        <input
          id="reg-phone"
          name="phone"
          type="tel"
          defaultValue={v.phone}
          autoComplete="tel"
          placeholder="+90 ___ ___ __ __"
        />
      </div>
      <div className="auth-field">
        <label htmlFor="reg-password" className="auth-label">
          Şifre <span className="auth-hint">(en az 8 karakter)</span>
        </label>
        <input
          id="reg-password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>
      <div className="auth-field">
        <label htmlFor="reg-pwc" className="auth-label">
          Şifre (tekrar)
        </label>
        <input
          id="reg-pwc"
          name="passwordConfirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>
      <div className="auth-consents">
        <label className="auth-consent">
          <input
            type="checkbox"
            name="acceptedTerms"
            required
            defaultChecked={v.acceptedTerms}
          />
          <span>
            <a href="/hukuk/kullanim-sartlari" target="_blank" rel="noreferrer">
              Kullanım Şartları
            </a>
            &apos;nı okudum, kabul ediyorum.
          </span>
        </label>
        {/* Information, not a term to accept: the KVKK notice is read, never
            "accepted" (Kurul İlke Kararı 2026/347; KVKK m.10), so it has no
            box and is not part of the sentence above. */}
        <p className="auth-consent-note">
          Kişisel verilerinin nasıl işlendiğini{" "}
          <a href="/hukuk/gizlilik-politikasi" target="_blank" rel="noreferrer">
            Gizlilik Politikası
          </a>{" "}
          ve{" "}
          <a
            href="/hukuk/kvkk-aydinlatma-metni"
            target="_blank"
            rel="noreferrer"
          >
            KVKK Aydınlatma Metni
          </a>
          &apos;nde okuyabilirsin.
        </p>
        <label className="auth-consent">
          <input
            type="checkbox"
            name="marketing"
            defaultChecked={v.marketing}
          />
          <span>
            Kampanya ve yeni ürünlerden e-posta ile haberdar olmak istiyorum.
          </span>
        </label>
        <label className="auth-consent">
          <input
            type="checkbox"
            name="newsletter"
            defaultChecked={v.newsletter}
          />
          <span>Aylık bülten aboneliğine katılmak istiyorum.</span>
        </label>
      </div>

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
            Oluşturuluyor…
          </>
        ) : (
          "Üyeliğimi oluştur"
        )}
        {!pending && <span className="arrow">→</span>}
      </button>
    </form>
  );
}
