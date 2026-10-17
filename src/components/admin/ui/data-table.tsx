import Link from "next/link";
import type { ReactNode } from "react";

import { cx } from "@/components/laffogato/cx";
import {
  DEFAULT_DIR_PARAM,
  DEFAULT_PAGE_PARAM,
  DEFAULT_SORT_PARAM,
  nextSortDir,
  withParams,
  type SearchParamsInput,
  type SortDir,
  type SortState,
} from "@/lib/admin/list-params";

import { RowCheckbox, SelectAllCheckbox, type Selection } from "../bulk";
import { EmptyState } from "./detail";
import { LinkPending } from "./link-pending";
import { EYEBROW, MONO_STYLE } from "./styles";

export interface DataTableColumn<T> {
  /** Stable id; also the `sirala` value when the column is sortable. */
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Header becomes a sort link (the page must accept `key` in parseSort). */
  sortable?: boolean;
  /** Direction of the first click on this column; default "asc". */
  firstDir?: SortDir;
  align?: "left" | "center" | "right";
  /**
   * Hide the column below this breakpoint. The table itself starts at `md`
   * (phones get cards), so `sm` / `md` only keep the column off the default
   * phone card; `lg` / `xl` also hide it in narrower tables. Any value keeps
   * the column off the default phone card.
   */
  hideBelow?: "sm" | "md" | "lg" | "xl";
  /** Extra classes on its th and td. */
  className?: string;
}

export interface DataTableProps<T> {
  columns: ReadonlyArray<DataTableColumn<T>>;
  rows: readonly T[];
  rowKey: (row: T) => string;
  /** Wraps the FIRST column's cell (and the phone card's title) in a link. */
  rowHref?: (row: T) => string | null | undefined;
  /**
   * Checkboxes per row and a select-all in the header: pass the parent's
   * `useSelection()` (components/admin/bulk.tsx). That makes the parent a
   * client component; without `selection` DataTable renders on the server.
   */
  selection?: Selection;
  /** Accessible name of a row's checkbox, e.g. `Sipariş 10023`. */
  rowLabel?: (row: T) => string;
  /** Last column: usually an ActionMenu. */
  rowActions?: (row: T) => ReactNode;
  /** Extra classes for a row and its phone card (a "yeni" ring, a muted row). */
  rowClassName?: (row: T) => string | false | null | undefined;
  /** Shown instead of the table when `rows` is empty. */
  empty?: ReactNode;
  /**
   * The phone layout (below `md`): one card per row. Without it the card
   * lists every column as label: value, the first column as its title.
   */
  mobileCard?: (row: T) => ReactNode;
  /** Visually hidden caption naming the table for screen readers. */
  caption?: string;
  /** The current sort (from parseSort), to mark its header. */
  sort?: SortState | null;
  /** Current params and path, so sort links keep every other filter. */
  searchParams?: SearchParamsInput;
  pathname?: string;
  sortParam?: string;
  dirParam?: string;
  /** Dropped from sort links (a new order starts at page 1). */
  pageParam?: string;
}

const ALIGN: Record<NonNullable<DataTableColumn<unknown>["align"]>, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

// The row-action column stays in view while a wide table scrolls sideways
// (admin audit ORD-02, KAR-03): at 768-1366 px the orders and karaoke
// tables were wider than their card and the "⋯" menu, the row's only
// action, sat behind a scrollbar 50 rows down. Pinned cells need a ground
// of their own, the same as the row's: white, the hover ground, or, for a
// selected row, the selection tint as it shows over white (the row's
// tint is see-through, which a pinned cell must not be). A hairline on its
// left edge says the row goes on underneath.
const PINNED = "sticky right-0 shadow-[inset_1px_0_0_var(--admin-border)]";
const PINNED_GROUND = "bg-[var(--admin-surface)]";
const PINNED_SELECTED =
  "bg-[color-mix(in_srgb,var(--admin-primary-soft)_50%,var(--admin-surface))]";

