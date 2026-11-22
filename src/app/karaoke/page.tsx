import type { Metadata } from "next";

import Link from "@/components/link";
import { JsonLd } from "@/lib/seo/json-ld";
import { karaokeFaq, karaokeLd } from "@/lib/seo/karaoke-faq";
import {
  effectiveKaraokeCancelPolicy,
  karaokeCancellationRules,
} from "@/lib/mobile/karaoke-time";
import { breadcrumbLd } from "@/lib/seo/structured-data";

import { SiteChrome } from "@/components/laffogato/site-chrome";
import { getActiveCustomer } from "@/lib/customer/auth";
import { customerOrdersByEmail, getPublicSettings } from "@/lib/admin/store";
import { LEGAL_ENTITY } from "@/lib/legal/entity";
import { getAvailability, isCalendarDate } from "@/lib/mobile/karaoke";
import {
  computeTier,
  countOrdersLast365,
  TIER_LABELS,
} from "@/lib/mobile/loyalty-core";
import { istanbulClock } from "@/lib/mobile/venue";
import { openGraphBase, SITE } from "@/lib/seo/site";

import { KaraokeBooking } from "@/components/laffogato/karaoke-booking";
import { parseSaatParam } from "@/components/laffogato/karaoke-today";
import { footerSettings } from "@/lib/seo/contact";
import { priceLabel } from "@/lib/utils/format";
import { getSiteImages } from "@/lib/seo/site-data";
import { siteImage } from "@/lib/admin/site-images-core";

export const dynamic = "force-dynamic";

// Keyword-first (Tuzla + karaoke), under 60 characters.
const TITLE = "Tuzla Karaoke Odası: Online Rezervasyon | L'Affogato";
const DESCRIPTION =
  "Tuzla'da 200 yıllık köşkün üst katında özel karaoke odası. Günü ve saati seç, kartınla öde; rezervasyonun hemen kesinleşir. Saatler, fiyat ve iptal kuralı.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/karaoke" },
  openGraph: {
    ...openGraphBase(),
    title: TITLE,
    description: DESCRIPTION,
    url: "/karaoke",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

/** The next `count` Istanbul calendar days, starting today. */
function nextDays(today: string, count: number): string[] {
  const [y, m, d] = today.split("-").map(Number);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    // Built in UTC and read back as an ISO date: the venue's day boundary is
    // already baked into `today`, so this only ever adds whole days to it.
    const dt = new Date(Date.UTC(y, m - 1, d + i));
    out.push(dt.toISOString().slice(0, 10));
  }
  return out;
}

interface PageProps {
  searchParams: Promise<{ tarih?: string; saat?: string }>;
}

