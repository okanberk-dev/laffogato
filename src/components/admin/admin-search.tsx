"use client";

import {
  useActionState,
  type FormEvent,
  type FormHTMLAttributes,
  type Ref,
} from "react";

import { adminSearchAction } from "@/app/admin/ara/actions";
import { cx } from "@/components/laffogato/cx";
import {
  ADMIN_SEARCH_PATH,
  INITIAL_SEARCH_STATE,
  SEARCH_MAX_LENGTH,
} from "@/lib/admin/search-core";

/**
 * The panel's search box (P2b, decision D36). It POSTS: the text goes to
 * adminSearchAction in the request body, and the results page
 * (ADMIN_SEARCH_PATH) is the action's permalink. An e-mail or a phone
 * typed here therefore never sits in an address, the browser's history or
 * a request log (`?q=` did). Without JavaScript the browser posts the form
 * to the results page, which is drawn with the answer; with it, the box
 * hands the text to the results page in memory. What is searched, and for
 * whom: lib/admin/search.ts.
 *
 * The top bar no longer draws this box (admin UI v2, UI-6): it holds the
 * ⌘K palette's trigger (palette/trigger.tsx), a link to the results page
 * without JavaScript. The hand-off below still opens that page with a
 * text in memory for whichever caller needs it.
 */

export { ADMIN_SEARCH_PATH };

/** The top bar's text, waiting for the results page to pick it up. */
let handedOff: string | null = null;
const HANDOFF_EVENT = "admin:search";

/**
 * The top bar's search, handed to the results page in memory: the page
 * takes it when it mounts, or at once when it is already open.
 */
export function handOffSearch(text: string): void {
  handedOff = text;
  window.dispatchEvent(new Event(HANDOFF_EVENT));
}

/** The text handed off, once; null when there is none. */
export function takeHandedOffSearch(): string | null {
  const text = handedOff;
  handedOff = null;
  return text;
}

/**
 * The top bar's submit with JavaScript: the text is handed off and the
 * results page opened at its bare address (or, already open, it picks the
 * text up from the hand-off event). Exported for tests.
 */
export function sendToResultsPage(
  text: string,
  pathname: string,
  push: (href: string) => void,
): void {
  handOffSearch(text);
  if (pathname !== ADMIN_SEARCH_PATH) push(ADMIN_SEARCH_PATH);
}

/** Runs `onHandOff` for every hand-off while subscribed. */
export function subscribeHandOff(onHandOff: () => void): () => void {
  window.addEventListener(HANDOFF_EVENT, onHandOff);
  return () => window.removeEventListener(HANDOFF_EVENT, onHandOff);
}

/**
 * The search action with the results page as its permalink: the form is
 * drawn with `action="/admin/ara" method="POST"`, and a post without
 * JavaScript lands its answer in every box on that page.
 */
export function useAdminSearch() {
  return useActionState(
    adminSearchAction,
    INITIAL_SEARCH_STATE,
    ADMIN_SEARCH_PATH,
  );
}

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
  formAction,
  onSubmit,
  defaultValue = "",
  large = false,
  autoFocus = false,
  inputRef,
  className,
}: {
  /** Unique per page: the top bar and the results page both draw one. */
  id: string;
  /** useAdminSearch's dispatcher: the post without JavaScript. */
  formAction: FormHTMLAttributes<HTMLFormElement>["action"];
  /** The post with JavaScript. */
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  defaultValue?: string;
  /** The results page's own box. */
  large?: boolean;
  autoFocus?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  /** Includes the display (`flex`, or `hidden lg:flex`); default `flex`. */
  className?: string;
}) {
  return (
    <form
      action={formAction}
      onSubmit={onSubmit}
      role="search"
      className={cx("min-w-0 items-stretch gap-2", className ?? "flex")}
    >
      <label htmlFor={id} className="sr-only">
        Panelde ara
      </label>
      <input
        ref={inputRef}
        id={id}
        name="q"
        type="search"
        defaultValue={defaultValue}
        autoFocus={autoFocus}
        maxLength={SEARCH_MAX_LENGTH}
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
    </form>
  );
}
