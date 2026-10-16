/**
 * A short fingerprint of what a web checkout orders: the lines (product,
 * variant, quantity), who receives it, where, and the discount code.
 *
 * It decides when a retry may pay for the order an earlier attempt already
 * created (`startCheckoutAction`, docs/PAYNKOLAY.md §15.5): a declined card
 * must not mint a new order and a new stock and coupon claim on every try, but a customer who changed the basket or the
 * address must not pay for the old one either. The browser keeps the key of
 * its pending order (sessionStorage, next to the order id); the server
 * recomputes it from what is submitted and, before reusing anything,
 * compares the submission with the order row itself.
 *
 * Not a secret and not a security boundary - only change detection. Prices
 * are left out on purpose: the server prices every line from the database.
 * Pure and client-safe (no imports, no Web Crypto: it must also run on a
 * plain-http preview where `crypto.subtle` does not exist).
 */

export interface CartKeyLine {
  productId?: string;
  variantId?: string;
  name: string;
  qty: number;
}

export interface CartKeyInput {
  items: readonly CartKeyLine[];
  customerName: string;
  customerPhone: string;
  shippingAddress: string;
  promoCode?: string;
}

function tidy(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * cyrb53 (public domain): a fast 53-bit string hash, two 32-bit lanes. Plenty
 * for telling one basket from another; it is never used to authorise.
 */
function hash53(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0))
    .toString(16)
    .padStart(14, "0");
}

/** The fingerprint; 14 lowercase hex characters. */
export function checkoutCartKey(input: CartKeyInput): string {
  const lines = input.items
    .map((it) =>
      [
        it.productId ? `p:${it.productId}` : `n:${tidy(it.name)}`,
        it.variantId ?? "",
        String(it.qty),
      ].join("|"),
    )
    .sort();
  return hash53(
    JSON.stringify([
      lines,
      tidy(input.customerName),
      tidy(input.customerPhone),
      tidy(input.shippingAddress),
      tidy(input.promoCode ?? "").toUpperCase(),
    ]),
  );
}

/** What a stored key must look like before the server even compares it. */
export const CART_KEY_PATTERN = /^[0-9a-f]{14}$/;

/**
 * A short, non-reversible tag for a value the browser should not store as
 * is - the checkout marks its saved draft with the member's e-mail this way,
 * so a second member signing in on the same tab never sees the first one's
 * address.
 */
export function textFingerprint(text: string): string {
  return hash53(`owner|${text.trim().toLowerCase()}`);
}
