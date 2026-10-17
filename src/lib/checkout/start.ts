import type { DeliveryField } from "./delivery";

/**
 * What `startCheckoutAction` answers, shared by the action and the checkout.
 *
 * The action never sees a card. It creates (or reuses) the order and hands
 * back what the browser needs for the next step; the card goes from the
 * page's own native form straight to /odeme/paynkolay (docs/PAYNKOLAY.md
 * §15.5). Types only, plus nothing that reads the request: client-safe.
 */

/** One order line as the server priced it. */
export interface CheckoutQuoteLine {
  productId?: string;
  variantId?: string;
  unitPriceMinor: number;
  qty: number;
}

/**
 * The order as the server created it: the amounts the bank will be asked
 * for. The checkout compares `totalMinor` with the "Toplam (KDV dahil)"
 * shown right above the pay button and goes on to the bank only when they
 * agree; otherwise it shows the new amount and asks again (a price changed
 * in the panel, a code that could not be applied). That keeps "the total
 * shown before the payment obligation" true (Mesafeli Sözleşmeler
 * Yönetmeliği m.6, m.8) now that the card is typed before the order exists.
 */
export interface CheckoutQuote {
  orderId: string;
  /** The order's own basket key, with the code as it was applied. */
  cartKey: string;
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number;
  totalMinor: number;
  /** The code the order carries; empty when none was applied. */
  promoCode: string;
  /** A code was sent but could not be applied. */
  promoDropped: boolean;
  lines: CheckoutQuoteLine[];
}

export type CheckoutStartError =
  | { code: "consent"; message: string }
  | { code: "delivery"; field?: DeliveryField; message: string }
  | { code: "cart"; message: string }
  | { code: "limit"; minutes: number; message: string }
  | { code: "unavailable"; message: string };

export type CheckoutStart =
  /** The card is typed here: post it with this payload (`d`, `s`). */
  | { kind: "card"; d: string; s: string; quote: CheckoutQuote }
  /** Go to this address: a sign-in gate, or a provider with its own page. */
  | { kind: "redirect"; url: string; quote?: CheckoutQuote }
  /** Nothing to pay (a code covered it all); the order is settled. */
  | { kind: "paid"; url: string }
  | { kind: "error"; error: CheckoutStartError };

/**
 * A member's card saved AT PayNkolay (docs/PAYNKOLAY.md §16), as much of it
 * as the browser may see. The token never leaves the server: the pay form
 * names the card by `tranId` and the payment route looks the token up again
 * with the member's own key.
 */
export interface CheckoutSavedCard {
  tranId: string;
  last4: string;
  bank: string;
  brand: string;
  alias: string;
}

export type SavedCardsChange =
  { ok: true; cards: CheckoutSavedCard[] } | { ok: false; message: string };
