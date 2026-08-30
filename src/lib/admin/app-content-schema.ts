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
 */
export const APP_SLIDE_ROUTES = [
  "",
  "/menu",
  "/magaza",
  "/kart",
  "/hesabim",
] as const;

export const APP_SLIDE_ROUTE_LABELS: Record<string, string> = {
  "": "Yok (tıklanamaz)",
  "/menu": "Menü",
  "/magaza": "Mağaza",
  "/kart": "Üyelik kartı",
  "/hesabim": "Hesabım",
};

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
