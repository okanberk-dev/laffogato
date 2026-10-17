/**
 * What the web checkout keeps in the tab's sessionStorage, and nothing else
 * (docs/PAYNKOLAY.md §15.5). Never a card detail - not the number, not the
 * code, not the name on the card, not the expiry.
 *
 * - `PENDING`: the order an unpaid attempt created - its id, its sealed
 *   payment payload, its basket key, when, and the totals the server
 *   quoted. A retry offers it back so a declined card does not mint a new
 *   order (`startCheckoutAction`).
 * - `DRAFT`: the delivery choice and the code, so a trip to the bank and
 *   back does not make the customer type the address again.
 *
 * Both go when the order succeeds (`/odeme/basarili`, `ClearCart`) or the
 * tab closes.
 */
export const CHECKOUT_PENDING_KEY = "laffogato_checkout_pending_v1";
export const CHECKOUT_DRAFT_KEY = "laffogato_checkout_draft_v1";
/** Guards the checkout's one-time reload against a loop. */
export const CHECKOUT_RELOAD_KEY = "laffogato_checkout_reload_v1";

export const CHECKOUT_SESSION_KEYS = [
  CHECKOUT_PENDING_KEY,
  CHECKOUT_DRAFT_KEY,
  CHECKOUT_RELOAD_KEY,
] as const;
