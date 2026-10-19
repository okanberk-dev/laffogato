"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  actionError,
  actionOk,
  okWithNotice,
  type ActionResult,
} from "@/lib/admin/action-result";
import { logAudit } from "@/lib/admin/audit";
import { getAdminSession, requireRole } from "@/lib/admin/auth";
import { KARAOKE_PANEL_PATH } from "@/lib/admin/karaoke-panel";
import { parsePublishInstant } from "@/lib/admin/publish-window";
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
import {
  isBusinessCause,
  KARAOKE_CALL_HINT,
  KARAOKE_CANCEL_CAUSES,
  KARAOKE_REQUEST_CHANNELS,
  needsCallHint,
  type KaraokeCancelCause,
  type KaraokeRequestChannel,
} from "@/lib/mobile/karaoke-cancel-cause";
import { karaokeEndInstant } from "@/lib/mobile/karaoke-time";
import { istanbulClock } from "@/lib/mobile/venue";
import { formatTRYMinor } from "@/lib/utils/commerce";

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
 * so it never confirms itself. A paid request whose refund started while
 * the Onayla dialog was open is neither: its money is on its way back.
 */
const PAYMENT_OPEN_MESSAGE: Partial<Record<string, string>> = {
  pending:
    "Bu rezervasyonun ödemesi henüz alınmadı. Ödeme gelince kendiliğinden onaylanır; elle onaylanmaz.",
  none: "Bu talep ön ödeme açılmadan önce köşkte ödenecek diye alınmış. Ödemesi alınmamış rezervasyon onaylanmaz: müşteriyi arayıp online rezervasyon yapmasını iste ve bu talebi iptal et.",
  refunding:
    "Bu rezervasyonun iadesi bu arada başladı; onaylanmaz. Sayfayı yenileyip durumuna bak.",
};

/** Onayla on an evening that is already over (karar D7). */
const EVENING_OVER =
  "Bu rezervasyonun saati geçti; geçmiş bir rezervasyon onaylanmaz. Müşteri gelmediyse iptal et.";

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

const CauseSchema = z.enum(KARAOKE_CANCEL_CAUSES, {
  error: "İptal nedenini listeden seç.",
});
const ChannelSchema = z.enum(KARAOKE_REQUEST_CHANNELS, {
  error: "Misafirin isteği nereden geldi? Telefon ya da e-posta seç.",
});

const MSG_REQUEST_FUTURE = "İstek anı ileri bir saat olamaz.";
const MSG_REQUEST_BEFORE_BOOKING =
  "İstek anı rezervasyonun yapıldığı andan önce olamaz.";
const MSG_REQUEST_UNREADABLE =
  "İstek anını tarih ve saat olarak gir (ör. 30.10.2026 18:00).";

/**
 * "30.10.2026 18:00" (the refusal's own example, and how staff write a time)
 * as the `datetime-local` shape `parsePublishInstant` reads; anything else
 * passes through untouched. A day the month does not have stays unreadable
 * (`Date.parse` would roll 31.09 over into October).
 */
function fromTurkishInstant(typed: string): string {
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2})$/.exec(typed);
  if (!m) return typed;
  const [, d, mo, y, hh, mi] = m;
  const day = Number(d);
  const month = Number(mo);
  const days = new Date(Date.UTC(Number(y), month, 0)).getUTCDate();
  if (month < 1 || month > 12 || day < 1 || day > days) return "";
  if (Number(hh) > 23) return "";
  const two = (v: string) => v.padStart(2, "0");
  return `${y}-${two(mo)}-${two(d)}T${two(hh)}:${mi}`;
}

type StaffCancelInput =
  | { cause: Exclude<KaraokeCancelCause, "misafir"> }
  | {
      cause: "misafir";
      channel: KaraokeRequestChannel;
      requestedAt: Date;
      fullRefund: boolean;
    };

const MINUTE_MS = 60_000;

/**
 * A paid booking's cancel says why (ASK-OTH-3 (c), ASK-Y3-4 (c)): one code
 * from the fixed list; for a guest's request also the channel and the
 * instant it came in. The instant is the köşk's wall clock from the
 * dialog's `datetime-local` (`parsePublishInstant`, rule 22), now when left
 * empty; it may not lie ahead, nor before the booking was made (both at the
 * minute the field can say). The free-text note stays the separate
 * `reason`.
 */
