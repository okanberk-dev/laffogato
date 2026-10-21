// Pure half of the web account-deletion request: the rules and the words.
// NO "server-only", NO database - the member page, the panel and the tests
// all read these, and the server half (`deletion-request.ts`) only moves rows.

import { istanbulDayLabel } from "@/lib/legal/consent-version";
import {
  formatReservationDate,
  formatReservationTime,
} from "@/lib/mobile/karaoke-format";
import {
  closureRefundPercent,
  karaokeStartInstant,
} from "@/lib/mobile/karaoke-time";

/**
 * On the web an account is deleted by the team, on the member's request
 * (operator, 18 Eki 2026: "hesabı silme sadece bize ulaşarak olsun"). The
 * app keeps its immediate in-app deletion (`DELETE /api/mobile/v1/me`):
 * Apple 5.1.1(v) forbids routing a non-regulated app's deletion through
 * customer service, and Google Play wants an in-app path AND a web page to
 * ask for deletion - which /uye/hesap/sil now is.
 *
 * KVKK m.13/2 and the Veri Sorumlusuna Başvuru Tebliği m.6/5: an
 * application is answered "en geç otuz gün içinde ücretsiz olarak"; the
 * Silme Yönetmeliği m.12/1-a has the controller tell the person when it is
 * done. The panel counts the thirty days from the stamp; the team aims for
 * three working days.
 */
export const DELETION_ANSWER_DAYS = 30;

/** What the member may write about why; a sentence or two, not a letter. */
export const DELETION_REASON_MAX = 500;

/** The member page where the request is sent, shown and taken back. */
export const DELETION_REQUEST_PATH = "/uye/hesap/sil";

/** The panel list filtered to open requests (the staff mail's button). */
export const DELETION_ADMIN_PATH = "/admin/musteriler?filter=deletion";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface DeletionRequest {
  /** ISO instant the request was opened. */
  requestedAt: string;
  /** The member's own words; "" when none. */
  reason: string;
}

/**
 * A row's request as the code may trust it: an ISO stamp that parses, or
 * nothing. A hand-edited row with an empty string reads as "no request".
 */
export function deletionRequestOf(row: {
  deletionRequestedAt?: unknown;
  deletionReason?: unknown;
}): DeletionRequest | null {
  const at = row.deletionRequestedAt;
  if (typeof at !== "string" || !Number.isFinite(Date.parse(at))) return null;
  return {
    requestedAt: at,
    reason: typeof row.deletionReason === "string" ? row.deletionReason : "",
  };
}

export type ReasonResult =
  { ok: true; reason: string } | { ok: false; error: string };

/**
 * The reason box, trimmed, its runs of whitespace (line breaks included)
 * folded to one space and control characters dropped. Longer than
 * `DELETION_REASON_MAX` is refused, not cut: the member sees their text
 * kept and the limit named, rather than a request that quietly lost its end.
 */
export function normalizeDeletionReason(raw: unknown): ReasonResult {
  const text = String(raw ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length > DELETION_REASON_MAX) {
    return {
      ok: false,
      error: `Gerekçe en fazla ${DELETION_REASON_MAX} karakter olabilir (şu an ${text.length}).`,
    };
  }
  return { ok: true, reason: text };
}

/** The last day of the answer period, as an ISO instant. */
export function deletionDeadline(requestedAt: string): string {
  const at = Date.parse(requestedAt);
  return new Date(at + DELETION_ANSWER_DAYS * DAY_MS).toISOString();
}

/** Past the thirty days and still open: the panel paints it red. */
export function isDeletionOverdue(
  requestedAt: string,
  now: Date = new Date(),
): boolean {
  return now.getTime() > Date.parse(deletionDeadline(requestedAt));
}

/** "18 Ekim 2026" on the köşk's calendar (rule 22); "" if unreadable. */
export function deletionDayLabel(iso: string): string {
  return istanbulDayLabel(iso) ?? "";
}

/** "e***@ornek.com": enough for the team to recognise, nothing more. */
export function maskedAddress(email: string): string {
  const owner = String(email ?? "")
    .trim()
    .toLowerCase();
  const at = owner.indexOf("@");
  if (at <= 0) return owner ? "***" : "";
  return `${owner.slice(0, 1)}***${owner.slice(at)}`;
}

