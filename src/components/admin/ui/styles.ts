// Class strings the kit's pieces share. The buttons match forms.tsx
// (PrimaryButton, GhostButton, DangerButton) so a kit button and a form
// button look the same; written out in full for Tailwind's scanner.

import { COMPACT } from "./compact";

// The compact density's classes live in compact.ts (the tab strip, which the
// shell draws on every page, takes them without this file's buttons).
export { COMPACT };

const BUTTON_BASE = `inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl py-2 text-sm transition-[color,background-color,border-color,transform] active:scale-[0.98] motion-reduce:transition-colors motion-reduce:active:scale-100 focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/45 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 ${COMPACT.minH9}`;

export const BUTTON = {
  primary: `${BUTTON_BASE} bg-[var(--admin-primary)] px-5 font-medium text-white hover:bg-[var(--admin-primary-hover)]`,
  ghost: `${BUTTON_BASE} border border-[var(--admin-border-strong)] px-4 bg-[var(--admin-surface)] text-[var(--admin-text-soft)] hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)]`,
  danger: `${BUTTON_BASE} border border-[var(--admin-danger)]/35 px-4 bg-[var(--admin-surface)] text-[var(--admin-danger-ink)] hover:border-[var(--admin-danger)] hover:bg-[var(--admin-danger)] hover:text-white`,
  /** The submit of a dangerous modal: solid, unmistakable. */
  dangerSolid: `${BUTTON_BASE} bg-[var(--admin-danger)] px-5 font-medium text-white hover:bg-[var(--admin-danger-ink)]`,
  /** Text-only, for a quiet secondary action inside a row. */
  link: `inline-flex min-h-[44px] items-center gap-1 rounded-md px-1 text-sm text-[var(--admin-primary)] underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/45 focus-visible:outline-none disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 ${COMPACT.minH9}`,
  /** A row in an ActionMenu. */
  menu: `flex min-h-[44px] w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-2)] focus-visible:bg-[var(--admin-surface-2)] focus-visible:outline-none aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-transparent ${COMPACT.minH9}`,
  /** A destructive row in an ActionMenu. */
  menuDanger: `flex min-h-[44px] w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[var(--admin-danger-ink)] hover:bg-[var(--admin-danger-soft)] focus-visible:bg-[var(--admin-danger-soft)] focus-visible:outline-none aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-transparent ${COMPACT.minH9}`,
  /**
   * An icon-only control: a 44px square in the ghost button's outline. It
   * has no text, so it always takes an `aria-label` (the icon is
   * `aria-hidden`).
   */
  icon: `${BUTTON_BASE} h-11 w-11 shrink-0 border border-[var(--admin-border-strong)] bg-[var(--admin-surface)] text-[var(--admin-text-soft)] hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)] ${COMPACT.h9} ${COMPACT.w9}`,
} as const;

export type ButtonVariant = keyof typeof BUTTON;

/** The quiet icon control a row's "⋯" and icon links share (ROW_CONTROL). */
const ROW_ICON =
  "inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-[var(--admin-text-mute)] transition-colors hover:bg-[var(--admin-primary-soft)] hover:text-[var(--admin-text)] focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/45 focus-visible:outline-none pointer-fine:min-h-8 pointer-fine:min-w-8";

/**
 * A row's small controls (operator, 21 Oct 2026: smaller, minimal): the
 * ↑ / ↓ stepper (MoveButtons), the "⋯" on its own (ActionMenu), an icon
 * link and a row's text action. Muted ink and at most a hairline until
 * the pointer is on them. A touch screen keeps the panel's 44 px target;
 * where the pointer can aim they are 28 px (a step) and 32 px (the rest),
 * above WCAG 2.2's 24 px minimum and below "Sıkı görünüm"'s 36 px, so they
 * take none of its classes. The hover ground is --admin-primary-soft, a
 * step darker than a hovered row's --admin-surface-2, so it shows on
 * either.
 */
