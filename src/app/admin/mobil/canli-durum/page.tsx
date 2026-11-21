import Link from "@/components/link";
import { formatDateTime, PageHeader } from "@/components/admin/forms";
import { Badge } from "@/components/admin/ui";
import { Section } from "@/components/admin/ui/detail";
import { BUTTON } from "@/components/admin/ui/styles";
import { cx } from "@/components/laffogato/cx";
import { requireRole } from "@/lib/admin/auth";
import { DAY_LABELS, DAYS_OF_WEEK, type DayOfWeek } from "@/lib/admin/days";
import { canAccess } from "@/lib/admin/roles";
import { getSettings } from "@/lib/admin/store";
import {
  getVenueStatus,
  isCafeOpenNow,
  istanbulClock,
  nextOpenChangeAt,
  VENUE_TIMEZONE,
} from "@/lib/mobile/venue";

import { VenueStatusForm } from "./venue-status-form";

export const metadata = { title: "Admin · Canlı durum" };
export const dynamic = "force-dynamic";

const CLOCK = new Intl.DateTimeFormat("tr-TR", {
  timeZone: VENUE_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/**
 * When the posted hours next turn the köşk, on the köşk's clock: "Kapanış
 * 23:00", "Açılış yarın 10:00", "Açılış Pazartesi 10:00". Worded without a
 * suffix on the time, so no vowel harmony to get wrong.
 */
function nextChangeText(at: Date | null, openNow: boolean, now: Date): string {
  if (!at) {
    return openNow ? "Önümüzdeki 24 saat açık." : "Önümüzdeki 24 saat kapalı.";
  }
  const day = istanbulClock(at);
  const when =
    day.date === istanbulClock(now).date
      ? ""
      : day.date === istanbulClock(new Date(now.getTime() + 86_400_000)).date
        ? "yarın "
        : `${DAY_LABELS[day.day]} `;
  return `${openNow ? "Kapanış" : "Açılış"} ${when}${CLOCK.format(at)}`;
}

function dayHours(
  hours: { open: string; close: string; closed: boolean } | undefined,
): string {
  if (!hours || hours.closed) return "Kapalı";
  return `${hours.open} – ${hours.close}`;
}

/**
 * Live venue panel. Feeds GET /api/mobile/v1/live-status from the single
 * `venue_status` row.
 *
 * Whether the köşk is open is no longer set here (operator, 21 Kas 2026):
 * it follows Ayarlar → Saatler on its own, and this page only shows it
 * (today's hours, when they next open or close it, the week). What the
 * staff still enter is the room: free tables, Wi-Fi, noise, power, note.
 *
 * Open to the köşk shift (`venue`, admin UI v2 decision D3); the table
 * count is read-only without `mobileApp`, and the action ignores it.
 */
export default async function AdminVenueStatusPage() {
  const session = await requireRole("venue");
  const canEditTotal = canAccess("mobileApp", session.role);
  const canEditHours = canAccess("settings", session.role);
  const [status, settings] = await Promise.all([
    getVenueStatus(),
    getSettings(),
  ]);
  const now = new Date();
  const openNow = isCafeOpenNow(
    settings.weeklyHours,
    status.manualOverride,
    now,
  );
  const nextChange = nextOpenChangeAt(
    settings.weeklyHours,
    status.manualOverride,
    now,
  );
  const today: DayOfWeek = istanbulClock(now).day;

  return (
    // A form page at the form width (PAGE_WIDTHS.form).
    <main className="w-full px-4 pt-5 pb-10 sm:px-5 lg:px-6 lg:pt-6 [&>:not(header)]:max-w-3xl">
      <PageHeader
        title="Canlı durum"
        description="Uygulamanın ana sayfasındaki açık/kapalı, boş masa, Wi-Fi ve gürültü bilgisi."
      />

      <div className="grid gap-4 sm:gap-5">
        <Section
          title="Açık / kapalı"
          description="Çalışma saatlerinden kendiliğinden belirlenir; elle açıp kapatmak gerekmez."
          actions={
            canEditHours ? (
              <Link href="/admin/ayarlar?sekme=hours" className={BUTTON.ghost}>
                Saatleri düzenle
              </Link>
            ) : null
          }
        >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Badge tone={openNow ? "success" : "neutral"} dot>
              {openNow ? "Şu an açık" : "Şu an kapalı"}
            </Badge>
            <p className="text-sm text-[var(--admin-text-soft)]">
              {nextChangeText(nextChange, openNow, now)}
            </p>
          </div>

          <ul
            aria-label="Haftalık çalışma saatleri"
            className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4"
          >
            {DAYS_OF_WEEK.map((day) => {
              const isToday = day === today;
              const hours = settings.weeklyHours[day];
              return (
                <li
                  key={day}
                  aria-current={isToday ? "date" : undefined}
                  className={cx(
                    "flex flex-col gap-0.5 rounded-lg px-3 py-2.5",
                    isToday
                      ? "bg-[var(--admin-inverse)] text-[var(--admin-inverse-ink)]"
                      : "bg-[var(--admin-surface-2)] text-[var(--admin-text)]",
                  )}
                >
                  <span
                    className={cx(
                      "text-xs",
                      isToday
                        ? "text-white/75"
                        : "text-[var(--admin-text-mute)]",
                    )}
                  >
                    {isToday ? "Bugün" : DAY_LABELS[day]}
                  </span>
                  <span
                    className="text-sm font-medium whitespace-nowrap"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {dayHours(hours)}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-xs text-[var(--admin-text-mute)]">
            Uygulama ve kafe siparişi bu saatleri izler; site de aynı saatleri
            gösterir. Gece yarısını geçen kapanış (ör. 02:00) önceki günün
            devamı sayılır.
          </p>
        </Section>

        <VenueStatusForm
          canEditTotal={canEditTotal}
          savedAt={
            status.updatedAt
              ? `Son güncelleme: ${formatDateTime(status.updatedAt)}`
              : "Henüz hiç güncellenmedi; varsayılanlar gösteriliyor."
          }
          defaults={{
            freeTables: status.freeTables,
            totalTables: status.totalTables,
            wifi: status.wifi,
            noise: status.noise,
            power: status.power,
            note: status.note,
          }}
        />
      </div>
    </main>
  );
}
