"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  cancelEnrollAction,
  verifyEnrollAction,
  type EnrollState,
} from "@/app/admin/2fa-kurulum/actions";

import { GhostButton, PrimaryButton, TextInput } from "./forms";

const initial: EnrollState = {};

export function TwoFAEnrollForm() {
  const [state, formAction, pending] = useActionState(
    verifyEnrollAction,
    initial,
  );

  if (state.enabled) {
    return (
      <div className="grid gap-3">
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          2FA başarıyla aktive edildi. Sonraki girişlerde 6 haneli kod
          istenecek.
        </div>
        <Link
          href="/admin"
          className="inline-flex items-center justify-center rounded-full bg-[var(--admin-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--admin-primary-hover)]"
        >
          Genel bakışa dön →
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <form action={formAction} className="grid gap-3">
        <p className="text-sm text-neutral-600">
          QR kodu taradıktan sonra authenticator'da görünen 6 haneli kodu gir.
        </p>
        <TextInput
          name="token"
          inputMode="numeric"
          pattern="\d{6}"
          placeholder="123456"
          autoComplete="one-time-code"
          autoFocus
          required
          maxLength={6}
          style={{
            fontFamily: "var(--mono), monospace",
            letterSpacing: "0.4em",
            textAlign: "center",
            fontSize: 22,
          }}
        />
        {state.error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </div>
        )}
        <PrimaryButton type="submit" disabled={pending}>
          {pending ? "Doğrulanıyor…" : "Doğrula ve aktive et"}
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
