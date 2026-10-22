"use client";

import { useActionState } from "react";

import {
  cancelEnrollAction,
  verifyEnrollAction,
  type EnrollState,
} from "@/app/admin/2fa-kurulum/actions";

import { withPanelCatch } from "./action-form";
import { GhostButton, PrimaryButton, TextInput } from "./forms";
import { CODE_INPUT_STYLE } from "./twofa-verify-form";

const initial: EnrollState = {};

// A throw is an answer under the field, not the error screen; the success
// redirect (with its toast) still runs.
const submitCode = withPanelCatch<EnrollState>(verifyEnrollAction, () => ({
  error: "Kod şu an doğrulanamadı. Biraz sonra tekrar dene.",
}));

export function TwoFAEnrollForm() {
  const [state, formAction, pending] = useActionState(submitCode, initial);

  return (
    <div className="grid gap-3">
      {/* A plain action form on purpose: after a wrong code the field
          should be empty for the next one. */}
      <form action={formAction} className="grid gap-3">
        <p className="text-sm text-[var(--admin-text-soft)]">
          QR kodu taradıktan sonra doğrulama uygulamasında görünen 6 haneli kodu
          gir.
        </p>
        <TextInput
          name="token"
          inputMode="numeric"
          pattern="\d{6}"
          placeholder="123456"
          autoComplete="one-time-code"
          aria-label="6 haneli doğrulama kodu"
          autoFocus
          required
          maxLength={6}
          style={CODE_INPUT_STYLE}
        />
        {state.error && (
          <div
            role="alert"
            className="rounded-lg bg-[var(--admin-danger-soft)] px-3.5 py-2.5 text-sm text-[var(--admin-danger-ink)]"
          >
            {state.error}
          </div>
        )}
        <PrimaryButton type="submit" disabled={pending}>
          {pending ? "Doğrulanıyor…" : "Doğrula ve aç"}
        </PrimaryButton>
      </form>
      <form action={cancelEnrollAction}>
        <GhostButton type="submit" className="w-full justify-center">
          Vazgeç
        </GhostButton>
      </form>
    </div>
  );
}
