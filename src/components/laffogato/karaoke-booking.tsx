"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import {
  bookKaraokeAction,
  type BookKaraokeState,
} from "@/app/karaoke/actions";
import { PageHero } from "./page-hero";
// Type-only: karaoke-core builds Zod schemas at load, and a value import from
// it ships all of Zod to the browser. The quote maths comes from the
// dependency-free module instead.
import type { KaraokeAvailability } from "@/lib/mobile/karaoke-core";
import {
  formatReservationDate,
  formatReservationTime,
  hourFromLabel,
} from "@/lib/mobile/karaoke-format";
import {
  karaokeDiscountPctFor,
  quoteKaraoke,
} from "@/lib/mobile/karaoke-quote";
import {
  KARAOKE_BUSINESS_CANCEL,
  KARAOKE_NO_REFUND_RULE,
  KARAOKE_NO_WITHDRAWAL,
  KARAOKE_PAYMENT_PAGE_MINUTES,
  KARAOKE_REFUND_RULE,
} from "@/lib/mobile/karaoke-time";
import { priceLabel } from "@/lib/utils/format";

const DAY_NAMES = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cts"];

/** "2026-09-08" → "Pzt 8 Eyl", with today and tomorrow named. */
function dayLabel(date: string, today: string, tomorrow: string): string {
  if (date === today) return "Bugün";
  if (date === tomorrow) return "Yarın";
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const month = new Intl.DateTimeFormat("tr-TR", {
    month: "short",
    timeZone: "UTC",
  }).format(dt);
  return `${DAY_NAMES[dt.getUTCDay()]} ${d} ${month}`;
}

