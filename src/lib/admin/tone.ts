// Client-safe (no server-only): the panel's colour vocabulary for badges,
// toasts and banners. The colours themselves are the `--admin-*` tokens in
// app/admin/layout.tsx; the class strings live in components/admin/ui/tone.ts.

/**
 * What a badge, toast or banner means, not what colour it is.
 *
 * - `neutral`: nothing to do (cancelled, archived)
 * - `primary`: the köşk is working on it (espresso)
 * - `accent`: in progress, gold (preparing)
 * - `info`: new, waiting for the next step
 * - `success`: done, money or goods arrived
 * - `warning`: needs a look (unpaid, mail not sent)
 * - `danger`: money went back, or something failed
 */
export type AdminTone =
  "neutral" | "primary" | "accent" | "info" | "success" | "warning" | "danger";

export const ADMIN_TONES: readonly AdminTone[] = [
  "neutral",
  "primary",
  "accent",
  "info",
  "success",
  "warning",
  "danger",
];
