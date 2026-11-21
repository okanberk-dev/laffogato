import { cx } from "@/components/laffogato/cx";
import Link from "@/components/link";
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
   * The cell is the view on screen (Raporlar's metric): the selected card
   * tab, a pale blue ground inside a blue line.
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

/**
 * With `lead`: the first figure (the dashboard's net revenue) takes two
 * columns, StorageBox's one leading number; the rest one each. On a phone
 * it takes the whole first row and the others pair up under it.
 */
const GRID_LEAD: Record<number, string> = {
  4: "grid-cols-2 md:grid-cols-5",
  5: "grid-cols-2 md:grid-cols-6",
};

function kpiLeadSpan(index: number, count: number): string {
  if (index === 0) return "col-span-2";
  if (count === 4) return index === 3 ? "col-span-2 md:col-span-1" : "";
  // Five: three over two from md (2 + 2 + 2, 3 + 3), one row once the
  // labels fit beside the sidebar (at 1280 px "Bugünkü sipariş" was cut).
  return index < 3
    ? "md:col-span-2 min-[86.25rem]:col-span-1"
    : "md:col-span-3 min-[86.25rem]:col-span-1";
}

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
 * StorageBox's stat cards (21 Kas 2026): each figure its own white card on
 * the canvas, side by side in the grid's gutter. Each card, top to bottom:
 * a 32 px round icon in the nav group's colour (and an arrow when it is a
 * link), the label, the figure in DM Sans, then a grey change pill and the
 * figure it is read against. With `href` the whole card is a link (its line
 * darkens on hover); with `current` it is the selected one of a set of card
 * tabs. Server-safe.
 */
export function KpiStrip({
  cells,
  label,
  className,
  linkScroll = true,
  lead = false,
}: {
  cells: readonly KpiCell[];
  /** The first figure leads: two columns wide (four or five cells). */
  lead?: boolean;
  /** The list's accessible name ("Bugünün özeti"). */
  label: string;
  className?: string;
  /**
   * False when the cells are card tabs of the same page (Raporlar): a tab
   * keeps the page where it is, the chart it switches is right under it.
   */
  linkScroll?: boolean;
}) {
  if (cells.length === 0) return null;
  const leads = lead && GRID_LEAD[cells.length] !== undefined;
  return (
    <ul
      aria-label={label}
      className={cx(
        "grid gap-3 sm:gap-4 xl:gap-5",
        leads
          ? cx(
              GRID_LEAD[cells.length],
              cells.length === 5 ? "min-[86.25rem]:grid-cols-6" : null,
            )
          : (GRID[cells.length] ?? "grid-cols-2 md:grid-cols-3 xl:grid-cols-6"),
        className,
      )}
    >
      {cells.map((cell, i) => (
        <li
          key={cell.key}
          className={cx(
            "flex min-w-0 overflow-hidden rounded-xl border bg-[var(--admin-surface)] transition-colors duration-150 print:border-[var(--admin-border-strong)]",
            cell.current
              ? "border-[var(--admin-primary)]"
              : "border-[var(--admin-card-border)] has-[a:hover]:border-[var(--admin-border-strong)]",
            leads ? kpiLeadSpan(i, cells.length) : kpiSpan(i, cells.length),
          )}
        >
          <KpiBody cell={cell} scroll={linkScroll} />
        </li>
      ))}
    </ul>
  );
}

function KpiBody({ cell, scroll }: { cell: KpiCell; scroll: boolean }) {
  const inner = (
    <>
      <span className="flex min-w-0 items-center justify-between gap-2">
        {cell.icon ? (
          <span
            aria-hidden="true"
            className={cx(
              "grid size-8 shrink-0 place-items-center rounded-full print:hidden",
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
        {cell.href && !cell.current ? (
          <span
            aria-hidden="true"
            className="grid size-7 shrink-0 place-items-center rounded-full text-[var(--admin-text-mute)] transition-colors group-hover/kpi:bg-[var(--admin-panel)] group-hover/kpi:text-[var(--admin-text)] print:hidden"
          >
            <AdminIcon name="deltaUp" size={15} />
          </span>
        ) : null}
      </span>
      <span
        className={cx(
          "mt-4 block truncate text-sm",
          cell.current
            ? "font-medium text-[var(--admin-primary)]"
            : "text-[var(--admin-text-soft)]",
        )}
      >
        {cell.label}
      </span>
      <span
        title={cell.value}
        className={cx(
          "admin-display mt-1 block leading-[1.1] font-normal tracking-[-0.04em]",
          cell.money
            ? "text-[clamp(1.375rem,14cqi,var(--admin-kpi))] [overflow-wrap:anywhere]"
            : "truncate text-[length:var(--admin-kpi)]",
          cell.tone ? TONE_INK[cell.tone] : "text-[var(--admin-text)]",
        )}
      >
        {cell.value}
      </span>
      {cell.delta || cell.reference ? (
        <span className="mt-3 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--admin-text-mute)]">
          {cell.delta ? (
            <span
              className={cx(
                "inline-flex min-h-6 items-center gap-1 rounded-full px-2.5 py-0.5 font-medium",
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
    "group/kpi @container flex w-full min-w-0 flex-col p-4 sm:p-5 xl:p-6",
    cell.current && "bg-[var(--admin-primary-soft)]",
  );
  if (!cell.href) return <div className={frame}>{inner}</div>;
  return (
    <Link
      href={cell.href}
      scroll={scroll}
      aria-current={cell.current ? "true" : undefined}
      className={cx(
        frame,
        "transition-colors duration-150 focus-visible:ring-[3px] focus-visible:ring-[var(--admin-ring)] focus-visible:outline-none focus-visible:ring-inset",
      )}
    >
      {inner}
    </Link>
  );
}
