import Link from "next/link";

import {
  formatReservationDate,
  formatReservationTime,
} from "@/lib/mobile/karaoke-format";
import {
  KARAOKE_NO_REFUND_RULE,
  KARAOKE_REFUND_RULE,
  istanbulTimeLabel,
  karaokeCancelDeadline,
  mayReopenPayment,
  withinFreeCancel,
} from "@/lib/mobile/karaoke-time";
import { priceLabel } from "@/lib/utils/format";

/**
 * One karaoke booking, as its owner sees it: the member from "Karaoke
 * rezervasyonlarım", a guest from the signed link in their e-mail.
 *
 * The cancel action is deliberately quiet (operator, 16 Eki 2026: "iptali
 * zorlaştırabilirsin biraz silinik vs. gibi"): a muted text link at the very
 * bottom, then a separate step that says what happens to the money under the
 * two-hour rule, in the operator's words, then the confirm. Nothing on this
 * page decides anything: the actions it posts to check ownership, the rule
 * and the POS again (karaoke-payment.ts `cancelKaraokeReservation`).
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
}): { label: string; tone: string } {
  if (r.status === "cancelled") {
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
}) {
  const state = karaokeStatusLine(r);
  const live = r.status !== "cancelled";
  const moneyOpen =
    r.paymentStatus === "none" ||
    r.paymentStatus === "pending" ||
    r.paymentStatus === "paid";
  const cancellable = live && moneyOpen;
  const inWindow = withinFreeCancel(r, now);
  const deadline = karaokeCancelDeadline(r);
  const canPay =
    live &&
    r.paymentStatus === "pending" &&
    r.totalMinor > 0 &&
    mayReopenPayment(r, now);
  const paid = r.paidMinor && r.paidMinor > 0 ? r.paidMinor : r.totalMinor;
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
          {/* The rate the booking was made at; older bookings kept none. */}
          <dt>
            Toplam (
            {typeof r.taxRatePct === "number"
              ? `%${r.taxRatePct} KDV dahil`
              : "KDV dahil"}
            )
          </dt>
          <dd>
            {priceLabel(r.totalMinor)}
            {r.discountMinor > 0 ? (
              <span className="karaoke-mine-sub">
                {" "}
                ({priceLabel(r.priceMinor)} - indirim{" "}
                {priceLabel(r.discountMinor)})
              </span>
            ) : null}
          </dd>
        </div>
        <div>
          <dt>Ödeme</dt>
          <dd>{PAYMENT_LABEL[r.paymentStatus] ?? r.paymentStatus}</dd>
        </div>
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
          <p>{KARAOKE_REFUND_RULE}</p>
          <p>{KARAOKE_NO_REFUND_RULE}</p>
          {inWindow ? (
            <p className="karaoke-mine-sub">
              Ücretsiz iptal için son an: {formatReservationDate(r.date)}{" "}
              {istanbulTimeLabel(deadline.toISOString())} öncesi.
            </p>
          ) : null}
        </div>
      ) : null}

      {cancellable && confirming ? (
        <section
          className="karaoke-mine-confirm"
          aria-labelledby="karaoke-cancel-title"
        >
          <h3 id="karaoke-cancel-title" className="h4">
            Rezervasyonu iptal etmek üzeresin
          </h3>
          {inWindow ? (
            <>
              <p>{KARAOKE_REFUND_RULE}</p>
              <p className="karaoke-mine-outcome">
                {r.paymentStatus === "paid"
                  ? `Şimdi iptal edersen ödediğin ${priceLabel(paid)} kartına iade edilir; yansıması bankana göre birkaç iş günü sürebilir.`
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
              <p className="karaoke-mine-outcome">{KARAOKE_NO_REFUND_RULE}</p>
              <p>Artık buradan iptal edemezsin; sorun varsa bizi ara.</p>
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
