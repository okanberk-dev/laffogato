"use client";

import { useActionState } from "react";

import {
  closeCustomerAccountAction,
  resendVerificationAction,
  setCustomerActiveAction,
  type ResendVerificationState,
} from "@/app/admin/musteriler/actions";

import { ActionButton } from "./action-form";
import { Card, GhostButton } from "./forms";
import { ActionModal, ConfirmButton } from "./ui";

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

      {/* Activate / deactivate. Taking the account away asks first;
          giving it back does not. */}
      {isActive ? (
        <ConfirmButton
          action={setCustomerActiveAction}
          hidden={{ email, active: "0" }}
          label="Hesabı pasifleştir"
          variant="ghost"
          className="w-full"
          description="Üye giriş yapamaz, uygulama ve site hesabı kapalı görünür. Siparişleri, damgaları ve kuponları olduğu gibi kalır; istediğin zaman yeniden aktifleştirebilirsin."
          confirmLabel="Pasifleştir"
        />
      ) : (
        <ActionButton
          action={setCustomerActiveAction}
          hidden={{ email, active: "1" }}
          variant="primary"
          className="w-full"
          pendingLabel="Aktifleştiriliyor…"
        >
          Hesabı yeniden aktifleştir
        </ActionButton>
      )}

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

      {/* Close the account: the member's own deletion pipeline (deleteMe),
          behind the member's e-mail typed out. */}
      <ActionModal
        action={closeCustomerAccountAction}
        title="Hesabı kapat ve sil"
        trigger="Hesabı sil"
        triggerVariant="danger"
        triggerClassName="w-full"
        tone="danger"
        submitLabel="Hesabı kapat"
        pendingLabel="Kapatılıyor…"
        confirmPhrase={email}
        hidden={{ email }}
        size="md"
        description={
          <ul className="grid list-disc gap-1 pl-4">
            <li>
              Üyenin kendi hesap silmesiyle aynı işlem yapılır, geri alınamaz.
            </li>
            <li>
              Gelecekteki karaoke rezervasyonları iptal edilir; ödenmiş olanlar
              karta iade edilir.
            </li>
            <li>Uygulamadan kasa (barista) yetkisi varsa kaldırılır.</li>
            <li>
              Ad, telefon, adresler ve e-posta silinir. Siparişler muhasebe için
              anonim olarak kalır.
            </li>
            <li>Devam eden siparişi olan hesap kapatılamaz.</li>
          </ul>
        }
      />
    </Card>
  );
}
