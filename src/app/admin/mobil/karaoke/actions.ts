"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  actionError,
  okWithNotice,
  type ActionResult,
} from "@/lib/admin/action-result";
import { logAudit } from "@/lib/admin/audit";
import { getAdminSession, requireRole } from "@/lib/admin/auth";
import { KARAOKE_PANEL_PATH } from "@/lib/admin/karaoke-panel";
import { canAccess } from "@/lib/admin/roles";
import {
  getReservation,
  listReservationsForDate,
  paymentStatusOf,
  setReservationStatus,
  type KaraokeReservation,
  type SetReservationStatusFailure,
} from "@/lib/mobile/karaoke";
import {
  cancelKaraokeReservation,
  retryKaraokeRefund,
  settleKaraokeRefundByHand,
  type CancelKaraokeFailure,
} from "@/lib/mobile/karaoke-payment";
import { istanbulClock } from "@/lib/mobile/venue";

const FAILURE_MESSAGE: Record<SetReservationStatusFailure, string> = {
  not_found: "Rezervasyon bulunamadı. Silinmiş olabilir; sayfayı yenile.",
  wrong_status:
    "Rezervasyonun durumu bu arada değişmiş. Sayfayı yenileyip tekrar bak.",
  slot_taken:
    "Bu saat başka bir onaylı rezervasyonda. Onaylamak için önce diğerini iptal et.",
  raced: "Bu rezervasyonu az önce başka biri değiştirdi. Sayfayı yenile.",
  payment_open:
    "Bu rezervasyonun ödemesi alınmadı. Ödemesi alınmamış rezervasyon onaylanmaz.",
};

/**
 * `payment_open` has two causes, and the old single sentence ("ödeme gelince
 * kendiliğinden kesinleşir") was false for one of them: a request taken as
 * pay-at-the-venue before prepayment was switched on never gets a payment,
 * so it never confirms itself.
 */
const PAYMENT_OPEN_MESSAGE: Partial<Record<string, string>> = {
  pending:
    "Bu rezervasyonun ödemesi henüz alınmadı. Ödeme gelince kendiliğinden onaylanır; elle onaylanmaz.",
  none: "Bu talep ön ödeme açılmadan önce köşkte ödenecek diye alınmış. Ödemesi alınmamış rezervasyon onaylanmaz: müşteriyi arayıp online rezervasyon yapmasını iste ve bu talebi iptal et.",
};

const REFUND_FORBIDDEN =
  "Bu rezervasyon ödenmiş; iptal etmek kartına iade demek. İade yetkisi olan biri (sahip ya da yönetici) iptal etmeli.";

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
  refund_forbidden: REFUND_FORBIDDEN,
  raced: "Bu rezervasyonu az önce başka biri değiştirdi. Sayfayı yenile.",
};

const PAID_MEANWHILE =
  'Bu rezervasyonun ödemesi bu arada geldi: iptal artık iade demek. Sayfayı yenileyip "İptal et ve iade et" ile yeniden dene.';

const NO_REFUND_RIGHT =
  "İade yetkin yok: para iadesini sahip ya da yönetici yapar.";

/** `krk-00042`: the only shape an id may have here. */
const IdSchema = z
  .string()
  .trim()
  .regex(/^krk-\d{1,12}$/);

function readId(formData: FormData): string | null {
  const parsed = IdSchema.safeParse(formData.get("id"));
  return parsed.success ? parsed.data : null;
}

const ReasonSchema = z
  .string()
  .trim()
  .max(500, "Neden en fazla 500 karakter olabilir.");

/**
 * The reason typed in the dialog. Required wherever money moves (a refund,
 * a refund recorded by hand), optional elsewhere; it goes into the audit row.
 */
function readReason(
  formData: FormData,
  required: boolean,
): { ok: true; reason: string } | { ok: false; result: ActionResult } {
  const raw = formData.get("reason");
  const parsed = ReasonSchema.safeParse(typeof raw === "string" ? raw : "");
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Neden geçersiz.";
    return { ok: false, result: actionError(message, { reason: message }) };
  }
  if (required && parsed.data.length < 3) {
    const message = "Para hareket ediyor: kısaca nedenini yaz.";
    return { ok: false, result: actionError(message, { reason: message }) };
  }
  return { ok: true, reason: parsed.data };
}

/** Who the booking's mail goes to, in the dative, for the result sentence. */
function recipient(r: Pick<KaraokeReservation, "guest"> | undefined): string {
  return r?.guest ? "müşteriye" : "üyeye";
}

function revalidate(id: string): void {
  revalidatePath(KARAOKE_PANEL_PATH);
  revalidatePath(`${KARAOKE_PANEL_PATH}/${id}`);
  revalidatePath("/admin");
}

// Rol kapısı her action'da ayrıca açılır: sayfadaki `requireRole` bir Server
// Action'ı korumaz - action, sayfadan bağımsız çağrılabilen bir POST ucudur
// (CLAUDE.md kural 27). Paneli `karaoke` açar (Personel dahil); para hareket
// eden her şey ayrıca `refunds` ister ve yoksa yönlendirmez, nedenini söyler.
// Her action kendi tam sonucunu döner: modal başına bir durum, bir mesaj.

export async function confirmReservationAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("karaoke");
  const id = readId(formData);
  if (!id) return actionError("Rezervasyon numarası eksik.");
  // Refuses a booking whose money is not in (`payment_open`): only a paid
  // booking, or a pay-at-the-venue request while prepayment is switched off,
  // is ever confirmed.
  const result = await setReservationStatus(id, "confirmed");
  if (!result.ok) {
    revalidate(id);
    if (result.reason === "payment_open") {
      const current = await getReservation(id);
      const why = current
        ? PAYMENT_OPEN_MESSAGE[paymentStatusOf(current)]
        : undefined;
      return actionError(why ?? FAILURE_MESSAGE.payment_open);
    }
    return actionError(FAILURE_MESSAGE[result.reason]);
  }
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
  revalidate(id);
  return okWithNotice(
    "Rezervasyon onaylandı.",
    result.notified,
    recipient(updated),
  );
}

