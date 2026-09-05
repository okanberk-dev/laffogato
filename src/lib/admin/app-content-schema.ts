/**
 * Shared vocabulary for the mobile app's home content — tones, routes, kinds
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
 * `""` stays first so a fresh form defaults to "no action" — a slide is
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
