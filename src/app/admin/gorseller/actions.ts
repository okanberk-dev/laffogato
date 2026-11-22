"use server";

import { revalidatePath } from "next/cache";

import {
  actionError,
  actionOk,
  type ActionResult,
} from "@/lib/admin/action-result";
import { logAudit } from "@/lib/admin/audit";
import { requireRole } from "@/lib/admin/auth";
import {
  acceptableSiteImage,
  getSiteImageRow,
  resetSiteImage,
  saveSiteImage,
} from "@/lib/admin/site-images";
import { findSiteImageSlot } from "@/lib/admin/site-images-core";

const ALT_MAX = 160;

function readKey(formData: FormData): string | null {
  const key = String(formData.get("key") ?? "").trim();
  return findSiteImageSlot(key) ? key : null;
}

/**
 * The uploader posts a JSON array (image-upload.tsx); one slot takes one
 * picture. The page hands it the stored upload's served path, not its
 * bytes, so that path coming back means "kept". `undefined`: nothing new
 * (keep what is stored); `"cleared"`: the picture was removed in the
 * uploader; `null`: not an image the site can serve.
 */
function readUpload(formData: FormData): string | "cleared" | undefined | null {
  const raw = String(formData.get("image") ?? "").trim();
  if (!raw) return undefined;
  let first: unknown;
  try {
    const data: unknown = JSON.parse(raw);
    if (Array.isArray(data) && data.length === 0) return "cleared";
    first = Array.isArray(data) ? data[0] : undefined;
  } catch {
    first = raw;
  }
  if (typeof first !== "string" || !first.trim()) return undefined;
  const value = first.trim();
  if (value.startsWith("/gorsel/site/")) return undefined;
  return acceptableSiteImage(value) ? value : null;
}

function revalidateSite(): void {
  // The pages read the map through the Data Cache (`pub:site`), which the
  // write expired; the panel page re-reads live.
  revalidatePath("/admin/gorseller");
}

/** "Kaydet": a slot's new picture and/or its alt text. */
export async function saveSiteImageAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("content");
  const key = readKey(formData);
  if (!key) return actionError("Görsel alanı bulunamadı. Sayfayı yenile.");
  const upload = readUpload(formData);
  if (upload === null) {
    return actionError("Bu dosya kullanılamıyor. JPEG, PNG ya da WebP yükle.", {
      image: "Bu dosya kullanılamıyor.",
    });
  }
  const alt = String(formData.get("alt") ?? "")
    .trim()
    .slice(0, ALT_MAX);
  const stored = await getSiteImageRow(key);
  if (upload === "cleared") {
    // The picture removed in the uploader: back to the site's own.
    if (stored) {
      await resetSiteImage(key);
      await logAudit({
        action: "update",
        entity: "site_image",
        entityId: key,
        payload: { picture: "reset" },
      });
      revalidateSite();
      return actionOk("Fotoğraf kaldırıldı; site kendi fotoğrafını gösterir.");
    }
    return actionError("Önce bir fotoğraf seç.", { image: "Fotoğraf seç." });
  }
  if (upload === undefined && !stored) {
    return actionError("Önce bir fotoğraf seç.", { image: "Fotoğraf seç." });
  }
  await saveSiteImage(key, upload ?? null, alt);
  await logAudit({
    action: "update",
    entity: "site_image",
    entityId: key,
    payload: { picture: upload ? "new" : "kept", alt },
  });
  revalidateSite();
  return actionOk(
    "Kaydedildi. Site birkaç saniye içinde yeni fotoğrafı gösterir.",
  );
}

/** "Varsayılana dön": the bundled photograph again. */
export async function resetSiteImageAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("content");
  const key = readKey(formData);
  if (!key) return actionError("Görsel alanı bulunamadı. Sayfayı yenile.");
  await resetSiteImage(key);
  await logAudit({
    action: "update",
    entity: "site_image",
    entityId: key,
    payload: { picture: "reset" },
  });
  revalidateSite();
  return actionOk("Sitenin kendi fotoğrafına dönüldü.");
}
