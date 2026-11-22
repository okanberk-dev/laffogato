import { useId, type ReactNode } from "react";

import { cx } from "@/components/laffogato/cx";
import type { AdminTone } from "@/lib/admin/tone";

import { formatDateTime } from "../forms";
import { CARD, CARD_TITLE, COMPACT, LABEL, MONO_STYLE } from "./styles";
import { TONE_DOT } from "./tone";

// Detail-page building blocks (Filament's "infolist"). Server- and
// client-safe: no state, no effects.

export interface SectionProps {
  title: ReactNode;
  /** One line under the title. */
  description?: ReactNode;
  /** Buttons or an ActionMenu on the right of the header. */
  actions?: ReactNode;
  /** Anchor id (e.g. "odeme"), so a link can jump to the section. */
  id?: string;
  /** Drop the body padding, for a DataTable or a list that draws its own. */
  flush?: boolean;
  className?: string;
  children: ReactNode;
}

/** A titled card: one topic of a record (Kalemler, Ödeme, Teslimat…). */
export function Section({
  title,
  description,
  actions,
  id,
  flush = false,
  className,
  children,
}: SectionProps) {
  const headingId = `${useId()}-h`;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cx(
        // StorageBox's card; on paper its line darkens a step so the box prints.
        CARD,
        "print:border-[var(--admin-border-strong)]",
        className,
      )}
    >
      <header
        className={cx(
          "flex flex-wrap items-center justify-between gap-3 px-4 pt-4 pb-0 sm:px-6 sm:pt-5",
          COMPACT.px4,
          COMPACT.py2,
        )}
      >
        <div className="min-w-0">
          <h2 id={headingId} className={CARD_TITLE}>
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-sm text-[var(--admin-text-mute)]">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </header>
      <div className={flush ? undefined : cx("p-4 sm:p-6 sm:pt-5", COMPACT.p4)}>
        {children}
      </div>
    </section>
  );
}

export interface KeyValueItem {
  label: ReactNode;
  /** `null`, `undefined` or "" shows the grid's `empty` text. */
  value: ReactNode;
  /** Small text under the value. */
  hint?: ReactNode;
  /** Take the whole row (an address, a note). */
  full?: boolean;
  /** Mono digits for numbers, codes, references. */
  mono?: boolean;
}

/**
 * Label / value pairs as a `<dl>`, one column on phones, `columns` from
 * `sm` up. `false` / `null` items are skipped, so conditional rows can be
 * written inline: `order.carrier && { label: "Kargo", value: order.carrier }`.
 * Labels are 12px sentence case (LABEL), as written.
 *
 * `layout="inline"` is Innex's key-value summary for a narrow column (the
 * order page's left side): one row per pair, the label grey on the left and
 * the value dark on the right. A `full` item (an address) keeps the
 * stacked shape there.
 */
