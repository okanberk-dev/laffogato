import Link from "next/link";

import { kdvIncludedParts } from "@/components/laffogato/kdv-note";
import { karaokeInstantLabel } from "@/components/laffogato/karaoke-terms";
import {
  formatReservationDate,
  formatReservationTime,
} from "@/lib/mobile/karaoke-format";
import {
  isPartialRefund,
  karaokeCancelDeadline,
  karaokeLateRefundMinor,
  karaokeRulesOf,
  karaokeSelfCancelTerms,
  karaokeStartInstant,
  keptWholeOnLateCancel,
  mayReopenPayment,
  refundAmountOf,
} from "@/lib/mobile/karaoke-time";
import { priceLabel } from "@/lib/utils/format";

/**
 * One karaoke booking, as its owner sees it: the member from "Karaoke
 * rezervasyonlarım", a guest from the signed link in their e-mail.
 *
 * The cancel action is deliberately quiet (operator, 16 Eki 2026: "iptali
 * zorlaştırabilirsin biraz silinik vs. gibi"): a muted text link at the very
 * bottom, then a separate step that says what happens to the money under the
 * booking's own rule (its snapshot: the sentences it was shown, its
 * deadline, its late share), then the confirm. Nothing on this page decides
 * anything: the actions it posts to check ownership, the rule and the POS
 * again (karaoke-payment.ts `cancelKaraokeReservation`).
 *
 * A server component with no data access of its own (CLAUDE.md: the caller
 * reads, the component renders).
 */

export interface KaraokeViewReservation {
  id: string;
  date: string;
  startHour: number;
  hours: number;
  guests: number;
  status: "requested" | "confirmed" | "cancelled";
  paymentStatus: string;
  priceMinor: number;
  discountMinor: number;
  totalMinor: number;
  paidMinor?: number;
  createdAt: string;
  customerName: string;
  note?: string;
  /** The karaoke KDV rate at booking time; null or absent on older bookings. */
  taxRatePct?: number | null;
  /**
   * The cancellation policy the booking was made under and what it showed
   * (karaoke-core `KaraokeReservation`); null or absent on older bookings,
   * which read as the default rule.
   */
  freeCancelHours?: number | null;
  lateRefundPercent?: number | null;
  cancelDeadline?: string | null;
  cancellationRules?: string[] | null;
  /** A late cancel's share, owed or refunded; null: the whole payment. */
  refundMinor?: number | null;
  /** A free hour the köşk gave to make good its late cancel of this code. */
  makeGoodFor?: string | null;
}

export type KaraokeViewNotice = { tone: "ok" | "warn" | "error"; text: string };

const PAYMENT_LABEL: Record<string, string> = {
  none: "Ödeme köşkte",
  pending: "Ödeme bekleniyor",
  paid: "Ödendi",
  refunding: "İade sonucu bekleniyor",
  refunded: "İade edildi",
  expired: "Ödenmedi, süresi doldu",
};

export function karaokeStatusLine(r: {
  status: string;
  paymentStatus: string;
  paidMinor?: number;
  refundMinor?: number | null;
}): { label: string; tone: string } {
  if (r.status === "cancelled") {
    // A late cancel that kept the payment and put the hours on sale: nothing
    // went back (yet), so "iade edildi" would not be true.
    if (keptWholeOnLateCancel(r)) {
      return { label: "İptal edildi, saat satışa açıldı", tone: "cancelled" };
    }
    return r.paymentStatus === "refunded"
      ? { label: "İptal edildi, iade edildi", tone: "refunded" }
      : r.paymentStatus === "expired"
        ? { label: "Ödenmediği için düştü", tone: "cancelled" }
        : { label: "İptal edildi", tone: "cancelled" };
  }
  if (r.status === "confirmed") return { label: "Kesinleşti", tone: "paid" };
  if (r.paymentStatus === "pending") {
    return { label: "Ödeme bekleniyor", tone: "pending_payment" };
  }
  return { label: "Onay bekliyor", tone: "pending_payment" };
}

/**
 * What a cancel by the booking's owner would do right now, as the server
 * does it (`cancelKaraokeReservation`): refused, nothing to refund, the
 * whole payment back, or the late share, which a person refunds by hand
 * (PayNkolay refunds whole payments only, operator decision D9). Only a
 * confirmed booking keeps a share: one the köşk never confirmed goes back in
 * full, and so does a share that rounds to nothing or to all of it.
 */
export type KaraokeCancelOutcome =
  | { kind: "refused" }
  | { kind: "nothing" }
  | { kind: "full"; amountMinor: number }
  | { kind: "share"; amountMinor: number };

