"use client";

import { useActionState, useEffect, useRef } from "react";

import {
  useNoResetSubmit,
  withPanelCatch,
} from "@/components/admin/action-form";
import { Field, PrimaryButton, TextInput } from "@/components/admin/forms";

import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};

// A throw (the database stumbling under the rate limiter or the 2FA check)
// is an answer next to the button, not the error screen; redirect() still
// runs. A fresh object each time, so the effect below sees every refusal.
const submitLogin = withPanelCatch<LoginState>(loginAction, () => ({
  error: "Giriş şu an yapılamadı. Biraz sonra tekrar dene.",
}));

/**
 * Posted by hand (useNoResetSubmit), not through `<form action>`: React 19
 * empties an action form's uncontrolled fields once the action finishes,
 * whatever it answers, so every mistyped password used to take the e-mail
 * with it. Now a refusal keeps the address; only the password is cleared,
 * and focused, for the retry.
 */
export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(
    submitLogin,
    initialState,
  );
  const onSubmit = useNoResetSubmit(formAction, pending);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const field = formRef.current?.elements.namedItem("password");
    if (!state.error || !(field instanceof HTMLInputElement)) return;
    field.value = "";
    field.focus();
  }, [state]);

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4">
      {/* Empty, not "/admin": with no explicit destination the action picks
          the one the role can actually open. */}
      <input type="hidden" name="next" value={next ?? ""} />

      <Field label="E-posta">
        <TextInput
          type="email"
          name="email"
          required
          maxLength={254}
          autoComplete="email"
          placeholder="merhaba@example.com"
        />
      </Field>

      <Field label="Şifre">
        <TextInput
          type="password"
          name="password"
          required
          autoComplete="current-password"
          placeholder="••••••••"
        />
      </Field>

      {state.error && (
        <div
          role="alert"
          className="rounded-xl bg-[var(--admin-danger-soft)] px-3.5 py-2.5 text-sm text-[var(--admin-danger-ink)]"
        >
          {state.error}
        </div>
      )}

      <PrimaryButton
        type="submit"
        disabled={pending}
        aria-busy={pending || undefined}
        className="mt-2 w-full"
      >
        {pending ? "Giriş yapılıyor…" : "Giriş yap"}
      </PrimaryButton>
    </form>
  );
}