/** First word of the name, at most 40 characters; "" for none. */
function firstName(full: string): string {
  const first =
    String(full ?? "")
      .trim()
      .split(/\s+/)[0] ?? "";
  if (first.includes("@") || /\d{3,}/.test(first)) return "";
  return first.slice(0, 40);
}

export interface DeletionStaffNoticeInput {
  kind: "opened" | "withdrawn";
  customerId: string;
  name: string;
  email: string;
  requestedAt: string;
  hasReason: boolean;
  /**
   * The member's paid karaoke bookings still to come, by their start
   * (`paidKaraokeAtRequest`): the team closes the account before the first
   * of them. `null`: they could not be read. Filled by the notifier
   * (`notifyStaffOfDeletionRequest`), not by the caller.
   */
  karaoke?: readonly DeletionKaraokeItem[] | null;
}

/** Bookings a staff mail names; the panel lists them all. */
const KARAOKE_ROWS_MAX = 5;

/** The mail's karaoke rows: each booking by its start and its refund. */
function karaokeRows(
  karaoke: readonly DeletionKaraokeItem[] | null | undefined,
): Array<{ label: string; value: string }> {
  if (karaoke === null) {
    return [{ label: "Ödenmiş karaoke", value: "Okunamadı, panelde bak" }];
  }
  const list = karaoke ?? [];
  const rows = list.slice(0, KARAOKE_ROWS_MAX).map((k) => ({
    label: "Ödenmiş karaoke",
    value: `${k.label} (${deletionRefundLabel(k.refundPercent)})`,
  }));
  if (list.length > KARAOKE_ROWS_MAX) {
    rows.push({
      label: "Ödenmiş karaoke",
      value: `${list.length - KARAOKE_ROWS_MAX} rezervasyon daha, panelde`,
    });
  }
  return rows;
}

export interface DeletionStaffNoticeContent {
  subject: string;
  summary: string;
  label: string;
  title: string;
  subtitle: string;
  rows: Array<{ label: string; value: string }>;
  footnote: string;
}

/**
 * The team's mail about a request: the request, and for an opened one the
 * member's paid karaoke bookings with their start, so the account is closed
 * before the first of them (ASK-Y3-4 (d)).
 *
 * Minimal on purpose (KVKK m.4/2-ç ölçülülük): the member number, the first
 * name and a masked address are enough to find the account in the panel,
 * which holds the rest for those allowed to open it. The reason itself is
 * not mailed - only whether one was written; the panel shows it.
 */
export function buildDeletionStaffNotice(
  n: DeletionStaffNoticeInput,
): DeletionStaffNoticeContent {
  const on = deletionDayLabel(n.requestedAt);
  const deadline = deletionDayLabel(deletionDeadline(n.requestedAt));
  const rows = [
    { label: "Üye no", value: n.customerId },
    { label: "Ad", value: firstName(n.name) },
    { label: "E-posta", value: maskedAddress(n.email) },
    { label: "Talep tarihi", value: on },
  ];
  if (n.kind === "withdrawn") {
    return {
      subject: `Hesap silme talebi geri alındı · ${n.customerId}`,
      summary: "Üye hesap silme talebini geri aldı; hesabı silme.",
      label: "ÜYELİK · TALEP GERİ ALINDI",
      title: "Silme talebi geri alındı",
      subtitle: "Üye hesabının açık kalmasını istedi",
      rows,
      footnote:
        "Bu hesabı silme. Üye yeniden isterse yeni bir talep e-postası gelir.",
    };
  }
  const karaoke = karaokeRows(n.karaoke);
  return {
    subject: `Hesap silme talebi · ${n.customerId} · son gün ${deadline}`,
    summary: `Bir üye hesabının silinmesini istedi. Son gün: ${deadline}.`,
    label: "ÜYELİK · SİLME TALEBİ",
    title: "Hesap silme talebi",
    subtitle: `En geç ${deadline} tarihine kadar sonuçlandır (KVKK, 30 gün)`,
    rows: [
      ...rows,
      { label: "Son gün", value: deadline },
      {
        label: "Gerekçe",
        value: n.hasReason ? "Yazdı, panelde" : "Yazmadı",
      },
      ...karaoke,
    ],
    footnote:
      "Hesabı üyenin sayfasındaki Hesabı sil ile kapat; üyeye bilgi e-postası kendiliğinden gider. Devam eden siparişi varsa sipariş bitince kapat." +
      (n.karaoke === null
        ? " Karaoke rezervasyonları okunamadı: kapatmadan önce üyenin sayfasına bak."
        : karaoke.length > 0
          ? " Ödenmiş karaoke rezervasyonu var: hesabı ilk rezervasyonun başlangıç saatinden önce kapat. İade, rezervasyonun kuralına göre talep anındaki hâliyle yapılır."
          : ""),
  };
}

