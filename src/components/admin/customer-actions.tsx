"use client";

import { useActionState } from "react";

import {
  deleteCustomerAction,
  resendVerificationAction,
  setCustomerActiveAction,
  type ResendVerificationState,
} from "@/app/admin/musteriler/actions";

import { Card, DangerButton, GhostButton, PrimaryButton } from "./forms";

const resendInitial: ResendVerificationState = {};

interface Props {
  email: string;
  isActive: boolean;
  emailVerified: boolean;
}

export function CustomerActions({ email, isActive, emailVerified }: Props) {
  const [resend, resendAction, resending] = useActionState(
    resendVerificationAction,
    resendInitial,
  );

  return (
    <Card className="grid gap-3">
      <h2
        className="text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
        style={{ fontFamily: "var(--mono), monospace" }}
      >
        Yönetim
      </h2>

      {/* Activate / deactivate */}
      <form action={setCustomerActiveAction}>
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="active" value={isActive ? "0" : "1"} />
        {isActive ? (
          <GhostButton type="submit" className="w-full">
            Hesabı pasifleştir
          </GhostButton>
        ) : (
          <PrimaryButton type="submit" className="w-full">
            Hesabı yeniden aktifleştir
          </PrimaryButton>
        )}
      </form>

      {/* Resend verification (only meaningful when not yet verified) */}
      {!emailVerified && (
        <form action={resendAction} className="grid gap-2">
          <input type="hidden" name="email" value={email} />
          <GhostButton type="submit" disabled={resending} className="w-full">
            {resending ? "Oluşturuluyor…" : "Doğrulama bağlantısı yenile"}
          </GhostButton>
          {resend.error && (
            <p className="text-xs text-red-600">{resend.error}</p>
          )}
          {resend.message && (
            <p className="text-xs text-emerald-700">{resend.message}</p>
          )}
          {resend.url && (
            <div className="grid gap-1">
              <span className="text-[10px] tracking-[0.18em] text-neutral-400 uppercase">
                Doğrulama bağlantısı
              </span>
              <input
                readOnly
                value={resend.url}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full rounded-md border border-[var(--admin-border)] bg-neutral-50 px-2 py-1.5 text-[11px] text-neutral-700"
                style={{ fontFamily: "var(--mono), monospace" }}
              />
            </div>
          )}
        </form>
      )}

      {/* Delete */}
      <form
        action={deleteCustomerAction}
        onSubmit={(e) => {
          if (
            !confirm(
              "Bu üye hesabını kalıcı olarak silmek istediğine emin misin? Bu işlem geri alınamaz. (Geçmiş siparişler silinmez.)",
            )
          ) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="email" value={email} />
        <DangerButton type="submit" className="w-full">
          Hesabı sil
        </DangerButton>
      </form>
    </Card>
  );
}
