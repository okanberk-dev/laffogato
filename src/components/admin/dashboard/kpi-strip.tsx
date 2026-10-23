import Link from "next/link";

import { cx } from "@/components/laffogato/cx";
import type { AdminTone } from "@/lib/admin/tone";

import { HUE_INK, HUE_SOFT, type AdminHue } from "../ui/hues";
import { AdminIcon, type AdminIconName } from "../ui/icons";
import { TONE_INK, TONE_SOFT } from "../ui/tone";
import { NUMERIC_STYLE } from "../ui/styles";

/** One figure of a KPI strip. */
export interface KpiCell {
  key: string;
  label: string;
  value: string;
  /** What the figure is read against ("Geçen cuma bu saate kadar 7"). */
  reference?: string;
  /** The change against the reference's figure; `good` picks its colour. */
  delta?: {
    label: string;
    direction: "up" | "down";
    good: boolean;
    spoken: string;
  };
  /** The list the figure counts, or the view it switches to. */
  href?: string;
  /**
   * The cell is the view on screen (Raporlar's metric): Innex's selected
   * card tab, a pale blue ground over a 2 px blue rule.
   */
  current?: boolean;
  /** Colours the figure: it asks for a person. */
  tone?: AdminTone;
  /** Tabular digits, and the figure shrinks with its cell before it wraps. */
  money?: boolean;
  /** Decorative: the label names the figure. */
  icon?: AdminIconName;
  /** The icon box's colour; grey without. */
  hue?: AdminHue;
}

/**
 * How many columns the strip takes at each width, by its number of cells.
 * Five cells sit three over two from md (six columns, so the second row
 * has no hole) and in one row from xl; on a phone they pair up and an odd
 * last one takes the whole row. Written out for Tailwind's scanner.
 */
const GRID: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-2 md:grid-cols-3",
  4: "grid-cols-2 md:grid-cols-4",
  5: "grid-cols-2 md:grid-cols-6 xl:grid-cols-5",
};

/** The cell's span in GRID's columns. Pure, exported for tests. */
export function kpiSpan(index: number, count: number): string {
  const lastOdd = index === count - 1 && count % 2 === 1;
  if (count === 5) {
    return cx(
      lastOdd && "col-span-2",
      index < 3 ? "md:col-span-2" : "md:col-span-3",
      "xl:col-span-1",
    );
  }
  if (count === 3) return cx(lastOdd && "col-span-2", "md:col-span-1");
  return "";
}

/**
 * Innex's KPI strip (22 Eki 2026): one card, its figures side by side with
 * a hairline between them (the card's grey shows through a 1 px gap, so the
 * lines stay right however the cells wrap). Each cell, top to bottom: a
 * small tinted icon box beside the label, the figure, then a change pill
 * and the figure it is read against. With `href` the whole cell is a link;
 * with `current` it is the selected one of a set of card tabs. Server-safe.
 */
export function KpiStrip({
  cells,
  label,
  className,
}: {
  cells: readonly KpiCell[];
  /** The list's accessible name ("Bugünün özeti"). */
  label: string;
  className?: string;
}) {
  if (cells.length === 0) return null;
  return (
    <ul
      aria-label={label}
      className={cx(
        "grid gap-px overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-border)] print:border-[var(--admin-border-strong)]",
        GRID[cells.length] ?? "grid-cols-2 md:grid-cols-3 xl:grid-cols-6",
        className,
      )}
    >
      {cells.map((cell, i) => (
        <li
          key={cell.key}
          className={cx(
            "flex min-w-0 bg-[var(--admin-surface)]",
            kpiSpan(i, cells.length),
          )}
        >
          <KpiBody cell={cell} />
        </li>
      ))}
    </ul>
  );
}

function KpiBody({ cell }: { cell: KpiCell }) {
  const inner = (
    <>
      <span className="flex min-w-0 items-center gap-2">
        {cell.icon ? (
          <span
            aria-hidden="true"
            className={cx(
              "grid size-7 shrink-0 place-items-center rounded-lg print:hidden",
              cell.hue ? HUE_SOFT[cell.hue] : "bg-[var(--admin-panel)]",
              cell.tone
                ? TONE_INK[cell.tone]
                : cell.hue
                  ? HUE_INK[cell.hue]
                  : "text-[var(--admin-text-soft)]",
            )}
          >
            <AdminIcon name={cell.icon} size={16} />
          </span>
        ) : null}
        <span
          className={cx(
            "truncate text-[13px] font-medium",
            cell.current
              ? "text-[var(--admin-primary)]"
              : "text-[var(--admin-text-soft)]",
          )}
        >
          {cell.label}
        </span>
      </span>
      <span
        title={cell.value}
        className={cx(
          "mt-3 block leading-tight font-bold tracking-[-0.01em]",
          cell.money
            ? "text-[clamp(1.125rem,12cqi,1.5rem)] [overflow-wrap:anywhere]"
            : "truncate text-2xl",
          cell.tone ? TONE_INK[cell.tone] : "text-[var(--admin-text)]",
        )}
        style={NUMERIC_STYLE}
      >
        {cell.value}
      </span>
      {cell.delta || cell.reference ? (
        <span className="mt-2 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-[var(--admin-text-mute)]">
          {cell.delta ? (
            <span
              className={cx(
                "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-medium",
                TONE_SOFT[cell.delta.good ? "success" : "danger"],
              )}
              style={NUMERIC_STYLE}
            >
              <AdminIcon
                name={cell.delta.direction === "up" ? "deltaUp" : "deltaDown"}
                size={12}
                strokeWidth={2.25}
              />
              {cell.delta.label}
              <span className="sr-only"> {cell.delta.spoken}</span>
            </span>
          ) : null}
          {cell.reference ? (
            <span className="min-w-0 break-words">{cell.reference}</span>
          ) : null}
        </span>
      ) : null}
    </>
  );
  const frame = cx(
    "@container flex w-full min-w-0 flex-col p-4 xl:p-5",
    cell.current &&
      "bg-[var(--admin-primary-soft)] shadow-[inset_0_-2px_0_var(--admin-primary)]",
  );
  if (!cell.href) return <div className={frame}>{inner}</div>;
  return (
    <Link
      href={cell.href}
      aria-current={cell.current ? "true" : undefined}
      className={cx(
        frame,
        "transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/40 focus-visible:outline-none focus-visible:ring-inset",
        !cell.current && "hover:bg-[var(--admin-surface-2)]",
      )}
    >
      {inner}
    </Link>
  );
}
