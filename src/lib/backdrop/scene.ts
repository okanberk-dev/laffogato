import "server-only";

import type { BackdropColumns } from "@/lib/admin/store";

import { backdropFromImage } from "./from-image";
import {
  decideScene,
  type BackdropChoice,
  type PhotoReading,
  type ScenePrevious,
  type VesselChoice,
} from "./scene-core";

/** One save's photo, item and form choices. */
export interface SceneRequest {
  /** The photo being saved ("" = none): menu `image`, product `images[0]`. */
  photo: string;
  /** The item's `hue` (menu) or `img` (shop): the pick's prior. */
  hue: string;
  /** The menu `categoryKey` or the shop `cat` (`gear` and `merch` get no pick). */
  category: string;
  backdrop: BackdropChoice;
  vessel: VesselChoice;
}

/**
 * The scene columns for one save of the menu item form or the product
 * wizard: reads the photo with sharp, then applies `decideScene`.
 *
 * Server only (`sharp` is native). The photo is read on every save, not only
 * when it changed: the pick depends on the item's `hue` and category too, and
 * it is deterministic, so an unchanged photo with an unchanged hue gives the
 * stored answer again. The read costs tens of milliseconds per save
 * (measured locally on 1600 px noise, the worst case: 14 ms for a JPEG,
 * 57 ms for a WebP).
 */
export async function sceneColumns(
  request: SceneRequest,
  previous: ScenePrevious | null,
): Promise<BackdropColumns> {
  return decideScene({
    photo: request.photo,
    backdrop: request.backdrop,
    vessel: request.vessel,
    previous,
    reading: await readPhoto(request),
  });
}

async function readPhoto(request: SceneRequest): Promise<PhotoReading> {
  if (!request.photo) return { kind: "none" };
  // Only an uploaded data URL is read: `backdropFromImage` never fetches an
  // https link, and a site-relative file (`/menu/...`) is left to
  // `scripts/backfill-backdrops.mjs`.
  const found = await backdropFromImage(request.photo, {
    hue: request.hue,
    category: request.category,
  });
  if (!found) return { kind: "unread" };
  return {
    kind: "read",
    photoCutout: found.photoCutout,
    family: found.pick.family,
    hex: found.pick.hex,
  };
}
