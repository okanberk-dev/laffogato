// Class strings the kit's pieces share. The buttons match forms.tsx
// (PrimaryButton, GhostButton, DangerButton) so a kit button and a form
// button look the same; written out in full for Tailwind's scanner.

import { COMPACT } from "./compact";

// The compact density's classes live in compact.ts (the tab strip, which the
// shell draws on every page, takes them without this file's buttons).
export { COMPACT };

/**
 * The StorageBox button (21 Kas 2026, docs/ADMIN-STORAGEBOX.md): a pill,
 * 14 px medium text, a 16-18 px icon, pressed it shrinks to 0.98. 44 px
 * tall on a touch screen, 40 px where the pointer can aim, 32 px in
 * "Sıkı görünüm".
 */
const BUTTON_BASE = `inline-flex min-h-11 items-center justify-center gap-2 rounded-full py-1.5 text-sm font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow,transform] duration-150 active:scale-[0.98] motion-reduce:transition-colors motion-reduce:active:scale-100 focus-visible:ring-[3px] focus-visible:ring-[var(--admin-ring)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 pointer-fine:min-h-10 ${COMPACT.minH8}`;

export const BUTTON = {
  /** The one vivid blue: the one solid button of a screen. */
  primary: `${BUTTON_BASE} bg-[var(--admin-primary)] px-5 text-white shadow-[0_1px_2px_rgb(18_42_255/0.18)] hover:bg-[var(--admin-primary-hover)]`,
  /** Secondary: white, a thin line, dark text ("Tümünü gör", "Vazgeç"). */
  ghost: `${BUTTON_BASE} border border-[var(--admin-border-strong)] px-5 bg-[var(--admin-surface)] text-[var(--admin-text)] hover:bg-[var(--admin-surface-2)]`,
  /** Quiet: a grey pill, for the screen's lesser actions. */
  soft: `${BUTTON_BASE} px-5 bg-[var(--admin-panel)] text-[var(--admin-text)] hover:bg-[var(--admin-panel-hover)]`,
  danger: `${BUTTON_BASE} border border-[var(--admin-danger)]/40 px-5 bg-[var(--admin-surface)] text-[var(--admin-danger-ink)] hover:bg-[var(--admin-danger-soft)]`,
  /** The submit of a dangerous modal: solid, unmistakable. */
  dangerSolid: `${BUTTON_BASE} bg-[var(--admin-danger)] px-5 text-white hover:bg-[var(--admin-danger-ink)]`,
  /** Text-only, for a quiet secondary action inside a row. */
  link: `inline-flex min-h-11 items-center gap-1 rounded-md px-1 text-sm font-medium text-[var(--admin-primary)] underline-offset-4 hover:underline focus-visible:ring-[3px] focus-visible:ring-[var(--admin-ring)] focus-visible:outline-none disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 pointer-fine:min-h-9 ${COMPACT.minH8}`,
  /** A row in an ActionMenu. */
  menu: `flex min-h-11 w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-2)] focus-visible:bg-[var(--admin-surface-2)] focus-visible:outline-none aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-transparent pointer-fine:min-h-9 ${COMPACT.minH8}`,
  /** A destructive row in an ActionMenu. */
  menuDanger: `flex min-h-11 w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm text-[var(--admin-danger-ink)] hover:bg-[var(--admin-danger-soft)] focus-visible:bg-[var(--admin-danger-soft)] focus-visible:outline-none aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-transparent pointer-fine:min-h-9 ${COMPACT.minH8}`,
  /**
   * An icon-only control: a grey circle (StorageBox's round button). It
   * has no text, so it always takes an `aria-label` (the icon is
   * `aria-hidden`).
   */
  icon: `${BUTTON_BASE} h-11 w-11 shrink-0 bg-[var(--admin-panel)] text-[var(--admin-text-soft)] hover:bg-[var(--admin-panel-hover)] hover:text-[var(--admin-text)] pointer-fine:h-10 pointer-fine:w-10 ${COMPACT.h8} ${COMPACT.w8}`,
} as const;

export type ButtonVariant = keyof typeof BUTTON;

/** The quiet icon control a row's "⋯" and icon links share (ROW_CONTROL). */
const ROW_ICON =
  "inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-[var(--admin-text-mute)] transition-colors hover:bg-[var(--admin-panel)] hover:text-[var(--admin-text)] focus-visible:ring-[3px] focus-visible:ring-[var(--admin-ring)] focus-visible:outline-none pointer-fine:min-h-8 pointer-fine:min-w-8";

/**
 * A row's small controls (operator, 21 Oct 2026: smaller, minimal): the
 * ↑ / ↓ stepper (MoveButtons), the "⋯" on its own (ActionMenu), an icon
 * link and a row's text action. Muted ink and at most a hairline until
 * the pointer is on them. A touch screen keeps the panel's 44 px target;
 * where the pointer can aim they are 28 px (a step) and 32 px (the rest),
 * above WCAG 2.2's 24 px minimum and Innex's own size, so "Sıkı görünüm"
 * leaves them be. The hover ground is --admin-panel, a step darker than a
 * hovered row's --admin-surface-2, so it shows on either.
 */
