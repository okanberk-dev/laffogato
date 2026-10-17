import type { Metadata } from "next";

import { JsonLd } from "@/lib/seo/json-ld";
import { breadcrumbLd } from "@/lib/seo/structured-data";

import { SiteChrome } from "@/components/laffogato/site-chrome";
import { getActiveCustomer } from "@/lib/customer/auth";
import { customerOrdersByEmail, getPublicSettings } from "@/lib/admin/store";
import { getAvailability, isCalendarDate } from "@/lib/mobile/karaoke";
import {
  computeTier,
  countOrdersLast365,
  TIER_LABELS,
} from "@/lib/mobile/loyalty-core";
import { istanbulClock } from "@/lib/mobile/venue";
import { openGraphDefaults, SITE } from "@/lib/seo/site";

import { KaraokeBooking } from "@/components/laffogato/karaoke-booking";
import { parseSaatParam } from "@/components/laffogato/karaoke-today";

export const dynamic = "force-dynamic";

const TITLE = "Karaoke Odası Rezervasyonu - Tuzla | L'Affogato";
const DESCRIPTION =
  "Köşkün üst katında özel karaoke odası. Saatini seç, kartınla öde; rezervasyonun hemen kesinleşir.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/karaoke" },
  openGraph: {
    ...openGraphDefaults(),
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
  const settings = await getPublicSettings();

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

  return (
    <>
      <JsonLd
        data={breadcrumbLd([
          { name: "Ana Sayfa", url: "/" },
          { name: "Karaoke", url: "/karaoke" },
        ])}
      />
      <SiteChrome
        settings={{
          phone: settings.phone,
          email: settings.email,
          address: settings.address,
        }}
      >
        <KaraokeBooking
          days={days}
          date={date}
          // `?saat=` (the home page's free-hour chips): preselected only if
          // that hour is free on this day; otherwise the first free one.
          initialHour={parseSaatParam(saat)}
          availability={availability}
          unavailable={unavailable}
          capacity={settings.karaokeCapacity}
          hourlyMinor={settings.karaokeHourlyMinor}
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
          // Presentation only: the action re-reads the switch with
          // `getSettings()` and decides there.
          prepay={availability?.paymentRequired ?? settings.karaokePrepay}
        />
      </SiteChrome>
    </>
  );
}
