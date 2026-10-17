// The home hero's slides as the panel stores them (`public.home_hero_slides`)
// and as the site draws them. NO "server-only" and no database: the panel's
// client form reads the lists below, and the tests run the rules without a
// database. The table's reads and writes are in ./home-hero.ts.

import type {
  HomeSlide,
  HomeSlideAction,
  HomeSlideButton,
} from "@/components/laffogato/data";
import type { SceneKey } from "@/components/laffogato/scenes";
import { BACKDROP_FAMILIES, BACKDROP_KEYS } from "@/lib/backdrop/families";
import { sameSitePath } from "@/lib/http/same-site-path";

import { MAX_STORED_IMAGE_LENGTH } from "./image-encode";
import { isPublishWindowOpen } from "./publish-window";

/** One row of `public.home_hero_slides`. */
export interface HomeHeroSlide {
  id: string;
  sortOrder: number;
  isActive: boolean;
  /** ISO-8601 UTC, "" = unbounded (publish-window.ts). */
  startsAt: string;
  endsAt: string;
  kicker: string;
  titleLine1: string;
  titleLine2: string;
  body: string;
  /** A bundled path, an uploaded data:image/..., or an https URL. */
  image: string;
  alt: string;
  scene: string;
  primaryLabel: string;
  primaryAction: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryAction: string;
  secondaryHref: string;
  createdAt: string;
  updatedAt: string;
}

/** What the panel writes: a row without its id and timestamps. */
export type HomeHeroSlideInput = Omit<
  HomeHeroSlide,
  "id" | "createdAt" | "updatedAt"
>;

/** The panel's lengths. The display title is set very large, so it is short. */
export const HOME_HERO_LIMITS = {
  kicker: 40,
  titleLine: 20,
  body: 280,
  /** The first sentence is all a phone shows (home-landing.test.ts). */
  lead: 90,
  alt: 140,
  buttonLabel: 28,
  href: 300,
  urlHref: 500,
  imageUrl: 2048,
  sortOrder: 999,
} as const;

/** The site draws at most this many slides: the thumbnails share one row. */
export const MAX_LIVE_HOME_SLIDES = 6;

/**
 * The action codes a button may name, with the panel's labels. `PageHome`
 * (`onSlideAction`) owns where each one goes; the Record keeps this list in
 * step with the `HomeSlideAction` type.
 */
export const HOME_SLIDE_ACTION_LABELS: Record<HomeSlideAction, string> = {
  menu: "Menü",
  seasonMenu: "Matcha barı (sezon menüsü)",
  signature: "Espresso menüsü (imza ürün)",
  story: "Hikayemiz",
  visit: "Ziyaret bilgileri",
  karaoke: "Karaoke rezervasyonu",
};

export const HOME_SLIDE_ACTIONS = Object.keys(
  HOME_SLIDE_ACTION_LABELS,
) as HomeSlideAction[];

export function isHomeSlideAction(value: unknown): value is HomeSlideAction {
  return (
    typeof value === "string" &&
    (HOME_SLIDE_ACTIONS as string[]).includes(value)
  );
}

/** The scene lights a slide can stand in (scenes.ts), named for the panel. */
export const HOME_HERO_SCENE_LABELS: Record<SceneKey, string> = {
  ...(Object.fromEntries(
    BACKDROP_KEYS.map((k) => [k, BACKDROP_FAMILIES[k].name]),
  ) as Record<(typeof BACKDROP_KEYS)[number], string>),
  house: "Ev yeşili",
  velvet: "Bordo (kadife)",
  porcelain: "Porselen (nötr)",
};

export const HOME_HERO_SCENES = Object.keys(
  HOME_HERO_SCENE_LABELS,
) as SceneKey[];

export function isHomeHeroScene(value: unknown): value is SceneKey {
  return (
    typeof value === "string" && (HOME_HERO_SCENES as string[]).includes(value)
  );
}

/**
 * The site's own pictures a slide can use without an upload: the transparent
 * cut-outs the bundled slides stand on, and the karaoke room's drawing. Each
 * is a file in public/ (tests/home-hero-slides.test.ts checks).
 */
export const HOME_HERO_BUNDLED_IMAGES: ReadonlyArray<{
  path: string;
  label: string;
}> = [
  {
    path: "/menu/strawberry-matcha-cut.webp",
    label: "Çilekli matcha latte (kesme fotoğraf)",
  },
  {
    path: "/menu/matcha-affogato-cut.webp",
    label: "Matcha affogato (kesme fotoğraf)",
  },
  {
    path: "/menu/matcha-latte-cut.webp",
    label: "Buzlu matcha latte (kesme fotoğraf)",
  },
  {
    path: "/illustrations/karaoke-mic-cut.webp",
    label: "Karaoke mikrofonu (çizim)",
  },
  {
    path: "/illustrations/karaoke-room.webp",
    label: "Karaoke odası (çizim)",
  },
];

export function isBundledHomeHeroImage(value: string): boolean {
  return HOME_HERO_BUNDLED_IMAGES.some((i) => i.path === value);
}

/** The text placeholders the site fills from the panel (data.ts `slideText`). */
export const HOME_SLIDE_PLACEHOLDERS = ["{kapasite}", "{kapanis}"] as const;

/** Placeholders in `text` the site would print as they are. */
export function unknownPlaceholders(text: string): string[] {
  return [...text.matchAll(/\{[^{}]*\}/g)]
    .map((m) => m[0])
    .filter((t) => !(HOME_SLIDE_PLACEHOLDERS as readonly string[]).includes(t));
}

