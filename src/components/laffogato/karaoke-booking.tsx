"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import {
  bookKaraokeAction,
  type BookKaraokeState,
} from "@/app/karaoke/actions";
import { PageHero } from "./page-hero";
import {
  karaokeDiscountPct,
  quoteReservation,
  type KaraokeAvailability,
} from "@/lib/mobile/karaoke-core";
import { priceLabel } from "@/lib/utils/format";
import { BusyDots } from "./busy-dots";

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
  /** The signed-in member's details, to prefill the contact block. */
  contact?: { name: string; email: string; phone: string };
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
  contact,
}: KaraokeBookingProps) {
  const slots = availability?.slots ?? [];
  const firstFree = slots.find((s) => s.available)?.startHour;
  const [startHour, setStartHour] = useState<number | null>(firstFree ?? null);
  const [hours, setHours] = useState(1);
  const [guests, setGuests] = useState(Math.min(4, capacity));
  const [note, setNote] = useState("");
  const [state, formAction, pending] = useActionState<
    BookKaraokeState,
    FormData
  >(bookKaraokeAction, {});

  const maxHours = availability?.maxHours ?? 3;
  const hourly = availability?.hourlyMinor ?? hourlyMinor;
  const discountPct = karaokeDiscountPct(
    tier,
    availability?.oroDiscountPct ?? 15,
  );

  const quote = useMemo(
    () =>
      quoteReservation(hours, hourly, tier, availability?.oroDiscountPct ?? 15),
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
            {state.booked.guests} kişi. Rezervasyonun uygulamadaki hesabına da
            düştü; ekibimiz onayladığında haber vereceğiz.
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
        lede="Köşkün üst katındaki karaoke odası sekiz kişiye kadar. Gün ve saat seç, kişi sayısını gir; rezervasyonunu web'den ya da uygulamadan tamamla."
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
                  Rezervasyon takvimine şu an ulaşamıyoruz, bu yüzden boş
                  saatleri gösteremiyoruz. Kısa süre içinde tekrar dene ya da
                  bizi ara: {phone}.
                </p>
              ) : slots.length === 0 ? (
                <p className="karaoke-warn">
                  Bu gün için uygun saat kalmadı. Başka bir gün seçebilirsin.
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
                  {hourLabel(startHour)}’dan itibaren {hours} saat boş değil -
                  daha kısa bir süre ya da başka bir saat seç.
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
                Oda {capacity} kişiye kadar. Daha kalabalık gruplar için bizi
                arayın: {phone}.
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
                <label className="karaoke-consent">
                  <input type="checkbox" name="contactConsent" required />
                  <span>
                    Rezervasyonumla ilgili (onay, değişiklik, iptal) bana
                    e-posta ve telefonla ulaşılmasına izin veriyorum.{" "}
                    <Link href="/hukuk/kvkk-aydinlatma-metni" target="_blank">
                      KVKK Aydınlatma Metni
                    </Link>
                  </span>
                </label>
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
                  <span>Ödenecek</span>
                  <span className="karaoke-total-n">
                    {priceLabel(quote.totalMinor)}
                  </span>
                </div>
              </div>

              {state.error && (
                <p role="alert" className="karaoke-error">
                  {state.error}
                </p>
              )}

              {!isAuthenticated ? (
                <>
                  <a
                    href={`/uye/giris?next=${encodeURIComponent(`/karaoke?tarih=${date}`)}`}
                    className="btn btn-gold"
                    style={{ width: "100%" }}
                  >
                    Giriş yap ve rezerve et
                  </a>
                  <p className="karaoke-fine">
                    Rezervasyon hesabına işlenir, bu yüzden giriş gerekiyor.
                    Hesabın yoksa{" "}
                    <a href="/uye/kayit" className="karaoke-link">
                      üye ol
                    </a>
                    .
                  </p>
                </>
              ) : !emailVerified ? (
                <p className="karaoke-fine">
                  Rezervasyon yapabilmek için önce e-postanı doğrula.{" "}
                  <a href="/uye/hesap" className="karaoke-link">
                    Doğrulama bağlantısını yeniden gönder
                  </a>
                  .
                </p>
              ) : (
                <>
                  <button
                    type="submit"
                    className="btn btn-gold"
                    style={{ width: "100%" }}
                    disabled={!selectionValid || pending}
                    aria-busy={pending}
                  >
                    {pending ? (
                      <>
                        <BusyDots />
                        Gönderiliyor…
                      </>
                    ) : (
                      "Rezervasyonu tamamla"
                    )}
                  </button>
                  <p className="karaoke-fine">
                    Rezervasyon uygulamadaki hesabına da düşer; ekibimiz
                    onayladığında haber veririz. 2 saat öncesine kadar ücretsiz
                    iptal.
                  </p>
                </>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
