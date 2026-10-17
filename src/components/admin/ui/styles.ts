// Class strings the kit's pieces share. The buttons match forms.tsx
// (PrimaryButton, GhostButton, DangerButton) so a kit button and a form
// button look the same; written out in full for Tailwind's scanner.

const BUTTON_BASE =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/45 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

export const BUTTON = {
  primary: `${BUTTON_BASE} bg-[var(--admin-primary)] px-5 font-medium text-white hover:bg-[var(--admin-primary-hover)]`,
  ghost: `${BUTTON_BASE} border border-[var(--admin-border-strong)] px-4 bg-[var(--admin-surface)] text-[var(--admin-text-soft)] hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)]`,
  danger: `${BUTTON_BASE} border border-[var(--admin-danger)]/35 px-4 bg-[var(--admin-surface)] text-[var(--admin-danger-ink)] hover:border-[var(--admin-danger)] hover:bg-[var(--admin-danger)] hover:text-white`,
  /** The submit of a dangerous modal: solid, unmistakable. */
  dangerSolid: `${BUTTON_BASE} bg-[var(--admin-danger)] px-5 font-medium text-white hover:bg-[var(--admin-danger-ink)]`,
  /** Text-only, for a quiet secondary action inside a row. */
  link: "inline-flex min-h-[44px] items-center gap-1 rounded-md px-1 text-sm text-[var(--admin-primary)] underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/45 focus-visible:outline-none disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
  /** A row in an ActionMenu. */
  menu: "flex min-h-[44px] w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-2)] focus-visible:bg-[var(--admin-surface-2)] focus-visible:outline-none aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-transparent",
  /** A destructive row in an ActionMenu. */
  menuDanger:
    "flex min-h-[44px] w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[var(--admin-danger-ink)] hover:bg-[var(--admin-danger-soft)] focus-visible:bg-[var(--admin-danger-soft)] focus-visible:outline-none aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-transparent",
} as const;

export type ButtonVariant = keyof typeof BUTTON;

/** The mono, spaced, uppercase label used across the panel's headers. */
export const EYEBROW =
  "text-[10px] tracking-[0.22em] text-[var(--admin-text-soft)] uppercase";
export const MONO_STYLE = { fontFamily: "var(--mono), monospace" } as const;

/**
 * Amounts, booking codes and POS references: a monospace face with tabular
 * figures, so a right-aligned Tutar column and a list of codes line up
 * digit by digit (admin audit KAR-18). MONO_STYLE is the panel's label
 * voice and stays as it is: --mono resolves to Poppins, which has no
 * tabular figures, and labels and headers use it too.
 */
export const NUMERIC_STYLE = {
  fontFamily:
    'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
  fontVariantNumeric: "tabular-nums",
} as const;