export const ROW_CONTROL = {
  /** The stepper's frame: a hairline around its two halves. */
  // `relative z-[1]`: above a phone card's stretched title (CardLink), the
  // faded half included, which would otherwise open the record.
  stepper:
    "relative z-[1] inline-flex shrink-0 items-center rounded-full border border-[var(--admin-border-strong)] p-0.5",
  /** One half of the stepper: a chevron. */
  step: "inline-flex h-11 w-11 items-center justify-center rounded-full text-[var(--admin-text-mute)] transition-colors hover:bg-[var(--admin-panel)] hover:text-[var(--admin-text)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 pointer-fine:h-7 pointer-fine:w-7",
  /** The half with nowhere to go: the first row's ↑, the last row's ↓. */
  stepIdle:
    "inline-flex h-11 w-11 items-center justify-center text-[var(--admin-text-mute)] opacity-40 pointer-fine:h-7 pointer-fine:w-7",
  /**
   * A text action on a row (the menu's "Tükendi", an order's next step, a
   * legal text's "Düzenle"): Innex's secondary button, small.
   */
  text: "inline-flex min-h-[44px] items-center justify-center rounded-full border border-[var(--admin-border-strong)] bg-[var(--admin-surface)] px-4 text-[13px] font-medium whitespace-nowrap text-[var(--admin-text)] transition-colors hover:bg-[var(--admin-surface-2)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 pointer-fine:min-h-8",
  /** The same, filled: the row's one call to act (the menu's "Satışa aç"). */
  textStrong:
    "inline-flex min-h-[44px] items-center justify-center rounded-full bg-[var(--admin-primary)] px-4 text-[13px] font-medium whitespace-nowrap text-white transition-colors hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 pointer-fine:min-h-8",
  /** An icon alone, a link or a button; it takes an `aria-label`. */
  icon: ROW_ICON,
  /**
   * The "⋯" with no label (ActionMenu's summary): a row's, a card's. It
   * keeps the hover ground while its menu is open (`[open]>&`, the
   * details' own state, so it holds before hydration too).
   */
  more: `${ROW_ICON} cursor-pointer list-none select-none [[open]>&]:bg-[var(--admin-panel)] [[open]>&]:text-[var(--admin-text)] [&::-webkit-details-marker]:hidden`,
} as const;

/**
 * The StorageBox card: white on the grey canvas, a very pale 1 px line,
 * 24 px corners (rounded-xl, mapped in admin-theme.css), no shadow.
 * Sections, widgets, filter panels and the sign-in box are this; its
 * padding is the user's (16 px on a phone, 20 px from `sm`).
 */
export const CARD =
  "rounded-xl border border-[var(--admin-card-border)] bg-[var(--admin-surface)] forced-colors:border-[CanvasText]";

/**
 * The label of filter fields and of a phone card's values. 13px sentence
 * case: it was 10px spaced capitals, the hardest text on the panel to read.
 * Capitals stay only for the sidebar's small group labels (Innex's GUESTS,
 * PROPERTY…).
 */
export const EYEBROW = "text-[13px] font-medium text-[var(--admin-text-soft)]";

/**
 * The line above a page title (PageHeader `eyebrow` and `meta`): 12px
 * sentence-case muted text. --admin-text-mute clears 4.5:1 on every panel
 * ground (tests/admin-ui-kit.test.ts).
 */
export const HEADER_EYEBROW = "text-xs text-[var(--admin-text-mute)]";

/**
 * A card's own heading, the size of Section's title (detail.tsx): DM Sans
 * at 18-22 px, light (400). The cards that build their own heading (the
 * customer's coupons, stamps and actions, the manual order's parts) use it
 * too.
 */
export const CARD_TITLE =
  "admin-display text-[length:var(--admin-card-title)] leading-[1.3] font-normal text-[var(--admin-text)]";

/** A big figure in a card ("Toplam ürün"): DM Sans 400, tight. */
export const FIGURE =
  "admin-display text-[length:var(--admin-kpi)] leading-[1.1] font-normal tracking-[-0.04em] text-[var(--admin-text)]";

/** A heading inside a card ("Yeni kupon tanımla"): 14px semibold ink. */
export const CARD_SUBTITLE = "text-sm font-semibold text-[var(--admin-text)]";

/** A label over its value (KeyValueGrid): Innex's 12px label grey. */
export const LABEL = "text-xs font-medium text-[var(--admin-text-mute)]";
export const MONO_STYLE = { fontFamily: "var(--mono), monospace" } as const;

/**
 * Amounts, booking codes and POS references: Inter's tabular figures, so a
 * right-aligned Tutar column and a list of codes line up digit by digit
 * (admin audit KAR-18). It was Geist Mono; Innex sets its numbers in the
 * text face. MONO_STYLE is the panel's label voice and stays as it is:
 * --mono resolves to the same Inter in the panel (app/admin/layout.tsx).
 */
export const NUMERIC_STYLE = {
  fontFamily: "var(--font-admin-sans), ui-sans-serif, system-ui, sans-serif",
  fontVariantNumeric: "tabular-nums",
} as const;

/**
 * A real monospace, for what is typed or checked character by character: an
 * Apple team ID, a signing fingerprint, a 2FA key, a Markdown source. The
 * system's own face, so no font file is loaded for it: NUMERIC_STYLE's Inter
 * lines up digits but not letters.
 */
export const CODE_STYLE = {
  fontFamily:
    'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
  fontVariantNumeric: "tabular-nums",
} as const;
