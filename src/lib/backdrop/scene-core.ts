/**
 * What the panel's save writes into a row's scene columns (lafmobil
 * docs/DESIGN-GLASS.md §6.5 "Yükleme" and "Panel", glass round G5).
 *
 * Pure and client-safe: the form reads the two field names and the "auto"
 * value from here, the save actions feed `decideScene` what the photo turned
 * out to be (`scene.ts` reads it with sharp), and the tests drive every rule
 * without an image. The type import from the store is erased at build time.
 *
 * The rules, in the words of the contract (docs/API-MOBILE.md §1):
 * - "Otomatik" (`auto`) stores the photo's pick, recomputed on every save.
 * - A family chosen by hand (`manual`) survives a new upload.
 * - `photoCutout` always describes the photo being saved, whatever the source.
 * - Removing the photo clears an automatic pick; a hand choice stays.
 * - `vessel` is written only from the form.
 */

import type { BackdropColumns, BackdropSource } from "@/lib/admin/store";
import { isStoreImage } from "@/lib/images/public";

import {
  isBackdropKey,
  isVesselKey,
  type BackdropKey,
  type VesselKey,
} from "./families";

/** The form field that carries the scene choice: `auto` or a family key. */
export const BACKDROP_FIELD = "backdrop";
/** The form field that carries the vessel shape: "" or a vessel key. */
export const VESSEL_FIELD = "vessel";

/** The select value for "Otomatik (fotoğraftan)". */
export const BACKDROP_AUTO = "auto";
/** The select value for "Kategoriden" (no vessel chosen). */
export const VESSEL_FROM_CATEGORY = "";

/**
 * The scene the operator asked for.
 *
 * `keep` is what a request without the field means (a form from before this
 * change, still open in a tab): the row keeps its source and its hand choice.
 */
export type BackdropChoice =
  { kind: "keep" } | { kind: "auto" } | { kind: "manual"; family: BackdropKey };

/** The vessel the operator asked for; `keep` when the field was not sent. */
export type VesselChoice =
  { kind: "keep" } | { kind: "set"; vessel: VesselKey | null };

/**
 * The form's scene value. A family key is a hand choice; `auto` and any value
 * the list does not know are "Otomatik" (a stale or tampered value never
 * pins a scene nobody chose); a missing field is `keep`.
 */
export function parseBackdropChoice(raw: unknown): BackdropChoice {
  if (raw === null || raw === undefined) return { kind: "keep" };
  const value = String(raw).trim();
  if (isBackdropKey(value)) return { kind: "manual", family: value };
  return { kind: "auto" };
}

/**
 * The form's vessel value. A vessel key sets it, "" and any unknown value set
 * it to null ("Kategoriden"), a missing field is `keep`.
 */
export function parseVesselChoice(raw: unknown): VesselChoice {
  if (raw === null || raw === undefined) return { kind: "keep" };
  const value = String(raw).trim();
  return { kind: "set", vessel: isVesselKey(value) ? value : null };
}

/**
 * What kind of photo a row has, for the panel's "Sahne" line. The panel is
 * given this word, never the photo itself: a stored upload is a data URL of
 * up to 2 MB, and the form already carries it once.
 */
export type PhotoKind = "none" | "upload" | "link";

export function photoKind(photo: string | null | undefined): PhotoKind {
  if (!photo) return "none";
  // A photo in our store (R2) is an upload too: the save reads it back.
  return photo.startsWith("data:image/") || isStoreImage(photo)
    ? "upload"
    : "link";
}

/**
 * What reading the photo gave.
 *
 * - `none`: the row has no photo after this save.
 * - `read`: an uploaded photo sharp could read, with its pick.
 * - `unread`: a photo the save cannot read: an `https://` link or a
 *   site-relative file (`/menu/...`), which the panel never fetches
 *   (`scripts/backfill-backdrops.mjs` can), or bytes sharp refused.
 */
export type PhotoReading =
  | { kind: "none" }
  | {
      kind: "read";
      photoCutout: boolean;
      /** The automatic pick for this photo, or null (no confident pick). */
      family: BackdropKey | null;
      /** The body colour the pick read, or null (none read, or no pick run). */
      hex: string | null;
    }
  | { kind: "unread" };

/** The row as it was before this save, with the photo its columns describe. */
export interface ScenePrevious extends BackdropColumns {
  /** The menu item's `image`, or the product's `images[0]`; "" = none. */
  photo: string;
}

export interface SceneDecision {
  /** The photo being saved ("" = none): menu `image`, product `images[0]`. */
  photo: string;
  backdrop: BackdropChoice;
  vessel: VesselChoice;
  /** The stored row, or null for a new one. */
  previous: ScenePrevious | null;
  reading: PhotoReading;
}

/**
 * The five scene columns to store.
 *
 * An unreadable photo is the one case that looks back at the stored row: if
 * it is the same photo as before, what was measured for it still holds; a new
 * photo nobody could read has no pick and is taken as opaque (the app then
 * draws it inside its frame, which is right for any photo).
 */
export function decideScene(decision: SceneDecision): BackdropColumns {
  const { photo, backdrop, vessel, previous, reading } = decision;

  const previousSource: BackdropSource =
    previous?.backdropSource === "manual" ? "manual" : "auto";
  const source: BackdropSource =
    backdrop.kind === "keep"
      ? previousSource
      : backdrop.kind === "manual"
        ? "manual"
        : "auto";

  // What this photo is: its cutout flag, its body colour, its automatic pick.
  let photoCutout = false;
  let hex: string | null = null;
  let autoFamily: string | null = null;
  if (reading.kind === "read") {
    photoCutout = reading.photoCutout;
    hex = reading.hex;
    autoFamily = reading.family;
  } else if (
    reading.kind === "unread" &&
    previous !== null &&
    previous.photo === photo
  ) {
    photoCutout = previous.photoCutout === true;
    hex = previous.backdropHex ?? null;
    // The stored family is an automatic pick only if the row was automatic.
    autoFamily = previousSource === "auto" ? (previous.backdrop ?? null) : null;
  }

  let family: string | null;
  if (source === "auto") {
    family = autoFamily;
  } else if (backdrop.kind === "manual") {
    family = backdrop.family;
  } else {
    // `keep` on a hand-chosen row.
    family = previous?.backdrop ?? null;
  }

  return {
    backdrop: family,
    backdropSource: source,
    backdropHex: hex,
    photoCutout,
    vessel: vessel.kind === "set" ? vessel.vessel : (previous?.vessel ?? null),
  };
}
