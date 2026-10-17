"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logAudit } from "@/lib/admin/audit";
import { requireRole } from "@/lib/admin/auth";
import { canAccess } from "@/lib/admin/roles";
import {
  setReservationStatus,
  type SetReservationStatusFailure,
} from "@/lib/mobile/karaoke";
import {
  cancelKaraokeReservation,
  retryKaraokeRefund,
  settleKaraokeRefundByHand,
  type CancelKaraokeFailure,
} from "@/lib/mobile/karaoke-payment";

export interface ReservationActionState {
  error?: string;
  message?: string;
}

const FAILURE_MESSAGE: Record<SetReservationStatusFailure, string> = {
  not_found: "Rezervasyon bulunamadı. Silinmiş olabilir; sayfayı yenile.",
  wrong_status:
    "Rezervasyonun durumu bu arada değişmiş. Sayfayı yenileyip tekrar bak.",
  slot_taken:
    "Bu saat başka bir onaylı rezervasyonda. Onaylamak için önce diğerini iptal et.",
  raced: "Bu rezervasyonu az önce başka biri değiştirdi. Sayfayı yenile.",
  payment_open:
    "Bu rezervasyonun ödemesi alınmadı. Ödemesi alınmamış rezervasyon onaylanmaz; ödeme gelince kendiliğinden kesinleşir.",
};

const CANCEL_MESSAGE: Record<CancelKaraokeFailure, string> = {
  not_found: "Rezervasyon bulunamadı. Sayfayı yenile.",
  not_cancellable:
    "Bu rezervasyon iptal edilemez durumda (zaten iptal ya da iadesi sürüyor). Sayfayı yenile.",
  too_late: "İptal süresi geçmiş.",
  payment_unknown:
    "Ödeme altyapısına bu rezervasyonun ödenip ödenmediği sorulamadı; iptal edilmedi. Birkaç dakika sonra yeniden dene.",
  refund_refused:
    "POS iadeyi reddetti; rezervasyon iptal edilmedi, ödendi olarak duruyor.",
  refund_unknown:
    "İade isteği gönderildi ama POS yanıt vermedi. Rezervasyon 'iade sonucu bekleniyor' durumunda; PayNkolay panelinden bakıp sonucu buradan işaretle.",
  refund_forbidden:
    "Bu rezervasyon ödenmiş; iptal etmek kartına iade demek. İade yetkisi olan biri (sahip ya da yönetici) iptal etmeli.",
  raced: "Bu rezervasyonu az önce başka biri değiştirdi. Sayfayı yenile.",
};

/** `krk-00042`: the only shape an id may have here. */
const IdSchema = z
  .string()
  .trim()
  .regex(/^krk-\d{1,12}$/);

function readId(formData: FormData): string | null {
  const parsed = IdSchema.safeParse(formData.get("id"));
  return parsed.success ? parsed.data : null;
}

/**
 * Rol kapısı her action'da ayrıca açılır: sayfadaki `requireRole` bir Server
 * Action'ı korumaz - action, sayfadan bağımsız çağrılabilen bir POST ucudur.
 */
export async function confirmReservationAction(
  _prev: ReservationActionState,
  formData: FormData,
): Promise<ReservationActionState> {
  await requireRole("mobileApp");
  const id = readId(formData);
  if (!id) return { error: "Rezervasyon numarası eksik." };
  // Refuses a booking whose money is not in (`payment_open`): only a paid
  // booking, or a pay-at-the-venue request while prepayment is switched off,
  // is ever confirmed.
  const result = await setReservationStatus(id, "confirmed");
  if (!result.ok) return { error: FAILURE_MESSAGE[result.reason] };
  const updated = result.reservation;
  await logAudit({
    action: "transition",
    entity: "karaoke_reservation",
    entityId: id,
    payload: {
      status: "confirmed",
      date: updated.date,
      startHour: updated.startHour,
    },
  });
  revalidatePath("/admin/mobil/karaoke");
  return {
    message: result.notified
      ? "Rezervasyon onaylandı; üyeye bilgilendirme e-postası gönderildi."
      : "Rezervasyon onaylandı. Bilgilendirme e-postası GÖNDERİLEMEDİ - üyeye kendin ulaş.",
  };
}

/**
 * The köşk cancels (a business cancellation, MSY m.16/4): any time, and a
 * paid booking's money goes back in full through the POS first. Sending money
 * back needs the `refunds` permission on top of the karaoke panel.
 */
export async function cancelReservationAction(
  _prev: ReservationActionState,
  formData: FormData,
): Promise<ReservationActionState> {
  const session = await requireRole("mobileApp");
  const id = readId(formData);
  if (!id) return { error: "Rezervasyon numarası eksik." };
  const result = await cancelKaraokeReservation(id, {
    kind: "staff",
    actor: session.email,
    canRefund: canAccess("refunds", session.role),
  });
  revalidatePath("/admin/mobil/karaoke");
  if (!result.ok) {
    const detail = result.message ? ` (${result.message})` : "";
    return { error: `${CANCEL_MESSAGE[result.reason]}${detail}` };
  }
  const done = result.refunded
    ? "Rezervasyon iptal edildi ve ödeme karta iade edildi"
    : "Rezervasyon iptal edildi";
  return {
    message: result.notified
      ? `${done}; üyeye bilgilendirme e-postası gönderildi.`
      : `${done}. Bilgilendirme e-postası GÖNDERİLEMEDİ - üyeye kendin ulaş.`,
  };
}

/** "İadeyi yeniden dene": a refund whose answer never came, or was declined. */
export async function retryKaraokeRefundAction(
  _prev: ReservationActionState,
  formData: FormData,
): Promise<ReservationActionState> {
  const session = await requireRole("refunds");
  const id = readId(formData);
  if (!id) return { error: "Rezervasyon numarası eksik." };
  const result = await retryKaraokeRefund(id, session.email);
  revalidatePath("/admin/mobil/karaoke");
  if (!result.ok) {
    return {
      error:
        result.reason === "refused"
          ? `POS iadeyi reddetti: ${result.message ?? "?"}. İlk iade geçmiş olabilir; PayNkolay panelinden bak.`
          : result.reason === "unknown"
            ? `İadenin sonucu belli değil: ${result.message ?? "POS yanıt vermedi"}. Rezervasyon 'iade sonucu bekleniyor' durumunda kaldı; PayNkolay panelinden bak.`
            : "Bu rezervasyonun iade edilecek ödemesi yok.",
    };
  }
  return { message: "İade yapıldı; üyeye e-posta gönderildi." };
}

/** "İade POS'ta görüldü": a person saw the refund in PayNkolay's panel. */
export async function settleKaraokeRefundAction(
  _prev: ReservationActionState,
  formData: FormData,
): Promise<ReservationActionState> {
  const session = await requireRole("refunds");
  const id = readId(formData);
  if (!id) return { error: "Rezervasyon numarası eksik." };
  const result = await settleKaraokeRefundByHand(id, session.email);
  revalidatePath("/admin/mobil/karaoke");
  if (!result.ok) return { error: "Bu rezervasyonun iadesi beklenmiyor." };
  return { message: "İade kaydedildi; üyeye e-posta gönderildi." };
}