export default async function KaraokePage({ searchParams }: PageProps) {
  const { tarih, saat } = await searchParams;
  // One reading of the clock per request: the calendar day and the tier
  // window below must agree on what "now" is.
  const now = new Date();
  const clock = istanbulClock(now);
  const [settings, images] = await Promise.all([
    getPublicSettings(),
    getSiteImages(),
  ]);

  // Availability is per-day, and the day lives in the URL rather than in
  // client state: picking a date is a server round-trip that re-reads the
  // real calendar, so the grid can never show a slot that was taken while
  // the page sat open.
  const requested = tarih && isCalendarDate(tarih) ? tarih : clock.date;
  // How far ahead the room can be booked is an operator setting
  // (/admin/mobil/ayarlar → karaoke.bookingWindowDays); the strip used to
  // offer a fixed week regardless, so a shorter window still showed days the
  // server would refuse.
  const windowDays = Math.max(
    1,
    Math.min(14, settings.mobileApp.karaoke.bookingWindowDays),
  );
  const days = nextDays(clock.date, windowDays);
  const date = days.includes(requested) ? requested : clock.date;

  const customer = await getActiveCustomer();

  // The ORO discount is a real tier read, not a decoration: it is the same
  // computation `createReservation` will apply on submit.
  let tier: string | null = null;
  if (customer) {
    const orders = await customerOrdersByEmail(customer.email);
    tier = computeTier(countOrdersLast365(orders, now.getTime()));
  }

  let availability = null;
  let unavailable = false;
  try {
    availability = await getAvailability(date);
  } catch {
    // The calendar is a commercial path: when it cannot be read, the page says
    // so rather than showing every hour as free.
    unavailable = true;
  }

  // The stage band's photograph: the room (Görseller › Karaoke › Oda).
  const stageImage = siteImage(images, "karaoke.room");

  // The questions under the form and in the JSON-LD, from the same panel
  // values the form uses (src/lib/seo/karaoke-faq.ts).
  const rules = settings.mobileApp.karaoke;
  const faqFacts = {
    capacity: settings.karaokeCapacity,
    hourlyMinor: settings.karaokeHourlyMinor,
    firstHour: rules.firstHour,
    closeHour: rules.closeHour,
    maxHours: rules.maxHours,
    prepay: availability?.paymentRequired ?? settings.karaokePrepay,
    topTierDiscountPct: rules.oroDiscountPct,
    topTierLabel: TIER_LABELS.oro,
    cancellationRules:
      availability?.cancellationRules ??
      karaokeCancellationRules(effectiveKaraokeCancelPolicy(settings)).rules,
  };
  const faq = karaokeFaq(faqFacts);

  return (
    <>
      <JsonLd
        data={breadcrumbLd([
          { name: "Ana Sayfa", url: "/" },
          { name: "Karaoke", url: "/karaoke" },
        ])}
      />
      <JsonLd data={karaokeLd(faqFacts, faq)} />
      <SiteChrome settings={footerSettings(settings)}>
        <KaraokeBooking
          heroImage={siteImage(images, "karaoke.hero")}
          roomImage={siteImage(images, "karaoke.room")}
          days={days}
          date={date}
          // `?saat=` (the home page's free-hour chips): preselected only if
          // that hour is free on this day; otherwise the first free one.
          initialHour={parseSaatParam(saat)}
          availability={availability}
          unavailable={unavailable}
          capacity={settings.karaokeCapacity}
          hourlyMinor={settings.karaokeHourlyMinor}
          // The heading's closing hour: the panel's, like the hours the
          // calendar offers (/admin/mobil/ayarlar → karaoke.closeHour).
          closeHour={settings.mobileApp.karaoke.closeHour}
          tier={tier}
          tierLabel={
            tier ? TIER_LABELS[tier as keyof typeof TIER_LABELS] : null
          }
          isAuthenticated={!!customer}
          emailVerified={!!customer?.emailVerified}
          contact={
            customer
              ? {
                  name: customer.name,
                  email: customer.email,
                  phone: customer.phone,
                }
              : undefined
          }
          phone={settings.phone || SITE.phone}
          address={
            settings.address ||
            `${SITE.address.streetAddress}, ${SITE.address.postalCode} ${SITE.address.addressLocality} / ${SITE.address.addressRegion}`
          }
          // Who sells, above the boxes (MSY m.5/1-b): the title and tax
          // number from the one legal source; the client component does not
          // import entity.ts itself.
          sellerName={LEGAL_ENTITY.legalName}
          taxNo={LEGAL_ENTITY.taxNo}
          // The request's clock: a free-cancel moment already gone by is
          // not named as one still to come.
          now={now.toISOString()}
          // Presentation only: the action re-reads the switch with
          // `getSettings()` and decides there.
          prepay={availability?.paymentRequired ?? settings.karaokePrepay}
        />
        {/* The stage (operator, 22 Kas 2026: "karaoke sayfasını daha
            eğlenceli ... fotoyu öyle kullan, admin panelden değiştirilebilir
            olsun"): the room's photograph from Görseller to the edge on the
            charcoal band, three numbers from the panel, one call back up to
            the calendar. No gradient, shadow or motion (docs/BRAND.md). */}
        <section
          className="section--dark karaoke-stage"
          data-ground="dark"
          aria-labelledby="karaoke-stage-title"
        >
          <div className="karaoke-stage-media">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={stageImage.src}
              alt={stageImage.alt}
              loading="lazy"
              decoding="async"
            />
          </div>
          <div className="karaoke-stage-copy">
            <p className="t-label">Köşkün üst katı · Tuzla</p>
            <h2 id="karaoke-stage-title" className="karaoke-stage-title">
              Kapıyı kapat, mikrofonu al
            </h2>
            <p className="t-body karaoke-stage-lede">
              Oda yalnız sizin. Şarkıyı birlikte geldiğiniz kişiler dinler; alt
              katta kahve, gelato ve affogato bir merdiven uzakta.
            </p>
            <ul className="karaoke-stage-facts">
              <li>
                <span className="karaoke-stage-num">
                  {settings.karaokeCapacity}
                </span>
                <span>kişiye kadar</span>
              </li>
              <li>
                <span className="karaoke-stage-num">
                  {String(rules.closeHour).padStart(2, "0")}:00
                </span>
                <span>gece son saat</span>
              </li>
              <li>
                <span className="karaoke-stage-num">
                  {priceLabel(settings.karaokeHourlyMinor)}
                </span>
                <span>saati, KDV dahil</span>
              </li>
            </ul>
            <a className="btn btn-light btn-wide" href="#karaoke-takvim">
              Saatini seç
            </a>
          </div>
        </section>
        <section
          className="section section--band karaoke-faq"
          aria-labelledby="karaoke-faq-title"
        >
          <div className="wrap">
            <h2 id="karaoke-faq-title" className="t-display">
              Karaoke odası hakkında
            </h2>
            <div className="seo-faq">
              {faq.map((e) => (
                <details key={e.q}>
                  <summary>{e.q}</summary>
                  <p>{e.a}</p>
                </details>
              ))}
            </div>
            <p className="karaoke-faq-more">
              <Link className="link-u" href="/rehber/tuzla-karaoke">
                Tuzla&rsquo;da karaoke rehberi
              </Link>
            </p>
          </div>
        </section>
      </SiteChrome>
    </>
  );
}
