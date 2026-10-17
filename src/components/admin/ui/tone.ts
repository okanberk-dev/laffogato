import type { AdminTone } from "@/lib/admin/tone";

/**
 * Tone → Tailwind classes, written out in full so Tailwind's scanner sees
 * every one (a class built at runtime from a tone name never reaches CSS).
 * Colours are the `--admin-*` tokens set in app/admin/layout.tsx; each ink
 * clears WCAG AA (4.5:1) on its soft ground and on white
 * (tests/admin-ui-kit.test.ts).
 */

/** Soft ground + ink: badges, chips, inline notices. */
export const TONE_SOFT: Record<AdminTone, string> = {
  neutral: "bg-[var(--admin-neutral-soft)] text-[var(--admin-text-soft)]",
  primary: "bg-[var(--admin-primary-soft)] text-[var(--admin-primary)]",
  accent: "bg-[var(--admin-accent-soft)] text-[var(--admin-accent-ink)]",
  info: "bg-[var(--admin-info-soft)] text-[var(--admin-info)]",
  success: "bg-[var(--admin-success-soft)] text-[var(--admin-success)]",
  warning: "bg-[var(--admin-warning-soft)] text-[var(--admin-warning)]",
  danger: "bg-[var(--admin-danger-soft)] text-[var(--admin-danger-ink)]",
};

/** Ink only: an icon, a dot, a left rule. */
export const TONE_INK: Record<AdminTone, string> = {
  neutral: "text-[var(--admin-text-soft)]",
  primary: "text-[var(--admin-primary)]",
  accent: "text-[var(--admin-accent-ink)]",
  info: "text-[var(--admin-info)]",
  success: "text-[var(--admin-success)]",
  warning: "text-[var(--admin-warning)]",
  danger: "text-[var(--admin-danger-ink)]",
};

/** A solid dot (Timeline, Badge `dot`). */
export const TONE_DOT: Record<AdminTone, string> = {
  neutral: "bg-[var(--admin-text-mute)]",
  primary: "bg-[var(--admin-primary)]",
  accent: "bg-[var(--admin-accent)]",
  info: "bg-[var(--admin-info)]",
  success: "bg-[var(--admin-success)]",
  warning: "bg-[var(--admin-warning)]",
  danger: "bg-[var(--admin-danger)]",
};

/** The left rule of a toast or banner. */
export const TONE_RULE: Record<AdminTone, string> = {
  neutral: "border-l-[var(--admin-border-strong)]",
  primary: "border-l-[var(--admin-primary)]",
  accent: "border-l-[var(--admin-accent)]",
  info: "border-l-[var(--admin-info)]",
  success: "border-l-[var(--admin-success)]",
  warning: "border-l-[var(--admin-warning)]",
  danger: "border-l-[var(--admin-danger)]",
};
