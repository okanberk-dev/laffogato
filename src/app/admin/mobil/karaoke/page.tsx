import {
  Card,
  formatDateTime,
  formatTRY,
  PageHeader,
} from "@/components/admin/forms";
import { KaraokeReservationActions } from "@/components/admin/karaoke-reservation-actions";
import { requireRole } from "@/lib/admin/auth";
import { canAccess } from "@/lib/admin/roles";
import { getSettings } from "@/lib/admin/store";
import {
  KARAOKE_PAYMENT_LABELS,
  KARAOKE_STATUS_LABELS,
  istanbulTimeLabel,
  listReservationsForAdmin,
  paymentStatusOf,
  type KaraokePaymentStatus,
  type KaraokeReservation,
} from "@/lib/mobile/karaoke";

export const metadata = { title: "Admin · Karaoke" };
export const dynamic = "force-dynamic";

const STATUS_TONE: Record<KaraokeReservation["status"], string> = {
  requested: "bg-amber-50 text-amber-700",
  confirmed: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-neutral-100 text-neutral-500",
};

const PAYMENT_TONE: Record<KaraokePaymentStatus, string> = {
  none: "bg-neutral-100 text-neutral-600",
  pending: "bg-amber-50 text-amber-700",
  paid: "bg-emerald-50 text-emerald-700",
  refunding: "bg-rose-50 text-rose-700",
  refunded: "bg-sky-50 text-sky-700",
  expired: "bg-neutral-100 text-neutral-500",
};

function dateLabel(date: string): string {
  const [y, m, d] = date.split("-").map((s) => parseInt(s, 10));
  return new Intl.DateTimeFormat("tr-TR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

function hourRange(r: KaraokeReservation): string {
  const pad = (h: number) => `${String(h).padStart(2, "0")}:00`;
  return `${pad(r.startHour)} - ${pad(r.startHour + r.hours)}`;
}

/**
 * Reservation panel. With prepayment on (Ayarlar → Karaoke) a booking is an
 * unpaid hold until its payment confirms it on its own; nobody confirms an
 * unpaid one by hand. Cancelling a paid booking refunds it in full, which
 * needs the refunds permission. Holds that lapsed unpaid are left out: they
 * were never bookings. Pricing lives in Ayarlar → Karaoke; the amounts below
 * were fixed at booking time and do not follow later changes.
 */
export default async function AdminKaraokePage() {
  const session = await requireRole("mobileApp");
  const canRefund = canAccess("refunds", session.role);
  const [all, settings] = await Promise.all([
    listReservationsForAdmin(),
    getSettings(),
  ]);
  const reservations = all.filter((r) => paymentStatusOf(r) !== "expired");
  const lapsed = all.length - reservations.length;

  const byDate = new Map<string, KaraokeReservation[]>();
  for (const r of reservations) {
    const list = byDate.get(r.date) ?? [];
    list.push(r);
    byDate.set(r.date, list);
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Mobil uygulama · Rezervasyon"
        title="Karaoke"
        description={
          settings.karaokePrepay
            ? "Web ve uygulamadan gelen karaoke rezervasyonları. Ödeme online alınır ve rezervasyon ödemeyle kendiliğinden kesinleşir; ödenmemiş rezervasyon onaylanmaz. Ödenmiş bir rezervasyonu iptal etmek tutarın tamamını karta iade eder."
            : "Ön ödeme kapalı (Ayarlar → Karaoke): talepler köşkte ödenir, onayla ya da iptal et. İptal edilen saat yeniden boşa düşer."
        }
      />
      {lapsed > 0 ? (
        <p className="mb-4 text-xs text-neutral-500">
          Ödenmediği için düşen {lapsed} rezervasyon denemesi listede
          gösterilmiyor.
        </p>
      ) : null}

      {reservations.length === 0 ? (
        <Card>
          <p className="text-sm text-neutral-500">
            Bugünden itibaren rezervasyon yok.
          </p>
        </Card>
      ) : (
        <div className="grid gap-6">
          {Array.from(byDate.entries()).map(([date, list]) => (
            <section key={date} className="grid gap-3">
              <h2 className="text-sm font-medium tracking-wide text-neutral-600 uppercase">
                {dateLabel(date)}
              </h2>
              {list.map((r) => {
                const money = paymentStatusOf(r);
                const live = r.status !== "cancelled";
                return (
                  <Card key={r.id}>
                    <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{hourRange(r)}</span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_TONE[r.status]}`}
                          >
                            {KARAOKE_STATUS_LABELS[r.status]}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${PAYMENT_TONE[money]}`}
                          >
                            {KARAOKE_PAYMENT_LABELS[money]}
                            {money === "pending" && r.paymentDueAt
                              ? ` · ${istanbulTimeLabel(r.paymentDueAt)}'e kadar`
                              : ""}
                          </span>
                          {r.guest ? (
                            <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700">
                              Üyeliksiz
                            </span>
                          ) : null}
                          <span className="text-xs text-neutral-400">
                            {r.id}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-sm">
                          {r.customerName || "İsimsiz"}{" "}
                          <span className="text-neutral-500">
                            · {r.contactEmail || r.customerEmail}
                          </span>
                          {r.contactPhone ? (
                            <a
                              href={`tel:${r.contactPhone}`}
                              className="ml-1 text-neutral-700 underline"
                            >
                              {r.contactPhone}
                            </a>
                          ) : null}
                        </p>
                        <p className="text-sm text-neutral-500">
                          {r.guests} kişi · {r.hours} saat ·{" "}
                          {formatTRY(r.totalMinor)}
                          {r.discountMinor > 0
                            ? ` (${formatTRY(r.priceMinor)} − RUBY ${formatTRY(r.discountMinor)})`
                            : ""}
                        </p>
                        {r.note ? (
                          <p className="mt-1 text-sm text-neutral-600">
                            “{r.note}”
                          </p>
                        ) : null}
                        <p className="mt-1 text-xs text-neutral-400">
                          Talep: {formatDateTime(r.createdAt)}
                        </p>
                      </div>
                      <KaraokeReservationActions
                        id={r.id}
                        canConfirm={
                          r.status === "requested" &&
                          (money === "paid" ||
                            (money === "none" && !settings.karaokePrepay))
                        }
                        canCancel={
                          live &&
                          (money === "none" ||
                            money === "pending" ||
                            (money === "paid" && canRefund))
                        }
                        cancelRefunds={money === "paid"}
                        canResolveRefund={
                          canRefund &&
                          (money === "refunding" || (money === "paid" && !live))
                        }
                      />
                    </div>
                    {money === "paid" && !canRefund && live ? (
                      <p className="mt-2 text-xs text-neutral-500">
                        Ödenmiş rezervasyonu iptal etmek iade demektir; iade
                        yetkisi olan biri iptal edebilir.
                      </p>
                    ) : null}
                  </Card>
                );
              })}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
