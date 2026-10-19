/**
 * Shared vocabulary for the mobile app's home content - tones, routes, kinds
 * and their Turkish labels.
 *
 * This file exists because `store.ts` starts with `import "server-only"` and
 * reaches `pg`, so ANY client component that imports a constant from it drags
 * the database driver into the browser bundle. Next 16 does not merely warn
 * about that: the build fails, and it fails with nineteen errors that all point
 * at `node:dns` rather than at the one import that caused them.
 *
 * So the rule, and it matches every other `*-schema.ts` in this directory:
 * anything a "use client" form needs lives HERE, and `store.ts` re-exports it
 * for server callers. Nothing in this file may import from `store.ts`, from
 * `@/lib/db`, or from anything that pulls in `server-only`.
 */

import { parsePublishInstant } from "./publish-window";
import type { AdminTone } from "./tone";

// ── Hero slides ────────────────────────────────────────────────────────────

/** Brand ground a slide paints itself on. Mirrors the app's theme tokens. */
export type AppSlideTone = "premium" | "inverse" | "brand" | "paper";

export const APP_SLIDE_TONES: AppSlideTone[] = [
  "premium",
  "inverse",
  "brand",
  "paper",
];

export const APP_SLIDE_TONE_LABELS: Record<AppSlideTone, string> = {
  premium: "Bordo (premium)",
  inverse: "Koyu yeşil",
  brand: "Marka yeşili",
  paper: "Kağıt (açık)",
};

/**
 * Routes a slide may point at. The app resolves the key through its own
 * allow-list; anything not in this set is ignored rather than followed.
 *
 * Keys are the WEB-side vocabulary of APP-CONFIG-SPEC §5, not the app's file
 * paths: the app maps `/kart → /uyelik-karti`, `/hesabim → /(tabs)/profil`,
 * `/menu → /(tabs)/menu`, `/oduller → /(tabs)/oduller` itself, so a screen
 * can move inside the app without the panel (or old rows) noticing.
 *
 * `""` stays first so a fresh form defaults to "no action" - a slide is
 * decorative unless someone deliberately makes it a button.
 */
export const APP_SLIDE_ROUTES = [
  "",
  "/menu",
  "/magaza",
  "/kart",
  "/hesabim",
  "/kampanyalar",
  "/karaoke",
  "/canli-durum",
  "/oduller",
  "/davet",
  "/ziyaret",
  "/hikaye",
] as const;

export type AppSlideRoute = (typeof APP_SLIDE_ROUTES)[number];

export const APP_SLIDE_ROUTE_LABELS: Record<AppSlideRoute, string> = {
  "": "Yok (tıklanamaz)",
  "/menu": "Menü",
  "/magaza": "Mağaza",
  "/kart": "Üyelik kartı",
  "/hesabim": "Profil",
  "/kampanyalar": "Kampanyalar",
  "/karaoke": "Karaoke",
  "/canli-durum": "Canlı durum",
  "/oduller": "Ödüller",
  "/davet": "Davet",
  "/ziyaret": "Ziyaret",
  "/hikaye": "Hikâye",
};

/** Type guard for a stored `ctaRoute`; the store fails closed on anything else. */
export function isAppSlideRoute(value: string): value is AppSlideRoute {
  return (APP_SLIDE_ROUTES as readonly string[]).includes(value);
}

// ── Announcements ──────────────────────────────────────────────────────────

export type AppAnnouncementKind = "info" | "campaign" | "hours";

export const APP_ANNOUNCEMENT_KINDS: AppAnnouncementKind[] = [
  "info",
  "campaign",
  "hours",
];

export const APP_ANNOUNCEMENT_KIND_LABELS: Record<AppAnnouncementKind, string> =
  {
    info: "Bilgi",
    campaign: "Yeni / kampanya",
    hours: "Çalışma saatleri",
  };

// ── Posts: campaigns, collaborations, events ───────────────────────────────

export type AppPostKind = "campaign" | "collab" | "event";

export const APP_POST_KINDS: AppPostKind[] = ["campaign", "collab", "event"];

export const APP_POST_KIND_LABELS: Record<AppPostKind, string> = {
  campaign: "Kampanya",
  collab: "İş birliği",
  event: "Etkinlik",
};

// ── Publish state, as the panel lists it ───────────────────────────────────

/**
 * Where a slide, announcement or post stands right now. The app shows a row
 * only when it is active AND inside its window (`isPublishWindowOpen`, the
 * store's `listActive*`); the list used to say only "YAYINDA DEĞİL" for an
 * inactive row, so an expired or scheduled one looked exactly like a live
 * one. `invalid`: a bound that is not a time (typed by hand into the
 * database, or older than the date inputs); the window fails closed on it,
 * so the row is not on any phone.
 */
export type AppPublishStatus =
  "live" | "scheduled" | "expired" | "off" | "invalid";

export const APP_PUBLISH_STATUSES: readonly AppPublishStatus[] = [
  "live",
  "scheduled",
  "expired",
  "off",
  "invalid",
];

export const APP_PUBLISH_STATUS_LABELS: Record<AppPublishStatus, string> = {
  live: "Yayında",
  scheduled: "Planlandı",
  expired: "Süresi doldu",
  off: "Kapalı",
  invalid: "Tarih geçersiz",
};

export const APP_PUBLISH_STATUS_TONES: Record<AppPublishStatus, AdminTone> = {
  live: "success",
  scheduled: "info",
  expired: "neutral",
  off: "neutral",
  invalid: "danger",
};

/** Pure; `now` is passed in so a whole list reads one clock. */
export function appPublishStatus(
  row: { isActive: boolean; startsAt: string; endsAt: string },
  now: number,
): AppPublishStatus {
  if (!row.isActive) return "off";
  const from = row.startsAt.trim() ? parsePublishInstant(row.startsAt) : 0;
  const to = row.endsAt.trim() ? parsePublishInstant(row.endsAt) : Infinity;
  if (from === null || to === null) return "invalid";
  if (from > now) return "scheduled";
  if (to < now) return "expired";
  return "live";
}

/**
 * The refusals a slide, announcement or post save shares, by field name:
 * a title of only spaces (the HTML `required` passes it, and the action used
 * to return without a word), a start or end that is not a time, an end
 * before the start. Empty when the input can be saved.
 */
export function appContentFieldErrors(input: {
  title: string;
  startsAt: string;
  endsAt: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.title.trim()) errors.title = "Başlık boş olamaz.";
  const from = input.startsAt.trim() ? parsePublishInstant(input.startsAt) : 0;
  const to = input.endsAt.trim() ? parsePublishInstant(input.endsAt) : Infinity;
  if (from === null) errors.startsAt = "Başlangıç bir tarih ve saat olmalı.";
  if (to === null) errors.endsAt = "Bitiş bir tarih ve saat olmalı.";
  if (from !== null && to !== null && to <= from) {
    errors.endsAt = "Bitiş başlangıçtan sonra olmalı.";
  }
  return errors;
}
