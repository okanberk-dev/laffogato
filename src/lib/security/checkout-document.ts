/**
 * The checkout document: the one page of the site the card is typed on
 * (operator, 16 Eki 2026, docs/PAYNKOLAY.md §15.5).
 *
 * A document is only as safe as the scripts that ever ran in it. /odeme is
 * served under its own strict policy (`checkout-csp.ts`) and without Google
 * Tag Manager, but a client-side navigation INTO /odeme keeps the document
 * the visitor came from - its policy, and whatever GTM already loaded. So the
 * question that decides whether card fields may be shown is not "which path
 * is on screen" but "which path was this document loaded at".
 *
 * Pure and dependency-free: the proxy, the root layout's tag wrapper and the
 * checkout's own guard all read it, the last two in the browser.
 */

/**
 * The checkout's path, exactly - the same single path next.config.ts keeps
 * out of the site policy (`CSP_SOURCE`). `/odeme/*` pages (the return, the
 * success page, the app's failure page) are ordinary site pages, and
 * `/odeme/` never reaches a page: Next.js redirects it to `/odeme` first.
 */
export const CHECKOUT_DOCUMENT_PATH = "/odeme";

/** Whether `pathname` is the checkout page itself. */
export function isCheckoutPath(pathname: string | null | undefined): boolean {
  return pathname === CHECKOUT_DOCUMENT_PATH;
}

/**
 * Whether the document behind a Navigation Timing entry was loaded at the
 * checkout path. The entry's `name` is the document's own URL after
 * redirects (a 303 from the payment route back to `/odeme?odeme=...` reads
 * as `/odeme`). `null` when there is no entry to read: the caller decides.
 */
export function documentLoadedAtCheckout(
  navigationEntryName: string | null | undefined,
): boolean | null {
  if (!navigationEntryName) return null;
  try {
    return isCheckoutPath(new URL(navigationEntryName).pathname);
  } catch {
    return null;
  }
}
