/**
 * The `krk-` namespace in payment references.
 *
 * A karaoke booking is paid through the same POS as an order, and its payment
 * rows live in `payment_transactions` with `"orderId"` = the reservation id
 * (`krk-00042`). PayNkolay carries that id as `clientRefCode`
 * (docs/PAYNKOLAY.md §14.2), so every place that gets a reference back from
 * the POS - the browser return, the payment page's expiry notice, the sweeps -
 * asks this one predicate whether it is holding a booking or an order. Two
 * spellings of the test would be two places to disagree.
 *
 * Pure and dependency-free on purpose: the card path
 * (`src/app/odeme/paynkolay/route.ts`) imports it, and that path must reach no
 * database and no store (CLAUDE.md rule 28, tests/saved-cards.test.ts).
 */

/** `nextSeq("krk")`, padded to five digits: `krk-00042`, later `krk-100000`. */
const KARAOKE_REF = /^krk-\d{1,12}$/;

export function isKaraokeRef(ref: string | null | undefined): boolean {
  return typeof ref === "string" && KARAOKE_REF.test(ref);
}