const HIDE_BELOW: Record<
  NonNullable<DataTableColumn<unknown>["hideBelow"]>,
  string
> = {
  sm: "",
  md: "",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
};

function SortGlyph({ dir }: { dir: SortDir | null }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "inline-block w-3 text-[11px] leading-none",
        dir ? "text-[var(--admin-primary)]" : "text-[var(--admin-text-mute)]",
      )}
    >
      {dir === "asc" ? "↑" : dir === "desc" ? "↓" : "↕"}
    </span>
  );
}

/**
 * The panel's list table (Filament's table): sortable headers as links that
 * keep the other URL params, optional row selection for a bulk bar, a row
 * action column, an empty state, and cards instead of rows on phones.
 *
 * No hooks: renders on the server from a page, or inside a client list that
 * owns the selection. Column `cell` functions run wherever DataTable runs.
 *
 * @example
 * <DataTable
 *   rows={orders}
 *   rowKey={(o) => o.id}
 *   rowHref={(o) => `/admin/siparisler/${o.id}`}
 *   columns={[
 *     { key: "no", header: "No", cell: (o) => `#${o.orderNo}`, sortable: true, firstDir: "desc" },
 *     { key: "durum", header: "Durum", cell: (o) => <OrderStatusBadge order={o} /> },
 *     { key: "tutar", header: "Tutar", align: "right", cell: (o) => formatTRY(o.totalMinor), sortable: true },
 *   ]}
 *   sort={sort}
 *   searchParams={sp}
 *   pathname="/admin/siparisler"
 *   rowActions={(o) => <ActionMenu label={`Sipariş ${o.orderNo}`}>…</ActionMenu>}
 * />
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  rowHref,
  selection,
  rowLabel,
  rowActions,
  rowClassName,
  empty,
  mobileCard,
  caption,
  sort = null,
  searchParams,
  pathname = "",
  sortParam = DEFAULT_SORT_PARAM,
  dirParam = DEFAULT_DIR_PARAM,
  pageParam = DEFAULT_PAGE_PARAM,
}: DataTableProps<T>) {
  if (rows.length === 0) {
    return <>{empty ?? <EmptyState title="Kayıt yok." />}</>;
  }

  const ids = selection ? rows.map(rowKey) : [];
  const [first, ...others] = columns;
  const rest = others.filter((col) => !col.hideBelow);

  const linked = (row: T, content: ReactNode) => {
    const href = rowHref?.(row);
    if (!href) return content;
    return (
      <Link
        href={href}
        className="font-medium text-[var(--admin-text)] underline-offset-4 hover:text-[var(--admin-primary)] hover:underline focus-visible:rounded focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/45 focus-visible:outline-none"
      >
        {content}
      </Link>
    );
  };

  const header = (col: DataTableColumn<T>) => {
    if (!col.sortable) return col.header;
    const active = sort && sort.key === col.key ? sort.dir : null;
    const href = withParams(
      searchParams,
      {
        [sortParam]: col.key,
        [dirParam]: nextSortDir(sort, col.key, col.firstDir ?? "asc"),
        [pageParam]: null,
      },
      pathname,
    );
    return (
      <Link
        href={href}
        className={cx(
          "relative inline-flex items-center gap-1 rounded hover:text-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/45 focus-visible:outline-none",
          col.align === "right" && "flex-row-reverse",
        )}
      >
        <span>{col.header}</span>
        <SortGlyph dir={active} />
        <span className="sr-only">
          {active === "asc"
            ? ", artan sıralı; azalana çevir"
            : active === "desc"
              ? ", azalan sıralı; artana çevir"
              : ", sırala"}
        </span>
        <LinkPending className="-bottom-1" />
      </Link>
    );
  };

  return (
    <>
      {/* Phones: one card per row. */}
      <ul className="flex flex-col gap-3 md:hidden">
        {rows.map((row) => {
          const id = rowKey(row);
          return (
            <li
              key={id}
              className={cx(
                "rounded-xl border bg-[var(--admin-surface)] p-4 shadow-[0_1px_3px_rgba(68,48,28,0.06)]",
                selection?.has(id)
                  ? "border-[var(--admin-primary)]"
                  : "border-[var(--admin-border)]",
                rowClassName?.(row),
              )}
            >
              <div className="flex items-start gap-3">
                {selection ? (
                  <div className="pt-0.5">
                    <RowCheckbox
                      id={id}
                      selection={selection}
                      label={rowLabel?.(row)}
                    />
                  </div>
                ) : null}
                <div className="min-w-0 flex-1">
                  {mobileCard ? (
                    mobileCard(row)
                  ) : (
                    <>
                      {first ? (
                        <div className="text-sm">
                          {linked(row, first.cell(row))}
                        </div>
                      ) : null}
                      {rest.length > 0 ? (
                        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                          {rest.map((col) => (
                            <div key={col.key} className="contents">
                              <dt className={EYEBROW} style={MONO_STYLE}>
                                {col.header}
                              </dt>
                              <dd className="min-w-0 text-[var(--admin-text)]">
                                {col.cell(row)}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      ) : null}
                    </>
                  )}
                </div>
                {rowActions ? (
                  <div className="shrink-0">{rowActions(row)}</div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {/* From md: the table. `relative` makes the scroll box the containing
          block of the sr-only header texts (absolutely positioned): without
          it they hung past the viewport and the whole page scrolled
          sideways (ORD-M01). */}
      <div className="relative hidden overflow-x-auto rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[0_1px_3px_rgba(68,48,28,0.06)] md:block">
        <table className="w-full border-collapse text-sm">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead>
            <tr className={EYEBROW} style={MONO_STYLE}>
              {selection ? (
                <th scope="col" className="w-10 px-4 py-3 text-left">
                  <SelectAllCheckbox ids={ids} selection={selection} />
                </th>
              ) : null}
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={
                    sort && sort.key === col.key
                      ? sort.dir === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                  className={cx(
                    "px-4 py-3 font-normal whitespace-nowrap",
                    ALIGN[col.align ?? "left"],
                    col.hideBelow && HIDE_BELOW[col.hideBelow],
                    col.className,
                  )}
                >
                  {header(col)}
                </th>
              ))}
              {rowActions ? (
                <th
                  scope="col"
                  className={cx(
                    "w-14 px-4 py-3 text-right",
                    PINNED,
                    PINNED_GROUND,
                  )}
                >
                  <span className="sr-only">İşlemler</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const id = rowKey(row);
              const selected = selection?.has(id) ?? false;
              return (
                <tr
                  key={id}
                  className={cx(
                    "group border-t border-[var(--admin-border)] align-middle transition-colors hover:bg-[var(--admin-surface-2)]",
                    selected && "bg-[var(--admin-primary-soft)]/50",
                    rowClassName?.(row),
                  )}
                >
                  {selection ? (
                    <td className="px-4 py-3">
                      <RowCheckbox
                        id={id}
                        selection={selection}
                        label={rowLabel?.(row)}
                      />
                    </td>
                  ) : null}
                  {columns.map((col, i) => (
                    <td
                      key={col.key}
                      className={cx(
                        "px-4 py-3 text-[var(--admin-text)]",
                        ALIGN[col.align ?? "left"],
                        col.hideBelow && HIDE_BELOW[col.hideBelow],
                        col.className,
                      )}
                    >
                      {i === 0 ? linked(row, col.cell(row)) : col.cell(row)}
                    </td>
                  ))}
                  {rowActions ? (
                    <td
                      className={cx(
                        "px-4 py-2 text-right transition-colors group-hover:bg-[var(--admin-surface-2)]",
                        PINNED,
                        selected ? PINNED_SELECTED : PINNED_GROUND,
                      )}
                    >
                      {rowActions(row)}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
