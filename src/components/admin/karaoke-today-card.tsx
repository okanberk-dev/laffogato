import Link from "@/components/link";
import {
  venueWeekday,
  type KaraokeOccupancy,
} from "@/lib/admin/dashboard-core";
import {
  KARAOKE_PANEL_PATH,
  KARAOKE_TAB_PARAM,
  karaokeDetailHref,
  type KaraokeRowView,
} from "@/lib/admin/karaoke-panel";
import { karaokeEndInstant } from "@/lib/mobile/karaoke-time";

import { WidgetCard } from "./dashboard/widget-card";
import { Badge } from "./ui";
import { AdminIcon } from "./ui/icons";
import { NUMERIC_STYLE } from "./ui/styles";
import { TONE_SOFT } from "./ui/tone";

/**
 * How full the room is today against the same weekday a week ago
 * (Innex's "Karaoke doluluğu %70 · geçen cuma %55", recipe §3.5): the
 * share and the hours, a bar, and the change in points, green when the
 * room is fuller.
 */
function Occupancy({
  today,
  lastWeek,
  weekday,
}: {
  today: KaraokeOccupancy;
  lastWeek: KaraokeOccupancy;
  /** "cuma": the reference's day. */
  weekday: string;
}) {
  if (today.capacity === 0) return null;
  const diff = today.pct - lastWeek.pct;
  return (
    <div className="mb-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-[var(--admin-text-soft)]">Doluluk</span>
        <span
          className="text-sm text-[var(--admin-text)]"
          style={NUMERIC_STYLE}
        >
          <strong className="font-bold">%{today.pct}</strong> · {today.hours}/
          {today.capacity} saat
        </span>
      </div>
      <div
        aria-hidden="true"
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--admin-panel)]"
      >
        <div
          className="h-full rounded-full bg-[var(--admin-chart-line)]"
          style={{ width: `${today.pct}%` }}
        />
      </div>
      <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--admin-text-mute)]">
        {diff !== 0 ? (
          <span
            className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-px font-medium ${diff > 0 ? TONE_SOFT.success : TONE_SOFT.danger}`}
            style={NUMERIC_STYLE}
          >
            <AdminIcon name={diff > 0 ? "deltaUp" : "deltaDown"} size={12} />
            {diff > 0 ? "+" : "−"}
            {Math.abs(diff)} puan
            <span className="sr-only"> {diff > 0 ? "artış" : "düşüş"}</span>
          </span>
        ) : null}
        <span style={NUMERIC_STYLE}>
          Geçen {weekday} %{lastWeek.pct}
        </span>
      </p>
    </div>
  );
}

/**
 * The dashboard's karaoke card: tonight's bookings at a glance and anything
 * that waits for a person, any day. Server-safe. `today` are today's rows,
 * `attention` the Dikkat tab's set (`loadKaraokeTodayCard`,
 * lib/admin/karaoke-today.ts), so the card and the tab count the same
 * bookings; null when they could not be read, so a karaoke outage never
 * takes the dashboard with it.
 */
export function KaraokeTodayCard({
  today,
  attention: others,
  occupancy = null,
  now,
}: {
  today: readonly KaraokeRowView[] | null;
  attention: readonly KaraokeRowView[] | null;
  /** Today's and a week ago's (loadKaraokeTodayCard); none, no line. */
  occupancy?: { today: KaraokeOccupancy; lastWeek: KaraokeOccupancy } | null;
  now: Date;
}) {
  if (!today || !others) {
    return (
      <WidgetCard title="Bugün karaoke" href={KARAOKE_PANEL_PATH}>
        <p className="text-sm text-[var(--admin-text-soft)]">
          Rezervasyonlar şu an okunamadı.
        </p>
      </WidgetCard>
    );
  }

  const live = today.filter((v) => v.live);
  const paid = live.filter((v) => v.money === "paid").length;
  const pending = live.filter((v) => v.money === "pending").length;
  const waiting = live.filter(
    (v) => v.r.status === "requested" && v.money === "none",
  ).length;
  const attention = new Set<string>();
  for (const v of [...today, ...others]) {
    if (v.attention.length > 0) attention.add(v.r.id);
  }
  // Still to come or under way, earliest first.
  const upcoming = live
    .filter((v) => karaokeEndInstant(v.r).getTime() > now.getTime())
    .sort((a, b) => a.r.startHour - b.r.startHour)
    .slice(0, 4);

  const stats = [
    { label: "Rezervasyon", value: live.length },
    { label: "Ödendi", value: paid },
    { label: "Ödeme bekliyor", value: pending },
    ...(waiting > 0 ? [{ label: "Onay bekliyor", value: waiting }] : []),
  ];

  return (
    <WidgetCard title="Bugün karaoke" href={KARAOKE_PANEL_PATH}>
      {occupancy ? (
        <Occupancy {...occupancy} weekday={venueWeekday(now)} />
      ) : null}
      {/* Innex's small stat row: the figures side by side, a hairline
          between them, two abreast in a narrow card. */}
      <dl
        className={`grid gap-px overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-border)] ${stats.length === 4 ? "grid-cols-2" : "grid-cols-3"}`}
      >
        {stats.map((s) => (
          <div
            key={s.label}
            className="flex min-w-0 flex-col justify-between bg-[var(--admin-surface-2)] px-3 py-2.5"
          >
            <dt className="text-xs leading-4 text-[var(--admin-text-mute)]">
              {s.label}
            </dt>
            <dd
              className="mt-0.5 text-xl font-bold text-[var(--admin-text)]"
              style={NUMERIC_STYLE}
            >
              {s.value}
            </dd>
          </div>
        ))}
      </dl>

      {attention.size > 0 ? (
        <p className="mt-3 rounded-lg bg-[var(--admin-warning-soft)] px-3.5 py-2.5 text-sm text-[var(--admin-warning)]">
          {attention.size} rezervasyon bir işlem bekliyor (iade, onay ya da eski
          talep).{" "}
          <Link
            href={`${KARAOKE_PANEL_PATH}?${KARAOKE_TAB_PARAM}=dikkat`}
            className="font-medium underline underline-offset-4"
          >
            Dikkat sekmesi
          </Link>
        </p>
      ) : null}

      {upcoming.length > 0 ? (
        <ul className="mt-3 flex flex-col divide-y divide-[var(--admin-divider)]">
          {upcoming.map((v) => (
            <li key={v.r.id}>
              <Link
                href={karaokeDetailHref(v.r.id)}
                className="flex min-h-11 items-center justify-between gap-3 py-2 hover:text-[var(--admin-primary)] pointer-fine:min-h-9"
              >
                <span className="flex min-w-0 flex-col">
                  <span
                    className="text-sm font-medium whitespace-nowrap"
                    style={NUMERIC_STYLE}
                  >
                    {v.time}
                  </span>
                  <span className="truncate text-xs text-[var(--admin-text-mute)]">
                    {v.r.customerName || "İsimsiz"} · {v.r.guests} kişi
                  </span>
                </span>
                <Badge tone={v.paymentTone}>{v.paymentLabel}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-[var(--admin-text-soft)]">
          Bugün için sıradaki rezervasyon yok.
        </p>
      )}
    </WidgetCard>
  );
}