const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`;

export interface KaraokeBookingProps {
  /** The bookable window, as Istanbul calendar days. */
  days: string[];
  date: string;
  availability: KaraokeAvailability | null;
  /** True when the calendar could not be read at all. */
  unavailable: boolean;
  capacity: number;
  hourlyMinor: number;
  tier: string | null;
  tierLabel: string | null;
  isAuthenticated: boolean;
  emailVerified: boolean;
  phone: string;
  /** The köşk's address, printed in the pre-payment box (MSY m.5/1-c). */
  address: string;
  /**
   * Online prepayment is on (`settings.karaokePrepay`): the booking is paid
   * right away, confirmed by its payment, and open to guests without an
   * account. Off: the old request flow, members only, paid at the venue.
   */
  prepay: boolean;
  /** The signed-in member's details, to prefill the contact block. */
  contact?: { name: string; email: string; phone: string };
}

/** The three boxes before a paid booking; each its own, never pre-ticked. */
interface KaraokeTicks {
  preInfo: boolean;
  contract: boolean;
  kvkk: boolean;
}

export function KaraokeBooking({
  days,
  date,
  availability,
  unavailable,
  capacity,
  hourlyMinor,
  tier,
  tierLabel,
  isAuthenticated,
  emailVerified,
  phone,
  address,
  prepay,
  contact,
}: KaraokeBookingProps) {
  const slots = availability?.slots ?? [];
  const firstFree = slots.find((s) => s.available)?.startHour;
  const [startHour, setStartHour] = useState<number | null>(firstFree ?? null);
  const [hours, setHours] = useState(1);
  const [guests, setGuests] = useState(Math.min(4, capacity));
  const [note, setNote] = useState("");
  const [ticks, setTicks] = useState<KaraokeTicks>({
    preInfo: false,
    contract: false,
    kvkk: false,
  });
  const tick = (key: keyof KaraokeTicks) => (ticked: boolean) =>
    setTicks((t) => ({ ...t, [key]: ticked }));
  // Who may submit: a verified member, or - with prepayment on - anyone,
  // who then types their own contact details.
  const guest = !isAuthenticated && prepay;
  const canBook = (isAuthenticated && emailVerified) || guest;
  const ticked = prepay
    ? ticks.preInfo && ticks.contract && ticks.kvkk
    : ticks.kvkk;
  const [state, formAction, pending] = useActionState<
    BookKaraokeState,
    FormData
  >(bookKaraokeAction, {});

  const maxHours = availability?.maxHours ?? 3;
  const hourly = availability?.hourlyMinor ?? hourlyMinor;
  const discountPct = karaokeDiscountPctFor(
    tier,
    availability?.oroDiscountPct ?? 15,
  );

  const quote = useMemo(
    () => quoteKaraoke(hours, hourly, tier, availability?.oroDiscountPct ?? 15),
    [hours, hourly, tier, availability?.oroDiscountPct],
  );

  /** A block is bookable only if every hour in it is free. */
  const blockIsFree = (start: number, len: number) =>
    Array.from({ length: len }, (_, i) => start + i).every((h) =>
      slots.some((s) => s.startHour === h && s.available),
    );

  const today = days[0];
  const tomorrow = days[1];
  const selectionValid =
    startHour !== null && blockIsFree(startHour, hours) && !unavailable;

  if (state.booked) {
    return (
      <div className="wrap karaoke-page">
        <div className="karaoke-done">
          <div className="eyebrow">Karaoke · rezervasyon alındı</div>
          <h1 className="h1" style={{ marginTop: 14 }}>
            Görüşmek üzere
          </h1>
          <p className="lede" style={{ marginTop: 16 }}>
            {dayLabel(state.booked.date, today, tomorrow)} ·{" "}
            {hourLabel(state.booked.startHour)} · {state.booked.hours} saat ·{" "}
            {state.booked.guests} kişi. Ekibimiz onaylayınca haber veririz;
            ödemeyi köşkte yaparsın.
          </p>
          <div className="cta-row">
            <Link href="/uye/hesap" className="btn btn-primary">
              Hesabıma git
              <span className="arrow">→</span>
            </Link>
            <Link href="/" className="btn btn-ghost">
              Anasayfa
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="karaoke-page">
      <PageHero
        scene="berry"
        eyebrow="Karaoke · köşkün üst katı"
        title={["Özel oda,", "gece 24:00’e kadar"]}
        lede={
          prepay
            ? `${capacity} kişilik oda. Saatini seç, kartınla öde; rezervasyonun hemen kesinleşir.`
            : `${capacity} kişilik oda. Saatini seç, isteğini gönder.`
        }
      />
      <div className="wrap">
        <form action={formAction} className="karaoke-layout">
          <div className="karaoke-picker">
            <input type="hidden" name="date" value={date} />
            <input type="hidden" name="startHour" value={startHour ?? ""} />
            <input type="hidden" name="hours" value={hours} />
            <input type="hidden" name="guests" value={guests} />
            <input type="hidden" name="note" value={note} />

            <div>
              <span className="eyebrow muted">Gün</span>
              <div className="karaoke-days scroller">
                {days.map((d) => (
                  <a
                    key={d}
                    /* The day is a server round-trip: picking one re-reads the
                     real calendar rather than trusting a snapshot. */
                    href={`/karaoke?tarih=${d}`}
                    className={`karaoke-day ${d === date ? "on" : ""}`}
                    aria-current={d === date || undefined}
                  >
                    {dayLabel(d, today, tomorrow)}
                  </a>
                ))}
              </div>
            </div>

            <div>
              <span className="eyebrow muted">Saat</span>
              {unavailable ? (
                <p className="karaoke-warn">
                  Takvime şu an ulaşamıyoruz. Biraz sonra tekrar dene ya da bizi
                  ara: {phone}.
                </p>
              ) : slots.length === 0 ? (
                <p className="karaoke-warn">
                  Bu gün boş saat kalmadı. Başka bir gün seç.
                </p>
              ) : (
                <div className="karaoke-hours">
                  {slots.map((s) => {
                    const taken = !s.available;
                    const on = startHour === s.startHour;
                    return (
                      <button
                        key={s.startHour}
                        type="button"
                        className={`karaoke-hour ${on ? "on" : ""} ${taken ? "taken" : ""}`}
                        disabled={taken}
                        aria-pressed={on}
                        onClick={() => setStartHour(s.startHour)}
                      >
                        <span className="karaoke-hour-t">
                          {hourLabel(s.startHour)}
                        </span>
                        <span className="karaoke-hour-n">
                          {taken ? "dolu" : "uygun"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <span className="eyebrow muted">Süre</span>
              <div className="karaoke-stepper">
                <button
                  type="button"
                  onClick={() => setHours((h) => Math.max(1, h - 1))}
                  aria-label="Süreyi azalt"
                  className="karaoke-step-down"
                >
                  −
                </button>
                <span className="karaoke-step-value">{hours} saat</span>
                <button
                  type="button"
                  onClick={() => setHours((h) => Math.min(maxHours, h + 1))}
                  aria-label="Süreyi artır"
                  className="karaoke-step-up"
                >
                  +
                </button>
              </div>
              {startHour !== null && !blockIsFree(startHour, hours) && (
                <div className="karaoke-hint karaoke-hint-warn">
                  {hourFromLabel(startHour)} itibaren {hours} saat boş değil.
                  Süreyi kısalt ya da başka saat seç.
                </div>
              )}
            </div>

            <div>
              <span className="eyebrow muted">Kişi</span>
              <div className="karaoke-stepper">
                <button
                  type="button"
                  onClick={() => setGuests((g) => Math.max(1, g - 1))}
                  aria-label="Kişi azalt"
                  className="karaoke-step-down"
                >
                  −
                </button>
                <span className="karaoke-step-value">{guests} kişi</span>
                <button
                  type="button"
                  onClick={() => setGuests((g) => Math.min(capacity, g + 1))}
                  aria-label="Kişi artır"
                  className="karaoke-step-up"
                >
                  +
                </button>
              </div>
              <div className="karaoke-hint">
                En fazla {capacity} kişi. Daha kalabalık gruplar için ara:{" "}
                {phone}.
              </div>
            </div>

            {isAuthenticated && emailVerified && (
              <fieldset className="karaoke-contact">
                <legend className="eyebrow muted">İletişim</legend>
                {/* A member's details are already on the account - shown, not
                    asked again. Only a missing phone opens a field. */}
                <input
                  type="hidden"
                  name="contactName"
                  value={contact?.name ?? ""}
                />
                <input
                  type="hidden"
                  name="contactEmail"
                  value={contact?.email ?? ""}
                />
                {contact?.phone ? (
                  <input
                    type="hidden"
                    name="contactPhone"
                    value={contact.phone}
                  />
                ) : null}
                <div className="karaoke-contact-card">
                  <span className="karaoke-contact-name">
                    {contact?.name || "Üye"}
                  </span>
                  <span className="karaoke-contact-line">
                    {contact?.email}
                    {contact?.phone ? ` · ${contact.phone}` : ""}
                  </span>
                  <Link
                    href="/uye/hesap/bilgilerim"
                    className="karaoke-contact-edit"
                  >
                    Düzenle
                  </Link>
                </div>
                {!contact?.phone && (
                  <label className="karaoke-field">
                    <span>Cep telefonu</span>
                    <input
                      className="input"
                      name="contactPhone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="0532 123 45 67"
                      required
                    />
                  </label>
                )}
              </fieldset>
            )}

            {guest && (
              <fieldset className="karaoke-contact">
                <legend className="eyebrow muted">İletişim</legend>
                <p className="karaoke-hint" style={{ marginTop: 0 }}>
                  Hesap açılmaz; rezervasyon bağlantın e-postana gelir.{" "}
                  <a
                    href={`/uye/giris?next=${encodeURIComponent(`/karaoke?tarih=${date}`)}`}
                    className="karaoke-link"
                  >
                    Üyeysen giriş yap
                  </a>
                  .
                </p>
                <div className="karaoke-guest-grid">
                  <label className="karaoke-field">
                    <span>Ad</span>
                    <input
                      className="input"
                      name="guestFirstName"
                      autoComplete="given-name"
                      maxLength={60}
                      required
                    />
                  </label>
                  <label className="karaoke-field">
                    <span>Soyad</span>
                    <input
                      className="input"
                      name="guestLastName"
                      autoComplete="family-name"
                      maxLength={60}
                      required
                    />
                  </label>
                  <label className="karaoke-field">
                    <span>Cep telefonu</span>
                    <input
                      className="input"
                      name="contactPhone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="0532 123 45 67"
                      maxLength={40}
                      required
                    />
                  </label>
                  <label className="karaoke-field">
                    <span>E-posta</span>
                    <input
                      className="input"
                      name="contactEmail"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      maxLength={200}
                      required
                    />
                  </label>
                </div>
              </fieldset>
            )}

            <div>
              <label className="eyebrow muted" htmlFor="karaoke-note">
                Not (isteğe bağlı)
              </label>
              <input
                id="karaoke-note"
                className="input"
                value={note}
                maxLength={200}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Doğum günü, pasta, özel istek…"
                style={{ marginTop: 10 }}
              />
            </div>
          </div>

          <div className="karaoke-side">
            <div className="karaoke-photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/photos/interior-chest.webp"
                alt="Köşkün üst katı"
                loading="lazy"
              />
            </div>

            <div className="karaoke-summary">
              <span className="eyebrow on-dark">
                {dayLabel(date, today, tomorrow)}
                {startHour !== null ? ` · ${hourLabel(startHour)}` : ""} ·{" "}
                {guests} kişi
              </span>
              <div className="karaoke-lines">
                <div>
                  <span>
                    Oda · {hours} saat
                    <span className="karaoke-unit">
                      {" "}
                      ({priceLabel(hourly)}/saat)
                    </span>
                  </span>
                  <span>{priceLabel(quote.priceMinor)}</span>
                </div>
                {discountPct > 0 && (
                  <div>
                    <span>
                      {tierLabel ?? "Üyelik"} indirimi %{discountPct}
                    </span>
                    <span className="karaoke-discount">
                      −{priceLabel(quote.discountMinor)}
                    </span>
                  </div>
                )}
                <div className="karaoke-total">
                  <span>Ödenecek toplam (KDV dahil)</span>
                  <span className="karaoke-total-n">
                    {priceLabel(quote.totalMinor)}
                  </span>
                </div>
              </div>

              {!canBook && !isAuthenticated ? (
                <>
                  <a
                    href={`/uye/giris?next=${encodeURIComponent(`/karaoke?tarih=${date}`)}`}
                    className="btn btn-gold"
                    style={{ width: "100%" }}
                  >
                    Giriş yap ve rezerve et
                  </a>
                  <p className="karaoke-fine">
                    Hesabın yoksa{" "}
                    <a href="/uye/kayit" className="karaoke-link">
                      üye ol
                    </a>
                    .
                  </p>
                </>
              ) : !canBook ? (
                <p className="karaoke-fine">
                  Önce e-postanı doğrula.{" "}
                  <a href="/uye/hesap" className="karaoke-link">
                    Bağlantıyı yeniden gönder
                  </a>
                  .
                </p>
              ) : null}
            </div>
          </div>

          {canBook ? (
            <section
              className="karaoke-checkout"
              aria-labelledby="karaoke-preinfo-title"
            >
              {prepay ? (
                <>
                  <div className="karaoke-preinfo">
                    <h2 id="karaoke-preinfo-title" className="h4">
                      Ödemeden önce
                    </h2>
                    <ul>
                      <li>
                        {formatReservationDate(date)}
                        {startHour !== null
                          ? `, ${formatReservationTime(startHour, hours)} (${hours} saat)`
                          : " (saat seçilmedi)"}{" "}
                        · {guests} kişi ·{" "}
                        <strong>
                          Toplam {priceLabel(quote.totalMinor)} (KDV dahil)
                        </strong>
                      </li>
                      <li>{KARAOKE_NO_WITHDRAWAL}</li>
                      <li>
                        <strong>İptal:</strong> {KARAOKE_REFUND_RULE}{" "}
                        {KARAOKE_NO_REFUND_RULE}
                      </li>
                    </ul>
                    {/* The rest of the pre-information, one tap away: native
                        and JS-free, and still in the markup when closed. */}
                    <details className="karaoke-preinfo-more">
                      <summary>Ayrıntılar</summary>
                      <ul>
                        <li>
                          Oda seçtiğin saatlerde yalnız senin grubuna ayrılır.
                          Yiyecek ve içecek ayrıca ödenir; başka ücret yok.
                        </li>
                        <li>
                          Kartla tek çekim, PayNkolay 3D Secure ile. Kart
                          bilgilerin bizde saklanmaz. Ödeme sayfası{" "}
                          {KARAOKE_PAYMENT_PAGE_MINUTES} dakika açık kalır; saat
                          bu sürede senin için tutulur.
                        </li>
                        <li>
                          Ödeme onaylanınca rezervasyonun kesinleşir, ödenmezse
                          düşer. Kodun ve bağlantın e-postana gelir.
                        </li>
                        <li>{KARAOKE_BUSINESS_CANCEL}</li>
                      </ul>
                    </details>
                  </div>
                  {/* Who sells stays in sight, not behind the disclosure
                      (MSY m.5/1-c). */}
                  <p className="karaoke-seller">
                    Satıcı: L&apos;Affogato, {address}, {phone}.
                  </p>
                </>
              ) : null}

              <div
                className="karaoke-consents"
                role="group"
                aria-label="Onaylar"
              >
                {prepay ? (
                  <>
                    <label className="karaoke-consent">
                      <input
                        type="checkbox"
                        name="consentPreInfo"
                        required
                        checked={ticks.preInfo}
                        onChange={(e) => tick("preInfo")(e.target.checked)}
                      />
                      <span>
                        <Link
                          href="/hukuk/karaoke-odasi-rezervasyon"
                          target="_blank"
                        >
                          Ön Bilgilendirme Formu
                        </Link>
                        &apos;nu okudum ve onaylıyorum.
                      </span>
                    </label>
                    <label className="karaoke-consent">
                      <input
                        type="checkbox"
                        name="consentContract"
                        required
                        checked={ticks.contract}
                        onChange={(e) => tick("contract")(e.target.checked)}
                      />
                      <span>
                        <Link
                          href="/hukuk/karaoke-odasi-rezervasyon"
                          target="_blank"
                        >
                          Mesafeli Hizmet Sözleşmesi
                        </Link>
                        &apos;ni okudum ve kabul ediyorum.
                      </span>
                    </label>
                  </>
                ) : null}
                <label className="karaoke-consent">
                  <input
                    type="checkbox"
                    name="consentKvkk"
                    required
                    checked={ticks.kvkk}
                    onChange={(e) => tick("kvkk")(e.target.checked)}
                  />
                  <span>
                    Kişisel verilerimin rezervasyonun yapılması ve yönetilmesi
                    için işlenmesine ilişkin{" "}
                    <Link href="/hukuk/kvkk-aydinlatma-metni" target="_blank">
                      Aydınlatma Metni
                    </Link>
                    &apos;ni okudum.
                  </span>
                </label>
              </div>

              {state.error && (
                <p role="alert" className="karaoke-error">
                  {state.error}
                </p>
              )}

              <button
                type="submit"
                className="btn btn-gold karaoke-pay"
                disabled={!selectionValid || !ticked || pending}
              >
                {pending
                  ? "Gönderiliyor…"
                  : prepay
                    ? `Rezervasyonu onayla ve ${priceLabel(quote.totalMinor)} öde`
                    : "Rezervasyon iste"}
              </button>
              <p className="karaoke-fine">
                {prepay
                  ? "Bu düğmeyle ödeme yükümlülüğü altına girersin. Kartını bir sonraki sayfada yazarsın."
                  : "Ekibimiz onaylayınca haber veririz; ödemeyi köşkte yaparsın."}
              </p>
            </section>
          ) : null}
        </form>
      </div>
    </div>
  );
}