/**
 * Where a button's free link may go: a path on this site ("/kampanyalar",
 * "/menu/matcha"), or an https URL with a host and no credentials in it.
 * Everything else - `javascript:`, `data:`, `http:`, "//elsewhere",
 * "/\elsewhere", whitespace or control characters - is null, so the panel
 * refuses it and the site never draws it.
 */
export function safeSlideHref(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value) return null;
  if (value.startsWith("/")) {
    const path = sameSitePath(value);
    if (!path || /\s/.test(path)) return null;
    return path.length <= HOME_HERO_LIMITS.href ? path : null;
  }
  return httpsUrl(value, HOME_HERO_LIMITS.urlHref);
}

/** An absolute https URL with a host and no credentials, or null. */
function httpsUrl(value: string, max: number): string | null {
  if (/[\s\u0000-\u001f\u007f]/.test(value)) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !url.hostname) return null;
  if (url.username || url.password) return null;
  const out = url.toString();
  return out.length <= max ? out : null;
}

const DATA_IMAGE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;

/**
 * The stored picture, or "" when it is none of the three kinds a slide may
 * carry: a bundled file, an upload the panel's uploader produced (JPEG, PNG
 * or WebP, at most `MAX_STORED_IMAGE_LENGTH`), or an https URL.
 */
export function safeSlideImage(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const value = raw.trim();
  if (!value) return "";
  if (isBundledHomeHeroImage(value)) return value;
  if (value.startsWith("data:")) {
    return value.length <= MAX_STORED_IMAGE_LENGTH && DATA_IMAGE.test(value)
      ? value
      : "";
  }
  return httpsUrl(value, HOME_HERO_LIMITS.imageUrl) ?? "";
}

/**
 * One button as the site draws it, or undefined: no label, or a target that
 * is neither a known action nor a safe link. Read defensively: a row edited
 * by hand in SQL must not put an unchecked link on the home page.
 */
export function slideButton(
  label: string,
  action: string,
  href: string,
): HomeSlideButton | undefined {
  const text = label.trim();
  if (!text) return undefined;
  if (isHomeSlideAction(action)) return { label: text, action };
  const safe = safeSlideHref(href);
  return safe ? { label: text, href: safe } : undefined;
}

/**
 * A row as the hero draws it. `photo` is the picture's delivery URL (an
 * upload is served from /gorsel/ana-hero/<id>, see ./home-hero.ts). A lone
 * second button moves up into the first place.
 */
export function toHomeSlide(row: HomeHeroSlide, photo: string): HomeSlide {
  const buttons = [
    slideButton(row.primaryLabel, row.primaryAction, row.primaryHref),
    slideButton(row.secondaryLabel, row.secondaryAction, row.secondaryHref),
  ].filter((b): b is HomeSlideButton => !!b);
  return {
    id: row.id,
    kicker: row.kicker.trim(),
    title: [row.titleLine1.trim(), row.titleLine2.trim()],
    text: row.body.trim(),
    primary: buttons[0],
    secondary: buttons[1],
    photo,
    alt: row.alt.trim(),
    scene: isHomeHeroScene(row.scene) ? row.scene : "latte",
  };
}

/** The panel's order: sort order, then the older row first, then the id. */
export function compareHomeHeroSlides(
  a: Pick<HomeHeroSlide, "sortOrder" | "createdAt" | "id">,
  b: Pick<HomeHeroSlide, "sortOrder" | "createdAt" | "id">,
): number {
  return (
    a.sortOrder - b.sortOrder ||
    a.createdAt.localeCompare(b.createdAt) ||
    a.id.localeCompare(b.id)
  );
}

/** Why a row is not on the site right now, or null when it is live. */
export function homeSlideOffReason(
  row: HomeHeroSlide,
  now: number = Date.now(),
): string | null {
  if (!row.isActive) return "Yayında değil";
  if (!row.titleLine1.trim() || !safeSlideImage(row.image)) {
    return "Başlık ya da görsel eksik";
  }
  if (!isPublishWindowOpen(row, now)) {
    return "Yayın aralığı dışında";
  }
  return null;
}

/**
 * The rows the site draws right now: on, inside their window, with a title
 * and a picture, in the panel's order, at most `MAX_LIVE_HOME_SLIDES`.
 */
export function liveHomeHeroSlides(
  rows: readonly HomeHeroSlide[],
  now: number = Date.now(),
): HomeHeroSlide[] {
  return rows
    .filter((r) => homeSlideOffReason(r, now) === null)
    .sort(compareHomeHeroSlides)
    .slice(0, MAX_LIVE_HOME_SLIDES);
}

/** A bundled slide as a row's fields, for "Varsayılanları içe aktar". */
export function homeSlideToInput(
  slide: HomeSlide,
  sortOrder: number,
): HomeHeroSlideInput {
  const button = (b: HomeSlideButton | undefined) => ({
    label: b?.label ?? "",
    action: b?.action ?? "",
    href: b?.href ?? "",
  });
  const primary = button(slide.primary);
  const secondary = button(slide.secondary);
  return {
    sortOrder,
    isActive: true,
    startsAt: "",
    endsAt: "",
    kicker: slide.kicker,
    titleLine1: slide.title[0],
    titleLine2: slide.title[1],
    body: slide.text,
    image: slide.photo,
    alt: slide.alt,
    scene: slide.scene,
    primaryLabel: primary.label,
    primaryAction: primary.action,
    primaryHref: primary.href,
    secondaryLabel: secondary.label,
    secondaryAction: secondary.action,
    secondaryHref: secondary.href,
  };
}
