import Link from "next/link";

import {
  KARAOKE_PANEL_PATH,
  KARAOKE_TAB_PARAM,
  karaokeDetailHref,
  type KaraokeRowView,
} from "@/lib/admin/karaoke-panel";
import { karaokeEndInstant } from "@/lib/mobile/karaoke-time";

import { Card } from "./forms";
import { Badge } from "./ui";
import { EYEBROW, MONO_STYLE } from "./ui/styles";

/**
 * The dashboard's karaoke card: tonight's bookings at a glance and anything
 * that waits for a person, any day. Server-safe. `today` are today's rows,
 * `attention` the Dikkat tab's set (`loadKaraokeTodayCard`,
 * lib/admin/karaoke-today.ts), so the card and the tab count the same
 * bookings; null when they could not be read, so a karaoke outage never
 * takes the dashboard with it.
 *
 * `owed` is the older read (the refunds owed only) the dashboard still
 * passes until it moves to `loadKaraokeTodayCard`.
 */
export function KaraokeTodayCard({
  today,
  attention: given,
  owed,
  now,
}: {
  today: readonly KaraokeRowView[] | null;
  attention?: readonly KaraokeRowView[] | null;
  owed?: readonly KaraokeRowView[] | null;
  now: Date;
}) {
  const others = given ?? owed ?? null;
  if (!today || !others) {
    return (
      <Card>
        <h2 className="text-lg font-semibold text-[var(--admin-text)]">
          Bugün karaoke
        </h2>
        <p className="mt-2 text-sm text-[var(--admin-text-soft)]">
          Rezervasyonlar şu an okunamadı.{" "}
          <Link href={KARAOKE_PANEL_PATH} className="underline">
            Karaoke sayfasını aç
          </Link>
        </p>
      </Card>
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
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-[var(--admin-text)]">
          Bugün karaoke
        </h2>
        <Link
          href={KARAOKE_PANEL_PATH}
          className="text-xs text-[var(--admin-text-soft)] underline-offset-4 hover:text-[var(--admin-primary)] hover:underline"
        >
          Tümünü gör →
        </Link>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label}>
            <dt className={EYEBROW} style={MONO_STYLE}>
              {s.label}
            </dt>
            <dd className="mt-1 text-2xl font-semibold text-[var(--admin-text)]">
              {s.value}
            </dd>
          </div>
        ))}
      </dl>

      {attention.size > 0 ? (
        <p className="mt-4 rounded-xl bg-[var(--admin-warning-soft)] px-3.5 py-2.5 text-sm text-[var(--admin-warning)]">
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
        <ul className="mt-4 flex flex-col divide-y divide-[var(--admin-border)]">
          {upcoming.map((v) => (
            <li key={v.r.id}>
              <Link
                href={karaokeDetailHref(v.r.id)}
                className="flex min-h-[44px] flex-wrap items-center justify-between gap-2 py-2 hover:text-[var(--admin-primary)]"
              >
                <span className="flex min-w-0 items-baseline gap-3">
                  <span className="text-sm font-medium" style={MONO_STYLE}>
                    {v.time}
                  </span>
                  <span className="truncate text-sm text-[var(--admin-text-soft)]">
                    {v.r.customerName || "İsimsiz"} · {v.r.guests} kişi
                  </span>
                </span>
                <Badge tone={v.paymentTone}>{v.paymentLabel}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-[var(--admin-text-soft)]">
          Bugün için sıradaki rezervasyon yok.
        </p>
      )}
    </Card>
  );
}