export function karaokeCancelOutcome(
  r: KaraokeViewReservation,
  now: Date,
): KaraokeCancelOutcome {
  const terms = karaokeSelfCancelTerms(r, now);
  if (terms.kind === "refused") return { kind: "refused" };
  if (r.paymentStatus !== "paid") return { kind: "nothing" };
  const paid = r.paidMinor && r.paidMinor > 0 ? r.paidMinor : r.totalMinor;
  if (
    terms.kind === "late" &&
    terms.percent < 100 &&
    r.status === "confirmed"
  ) {
    const owed = karaokeLateRefundMinor(paid, terms.percent);
    if (owed > 0 && owed < paid) return { kind: "share", amountMinor: owed };
  }
  return { kind: "full", amountMinor: paid };
}

export function KaraokeReservationView({
  r,
  now,
  hidden,
  cancelAction,
  payAction,
  cancelHref,
  backHref,
  confirming,
  notice,
  contractHref,
}: {
  r: KaraokeViewReservation;
  now: Date;
  /** What identifies the booking to the actions: `{ id }` or `{ t }`. */
  hidden: Record<string, string>;
  cancelAction: (formData: FormData) => Promise<void>;
  payAction: (formData: FormData) => Promise<void>;
  /** This page with the cancel step open. */
  cancelHref: string;
  /** This page with it closed. */
  backHref: string;
  confirming: boolean;
  notice?: KaraokeViewNotice;
  /**
   * The confirmed terms as a file (ASK-DURABLE), for a paid booking whose
   * consent recorded its text: the signed-link download. Absent: no link.
   */
  contractHref?: string;
}) {
  const state = karaokeStatusLine(r);
  const live = r.status !== "cancelled";
  const moneyOpen =
    r.paymentStatus === "none" ||
    r.paymentStatus === "pending" ||
    r.paymentStatus === "paid";
  const cancellable = live && moneyOpen;
  // The booking's own rule: the two sentences it was shown at booking.
  const [refundRule, lateRule] = karaokeRulesOf(r);
  const terms = karaokeSelfCancelTerms(r, now);
  const outcome = karaokeCancelOutcome(r, now);
  const deadline = karaokeCancelDeadline(r);
  // The rate the booking was made at; older bookings kept none, and then
  // only the words are printed.
  const kdv = kdvIncludedParts(r.totalMinor, r.taxRatePct);
  const canPay =
    live &&
    r.paymentStatus === "pending" &&
    r.totalMinor > 0 &&
    mayReopenPayment(r, now);
  const fields = Object.entries(hidden).map(([name, value]) => (
    <input key={name} type="hidden" name={name} value={value} />
  ));

  return (
    <div className="karaoke-mine">
      {notice ? (
        <p
          role={notice.tone === "error" ? "alert" : "status"}
          className={`karaoke-mine-notice karaoke-mine-notice--${notice.tone}`}
        >
          {notice.text}
        </p>
      ) : null}

      <div className="karaoke-mine-head">
        <span className="karaoke-mine-code">{r.id.toUpperCase()}</span>
        <span className="status-chip" data-tone={state.tone}>
          {state.label}
        </span>
      </div>

      <dl className="karaoke-mine-grid">
        <div>
          <dt>Tarih</dt>
          <dd>{formatReservationDate(r.date)}</dd>
        </div>
        <div>
          <dt>Saat</dt>
          <dd>{formatReservationTime(r.startHour, r.hours)}</dd>
        </div>
        <div>
          <dt>Süre</dt>
          <dd>{r.hours} saat</dd>
        </div>
        <div>
          <dt>Kişi</dt>
          <dd>{r.guests} kişi</dd>
        </div>
        <div>
          <dt>Toplam</dt>
          <dd>
            {priceLabel(r.totalMinor)}
            {r.discountMinor > 0 ? (
              <span className="karaoke-mine-sub">
                {" "}
                ({priceLabel(r.priceMinor)} - indirim{" "}
                {priceLabel(r.discountMinor)})
              </span>
            ) : null}
            <span className="karaoke-mine-kdv">
              <span className="kdv-part">{kdv.rate}</span>
              {kdv.amount ? (
                <>
                  {" "}
                  <span className="kdv-part">({kdv.amount})</span>
                </>
              ) : null}
            </span>
          </dd>
        </div>
        <div>
          <dt>Ödeme</dt>
          <dd>
            {r.makeGoodFor && r.paymentStatus === "none"
              ? "Telafi saati, senden ödeme alınmaz"
              : keptWholeOnLateCancel(r)
                ? "Ödendi, iade yapılmadı"
                : (PAYMENT_LABEL[r.paymentStatus] ?? r.paymentStatus)}
          </dd>
        </div>
        {keptWholeOnLateCancel(r) ? (
          <div>
            {/* A late request under a late share of 0 (karaoke terms §7,
                29 Eki 2026): the hours are on sale, and a resold one
                refunds what was paid for it. */}
            <dt>İade</dt>
            <dd>
              Ücretsiz iptal süren geçtiği için ücret iadesi yapılmadı.
              Saatlerin yeniden satışa açıldı; biri başka bir misafire satılırsa
              o saat için ödediğin tutar en geç 14 gün içinde kartına iade
              edilir ve sana e-postayla haber veririz.
            </dd>
          </div>
        ) : r.status === "cancelled" && isPartialRefund(r) ? (
          <div>
            {/* A late cancel's share (karar D9): what goes back, not the
                whole payment. */}
            <dt>Geç iptal iadesi</dt>
            <dd>
              {priceLabel(refundAmountOf(r))}
              {r.paymentStatus === "refunding" ? (
                <span className="karaoke-mine-kdv">
                  Ekibimiz kartına iade edince e-postayla haber veririz.
                </span>
              ) : null}
            </dd>
          </div>
        ) : null}
      </dl>

      {canPay ? (
        <form action={payAction} className="karaoke-mine-pay">
          {fields}
          <p>Ödemen alınmadı; ödeyince rezervasyon kesinleşir.</p>
          <button type="submit" className="btn btn-primary">
            Ödemeyi tamamla
          </button>
        </form>
      ) : null}

      {live ? (
        <div className="karaoke-mine-rules">
          <p>{refundRule}</p>
          <p>{lateRule}</p>
          {terms.kind === "full" ? (
            <p className="karaoke-mine-sub">
              Ücretsiz iptal için son an: {karaokeInstantLabel(deadline)}.
            </p>
          ) : null}
        </div>
      ) : null}

      {contractHref ? (
        <p className="karaoke-mine-sub">
          {/* A file, not a page: a plain link, never prefetched. */}
          <a href={contractHref} download>
            Onayladığın sözleşmenin metnini indir
          </a>
        </p>
      ) : null}

      {cancellable && confirming ? (
        <section
          className="karaoke-mine-confirm"
          aria-labelledby="karaoke-cancel-title"
        >
          <h3 id="karaoke-cancel-title" className="h4">
            Rezervasyonu iptal etmek üzeresin
          </h3>
          {outcome.kind !== "refused" ? (
            <>
              <p>{terms.kind === "full" ? refundRule : lateRule}</p>
              <p className="karaoke-mine-outcome">
                {outcome.kind === "full"
                  ? `Şimdi iptal edersen ödediğin ${priceLabel(outcome.amountMinor)} kartına iade edilir; yansıması bankana göre birkaç iş günü sürebilir.`
                  : outcome.kind === "share"
                    ? `Şimdi iptal edersen rezervasyonundaki geç iptal kuralına göre ${priceLabel(outcome.amountMinor)} kartına iade edilir. İadeyi ekibimiz yapar; yapılınca sana e-postayla haber veririz.`
                    : "Ödeme alınmadığı için iade edilecek tutar yok; saat başkasına açılır."}
              </p>
              <form action={cancelAction} className="karaoke-mine-confirm-row">
                {fields}
                <input type="hidden" name="confirm" value="yes" />
                <button type="submit" className="btn btn-ghost btn-sm">
                  Evet, iptal et
                </button>
                <Link href={backHref} className="btn btn-primary btn-sm">
                  Vazgeç, rezervasyonum kalsın
                </Link>
              </form>
            </>
          ) : (
            <>
              <p className="karaoke-mine-outcome">{lateRule}</p>
              <p>Artık buradan iptal edemezsin; sorun varsa bizi ara.</p>
              {/* The way out a no-refund rule leaves (legal program, Y3-4). */}
              <p>
                Gelemeyeceksen rezervasyon kodunu bir başkasına verebilirsin;
                odayı o kullanır.
              </p>
              {/* Karaoke terms §7 (29 Eki 2026): told before the start, the
                  köşk cancels and puts the hours back on sale. A free make-
                  good hour has its own rule and no money to give back. */}
              {!r.makeGoodFor &&
              now.getTime() <
                karaokeStartInstant(r.date, r.startHour).getTime() ? (
                <p>
                  Ya da rezervasyon saatinden önce bizi arayıp ya da yazıp
                  gelemeyeceğini söyle: rezervasyonunu iptal eder, saatlerini
                  yeniden satışa açarız. Ücret iadesi yapılmaz, ama saatlerinden
                  biri başka bir misafire satılırsa o saat için ödediğin tutar
                  kartına iade edilir.
                </p>
              ) : null}
              <Link href={backHref} className="btn btn-primary btn-sm">
                Geri dön
              </Link>
            </>
          )}
        </section>
      ) : null}

      {cancellable && !confirming ? (
        <p className="karaoke-mine-quiet">
          <Link href={cancelHref} className="karaoke-mine-cancel">
            Rezervasyonu iptal et
          </Link>
        </p>
      ) : null}
    </div>
  );
}
