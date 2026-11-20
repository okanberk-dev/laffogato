/**
 * Card scheme marks, drawn here as small SVGs - the checkout loads no image,
 * font or script from anywhere else (its policy would refuse them; src/proxy.ts).
 * Colours come from `--scheme-*` in globals.css :root.
 *
 * Shown where a customer looks for them (Baymard): once, as "Kabul edilen
 * kartlar" above the card form, and inside the number field once the first
 * digits name the scheme. The row lists the schemes Turkish banks issue -
 * Visa, Mastercard, Troy; American Express is recognised in the number field
 * (its 4-6-5 grouping, 4-digit code) but not advertised.
 */

export type SchemeMarkName = "visa" | "mastercard" | "troy" | "amex";

/** The mark for a saved card's brand as PayNkolay names it, if there is one. */
export function schemeOfBrand(brand: string): SchemeMarkName | null {
  const b = brand.toLowerCase();
  if (b.includes("visa")) return "visa";
  if (b.includes("master")) return "mastercard";
  if (b.includes("troy")) return "troy";
  if (b.includes("amex") || b.includes("american")) return "amex";
  return null;
}

const FRAME = (
  <rect
    x="0.5"
    y="0.5"
    width="37"
    height="23"
    rx="4"
    fill="var(--surface)"
    stroke="var(--ink-line-strong)"
  />
);

export function SchemeMark({
  name,
  className,
}: {
  name: SchemeMarkName;
  className?: string;
}) {
  switch (name) {
    case "visa":
      return (
        <svg viewBox="0 0 38 24" className={className} aria-hidden="true">
          {FRAME}
          <text
            x="19"
            y="16"
            textAnchor="middle"
            fontFamily="Arial, Helvetica, sans-serif"
            fontSize="10.5"
            fontStyle="italic"
            fontWeight="800"
            letterSpacing="0.4"
            fill="var(--scheme-visa)"
          >
            VISA
          </text>
        </svg>
      );
    case "mastercard":
      return (
        <svg viewBox="0 0 38 24" className={className} aria-hidden="true">
          {FRAME}
          <circle cx="15" cy="12" r="7" fill="var(--scheme-mc-red)" />
          <circle cx="23" cy="12" r="7" fill="var(--scheme-mc-yellow)" />
          <path
            d="M19 6.255A7 7 0 0 1 19 17.745A7 7 0 0 1 19 6.255Z"
            fill="var(--scheme-mc-orange)"
          />
        </svg>
      );
    case "troy":
      return (
        <svg viewBox="0 0 38 24" className={className} aria-hidden="true">
          {FRAME}
          <text
            x="19"
            y="15.5"
            textAnchor="middle"
            fontFamily="Arial, Helvetica, sans-serif"
            fontSize="10"
            fontWeight="800"
            fill="var(--scheme-troy)"
          >
            troy
          </text>
        </svg>
      );
    case "amex":
      return (
        <svg viewBox="0 0 38 24" className={className} aria-hidden="true">
          <rect
            x="0"
            y="0"
            width="38"
            height="24"
            rx="4"
            fill="var(--scheme-amex)"
          />
          <text
            x="19"
            y="15.5"
            textAnchor="middle"
            fontFamily="Arial, Helvetica, sans-serif"
            fontSize="8.5"
            fontWeight="800"
            letterSpacing="0.3"
            fill="var(--surface)"
          >
            AMEX
          </text>
        </svg>
      );
  }
}

/** The schemes the checkout says it accepts, in this order. */
export const ACCEPTED_SCHEMES: readonly SchemeMarkName[] = [
  "visa",
  "mastercard",
  "troy",
];

/** A row of the accepted marks, with their names for screen readers. */
export function AcceptedSchemes({ className }: { className?: string }) {
  return (
    <span
      className={className}
      role="img"
      aria-label="Kabul edilen kartlar: Visa, Mastercard, Troy"
    >
      {ACCEPTED_SCHEMES.map((name) => (
        <SchemeMark key={name} name={name} className="co-scheme" />
      ))}
    </span>
  );
}
