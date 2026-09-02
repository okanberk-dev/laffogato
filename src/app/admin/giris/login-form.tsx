"use client";

import { useActionState } from "react";

import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(
    loginAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next ?? "/admin"} />

      <label className="flex flex-col gap-2">
        <span
          className="text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
          style={{ fontFamily: "var(--mono), monospace" }}
        >
          E-posta
        </span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="merhaba@example.com"
          className="rounded-md border border-[var(--admin-border)] bg-neutral-50 px-4 py-3 text-sm transition-colors outline-none focus:border-[var(--admin-primary)] focus:bg-white"
        />
      </label>

      <label className="flex flex-col gap-2">
        <span
          className="text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
          style={{ fontFamily: "var(--mono), monospace" }}
        >
          Şifre
        </span>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          placeholder="••••••••"
          className="rounded-md border border-[var(--admin-border)] bg-neutral-50 px-4 py-3 text-sm transition-colors outline-none focus:border-[var(--admin-primary)] focus:bg-white"
        />
      </label>

      {state.error && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
        >
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--admin-primary)] px-5 py-3.5 text-sm font-medium text-white transition-colors hover:bg-[var(--admin-primary-hover)] disabled:opacity-50"
      >
        {pending ? "Giriş yapılıyor…" : "Giriş yap"}
        <span aria-hidden>→</span>
      </button>
    </form>
  );
}
