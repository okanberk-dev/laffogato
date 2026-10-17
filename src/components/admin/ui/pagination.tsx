import Link from "next/link";

import { cx } from "@/components/laffogato/cx";
import {
  DEFAULT_PAGE_PARAM,
  pageCount,
  pageRangeLabel,
  pageWindow,
  withParams,
  type SearchParamsInput,
} from "@/lib/admin/list-params";

import { LinkPending } from "./link-pending";
import { MONO_STYLE } from "./styles";

// 44px, the panel's touch target (it was 40px; SHE-32). `relative` holds a
// link's LinkPending mark.
const CELL =
  "relative inline-flex h-11 min-w-11 items-center justify-center rounded-lg px-2 text-sm focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/45 focus-visible:outline-none";

/**
 * "1-100 / 250" and numbered page links that keep every other URL param.
 * For filtered or sorted views; the live, unfiltered order list keeps its
 * keyset "Daha eski" paging.
 *
 * Page 1 drops the param, so the first page has one URL.
 *
 * @example
 * <Pagination page={page} pageSize={100} total={total} searchParams={sp} pathname="/admin/siparisler" />
 */
export function Pagination({
  page,
  pageSize,
  total,
  searchParams,
  pathname,
  param = DEFAULT_PAGE_PARAM,
  label = "Sayfalar",
}: {
  /** 1-based, from parsePage. */
  page: number;
  pageSize: number;
  /** Rows across all pages. */
  total: number;
  searchParams?: SearchParamsInput;
  pathname: string;
  /** Default "sayfa". */
  param?: string;
  label?: string;
}) {
  const count = pageCount(total, pageSize);
  const current = Math.min(Math.max(1, page), count);
  const href = (n: number) =>
    withParams(searchParams, { [param]: n === 1 ? null : n }, pathname);

  return (
    <nav
      aria-label={label}
      className="mt-4 flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-sm text-[var(--admin-text-soft)]" style={MONO_STYLE}>
        {pageRangeLabel(current, pageSize, total)}
      </p>
      {count > 1 ? (
        <ul className="flex flex-wrap items-center gap-1">
          {current > 1 ? (
            <li>
              <Link
                href={href(current - 1)}
                rel="prev"
                className={cx(
                  CELL,
                  "text-[var(--admin-text-soft)] hover:bg-[var(--admin-surface-2)]",
                )}
              >
                <span aria-hidden="true">‹</span>
                <span className="sr-only">Önceki sayfa</span>
                <LinkPending />
              </Link>
            </li>
          ) : null}
          {pageWindow(current, count).map((n, i) =>
            n === null ? (
              <li
                key={`gap-${i}`}
                aria-hidden="true"
                className={cx(CELL, "text-[var(--admin-text-soft)]")}
              >
                …
              </li>
            ) : (
              <li key={n}>
                <Link
                  href={href(n)}
                  aria-current={n === current ? "page" : undefined}
                  aria-label={`Sayfa ${n}`}
                  className={cx(
                    CELL,
                    n === current
                      ? "bg-[var(--admin-primary)] font-medium text-white"
                      : "text-[var(--admin-text)] hover:bg-[var(--admin-surface-2)]",
                  )}
                  style={MONO_STYLE}
                >
                  {n}
                  <LinkPending />
                </Link>
              </li>
            ),
          )}
          {current < count ? (
            <li>
              <Link
                href={href(current + 1)}
                rel="next"
                className={cx(
                  CELL,
                  "text-[var(--admin-text-soft)] hover:bg-[var(--admin-surface-2)]",
                )}
              >
                <span aria-hidden="true">›</span>
                <span className="sr-only">Sonraki sayfa</span>
                <LinkPending />
              </Link>
            </li>
          ) : null}
        </ul>
      ) : null}
    </nav>
  );
}