export const ROW_CONTROL = {
  /** The stepper's frame: a hairline around its two halves. */
  // `relative z-[1]`: above a phone card's stretched title (CardLink), the
  // faded half included, which would otherwise open the record.
  stepper:
    "relative z-[1] inline-flex shrink-0 items-center rounded-lg border border-[var(--admin-border)] p-0.5",
  /** One half of the stepper: a chevron. */
  step: "inline-flex h-11 w-11 items-center justify-center rounded-md text-[var(--admin-text-mute)] transition-colors hover:bg-[var(--admin-primary-soft)] hover:text-[var(--admin-text)] focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/45 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 pointer-fine:h-7 pointer-fine:w-7",
  /** The half with nowhere to go: the first row's ↑, the last row's ↓. */
  stepIdle:
    "inline-flex h-11 w-11 items-center justify-center text-[var(--admin-text-mute)] opacity-40 pointer-fine:h-7 pointer-fine:w-7",
  /**
   * A text action on a row (the menu's "Tükendi", an order's next step, a
   * legal text's "Düzenle"): a hairline button.
   */
  text: "inline-flex min-h-[44px] items-center justify-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-[13px] font-medium whitespace-nowrap text-[var(--admin-text-soft)] transition-colors hover:border-[var(--admin-border-strong)] hover:text-[var(--admin-text)] focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/45 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 pointer-fine:min-h-8",
  /** The same, filled: the row's one call to act (the menu's "Satışa aç"). */
  textStrong:
    "inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[var(--admin-primary)] px-3 text-[13px] font-medium whitespace-nowrap text-white transition-colors hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/45 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 pointer-fine:min-h-8",
  /** An icon alone, a link or a button; it takes an `aria-label`. */
  icon: ROW_ICON,
  /**
   * The "⋯" with no label (ActionMenu's summary): a row's, a card's. It
   * keeps the hover ground while its menu is open (`[open]>&`, the
   * details' own state, so it holds before hydration too).
   */
  more: `${ROW_ICON} cursor-pointer list-none select-none [[open]>&]:bg-[var(--admin-primary-soft)] [[open]>&]:text-[var(--admin-text)] [&::-webkit-details-marker]:hidden`,
} as const;

/**
 * The label of filter fields and of a phone card's values. 13px sentence
 * case (AkmanOS's labels, 21 Eki 2026): it was 10px spaced capitals, the
 * hardest text on the panel to read. Capitals stay only for the sidebar's
 * small group labels.
 */
export const EYEBROW = "text-[13px] font-medium text-[var(--admin-text-soft)]";

/**
 * The line above a page title (PageHeader `eyebrow` and `meta`): 12px
 * sentence-case muted text. --admin-text-mute clears 4.5:1 on every panel
 * ground (tests/admin-ui-kit.test.ts).
 */
export const HEADER_EYEBROW = "text-xs text-[var(--admin-text-mute)]";

/**
 * A card's own heading, the size of Section's title (detail.tsx): 16px
 * semibold ink. The cards that build their own heading (the customer's
 * coupons, stamps and actions, the manual order's parts) opened with a
 * 10px spaced-capital line; like EYEBROW, sentence case now (21 Oct 2026).
 */
export const CARD_TITLE =
  "text-base font-semibold tracking-tight text-[var(--admin-text)]";

/** A heading inside a card ("Yeni kupon tanımla"): 14px semibold ink. */
export const CARD_SUBTITLE = "text-sm font-semibold text-[var(--admin-text)]";

/** A label over its value (KeyValueGrid): 12px, weight 500, sentence case. */
export const LABEL = "text-xs font-medium text-[var(--admin-text-soft)]";
export const MONO_STYLE = { fontFamily: "var(--mono), monospace" } as const;

/**
 * Amounts, booking codes and POS references: a monospace face with tabular
 * figures, so a right-aligned Tutar column and a list of codes line up
 * digit by digit (admin audit KAR-18). Geist Mono first (the panel's
 * mono, AkmanOS), the system's monospace behind it. MONO_STYLE is the
 * panel's label voice and stays as it is: --mono resolves to Geist Sans
 * in the panel (app/admin/layout.tsx), and labels and headers use it too.
 */
export const NUMERIC_STYLE = {
  fontFamily:
    'var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
  fontVariantNumeric: "tabular-nums",
} as const;
