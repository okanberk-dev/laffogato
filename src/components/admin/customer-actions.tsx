"use client";

import { useActionState } from "react";

import {
  closeCustomerAccountAction,
  resendVerificationAction,
  setCustomerActiveAction,
  type ResendVerificationState,
} from "@/app/admin/musteriler/actions";
import {
  deletionRefundLabel,
  type DeletionKaraokeItem,
} from "@/lib/customer/deletion-request-core";

import {
  ActionButton,
  PANEL_ACTION_FAILED,
  useHandPost,
  withPanelCatch,
} from "./action-form";
import { FormError, FormSuccess } from "./form-feedback";
import { Card, Checkbox, Field, GhostButton } from "./forms";
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
    <Card className="grid grid-cols-1 gap-3">
      <h2
        className="text-[10px] tracking-[0.22em] text-[var(--admin-text-soft)] uppercase"
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
              <span className="text-[10px] tracking-[0.18em] text-[var(--admin-text-soft)] uppercase">
                Doğrulama bağlantısı
              </span>
              <input
                readOnly
                value={resend.url}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full rounded-xl border border-[var(--admin-border-field)] bg-[var(--admin-surface-2)] px-2 py-1.5 text-xs text-[var(--admin-text)]"
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
 *
 * `passedKaraoke`: paid bookings whose start came after the request while
 * their rule still refunded them then. Each gets an unticked "Oda
 * kullanıldı, iade yapılmaz" box (`karaokeRoomUsed`); unticked, the closure
 * refunds it as the request would have (ASK-Y3-4 (d)), which the row says
 * under the box.
 */
export function CloseAccountButton({
  email,
  variant = "danger",
  requestedAt,
  passedKaraoke = [],
}: {
  email: string;
  variant?: "danger" | "primary";
  requestedAt?: string;
  passedKaraoke?: readonly DeletionKaraokeItem[];
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
            iade edilmez, olduğu gibi kalır; açık bir silme talebi varsa bu süre
            talep anına göre sayılır. İade yapılmazsa ya da POS iadeyi hemen
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
    >
      {passedKaraoke.length > 0 ? (
        <Field
          as="fieldset"
          label="Saati talepten sonra geçen rezervasyon"
          hint="Üye silmeyi istediğinde iptal iade alıyordu. Oda kullanıldıysa işaretle, ödeme olduğu gibi kalır."
        >
          {/* The tick's label is what ticking does; the refund is what an
              empty box does, so it sits under the row, outside the label. */}
          {passedKaraoke.map((k) => (
            <div key={k.id} className="grid">
              <Checkbox
                name="karaokeRoomUsed"
                value={k.id}
                label={`Oda kullanıldı, iade yapılmaz: ${k.label}`}
                aria-describedby={`karaoke-room-used-${k.id}`}
                // The label wraps on a phone; a box that shrank would leave
                // the note below out of line with the label.
                style={{ flexShrink: 0 }}
              />
              <span
                id={`karaoke-room-used-${k.id}`}
                className="-mt-2 pb-1 pl-8 text-xs text-[var(--admin-text-soft)]"
              >
                İşaretlemezsen {deletionRefundLabel(k.refundPercent)} yapılır.
              </span>
            </div>
          ))}
        </Field>
      ) : null}
    </ActionModal>
  );
}
