import Form from "next/form";
import Link from "next/link";

import { cx } from "@/components/laffogato/cx";

/**
 * The panel's search box (P2b, decision D36): a GET form to /admin/ara, so
 * it works without JavaScript and the results page has an address of its
 * own. With JavaScript, next/form turns the submit into a client-side
 * navigation. What is searched, and for whom: lib/admin/search.ts.
 */

export const ADMIN_SEARCH_PATH = "/admin/ara";

function SearchIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.4-4.4" />
    </svg>
  );
}

export function AdminSearchField({
  id,
  defaultValue = "",
  large = false,
  autoFocus = false,
  className,
}: {
  /** Unique per page: the top bar and the results page both draw one. */
  id: string;
  defaultValue?: string;
  /** The results page's own box. */
  large?: boolean;
  autoFocus?: boolean;
  /** Includes the display (`flex`, or `hidden lg:flex`); default `flex`. */
  className?: string;
}) {
  return (
    <Form
      action={ADMIN_SEARCH_PATH}
      role="search"
      className={cx("min-w-0 items-stretch gap-2", className ?? "flex")}
    >
      <label htmlFor={id} className="sr-only">
        Panelde ara
      </label>
      <input
        id={id}
        name="q"
        type="search"
        defaultValue={defaultValue}
        autoFocus={autoFocus}
        maxLength={80}
        autoComplete="off"
        enterKeyHint="search"
        placeholder="Sipariş no, müşteri, ürün"
        className={cx(
          "min-w-0 flex-1 rounded-xl border border-[var(--admin-border-field)] bg-[var(--admin-surface)] px-3 text-[var(--admin-text)] placeholder:text-[var(--admin-text-mute)]",
          large ? "min-h-[44px] text-base" : "min-h-10 text-sm",
        )}
      />
      <button
        type="submit"
        aria-label="Ara"
        className={cx(
          "grid shrink-0 place-items-center rounded-xl bg-[var(--admin-primary)] text-white hover:bg-[var(--admin-primary-hover)]",
          large ? "min-h-[44px] min-w-[44px] px-4" : "h-10 w-10",
        )}
      >
        <SearchIcon />
      </button>
    </Form>
  );
}

/**
 * The top bar's search: the box itself on a wide screen; on a phone, where
 * the bar holds the menu button and the logo, a 44 px link to the results
 * page and its own box.
 */
export function TopBarSearch() {
  return (
    <>
      <Link
        href={ADMIN_SEARCH_PATH}
        aria-label="Ara"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-[var(--admin-border)] text-[var(--admin-text-soft)] hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)] lg:hidden"
      >
        <SearchIcon />
      </Link>
      <AdminSearchField
        id="admin-top-search"
        className="hidden w-72 lg:flex xl:w-80"
      />
    </>
  );
}