/**
 * Resend's `Idempotency-Key` for one mail about one request: the same
 * request mailed twice (a retry after a timeout) reaches each inbox once.
 */
export function deletionMailKey(
  customerId: string,
  requestedAt: string,
  what: "member" | "staff-opened" | "staff-withdrawn" | "closed",
): string {
  const stamp = String(Date.parse(requestedAt) || 0);
  return `account-deletion-${customerId}-${stamp}-${what}`;
}

/** The fields of a karaoke booking the request card and mail read. */
export interface DeletionKaraokeRow {
  id: string;
  date: string;
  startHour: number;
  hours: number;
  status: string;
  paymentStatus?: string;
  guest?: boolean;
  createdAt?: string;
  // The booking's own cancellation rule (its snapshot, karaoke-time.ts).
  freeCancelHours?: number | null;
  lateRefundPercent?: number | null;
  cancelDeadline?: string | null;
}

export interface DeletionKaraokeItem {
  id: string;
  /** "30 Ekim 2026, 20:00 - 22:00": the day and the start the team races. */
  label: string;
  /**
   * What closing the account gives back, under the booking's rule judged at
   * the request (`closureRefundPercent`): 100 = the whole payment, else the
   * late share in whole %.
   */
  refundPercent: number;
  /**
   * The start came after the request while the rule still refunded it then:
   * closing refunds it unless the room is recorded as used (ASK-Y3-4 (d),
   * `cancelKaraokeForClosedAccount`).
   */
  startedSinceRequest: boolean;
}

/** "tam iade" or "%50 iade": what a closure refunds, in a row or a box. */
export function deletionRefundLabel(percent: number): string {
  return percent >= 100 ? "tam iade" : `%${percent} iade`;
}

/**
 * The member's paid karaoke bookings a deletion request puts on a clock:
 * the ones still to come (close the account before their start and the
 * refund is plain), and the ones whose start came since the request (the
 * closing dialog asks whether the room was used). Each is judged as the
 * closure will judge it: by its own rule at the request, or at the closure
 * (now) when it was booked after the request. Guest bookings are not the
 * account's; a paid evening whose rule refunded nothing at the request is
 * not refunded by the closure either, and is not listed.
 */
export function paidKaraokeAtRequest(
  rows: readonly DeletionKaraokeRow[],
  requestedAt: string,
  now: Date = new Date(),
): DeletionKaraokeItem[] {
  const asked = Date.parse(requestedAt);
  if (!Number.isFinite(asked)) return [];
  const at = new Date(asked);
  return rows
    .filter((r) => !r.guest && r.status !== "cancelled")
    .filter((r) => r.paymentStatus === "paid")
    .map((r) => ({
      r,
      start: karaokeStartInstant(r.date, r.startHour).getTime(),
      percent: closureRefundPercent(r, at, now),
    }))
    .filter(({ percent }) => percent > 0)
    .map((x) => ({ ...x, passed: x.start <= now.getTime() }))
    .sort((a, b) => a.start - b.start)
    .map(({ r, percent, passed }) => ({
      id: r.id,
      label: `${formatReservationDate(r.date)}, ${formatReservationTime(r.startHour, r.hours)}`,
      refundPercent: percent,
      startedSinceRequest: passed,
    }));
}
