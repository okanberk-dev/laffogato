"use client";

import { useActionState } from "react";

import {
  closeCustomerAccountAction,
  resendVerificationAction,
  setCustomerActiveAction,
  type ResendVerificationState,
} from "@/app/admin/musteriler/actions";

import {
  ActionButton,
  PANEL_ACTION_FAILED,
  useHandPost,
  withPanelCatch,
} from "./action-form";
import { FormError, FormSuccess } from "./form-feedback";
import { Card, GhostButton } from "./forms";
import { ActionModal, ConfirmButton } from "./ui";

const resendInitial: ResendVerificationState = {};

interface Props {
  email: string;
  isActive: boolean;
  emailVerified: boolean;
  /**
   * The member asked for deletion (/uye/hesap/sil): "Hesabı sil" is then
   * drawn as the primary action of the request card, not repeated here.
   */
  deletionRequested?: boolean;
}

export function CustomerActions({
  email,
  isActive,
  emailVerified,
  deletionRequested = false,
}: Props) {
  const [resend, resendAction, resending] = useActionState(
    withPanelCatch(resendVerificationAction, () => ({
      error: PANEL_ACTION_FAILED,
    })),
    resendInitial,
  );
  const resendPost = useHandPost(resendAction, resending);

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
        <form
          action={resendPost.action}
          onSubmit={resendPost.onSubmit}
          className="grid gap-2"
        >
          <input type="hidden" name="email" value={email} />
          <GhostButton type="submit" disabled={resending} className="w-full">
            {resending ? "Oluşturuluyor…" : "Doğrulama bağlantısı yenile"}
          </GhostButton>
          <FormError message={resend.error} />
          <FormSuccess message={resend.error ? undefined : resend.message} />
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
      {!deletionRequested && <CloseAccountButton email={email} />}
    </Card>
  );
}

/**
 * "Hesabı sil": the panel's account closure (`closeCustomerAccountAction`,
 * the member's own deletion pipeline `deleteMe`), behind the member's
 * e-mail typed out. Drawn in the Yönetim card, or as the primary action of
 * an open deletion request; that one posts the request it answers
 * (`requestedAt`), so a request the member took back meanwhile is refused.
 */
export function CloseAccountButton({
  email,
  variant = "danger",
  requestedAt,
}: {
  email: string;
  variant?: "danger" | "primary";
  requestedAt?: string;
}) {
  return (
    <ActionModal
      action={closeCustomerAccountAction}
      title="Hesabı kapat ve sil"
      trigger="Hesabı sil"
      triggerVariant={variant}
      triggerClassName="w-full"
      tone="danger"
      submitLabel="Hesabı kapat"
      pendingLabel="Kapatılıyor…"
      confirmPhrase={email}
      hidden={requestedAt ? { email, requestedAt } : { email }}
      size="md"
      description={
        <ul className="grid list-disc gap-1 pl-4">
          <li>
            Üyenin kendi hesap silmesiyle aynı işlem yapılır, geri alınamaz.
          </li>
          <li>
            Gelecekteki karaoke rezervasyonları iptal edilir, ödenmiş olanlar
            karta iade edilir. Saatine 2 saatten az kalan ödenmiş rezervasyon
            iade edilmez, olduğu gibi kalır. Bu durumda ve POS iadeyi hemen
            onaylamazsa ekibe e-posta gider.
          </li>
          <li>Uygulamadan kasa (barista) yetkisi varsa kaldırılır.</li>
          <li>
            Hesaptaki ad, telefon, adresler ve e-posta silinir; hesap Müşteriler
            listesinden çıkar.
          </li>
          <li>
            Siparişler yasal saklama süresi boyunca durur: e-posta adresi
            siparişten kaldırılır, faturadaki ad, telefon ve teslimat adresi
            siparişte kalır.
          </li>
          <li>
            Üyeye &quot;Hesabın silindi&quot; e-postası gider; açık bir silme
            talebi varsa kapanır.
          </li>
          <li>Devam eden siparişi olan hesap kapatılamaz.</li>
        </ul>
      }
    />
  );
}
