// Client-safe (no server-only): the panel's palette, its recents and the
// saved list views ask the same question of a text before it goes anywhere
// that outlives the request (an address, sessionStorage, a saved view).

/**
 * The separators a phone number is written with: spaces (any kind), dots,
 * dashes (the hyphen and its Unicode cousins U+2010-U+2015, U+2212),
 * brackets and the leading plus. Dropped before the digits are counted, so
 * "0532 123 45 67", "+90 (532) 123-45-67" and "532.123.45.67" read alike.
 */
const PHONE_SEPARATORS = /[\s.()+‐-―−-]/g;

/**
 * Seven digits in a row: longer than an order number (five), the same
 * line search-core.ts draws when it reads a phone.
 */
const LONG_DIGITS = /\d{7,}/;

/**
 * Does this text look like it names a person: an e-mail address (it has an
 * "@") or a phone number (seven or more digits once the separators are
 * dropped)? What the operator types in the panel's search is an e-mail or
 * a phone as often as an order number, and such a text must not ride into
 * a link, the browser's history or a request log (CLAUDE.md rule 9).
 *
 * Deliberately loose: a false "yes" only costs a convenience (a list link
 * without the text), a false "no" leaks a customer. So a date written as
 * digits ("2026-10-19") counts too. NFKC first, so a full-width "＠" or
 * "０５３２…" pasted from a phone is read as what it shows.
 */
export function piiLike(text: string): boolean {
  if (typeof text !== "string" || text === "") return false;
  const plain = text.normalize("NFKC");
  if (plain.includes("@")) return true;
  return LONG_DIGITS.test(plain.replace(PHONE_SEPARATORS, ""));
}
