import Link from "next/link";

import {
  AccountCard,
  AccountShell,
  EmptyState,
} from "@/components/uye/account-shell";
import { karaokeStatusLine } from "@/components/uye/karaoke-reservation-view";
import { requireCustomer } from "@/lib/customer/auth";
import {
  formatReservationDate,
  formatReservationTime,
  listMine,
  paymentStatusOf,
  type KaraokeReservation,
} from "@/lib/mobile/karaoke";
import { istanbulClock } from "@/lib/mobile/venue";
import { priceLabel } from "@/lib/utils/format";

export const metadata = { title: "Karaoke rezervasyonlarım · L'Affogato" };
export const dynamic = "force-dynamic";

/**
 * The member's own karaoke bookings (operator, 16 Eki 2026: "karaoke
 * rezervasyonlarım diye de kişinin profilinde alan olsun"). Upcoming first,
 * soonest at the top; then the past and the cancelled, newest first. Shown
 * only to a verified address, like the order history: the bookings are found
 * by address, and an unverified one is not yet proven to be the member's.
 */
export default async function KaraokeMinePage() {
  const customer = await requireCustomer();
  const all = customer.emailVerified ? await listMine(customer.email) : [];
  const today = istanbulClock(new Date()).date;
  // Holds that lapsed unpaid were never bookings; they would only be noise.
  const shown = all.filter((r) => paymentStatusOf(r) !== "expired");
  const upcoming = shown
    .filter((r) => r.date >= today && r.status !== "cancelled")
    .sort((a, b) => a.date.localeCompare(b.date) || a.startHour - b.startHour);
  const past = shown
    .filter((r) => !upcoming.includes(r))
    .sort((a, b) => b.date.localeCompare(a.date) || b.startHour - a.startHour);

  return (
    <AccountShell customer={customer} active="karaoke">
      <AccountCard
        title="Karaoke rezervasyonlarım"
        hint={
          customer.emailVerified
            ? `${upcoming.length} yaklaşan rezervasyon`
            : undefined
        }
        action={
          <Link href="/karaoke" className="btn btn-primary btn-sm">
            Yeni rezervasyon
          </Link>
        }
      >
        {!customer.emailVerified ? (
          <EmptyState
            art="bulten-zarf"
            title="Rezervasyonların e-posta doğrulamasından sonra görünür"
            hint="Hesabım sayfasından doğrulama bağlantısını yeniden gönderebilirsin."
          />
        ) : shown.length === 0 ? (
          <EmptyState
            art="karaoke-room"
            title="Henüz karaoke rezervasyonun yok"
            cta={
              <Link href="/karaoke" className="btn btn-primary btn-sm">
                Saat seç →
              </Link>
            }
          />
        ) : (
          <>
            {upcoming.length > 0 ? (
              <ReservationList title="Yaklaşan" items={upcoming} />
            ) : null}
            {past.length > 0 ? (
              <ReservationList title="Geçmiş ve iptal" items={past} />
            ) : null}
          </>
        )}
      </AccountCard>
    </AccountShell>
  );
}

function ReservationList({
  title,
  items,
}: {
  title: string;
  items: KaraokeReservation[];
}) {
  return (
    <section className="karaoke-mine-section">
      <h3 className="eyebrow muted">{title}</h3>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {items.map((r) => {
          const state = karaokeStatusLine({
            status: r.status,
            paymentStatus: paymentStatusOf(r),
          });
          return (
            <li key={r.id}>
              <Link
                href={`/uye/hesap/karaoke/${encodeURIComponent(r.id)}`}
                className="account-order-card"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div className="account-order-head">
                  <span className="account-order-no">
                    {formatReservationDate(r.date)}
                  </span>
                  <span className="status-chip" data-tone={state.tone}>
                    {state.label}
                  </span>
                </div>
                <div style={{ fontSize: 14, color: "var(--ink-soft)" }}>
                  {formatReservationTime(r.startHour, r.hours)} · {r.hours} saat
                  · {r.guests} kişi
                </div>
                <div className="account-order-meta">
                  <span>{r.id.toUpperCase()}</span>
                  <span>{priceLabel(r.totalMinor)}</span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
