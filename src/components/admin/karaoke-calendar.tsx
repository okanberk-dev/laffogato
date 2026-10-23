import Link from "next/link";

import { cx } from "@/components/laffogato/cx";
import {
  calendarHours,
  dayHead,
  nowOffset,
  weekDays,
  weekLabel,
  weekLabelShort,
  weekStart,
} from "@/lib/admin/karaoke-calendar-core";
import {
  karaokeDetailHref,
  type KaraokeRowView,
} from "@/lib/admin/karaoke-panel";
import type { AdminTone } from "@/lib/admin/tone";

import { Badge } from "./ui/badge";
import { LinkPending } from "./ui/link-pending";
import { NUMERIC_STYLE } from "./ui/styles";
import { TONE_RULE, TONE_SOFT } from "./ui/tone";

/** One hour's height in the grid: 48 px, a two-hour booking 96. */
const HOUR_PX = 48;

/**
 * The block's colour: whose turn it is, as the list's payment column says
 * it. Paid green, waiting for its money amber, a request paid at the köşk
 * blue, money owed back red.
 */
function blockTone(v: KaraokeRowView): AdminTone {
  if (v.refundOwed || v.attention.length > 0) return "danger";
  if (v.money === "paid") return "success";
  if (v.money === "pending") return "warning";
  return "info";
}

export interface KaraokeWeekProps {
  /** The week's Monday (YYYY-MM-DD). */
  monday: string;
  /** Today on the köşk's calendar. */
  today: string;
  /** The köşk's clock now: the line across today's column. */
  clock: { hour: number; minute: number };
  /** The week's bookings (karaokeRowViews); cancelled ones are left out. */
  views: readonly KaraokeRowView[];
  /** The calendar's address for the weeks around it and for this week. */
  prevHref: string;
  nextHref: string;
  thisWeekHref: string | null;
  /** The address a booking's page leads back to. */
  back: string;
}

/**
 * The karaoke page's week (Innex's reservation calendar, 22 Eki 2026): the
 * days as columns, the hours as rows and each booking a block from its
 * first hour to its last, coloured by its money, linking to its page. One
 * room, so the blocks never overlap; a cancelled booking holds no hour and
 * is not drawn. On a phone the week is a list of days instead. Server-safe.
 */
