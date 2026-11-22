import "server-only";

import { getDb, TABLES } from "@/lib/db";
import { raiseDbError } from "@/lib/db/health";

import { imageVersion } from "./image-bytes";
import { MAX_STORED_IMAGE_LENGTH } from "./image-encode";
import { servedImage } from "./image-url";
import {
  findSiteImageSlot,
  SITE_IMAGE_SLOTS,
  siteImagePath,
  type SiteImages,
} from "./site-images-core";

/**
 * The panel's site photographs (site-images-core.ts): one `site_images` row
 * per slot that has an upload. Reads here are live (the panel, the image
 * route); the public pages read the resolved map through the Data Cache
 * (src/lib/seo/site-data.ts `getSiteImages`).
 */

export interface SiteImageRow {
  key: string;
  imageUrl: string;
  alt: string;
  updatedAt: string;
}

export async function listSiteImageRowsLive(): Promise<SiteImageRow[]> {
  const { data, error, status } = await getDb()
    .from(TABLES.siteImages)
    .select("*");
  if (error) raiseDbError("listSiteImageRows", error, status);
  return ((data ?? []) as SiteImageRow[]).filter((r) =>
    findSiteImageSlot(r.key),
  );
}

export async function getSiteImageRow(
  key: string,
): Promise<SiteImageRow | null> {
  if (!findSiteImageSlot(key)) return null;
  const { data, error, status } = await getDb()
    .from(TABLES.siteImages)
    .select("*")
    .eq("key", key)
    .maybeSingle();
  if (error) raiseDbError("getSiteImageRow", error, status);
  return (data as SiteImageRow | null) ?? null;
}

/**
 * Every slot as the pages draw it: an upload behind its stamped path (an
 * https:// address passes through), else the bundled photograph; the alt
 * text the panel typed, else the slot's own. Small: no picture bytes.
 */
export function resolveSiteImages(rows: readonly SiteImageRow[]): SiteImages {
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const out: SiteImages = {};
  for (const slot of SITE_IMAGE_SLOTS) {
    const row = byKey.get(slot.key);
    const stored = row?.imageUrl?.trim() ?? "";
    out[slot.key] = {
      src: stored
        ? servedImage(stored, siteImagePath(slot.key, imageVersion(stored)))
        : slot.fallback,
      alt: row?.alt?.trim() || slot.alt,
    };
  }
  return out;
}

/** An uploaded picture as the panel's uploader posts it, or an https URL. */
export function acceptableSiteImage(value: string): boolean {
  const v = value.trim();
  if (v.startsWith("data:image/")) {
    return (
      v.length <= MAX_STORED_IMAGE_LENGTH &&
      /^data:image\/(jpeg|png|webp|avif|gif);base64,/i.test(v)
    );
  }
  return /^https:\/\/[^\s"'<>]+$/i.test(v);
}

/**
 * Saves a slot: a new picture (`imageUrl`, already checked with
 * `acceptableSiteImage`) and/or its alt text. `imageUrl: null` keeps the
 * stored picture and changes the alt text only.
 */
export async function saveSiteImage(
  key: string,
  imageUrl: string | null,
  alt: string,
): Promise<void> {
  if (!findSiteImageSlot(key)) throw new Error(`unknown site image ${key}`);
  const sb = getDb();
  const now = new Date().toISOString();
  if (imageUrl === null) {
    const existing = await getSiteImageRow(key);
    if (!existing) return;
    const { error, status } = await sb
      .from(TABLES.siteImages)
      .update({ alt, updatedAt: now })
      .eq("key", key);
    if (error) raiseDbError("saveSiteImage", error, status);
    return;
  }
  const { error, status } = await sb
    .from(TABLES.siteImages)
    .upsert([{ key, imageUrl, alt, updatedAt: now }], { onConflict: "key" });
  if (error) raiseDbError("saveSiteImage", error, status);
}

/** Back to the bundled photograph: the slot's row goes. */
export async function resetSiteImage(key: string): Promise<void> {
  const { error, status } = await getDb()
    .from(TABLES.siteImages)
    .delete()
    .eq("key", key);
  if (error) raiseDbError("resetSiteImage", error, status);
}
