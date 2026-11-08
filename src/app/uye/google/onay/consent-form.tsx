"use client";

import { useActionState } from "react";

import { BusyDots } from "@/components/laffogato/busy-dots";

import {
  cancelGoogleSignUpAction,
  completeGoogleSignUpAction,
  type GoogleConsentState,
} from "../../actions";

const initialState: GoogleConsentState = {};

/**
 * The register form's consent block, and nothing else: the Google account
 * already answered name and address, and there is no password to choose.
 * Same sentences and the same links as `register-form.tsx`, so one
 * agreement reads one way wherever an account is opened. Both boxes start
 * unticked (tests/frontend-form-contract.test.ts).
 */
export function GoogleConsentForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(
    completeGoogleSignUpAction,
    initialState,
  );
  const v = state.values ?? {};
  return (
    <>
      <form action={action} className="auth-form">
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <div className="auth-consents">
          <label className="auth-consent">
            <input type="checkbox" name="acceptedTerms" required />
            <span>
              <a
                href="/hukuk/kullanim-sartlari"
                target="_blank"
                rel="noreferrer"
              >
                Kullanım Şartları
              </a>
              &apos;nı okudum, kabul ediyorum.
            </span>
          </label>
          {/* Information, not a term to accept (KVKK m.10, Kurul İlke
              Kararı 2026/347): no box, as on the register form. */}
          <p className="auth-consent-note">
            Kişisel verilerinin nasıl işlendiğini{" "}
            <a
              href="/hukuk/gizlilik-politikasi"
              target="_blank"
              rel="noreferrer"
            >
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
              Açılıyor…
            </>
          ) : (
            "Üyeliğimi aç"
          )}
          {!pending && <span className="arrow">→</span>}
        </button>
      </form>
      {/* Its own form: a second submit inside the first would send the
          boxes along with a cancel. */}
      <form action={cancelGoogleSignUpAction} className="auth-foot">
        <button type="submit" className="auth-link" disabled={pending}>
          Vazgeç
        </button>
      </form>
    </>
  );
}