/**
 * The köşk cancels (a business cancellation, MSY m.16/4): any time, and a
 * paid booking's money goes back in full through the POS first. Sending money
 * back needs the `refunds` permission on top of the karaoke panel, and a
 * reason.
 *
 * `beklenen` is what the dialog showed: `iade` (a paid booking, the refund
 * dialog) or `odenmemis`. A payment that lands while an "unpaid" dialog is
 * open must not turn its plain "İptal" into a refund nobody confirmed.
 */
export async function cancelReservationAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireRole("karaoke");
  const id = readId(formData);
  if (!id) return actionError("Rezervasyon numarası eksik.");
  const expectsRefund = formData.get("beklenen") === "iade";
  const canRefund = canAccess("refunds", session.role);
  if (expectsRefund && !canRefund) return actionError(REFUND_FORBIDDEN);
  const reason = readReason(formData, expectsRefund);
  if (!reason.ok) return reason.result;

  const current = await getReservation(id);
  if (!current) return actionError(CANCEL_MESSAGE.not_found);
  if (!expectsRefund && paymentStatusOf(current) === "paid") {
    revalidate(id);
    return actionError(PAID_MEANWHILE);
  }

  const result = await cancelKaraokeReservation(id, {
    kind: "staff",
    actor: session.email,
    // Only the refund dialog may send money back. An unpaid hold the POS
    // turns out to have been paid for stops here instead (refund_forbidden).
    canRefund: canRefund && expectsRefund,
    ...(reason.reason ? { reason: reason.reason } : {}),
  });
  revalidate(id);
  if (!result.ok) {
    if (result.reason === "refund_forbidden" && canRefund && !expectsRefund) {
      return actionError(PAID_MEANWHILE);
    }
    const detail = result.message ? ` (${result.message})` : "";
    return actionError(`${CANCEL_MESSAGE[result.reason]}${detail}`);
  }
  const done = result.refunded
    ? "Rezervasyon iptal edildi ve ödeme karta iade edildi."
    : "Rezervasyon iptal edildi.";
  return okWithNotice(done, result.notified, recipient(result.reservation));
}

/**
 * "İadeyi başlat" (a cancelled booking still paid) and "İadeyi yeniden dene"
 * (a refund whose answer never came, or was declined): the POS is asked to
 * send the money back. Moves money, so it is behind a dialog with a reason.
 */
export async function retryKaraokeRefundAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireRole("karaoke");
  if (!canAccess("refunds", session.role)) return actionError(NO_REFUND_RIGHT);
  const id = readId(formData);
  if (!id) return actionError("Rezervasyon numarası eksik.");
  const reason = readReason(formData, true);
  if (!reason.ok) return reason.result;
  const result = await retryKaraokeRefund(id, session.email, undefined, {
    reason: reason.reason,
  });
  revalidate(id);
  if (!result.ok) {
    return actionError(
      result.reason === "refused"
        ? `POS iadeyi reddetti: ${result.message ?? "?"}. İlk iade geçmiş olabilir; PayNkolay panelinden bak.`
        : result.reason === "unknown"
          ? `İadenin sonucu belli değil: ${result.message ?? "POS yanıt vermedi"}. Rezervasyon 'iade sonucu bekleniyor' durumunda kaldı; PayNkolay panelinden bak.`
          : "Bu rezervasyonun iade edilecek ödemesi yok. Sayfayı yenile.",
    );
  }
  return okWithNotice(
    "İade yapıldı.",
    result.notified,
    recipient(result.reservation),
  );
}

/**
 * "İade POS'ta görüldü" / "PayNkolay'da iade edildi": a person saw the
 * refund in PayNkolay's panel (an unanswered one, or one they made there for
 * a cancelled booking still marked paid) and records it. Nothing is sent to
 * the POS.
 */
export async function settleKaraokeRefundAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireRole("karaoke");
  if (!canAccess("refunds", session.role)) return actionError(NO_REFUND_RIGHT);
  const id = readId(formData);
  if (!id) return actionError("Rezervasyon numarası eksik.");
  const reason = readReason(formData, true);
  if (!reason.ok) return reason.result;
  const result = await settleKaraokeRefundByHand(id, session.email, undefined, {
    reason: reason.reason,
  });
  revalidate(id);
  if (!result.ok) {
    return actionError(
      result.reason === "raced"
        ? "Bu rezervasyonun iadesi az önce başka yoldan kaydedildi. Sayfayı yenile."
        : "Bu rezervasyonun iadesi beklenmiyor. Sayfayı yenile.",
    );
  }
  return okWithNotice(
    "İade kaydedildi.",
    result.notified,
    recipient(result.reservation),
  );
}

/**
 * Today's live bookings (not cancelled: paid, waiting for payment or for
 * Onayla), for the nav badge. Null for a role without the karaoke panel and
 * for a read that failed: the badge then simply does not draw. Never throws
 * and never redirects - it runs in the background on every screen.
 */
export async function karaokeTodayCountAction(): Promise<number | null> {
  const session = await getAdminSession();
  if (!session || !canAccess("karaoke", session.role)) return null;
  try {
    const today = istanbulClock(new Date()).date;
    const rows = await listReservationsForDate(today);
    return rows.filter((r) => r.status !== "cancelled").length;
  } catch (err) {
    console.error("[admin/karaoke] bugünkü rezervasyonlar sayılamadı", err);
    return null;
  }
}
