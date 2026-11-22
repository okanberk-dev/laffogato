"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { useHandPost, withPanelCatch } from "@/components/admin/action-form";
import { Field, PrimaryButton, TextInput } from "@/components/admin/forms";
import { AdminIcon } from "@/components/admin/ui/icons";

import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};

// A throw (the database stumbling under the rate limiter or the 2FA check)
// is an answer next to the button, not the error screen; redirect() still
// runs. A fresh object each time, so the effect below sees every refusal.
const submitLogin = withPanelCatch<LoginState>(loginAction, () => ({
  error: "Giriş şu an yapılamadı. Biraz sonra tekrar dene.",
}));

/**
 * Posted by hand (useHandPost), not through `<form action>`: React 19
 * empties an action form's uncontrolled fields once the action finishes,
 * whatever it answers, so every mistyped password used to take the e-mail
 * with it. Now a refusal keeps the address; only the password is cleared,
 * and focused, for the retry.
 *
 * `action` stays on the form all the same. Before the page's JavaScript has
 * run there is no onSubmit, and a form with neither action nor method posts
 * the browser's own way: a GET to this page with the password in the
 * address (history, server logs). With it React draws its guard
 * (`action="javascript:..."`), so an early Enter sends nothing; after
 * hydration onSubmit prevents that post and React skips the action. The
 * press React kept and replays once the page is live is one attempt, not
 * one per impatient Enter (ui/submit.ts replayByHand).
 */
export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(
    submitLogin,
    initialState,
  );
  const post = useHandPost(formAction, pending);
  const formRef = useRef<HTMLFormElement>(null);
  // The eye in the field shows what was typed (a phone's keyboard makes
  // mistakes), and a line says when Caps Lock is on: the two reasons a
  // right password is refused.
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const readCaps = (e: React.KeyboardEvent<HTMLInputElement>) =>
    setCapsLock(e.getModifierState("CapsLock"));

  useEffect(() => {
    const field = formRef.current?.elements.namedItem("password");
    if (!state.error || !(field instanceof HTMLInputElement)) return;
    field.value = "";
    field.focus();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={post.action}
      onSubmit={post.onSubmit}
      className="flex flex-col gap-4"
    >
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
          placeholder="E-posta adresi"
        />
      </Field>

      {/* Not <Field>: its <label> would hold the eye button too, and the
          field's name would read "Şifre Şifreyi göster". */}
      <div className="flex flex-col gap-2">
        <label
          htmlFor="login-password"
          className="text-[13px] font-medium text-[var(--admin-text-soft)]"
          style={{ fontFamily: "var(--mono), monospace" }}
        >
          Şifre
        </label>
        <span className="relative block">
          <TextInput
            id="login-password"
            type={showPassword ? "text" : "password"}
            name="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            aria-describedby={capsLock ? "login-caps" : undefined}
            onKeyDown={readCaps}
            onKeyUp={readCaps}
            onBlur={() => setCapsLock(false)}
            className="pr-12"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
            aria-pressed={showPassword}
            className="absolute top-1/2 right-1 grid size-10 -translate-y-1/2 place-items-center rounded-full text-[var(--admin-text-mute)] transition-colors hover:bg-[var(--admin-surface-2)] hover:text-[var(--admin-text)] focus-visible:ring-[3px] focus-visible:ring-[var(--admin-ring)] focus-visible:outline-none pointer-fine:size-8"
          >
            <AdminIcon name={showPassword ? "hide" : "show"} size={18} />
          </button>
        </span>
      </div>
      {capsLock ? (
        <p
          id="login-caps"
          role="status"
          className="-mt-2 flex items-center gap-1.5 text-xs text-[var(--admin-warning)]"
        >
          <AdminIcon name="attention" size={14} />
          Caps Lock açık.
        </p>
      ) : null}

      {state.error && (
        <div
          role="alert"
          className="rounded-lg bg-[var(--admin-danger-soft)] px-3.5 py-2.5 text-sm text-[var(--admin-danger-ink)]"
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
