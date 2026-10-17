const DATE_FORMATTER = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

export function formatDate(value: string | Date): string {
  return DATE_FORMATTER.format(
    typeof value === "string" ? new Date(value) : value,
  );
}

/**
 * The customer-facing price string for a minor-unit amount.
 *
 * Kuruş are shown only when there are any, so ₺185 stays "185₺" while ₺184,90
 * is no longer rounded away to "185₺" - which is what the site used to display
 * and publish while charging the real amount at checkout.
 *
 * Thousands are grouped with a dot, the Turkish way: the karaoke hour reads
 * "1.000₺", not "1000₺". Every reader of these strings (`parsePriceLabel`,
 * the JSON-LD `offerPrice`) already drops a dot that groups three digits.
 */
export function priceLabel(amountMinor: number): string {
  const minor = Math.round(Math.abs(amountMinor));
  const sign = amountMinor < 0 && minor > 0 ? "-" : "";
  const kurus = minor % 100;
  const major = String(Math.trunc(minor / 100)).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    ".",
  );
  return kurus === 0
    ? `${sign}${major}₺`
    : `${sign}${major},${String(kurus).padStart(2, "0")}₺`;
}

/**
 * Reads a major-unit number back out of a display price.
 *
 * Handles the Turkish decimal comma; `parseFloat` stops at it, so "184,90₺"
 * used to come back as 184.
 */
export function parsePriceLabel(display: string): number {
  const cleaned = display
    .replace(/[^\d.,]/g, "")
    .replace(/\.(?=\d{3}\b)/g, "")
    .replace(",", ".");
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : 0;
}

/**
 * A lira amount typed into an admin form, as minor units - or `null` when it
 * is not unambiguously one.
 *
 * `parseFloat(s.replace(",", "."))` read "1.250,00" as 1.25: a ₺1.250 refund
 * went out as ₺1,25. Accepted: "1250", "1250,5", "1250.50", "1.250",
 * "1.250,00" (Turkish thousands dots with a decimal comma). Anything else -
 * "1,250.00", "12.5.0", "abc" - is refused so the admin retypes it rather
 * than moving the wrong amount of money.
 */
export function parseMoneyInput(raw: string): number | null {
  const text = raw.replace(/[\s₺]/g, "").replace(/TL$/i, "");
  let normalized: string;
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(text)) {
    normalized = text.replace(/\./g, "").replace(",", ".");
  } else if (/^\d+([.,]\d{1,2})?$/.test(text)) {
    normalized = text.replace(",", ".");
  } else {
    return null;
  }
  const minor = Math.round(Number(normalized) * 100);
  return Number.isSafeInteger(minor) ? minor : null;
}

/**
 * The largest catalog amount (a product, variant or menu price), 1.000.000
 * TL in kuruş. Prices sit in `integer` columns (at most ~21,4 milyon TL):
 * "25.000.000" read as 2.500.000.000 kuruş and the save died on Postgres
 * 22003 (integer out of range). Nothing the köşk sells comes near this, so a
 * bigger figure is a slipped key and is refused under its field.
 */
export const CATALOG_MONEY_MAX_MINOR = 100_000_000;

export const MONEY_TOO_LARGE_ERROR = "Tutar en fazla 1.000.000 TL olabilir.";

/**
 * A leading minus sign as a typed or pasted number may carry it: the ASCII
 * hyphen, the Unicode minus (U+2212, what a copied price or a phone's maths
 * keyboard gives), the figure and en dashes (U+2012, U+2013: autocorrect)
 * and the small and full-width hyphen-minus (U+FE63, U+FF0D).
 */
const LEADING_MINUS = /^[-\u2212\u2012\u2013\uFE63\uFF0D]/;

/**
 * Splits a leading "+" or minus sign ({@link LEADING_MINUS}) off a typed
 * number: `{ sign: -1, rest: "3" }` for "−3", `{ sign: 1, rest: "12" }` for
 * "+12" or "12". Spaces around the sign are dropped.
 */
export function splitSign(raw: string): { sign: 1 | -1; rest: string } {
  const text = raw.trim();
  if (text.startsWith("+")) return { sign: 1, rest: text.slice(1).trim() };
  if (LEADING_MINUS.test(text)) {
    return { sign: -1, rest: text.slice(1).trim() };
  }
  return { sign: 1, rest: text };
}

/**
 * {@link parseMoneyInput} for an amount that may go either way - a variant's
 * price difference ("-10,50" for the smaller bag). A leading "+" or minus
 * sign ({@link splitSign}) is read off first; the rest follows
 * parseMoneyInput's rules.
 */
export function parseSignedMoneyInput(raw: string): number | null {
  const { sign, rest } = splitSign(raw);
  const minor = parseMoneyInput(rest);
  if (minor === null) return null;
  return minor === 0 ? 0 : sign * minor;
}

/**
 * The display name without its qualifier: "Sirena - Espresso Blend" → "Sirena".
 *
 * Splits on a dash SURROUNDED BY WHITESPACE, and accepts every dash glyph. Two
 * reasons it cannot just split on one character:
 *
 * 1. Product names come from the admin panel, and the rows already in the
 *    database still carry the em dash the site's own copy has since dropped.
 * 2. A bare `split("-")` truncates any name that merely contains a hyphen -
 *    "Cold Brew Tonic - 250ml" would render as "Cold Brew Tonic", and an
 *    operator naming a product "E-5 Blend" would lose everything after "E".
 *
 * A name with no separator comes back whole.
 */
export function shortProductName(name: string): string {
  const head = name.split(/\s+[-‐‑‒–—]\s+/)[0];
  return head.trim() || name.trim();
}

/**
 * The postal address, split into display lines, with the landmark dropped.
 *
 * Three places used to derive this independently - the footer, the visit
 * page's props builder, and a hard-coded list in `data.ts` - which is how the
 * landmark survived in two of them after the operator asked for it out of the
 * address (7 Eyl). It is directions, not address: it still appears on
 * /ziyaret's own directions block, in the structured data, and in the app's
 * `venue.landmark`, which are the places that are actually about finding the
 * door.
 *
 * Splits on newlines and commas, and drops any parenthetical group. NOT on
 * "/": the two builders this replaced disagreed about that, and the one that
 * split on it broke "34940 Tuzla / İstanbul" - a single postal line - across
 * two rows. The stored setting is never modified; this is a display decision,
 * so an operator who wants the landmark back puts it outside the brackets.
 */
export function addressLines(address: string, fallback: string[]): string[] {
  const lines = (address ?? "")
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return lines.length > 0 ? lines : fallback;
}