export function KaraokeWeekCalendar({
  monday,
  today,
  clock,
  views,
  prevHref,
  nextHref,
  thisWeekHref,
  back,
}: KaraokeWeekProps) {
  const days = weekDays(monday);
  const live = views.filter((v) => v.live);
  const hours = calendarHours(live.map((v) => v.r));
  const span = hours.close - hours.first;
  const byDay = new Map(days.map((d) => [d, [] as KaraokeRowView[]]));
  for (const v of live) byDay.get(v.r.date)?.push(v);
  for (const list of byDay.values()) {
    list.sort((a, b) => a.r.startHour - b.r.startHour);
  }
  const nowAt = days.includes(today) ? nowOffset(clock, hours) : null;
  const total = live.length;

  return (
    <section aria-label={`Hafta: ${weekLabel(monday)}`} className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center rounded-lg border border-[var(--admin-border-strong)] bg-[var(--admin-surface)]">
            <Link
              href={prevHref}
              aria-label="Önceki hafta"
              className="relative inline-flex size-11 items-center justify-center rounded-l-lg text-[var(--admin-text-soft)] hover:bg-[var(--admin-surface-2)] hover:text-[var(--admin-text)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/40 focus-visible:outline-none pointer-fine:size-9"
            >
              <span aria-hidden="true">‹</span>
              <LinkPending className="bottom-1" />
            </Link>
            <span
              className="border-x border-[var(--admin-border)] px-3 text-sm font-medium whitespace-nowrap text-[var(--admin-text)]"
              style={NUMERIC_STYLE}
            >
              {/* Three-letter months on a phone: the long label did not
                  fit beside the arrows at 390 px (review of #231). */}
              <span className="sm:hidden">{weekLabelShort(monday)}</span>
              <span className="hidden sm:inline">{weekLabel(monday)}</span>
            </span>
            <Link
              href={nextHref}
              aria-label="Sonraki hafta"
              className="relative inline-flex size-11 items-center justify-center rounded-r-lg text-[var(--admin-text-soft)] hover:bg-[var(--admin-surface-2)] hover:text-[var(--admin-text)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/40 focus-visible:outline-none pointer-fine:size-9"
            >
              <span aria-hidden="true">›</span>
              <LinkPending className="bottom-1" />
            </Link>
          </div>
          {thisWeekHref ? (
            <Link
              href={thisWeekHref}
              className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-medium text-[var(--admin-primary)] underline-offset-4 hover:underline pointer-fine:min-h-9"
            >
              Bu hafta
            </Link>
          ) : null}
        </div>
        <p className="text-[13px] text-[var(--admin-text-mute)]">
          {/* "Bu hafta" only for this week: another week's count stands
              beside its own label (review of #231). */}
          {monday === weekStart(today)
            ? total > 0
              ? `Bu hafta ${total} rezervasyon`
              : "Bu hafta rezervasyon yok"
            : total > 0
              ? `${total} rezervasyon`
              : "Rezervasyon yok"}
          <span className="hidden sm:inline">
            {" "}
            · iptaller takvimde yok, listede
          </span>
        </p>
      </div>

      {/* From md: the grid. */}
      <div className="hidden overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] md:block">
        <div className="grid grid-cols-[3.25rem_repeat(7,minmax(0,1fr))] border-b border-[var(--admin-border)] bg-[var(--admin-surface-2)]">
          <span aria-hidden="true" />
          {days.map((d) => {
            const head = dayHead(d);
            const isToday = d === today;
            return (
              <div
                key={d}
                className="flex items-baseline justify-center gap-1.5 border-l border-[var(--admin-border)] px-1 py-2.5 text-[13px]"
              >
                <span className="text-[var(--admin-text-mute)]">
                  {head.short}
                </span>
                <span
                  className={cx(
                    "inline-flex min-w-6 justify-center rounded-md px-1 font-semibold",
                    isToday
                      ? "bg-[var(--admin-primary)] text-white"
                      : "text-[var(--admin-text)]",
                  )}
                  style={NUMERIC_STYLE}
                >
                  {head.date}
                </span>
                {isToday ? <span className="sr-only">(bugün)</span> : null}
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-[3.25rem_repeat(7,minmax(0,1fr))]">
          <div aria-hidden="true" className="relative">
            {Array.from({ length: span }, (_, i) => (
              <div
                key={i}
                style={{ height: HOUR_PX }}
                className="pr-2 text-right text-[11px] text-[var(--admin-text-mute)]"
              >
                <span
                  className={cx(
                    "relative bg-[var(--admin-surface)] px-0.5",
                    i === 0 ? "top-0.5" : "-top-2",
                  )}
                >
                  {`${String(hours.first + i).padStart(2, "0")}:00`}
                </span>
              </div>
            ))}
          </div>
          {days.map((d) => {
            const isToday = d === today;
            const list = byDay.get(d) ?? [];
            return (
              <div
                key={d}
                className={cx(
                  "relative border-l border-[var(--admin-border)]",
                  isToday && "bg-[var(--admin-primary-soft)]/40",
                )}
                style={{
                  height: span * HOUR_PX,
                  backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_PX - 1}px, var(--admin-divider) ${HOUR_PX - 1}px, var(--admin-divider) ${HOUR_PX}px)`,
                }}
              >
                <ol aria-label={`${dayHead(d).long} ${dayHead(d).date}`}>
                  {list.map((v) => {
                    const tone = blockTone(v);
                    return (
                      <li
                        key={v.r.id}
                        className="absolute inset-x-1"
                        style={{
                          top: (v.r.startHour - hours.first) * HOUR_PX + 2,
                          height: Math.max(1, v.r.hours) * HOUR_PX - 4,
                        }}
                      >
                        <Link
                          href={karaokeDetailHref(v.r.id, back)}
                          className={cx(
                            // A lift on hover, not a darker fill: the
                            // tone inks are AA on their fill as drawn
                            // (review of #231: brightness and opacity
                            // took them under 4.5:1).
                            "flex h-full min-w-0 flex-col overflow-hidden rounded-md border-l-2 px-2 py-1 text-xs transition-shadow hover:shadow-[0_1px_4px_rgba(12,14,27,0.18)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/50 focus-visible:outline-none",
                            TONE_SOFT[tone],
                            TONE_RULE[tone],
                          )}
                        >
                          <span className="font-semibold" style={NUMERIC_STYLE}>
                            {v.time}
                          </span>
                          <span className="truncate text-[var(--admin-text)]">
                            {v.r.customerName || "İsimsiz"}
                          </span>
                          {v.r.hours > 1 ? (
                            <span className="truncate">
                              {v.r.guests} kişi · {v.paymentLabel}
                            </span>
                          ) : (
                            <span className="sr-only">
                              {v.r.guests} kişi · {v.paymentLabel}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ol>
                {isToday && nowAt !== null ? (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-[var(--admin-danger)]"
                    style={{ top: `${nowAt * 100}%` }}
                  >
                    <span className="absolute -top-[3px] -left-[3px] size-2 rounded-full bg-[var(--admin-danger)]" />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Phones: the week as a list of days. */}
      <ol className="flex flex-col gap-3 md:hidden">
        {days.map((d) => {
          const head = dayHead(d);
          const list = byDay.get(d) ?? [];
          return (
            <li
              key={d}
              className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-[var(--admin-text)]">
                  {head.long}, {head.date} {head.month}
                </span>
                {d === today ? <Badge tone="primary">Bugün</Badge> : null}
              </div>
              {list.length === 0 ? (
                <p className="text-sm text-[var(--admin-text-mute)]">
                  Rezervasyon yok
                </p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {list.map((v) => {
                    const tone = blockTone(v);
                    return (
                      <li key={v.r.id}>
                        <Link
                          href={karaokeDetailHref(v.r.id, back)}
                          className={cx(
                            "flex min-h-11 items-center justify-between gap-3 rounded-md border-l-2 px-3 py-2 text-sm",
                            TONE_SOFT[tone],
                            TONE_RULE[tone],
                          )}
                        >
                          <span className="flex min-w-0 flex-col">
                            <span
                              className="font-semibold"
                              style={NUMERIC_STYLE}
                            >
                              {v.time}
                            </span>
                            <span className="truncate text-xs text-[var(--admin-text)]">
                              {v.r.customerName || "İsimsiz"} · {v.r.guests}{" "}
                              kişi
                            </span>
                          </span>
                          <span className="shrink-0 text-xs font-medium">
                            {v.paymentLabel}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ol>

      <ul
        aria-label="Renkler"
        className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--admin-text-mute)]"
      >
        {(
          [
            ["success", "Ödendi"],
            ["warning", "Ödeme bekliyor"],
            ["info", "Köşkte ödenecek"],
            ["danger", "İşlem bekliyor"],
          ] as const
        ).map(([tone, label]) => (
          <li key={tone} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={cx(
                "h-3 w-1 rounded-full",
                TONE_SOFT[tone],
                "border-l-2",
                TONE_RULE[tone],
              )}
            />
            {label}
          </li>
        ))}
      </ul>
    </section>
  );
}
