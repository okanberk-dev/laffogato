"use client";

import { useActionState } from "react";

import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next ?? "/admin"} />

      <label className="flex flex-col gap-2">
        <span
          className="text-[10px] uppercase tracking-[0.22em] text-neutral-500"
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
          className="rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none transition-colors focus:border-neutral-900 focus:bg-white"
        />
      </label>

      <label className="flex flex-col gap-2">
        <span
          className="text-[10px] uppercase tracking-[0.22em] text-neutral-500"
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
          className="rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none transition-colors focus:border-neutral-900 focus:bg-white"
        />
      </label>

      {state.error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-neutral-900 px-5 py-3.5 text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-50"
      >
        {pending ? "Giriş yapılıyor…" : "Giriş yap"}
        <span aria-hidden>→</span>
      </button>
    </form>
  );
}
