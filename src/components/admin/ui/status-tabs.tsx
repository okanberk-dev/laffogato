import Link from "next/link";

import { cx } from "@/components/laffogato/cx";
import {
  DEFAULT_PAGE_PARAM,
  withParams,
  type SearchParamsInput,
} from "@/lib/admin/list-params";

import { LinkPending } from "./link-pending";
import { COMPACT, MONO_STYLE } from "./styles";

export interface StatusTab {
  /** The param value; `null` for the "Tümü" tab (param removed). */
  value: string | null;
  label: string;
  /** Rows in this tab with the other filters applied; omit to hide. */
  count?: number;
}

/**
 * Filament-style status tabs: links (no JavaScript needed) that set one URL
 * param and keep the others, with a count on each. On phones the row
 * scrolls sideways instead of wrapping; from sm up it wraps, so every tab
 * stays in sight (the orders' eight ran off the card's edge at 1280 px,
 * where a mouse wheel cannot scroll sideways). 40 px targets, 44 on a
 * touch screen. A clicked tab marks itself while its list loads
 * (LinkPending).
 *
 * @example
 * <StatusTabs
 *   tabs={[{ value: null, label: "Tümü", count: 120 }, { value: "paid", label: "Ödendi", count: 8 }]}
 *   current={filters.durum ?? null}
 *   searchParams={sp}
 *   pathname="/admin/siparisler"
 * />
 */
export function StatusTabs({
  tabs,
  current,
  searchParams,
  pathname,
  param = "durum",
  pageParam = DEFAULT_PAGE_PARAM,
  label = "Durum",
}: {
  tabs: readonly StatusTab[];
  /** The active tab's value (`null` = Tümü). */
  current: string | null;
  searchParams?: SearchParamsInput;
  pathname: string;
  /** Default "durum". */
  param?: string;
  /** Dropped on every tab link: a new tab starts at page 1. */
  pageParam?: string;
  /** Accessible name of the tab row. */
  label?: string;
}) {
  return (
    <nav
      aria-label={label}
      className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0"
    >
      <ul className="inline-flex min-w-max gap-1 rounded-xl bg-[var(--admin-panel)] p-1 sm:max-w-full sm:min-w-0 sm:flex-wrap">
        {tabs.map((tab) => {
          const active = (tab.value ?? null) === (current ?? null);
          return (
            <li key={tab.value ?? "__all"}>
              <Link
                href={withParams(
                  searchParams,
                  { [param]: tab.value, [pageParam]: null },
                  pathname,
                )}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "relative inline-flex min-h-[40px] items-center gap-2 rounded-lg px-3 text-sm whitespace-nowrap transition-[color,background-color,box-shadow] duration-200 focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/45 focus-visible:outline-none pointer-coarse:min-h-11",
                  COMPACT.minH9,
                  active
                    ? "bg-[var(--admin-surface)] font-medium text-[var(--admin-text)] shadow-[0_1px_2px_rgba(28,25,23,0.08),0_0_0_1px_rgba(28,25,23,0.04)]"
                    : "text-[var(--admin-text-soft)] hover:text-[var(--admin-text)]",
                )}
              >
                {tab.label}
                {tab.count !== undefined ? (
                  <span
                    className={cx(
                      "rounded-full px-1.5 py-0.5 text-[11px] leading-none",
                      active
                        ? "bg-[var(--admin-primary)] text-white"
                        : "bg-[var(--admin-surface)] text-[var(--admin-text-soft)]",
                    )}
                    style={MONO_STYLE}
                  >
                    {tab.count}
                  </span>
                ) : null}
                <LinkPending />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
