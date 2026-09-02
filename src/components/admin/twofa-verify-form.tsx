"use client";

import { useActionState } from "react";

import {
  cancel2FAAction,
  verify2FAAction,
  type TwoFAState,
} from "@/app/admin/iki-asama/actions";

import { GhostButton, PrimaryButton, TextInput } from "./forms";

const initial: TwoFAState = {};

export function TwoFAVerifyForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(verify2FAAction, initial);

  return (
    <>
      <form action={formAction} className="grid gap-3">
        <input type="hidden" name="next" value={next} />
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
