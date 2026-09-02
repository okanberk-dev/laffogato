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
