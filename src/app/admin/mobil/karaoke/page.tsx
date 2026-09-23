import {
  Card,
  formatDateTime,
  formatTRY,
  PageHeader,
} from "@/components/admin/forms";
import { KaraokeReservationActions } from "@/components/admin/karaoke-reservation-actions";
import { requireRole } from "@/lib/admin/auth";
import {
  KARAOKE_STATUS_LABELS,
  listReservationsForAdmin,
  type KaraokeReservation,
} from "@/lib/mobile/karaoke";

export const metadata = { title: "Admin · Karaoke" };
export const dynamic = "force-dynamic";

const STATUS_TONE: Record<KaraokeReservation["status"], string> = {
  requested: "bg-amber-50 text-amber-700",
  confirmed: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-neutral-100 text-neutral-500",
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
 * Reservation panel. Requests arrive from the app as `requested`; the staff
 * confirm or cancel them here. Pricing lives in Ayarlar → Karaoke; the
 * amounts below were fixed at booking time and do not follow later changes.
 */
export default async function AdminKaraokePage() {
  await requireRole("mobileApp");
  const reservations = await listReservationsForAdmin();

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
        description="Uygulamadan gelen karaoke rezervasyon talepleri. Onayla ya da iptal et; iptal edilen saat yeniden boşa düşer."
      />

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
              {list.map((r) => (
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
                        <span className="text-xs text-neutral-400">{r.id}</span>
                      </div>
                      <p className="mt-1 truncate text-sm">
                        {r.customerName || "İsimsiz"}{" "}
                        <span className="text-neutral-500">
                          · {r.customerEmail}
                        </span>
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
                      canConfirm={r.status === "requested"}
                      canCancel={r.status !== "cancelled"}
                    />
                  </div>
                </Card>
              ))}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
