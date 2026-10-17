import "server-only";

import { HOME_SLIDES, type HomeSlide } from "@/components/laffogato/data";
import { getDb, TABLES, type DbError } from "@/lib/db";
import { publicRead, raiseDbError } from "@/lib/db/health";

import {
  compareHomeHeroSlides,
  HOME_HERO_LIMITS as L,
  homeSlideToInput,
  isHomeHeroScene,
  isHomeSlideAction,
  liveHomeHeroSlides,
  safeSlideHref,
  safeSlideImage,
  toHomeSlide,
  type HomeHeroSlide,
  type HomeHeroSlideInput,
} from "./home-hero-core";
import { imageVersion } from "./image-bytes";
import { homeHeroImagePath, servedImage } from "./image-url";

/**
 * The home page hero's slides (`public.home_hero_slides`), edited at
 * /admin/anasayfa-hero.
 *
 * The site reads them through `listHomeSlidesForSite`: the live rows in the
 * panel's order, or the bundled HOME_SLIDES (data.ts) when none is live - an
 * empty table, every row off or outside its window, or a database that
 * cannot be reached. A query the database REJECTS still throws, like every
 * other public read (src/lib/db/health.ts): a broken query is a bug, not an
 * outage.
 *
 * The rules a row must pass live in ./home-hero-core.ts (pure) and the form's
 * in ./home-hero-schema.ts; this file only reads and writes, and clamps what
 * it writes once more so a caller that skipped the form cannot store a link
 * the site would refuse.
 */

const TABLE = TABLES.homeHeroSlides;

/** The ids "Varsayılanları içe aktar" gives HOME_SLIDES, one per slide. */
export const DEFAULT_HOME_SLIDE_IDS = HOME_SLIDES.map(
  (_, i) => `hhero-varsayilan-${i + 1}`,
);

/** Gap between neighbours after a reorder, so a typed-in order fits between. */
const SORT_STEP = 10;

function checkErr(error: DbError | null, status: number, ctx: string): void {
  if (error) raiseDbError(ctx, error, status);
}

function toSlide(row: Record<string, unknown>): HomeHeroSlide {
  const s = (k: string) => String(row[k] ?? "");
  return {
    id: s("id"),
    sortOrder: Number(row.sortOrder ?? 0) || 0,
    isActive: row.isActive !== false,
    startsAt: s("startsAt"),
    endsAt: s("endsAt"),
    kicker: s("kicker"),
    titleLine1: s("titleLine1"),
    titleLine2: s("titleLine2"),
    body: s("body"),
    image: s("image"),
    alt: s("alt"),
    scene: s("scene"),
    primaryLabel: s("primaryLabel"),
    primaryAction: s("primaryAction"),
    primaryHref: s("primaryHref"),
    secondaryLabel: s("secondaryLabel"),
    secondaryAction: s("secondaryAction"),
    secondaryHref: s("secondaryHref"),
    createdAt: s("createdAt"),
    updatedAt: s("updatedAt"),
  };
}

/** A button's three columns, kept only when they still pass the site's check. */
function cleanButton(label: string, action: string, href: string) {
  const text = label.trim().slice(0, L.buttonLabel);
  if (!text) return { label: "", action: "", href: "" };
  if (isHomeSlideAction(action)) return { label: text, action, href: "" };
  const safe = safeSlideHref(href);
  return safe
    ? { label: text, action: "", href: safe }
    : { label: "", action: "", href: "" };
}

function clean(input: HomeHeroSlideInput): HomeHeroSlideInput {
  const primary = cleanButton(
    input.primaryLabel,
    input.primaryAction,
    input.primaryHref,
  );
  const secondary = cleanButton(
    input.secondaryLabel,
    input.secondaryAction,
    input.secondaryHref,
  );
  return {
    sortOrder: Number.isFinite(input.sortOrder)
      ? Math.min(L.sortOrder, Math.max(0, Math.floor(input.sortOrder)))
      : 0,
    isActive: !!input.isActive,
    startsAt: input.startsAt.trim().slice(0, 40),
    endsAt: input.endsAt.trim().slice(0, 40),
    kicker: input.kicker.trim().slice(0, L.kicker),
    titleLine1: input.titleLine1.trim().slice(0, L.titleLine),
    titleLine2: input.titleLine2.trim().slice(0, L.titleLine),
    body: input.body.trim().slice(0, L.body),
    image: safeSlideImage(input.image),
    alt: input.alt.trim().slice(0, L.alt),
    scene: isHomeHeroScene(input.scene) ? input.scene : "latte",
    primaryLabel: primary.label,
    primaryAction: primary.action,
    primaryHref: primary.href,
    secondaryLabel: secondary.label,
    secondaryAction: secondary.action,
    secondaryHref: secondary.href,
  };
}

/** Every slide, in the panel's order. */
export async function listHomeHeroSlides(): Promise<HomeHeroSlide[]> {
  const { data, error, status } = await getDb()
    .from(TABLE)
    .select("*")
    .order("sortOrder", { ascending: true })
    .order("createdAt", { ascending: true });
  checkErr(error, status, "listHomeHeroSlides");
  return (data ?? [])
    .map((r: Record<string, unknown>) => toSlide(r))
    .sort(compareHomeHeroSlides);
}

export async function getHomeHeroSlide(
  id: string,
): Promise<HomeHeroSlide | null> {
  const { data, error, status } = await getDb()
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  checkErr(error, status, "getHomeHeroSlide");
  return data ? toSlide(data) : null;
}

/** The order a new slide gets: after the last one. */
export async function nextHomeHeroSortOrder(): Promise<number> {
  const all = await listHomeHeroSlides();
  const last = all.reduce((max, s) => Math.max(max, s.sortOrder), 0);
  return Math.min(L.sortOrder, last + SORT_STEP);
}