function readStaffCancel(
  formData: FormData,
  createdAt: string,
  now: Date,
): { ok: true; input: StaffCancelInput } | { ok: false; result: ActionResult } {
  const refuse = (field: string, message: string) => ({
    ok: false as const,
    result: actionError(message, { [field]: message }),
  });
  const cause = CauseSchema.safeParse(formData.get("neden"));
  if (!cause.success) {
    return refuse(
      "neden",
      cause.error.issues[0]?.message ?? "İptal nedenini seç.",
    );
  }
  if (cause.data !== "misafir")
    return { ok: true, input: { cause: cause.data } };
  const channel = ChannelSchema.safeParse(formData.get("kanal"));
  if (!channel.success) {
    return refuse("kanal", channel.error.issues[0]?.message ?? "Kanal seç.");
  }
  const raw = formData.get("istekAni");
  const typed = typeof raw === "string" ? raw.trim() : "";
  let requestedAt = now;
  if (typed) {
    const at = parsePublishInstant(fromTurkishInstant(typed));
    if (at === null) return refuse("istekAni", MSG_REQUEST_UNREADABLE);
    requestedAt = new Date(at);
  }
  // The field holds whole minutes: a request typed for the current minute is
  // "now", and one in the minute the booking was made is not "before" it.
  const minuteOf = (ms: number) => Math.floor(ms / MINUTE_MS) * MINUTE_MS;
  if (minuteOf(requestedAt.getTime()) > minuteOf(now.getTime())) {
    return refuse("istekAni", MSG_REQUEST_FUTURE);
  }
  const made = Date.parse(createdAt);
  if (
    Number.isFinite(made) &&
    minuteOf(requestedAt.getTime()) < minuteOf(made)
  ) {
    return refuse("istekAni", MSG_REQUEST_BEFORE_BOOKING);
  }
  // A request typed later than now within the same minute reads as now.
  if (requestedAt.getTime() > now.getTime()) requestedAt = now;
  return {
    ok: true,
    input: {
      cause: "misafir",
      channel: channel.data,
      requestedAt,
      fullRefund: formData.get("tamIade") === "on",
    },
  };
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
  // The panel offers no Onayla once the evening is over; a hand-made POST
  // gets the same answer, and the customer no confirmation mail for an
  // evening already gone (admin audit KAR-13). Checked here, not in
  // setReservationStatus: a payment's own confirmation goes through that too.
  const current = await getReservation(id);
  if (!current) return actionError(FAILURE_MESSAGE.not_found);
  if (karaokeEndInstant(current).getTime() <= Date.now()) {
    revalidate(id);
    return actionError(EVENING_OVER);
  }
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
    // Personel cannot take the refund route the sentence points at.
    return actionError(canRefund ? PAID_MEANWHILE : REFUND_FORBIDDEN);
  }
  // A paid booking's cancel says why; the guest's mail opens with it.
  const now = new Date();
  let staff: StaffCancelInput | null = null;
  if (expectsRefund) {
    const read = readStaffCancel(formData, current.createdAt, now);
    if (!read.ok) return read.result;
    staff = read.input;
  }

  const result = await cancelKaraokeReservation(id, {
    kind: "staff",
    actor: session.email,
    // Only the refund dialog may send money back. An unpaid hold the POS
    // turns out to have been paid for stops here instead (refund_forbidden).
    canRefund: canRefund && expectsRefund,
    ...(reason.reason ? { reason: reason.reason } : {}),
    ...(staff ?? {}),
  });
  revalidate(id);
  if (!result.ok) {
    if (result.reason === "refund_forbidden" && canRefund && !expectsRefund) {
      return actionError(PAID_MEANWHILE);
    }
    const detail = result.message ? ` (${result.message})` : "";
    return actionError(`${CANCEL_MESSAGE[result.reason]}${detail}`);
  }
  if (result.kept && result.silent) {
    return actionOk(
      "İstek kaydedildi. Ücretsiz iptal süresi geçmişti ve rezervasyonun kuralı geç iptalde iade vermiyor: rezervasyon iptal edilmedi. Saati geçtiği için misafire e-posta gönderilmedi.",
    );
  }
  if (result.silent) {
    return actionOk(
      "Rezervasyon iptal edildi. Saati geçtiği için müşteriye e-posta gönderilmedi.",
    );
  }
  if (result.kept) {
    return okWithNotice(
      "İstek kaydedildi. Ücretsiz iptal süresi geçmişti ve rezervasyonun kuralı geç iptalde iade vermiyor: rezervasyon iptal edilmedi, misafirin adına duruyor.",
      result.notified,
      recipient(result.reservation),
    );
  }
  const done = result.refunded
    ? "Rezervasyon iptal edildi ve ödeme karta iade edildi."
    : result.refundOwedMinor
      ? `Rezervasyon iptal edildi. Kurala göre ${formatTRYMinor(result.refundOwedMinor)} iade edilecek: PayNkolay panelinden iade edip "Elle iade edildi" ile kaydet.`
      : "Rezervasyon iptal edildi.";
  const answer = okWithNotice(
    done,
    result.notified,
    recipient(result.reservation),
  );
  // Under 24 hours, a business cancel also calls (karaoke terms §8).
  if (
    answer.ok &&
    isBusinessCause(staff?.cause) &&
    needsCallHint(current, now)
  ) {
    return { ...answer, message: `${answer.message} ${KARAOKE_CALL_HINT}` };
  }
  return answer;
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
          : result.reason === "by_hand"
            ? 'Bu geç iptalin iadesi ödemenin bir kısmı; POS kısmi iade yapamıyor. Tutarı PayNkolay panelinden iade et, sonra "Elle iade edildi" ile kaydet.'
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
      // `raced`: the row moved under this call (a refund under way, another
      // person's settle) and nothing was recorded; it does not say which.
      result.reason === "raced"
        ? "Bu rezervasyonu az önce başka biri değiştirdi, iade kaydedilmedi. Sayfayı yenileyip durumuna bak."
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
