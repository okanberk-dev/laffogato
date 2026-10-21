"use client";

import { useActionState } from "react";

import {
  cancel2FAAction,
  verify2FAAction,
  type TwoFAState,
} from "@/app/admin/iki-asama/actions";

import { withPanelCatch } from "./action-form";
import { GhostButton, PrimaryButton, TextInput } from "./forms";
import { NUMERIC_STYLE } from "./ui/styles";

const initial: TwoFAState = {};

// A throw is an answer under the field, not the error screen; the redirect
// after a good code still runs.
const submitCode = withPanelCatch<TwoFAState>(verify2FAAction, () => ({
  error: "Kod şu an doğrulanamadı. Biraz sonra yeni kodla tekrar dene.",
}));

/** The six digits as one readable, evenly spaced code (the enroll form too). */
export const CODE_INPUT_STYLE = {
  ...NUMERIC_STYLE,
  letterSpacing: "0.4em",
  textAlign: "center",
  fontSize: 22,
} as const;

export function TwoFAVerifyForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(submitCode, initial);

  return (
    <>
      {/* A plain action form on purpose: after a wrong code the field
          should be empty for the next one. */}
      <form action={formAction} className="grid gap-3">
        <input type="hidden" name="next" value={next} />
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
            className="rounded-xl bg-[var(--admin-danger-soft)] px-3.5 py-2.5 text-sm text-[var(--admin-danger-ink)]"
          >
            {state.error}
          </div>
        )}
        <PrimaryButton type="submit" disabled={pending}>
          {pending ? "Doğrulanıyor…" : "Devam et"}
        </PrimaryButton>
      </form>
      <form action={cancel2FAAction} className="mt-3">
        <GhostButton type="submit" className="w-full justify-center">
          Vazgeç ve çıkış yap
        </GhostButton>
      </form>
    </>
  );
}