export function KeyValueGrid({
  items,
  columns = 2,
  empty = "-",
  layout = "stacked",
  className,
}: {
  items: ReadonlyArray<KeyValueItem | false | null | undefined>;
  columns?: 1 | 2 | 3;
  empty?: ReactNode;
  layout?: "stacked" | "inline";
  className?: string;
}) {
  const shown = items.filter((i): i is KeyValueItem => Boolean(i));
  const valueOf = (item: KeyValueItem) => {
    const blank =
      item.value === null || item.value === undefined || item.value === "";
    return {
      blank,
      body: (
        <>
          {blank ? empty : item.value}
          {item.hint ? (
            <span className="mt-0.5 block text-xs text-[var(--admin-text-soft)]">
              {item.hint}
            </span>
          ) : null}
        </>
      ),
    };
  };
  if (layout === "inline") {
    return (
      <dl className={cx("flex flex-col gap-3", className)}>
        {shown.map((item, i) => {
          const { blank, body } = valueOf(item);
          const ink = blank
            ? "text-[var(--admin-text-soft)]"
            : "text-[var(--admin-text)]";
          return item.full ? (
            <div key={i} className="min-w-0">
              <dt className={LABEL}>{item.label}</dt>
              <dd
                className={cx("mt-1 text-sm break-words", ink)}
                style={item.mono ? MONO_STYLE : undefined}
              >
                {body}
              </dd>
            </div>
          ) : (
            <div
              key={i}
              className="flex min-w-0 items-baseline justify-between gap-4"
            >
              <dt className="shrink-0 text-[13px] text-[var(--admin-text-mute)]">
                {item.label}
              </dt>
              <dd
                className={cx(
                  "min-w-0 text-right text-sm [overflow-wrap:anywhere]",
                  ink,
                )}
                style={item.mono ? MONO_STYLE : undefined}
              >
                {body}
              </dd>
            </div>
          );
        })}
      </dl>
    );
  }
  return (
    <dl
      className={cx(
        "grid grid-cols-1 gap-x-6 gap-y-4",
        columns === 2 && "sm:grid-cols-2",
        columns === 3 && "sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {shown.map((item, i) => {
        const { blank, body } = valueOf(item);
        return (
          <div
            key={i}
            className={cx("min-w-0", item.full && "sm:col-span-full")}
          >
            <dt className={LABEL}>{item.label}</dt>
            <dd
              className={cx(
                "mt-1 text-sm break-words",
                blank
                  ? "text-[var(--admin-text-soft)]"
                  : "text-[var(--admin-text)]",
              )}
              style={item.mono ? MONO_STYLE : undefined}
            >
              {body}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export interface TimelineItem {
  /** Stable key. */
  id: string;
  /** ISO-8601 instant. */
  at: string;
  title: ReactNode;
  description?: ReactNode;
  /** Who did it ("info@…", "Sistem", "Geliver"). */
  actor?: ReactNode;
  /** Dot colour; default `neutral`. */
  tone?: AdminTone;
}

function instant(at: string): number {
  const t = Date.parse(at);
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Events in time order: stage stamps, refunds, mails, audit rows merged into
 * one list. Sorted here (newest first by default), so callers can simply
 * concatenate their sources. Times print on the köşk's clock.
 */
export function Timeline({
  items,
  newestFirst = true,
  empty = "Henüz kayıt yok.",
}: {
  items: readonly TimelineItem[];
  newestFirst?: boolean;
  empty?: ReactNode;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-[var(--admin-text-soft)]">{empty}</p>;
  }
  const sorted = [...items].sort((a, b) =>
    newestFirst ? instant(b.at) - instant(a.at) : instant(a.at) - instant(b.at),
  );
  return (
    <ol className="relative flex flex-col gap-4 border-l border-dashed border-[var(--admin-border-strong)] pl-5">
      {sorted.map((item) => (
        <li key={item.id} className="relative">
          <span
            aria-hidden="true"
            className={cx(
              "absolute top-1.5 -left-[25px] h-2.5 w-2.5 rounded-full ring-4 ring-[var(--admin-surface)]",
              TONE_DOT[item.tone ?? "neutral"],
            )}
          />
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <div className="text-sm font-medium text-[var(--admin-text)]">
              {item.title}
            </div>
            <time
              dateTime={item.at}
              className="text-xs text-[var(--admin-text-soft)]"
              style={MONO_STYLE}
            >
              {formatDateTime(item.at)}
            </time>
          </div>
          {item.description ? (
            <div className="mt-0.5 text-sm text-[var(--admin-text-soft)]">
              {item.description}
            </div>
          ) : null}
          {item.actor ? (
            <div className="mt-0.5 text-xs text-[var(--admin-text-soft)]">
              {item.actor}
            </div>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

/**
 * What a list or section shows when it has nothing: one sentence saying so,
 * and `action`, the one next step ("Yeni kampanya"). A list that is empty
 * because of its filters always offers "Filtreyi temizle". Innex's empty
 * state (22 Eki 2026): a quiet glyph in a circle over the sentence, the
 * explanation in the label grey, the step under it. The glyph is drawn
 * inline: this box is in nearly every chunk, and no icon set comes with it.
 */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex flex-col items-center gap-2 rounded-xl border border-dashed border-[var(--admin-border-strong)] bg-[var(--admin-surface-2)] px-6 py-10 text-center",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="mb-1 grid size-10 place-items-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-text-mute)]"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-5"
        >
          <path d="M22 12h-6l-2 3h-4l-2-3H2" />
          <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
        </svg>
      </span>
      <p className="text-[15px] font-semibold text-[var(--admin-text)]">
        {title}
      </p>
      {description ? (
        <p className="max-w-md text-[13px] leading-5 text-[var(--admin-text-mute)]">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