export async function createHomeHeroSlide(
  input: HomeHeroSlideInput,
): Promise<HomeHeroSlide> {
  const now = new Date().toISOString();
  const slide: HomeHeroSlide = {
    id: `hhero-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...clean(input),
    createdAt: now,
    updatedAt: now,
  };
  const { error, status } = await getDb().from(TABLE).insert(slide);
  checkErr(error, status, "createHomeHeroSlide");
  return slide;
}

/** null: the row was deleted while the form was open. */
export async function updateHomeHeroSlide(
  id: string,
  input: HomeHeroSlideInput,
): Promise<HomeHeroSlide | null> {
  const { data, error, status } = await getDb()
    .from(TABLE)
    .update({ ...clean(input), updatedAt: new Date().toISOString() })
    .eq("id", id)
    .select("*");
  checkErr(error, status, "updateHomeHeroSlide");
  const row = (data ?? [])[0];
  return row ? toSlide(row) : null;
}

/** "Yayına al" / "Yayından kaldır". null: the row is gone. */
export async function setHomeHeroSlideActive(
  id: string,
  isActive: boolean,
): Promise<HomeHeroSlide | null> {
  const { data, error, status } = await getDb()
    .from(TABLE)
    .update({ isActive, updatedAt: new Date().toISOString() })
    .eq("id", id)
    .select("*");
  checkErr(error, status, "setHomeHeroSlideActive");
  const row = (data ?? [])[0];
  return row ? toSlide(row) : null;
}

/**
 * The removed slide's title, for the audit log (once the row is gone, its id
 * alone names nothing), or null when it was already gone.
 */
export async function deleteHomeHeroSlide(
  id: string,
): Promise<{ title: string } | null> {
  const { data, error, status } = await getDb()
    .from(TABLE)
    .delete()
    .eq("id", id)
    .select("id, titleLine1, titleLine2");
  checkErr(error, status, "deleteHomeHeroSlide");
  const row = (data ?? [])[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  const title = [row.titleLine1, row.titleLine2]
    .map((t) => String(t ?? "").trim())
    .filter(Boolean)
    .join(" ");
  return { title };
}

export type MoveResult = "moved" | "edge" | "not_found";

/**
 * Swaps a slide with its neighbour in the panel's order, then renumbers the
 * whole list 10, 20, 30… so equal or typed-in orders cannot make a later
 * move a no-op. Only the rows whose number changes are written.
 */
export async function moveHomeHeroSlide(
  id: string,
  direction: "up" | "down",
): Promise<MoveResult> {
  const order = await listHomeHeroSlides();
  const from = order.findIndex((s) => s.id === id);
  if (from === -1) return "not_found";
  const to = direction === "up" ? from - 1 : from + 1;
  if (to < 0 || to >= order.length) return "edge";
  [order[from], order[to]] = [order[to], order[from]];
  const db = getDb();
  for (const [i, slide] of order.entries()) {
    const sortOrder = Math.min(L.sortOrder, (i + 1) * SORT_STEP);
    if (slide.sortOrder === sortOrder) continue;
    const { error, status } = await db
      .from(TABLE)
      .update({ sortOrder })
      .eq("id", slide.id);
    checkErr(error, status, "moveHomeHeroSlide");
  }
  return "moved";
}

/**
 * "Varsayılanları içe aktar": the bundled HOME_SLIDES, karaoke slide
 * included, as editable rows after the existing ones.
 *
 * Each default has a fixed id, so a second import adds back only the ones
 * that were deleted and never overwrites an edited one. `firstImage` is
 * Ayarlar → "Hero görsel URL": while the bundled slides are on the site it
 * replaces the first one's photo, so the copy keeps it.
 */
export async function importDefaultHomeSlides(
  opts: { firstImage?: string } = {},
): Promise<{ added: number; total: number }> {
  const existing = await listHomeHeroSlides();
  const base = existing.reduce((max, s) => Math.max(max, s.sortOrder), 0);
  const now = new Date().toISOString();
  const firstImage = safeSlideImage(opts.firstImage ?? "");
  const rows: HomeHeroSlide[] = HOME_SLIDES.map((slide, i) => {
    const input = homeSlideToInput(slide, base + (i + 1) * SORT_STEP);
    if (i === 0 && firstImage) input.image = firstImage;
    return {
      id: DEFAULT_HOME_SLIDE_IDS[i],
      ...clean(input),
      createdAt: now,
      updatedAt: now,
    };
  });
  const { data, error, status } = await getDb()
    .from(TABLE)
    .upsert(rows, { onConflict: "id", ignoreDuplicates: true })
    .select("id");
  checkErr(error, status, "importDefaultHomeSlides");
  return { added: (data ?? []).length, total: rows.length };
}

/** A row's picture as the browser fetches it: an upload is served by id. */
export function homeSlidePhoto(slide: Pick<HomeHeroSlide, "id" | "image">) {
  const image = safeSlideImage(slide.image);
  return servedImage(image, homeHeroImagePath(slide.id, imageVersion(image)));
}

/**
 * What the home page draws. `fromPanel` is false when the bundled slides
 * stand in, which is also when Ayarlar → "Hero görsel URL" still applies.
 */
export async function listHomeSlidesForSite(
  now: number = Date.now(),
): Promise<{ slides: HomeSlide[]; fromPanel: boolean }> {
  const rows = await publicRead(
    "listHomeSlidesForSite",
    null,
    listHomeHeroSlides,
  );
  const live = rows ? liveHomeHeroSlides(rows, now) : [];
  if (live.length === 0) return { slides: HOME_SLIDES, fromPanel: false };
  return {
    slides: live.map((row) => toHomeSlide(row, homeSlidePhoto(row))),
    fromPanel: true,
  };
}
