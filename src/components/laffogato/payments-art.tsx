import { cx } from "./cx";

/**
 * A small drawing for the checkout and its result pages (owner's brief,
 * 6 Kas 2026): a card, a phone tapping it, a cup, the receipt and a padlock
 * - what paying at L'Affogato looks like, in the house's colours.
 *
 * Original, inline, decoration only (`aria-hidden`): every word that
 * matters sits beside it in the page. No script, no image request and no
 * inline style, so it is at home under the checkout document's own policy
 * (src/lib/security/checkout-csp.ts). Colours are tokens through the
 * `pay-art-*` classes in globals.css. It touches nothing in the payment.
 */
export function PaymentsArt({
  className,
  done = false,
}: {
  className?: string;
  /** A tick on the phone's screen: only where the payment did go through. */
  done?: boolean;
}) {
  return (
    <svg
      className={cx("pay-art", className)}
      viewBox="0 0 240 140"
      aria-hidden="true"
      focusable="false"
    >
      {/* The ground: one soft disc behind everything. */}
      <ellipse className="pay-art-disc" cx="120" cy="76" rx="112" ry="60" />

      {/* The receipt, behind, its zigzag foot. */}
      <g className="pay-art-receipt">
        <path d="M150 24h46v78l-5.75-5-5.75 5-5.75-5-5.75 5-5.75-5-5.75 5-5.75-5-5.75 5Z" />
        <path
          className="pay-art-line"
          d="M158 38h30M158 48h22M158 58h30M158 74h14M178 74h10"
        />
      </g>

      {/* The card, tilted. */}
      <g className="pay-art-card" transform="rotate(-8 88 78)">
        <rect x="40" y="52" width="96" height="60" rx="9" />
        <rect
          className="pay-art-card-band"
          x="40"
          y="64"
          width="96"
          height="10"
        />
        <rect
          className="pay-art-chip"
          x="52"
          y="84"
          width="16"
          height="12"
          rx="2.5"
        />
        <path className="pay-art-card-line" d="M52 102h34" />
      </g>

      {/* The phone, tapping the card, and its signal. */}
      <g className="pay-art-phone" transform="rotate(10 128 70)">
        <rect x="112" y="30" width="36" height="66" rx="8" />
        <rect
          className="pay-art-screen"
          x="116"
          y="38"
          width="28"
          height="50"
          rx="4"
        />
        {done ? (
          <path className="pay-art-tick" d="m123 63 5 5 9-10" />
        ) : (
          <path
            className="pay-art-dots"
            d="M124 63h.01M130 63h.01M136 63h.01"
          />
        )}
      </g>
      <g className="pay-art-waves">
        <path d="M100 40a14 14 0 0 1 0-18" />
        <path d="M93 46a24 24 0 0 1 0-30" />
      </g>

      {/* The cup, in front. */}
      <g className="pay-art-cup">
        <path d="M176 100h36c0 14-8 22-18 22s-18-8-18-22Z" />
        <path
          className="pay-art-handle"
          d="M211 104c7-1 10 3 9 8-1 4-5 6-10 5"
        />
        <ellipse cx="194" cy="124" rx="24" ry="3.5" />
      </g>
      <path
        className="pay-art-steam"
        d="M190 94c-4-6 4-9 0-15M199 94c-4-6 4-9 0-15"
      />

      {/* The padlock: the card goes to the payment provider alone. */}
      <g className="pay-art-lock">
        <path className="pay-art-shackle" d="M26 44v-6a8 8 0 0 1 16 0v6" />
        <rect x="21" y="43" width="26" height="20" rx="5" />
        <circle className="pay-art-keyhole" cx="34" cy="52" r="2.6" />
      </g>
    </svg>
  );
}
