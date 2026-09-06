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
 * is no longer rounded away to "185₺" — which is what the site used to display
 * and publish while charging the real amount at checkout.
 */
export function priceLabel(amountMinor: number): string {
  const kurus = Math.abs(amountMinor) % 100;
  const major = amountMinor / 100;
  return kurus === 0
    ? `${Math.trunc(major)}₺`
    : `${major.toFixed(2).replace(".", ",")}₺`;
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
 * The display name without its qualifier: "Sirena — Espresso Blend" → "Sirena".
 *
 * Splits on a dash SURROUNDED BY WHITESPACE, and accepts every dash glyph. Two
 * reasons it cannot just split on one character:
 *
 * 1. Product names come from the admin panel, and the rows already in the
 *    database still carry the em dash the site's own copy has since dropped.
 * 2. A bare `split("-")` truncates any name that merely contains a hyphen —
 *    "Cold Brew Tonic - 250ml" would render as "Cold Brew Tonic", and an
 *    operator naming a product "E-5 Blend" would lose everything after "E".
 *
 * A name with no separator comes back whole.
 */
export function shortProductName(name: string): string {
  const head = name.split(/\s+[-‐‑‒–—]\s+/)[0];
  return head.trim() || name.trim();
}
