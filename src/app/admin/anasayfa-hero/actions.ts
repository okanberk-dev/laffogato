"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  actionError,
  actionOk,
  type ActionResult,
} from "@/lib/admin/action-result";
import { logAudit } from "@/lib/admin/audit";
import { requireRole } from "@/lib/admin/auth";
import { setAdminFlash } from "@/lib/admin/flash";
import {
  createHomeHeroSlide,
  deleteHomeHeroSlide,
  importDefaultHomeSlides,
  moveHomeHeroSlide,
  setHomeHeroSlideActive,
  updateHomeHeroSlide,
} from "@/lib/admin/home-hero";
import { parseHomeHeroForm } from "@/lib/admin/home-hero-schema";
import { getSettings } from "@/lib/admin/store";

/**
 * The home page hero (/admin/anasayfa-hero).
 *
 * Every action opens its own role gate: a Server Action is a public POST
 * endpoint whatever page rendered it (CLAUDE.md rule 27), and these rewrite
 * the first thing every visitor sees. Content editors per roles.ts
 * (`content`: owner and manager), the same people who edit the site's copy.
 */

const PANEL = "/admin/anasayfa-hero";

function revalidate() {
  revalidatePath(PANEL);
  revalidatePath("/");
}

const REFUSED = "Formdaki uyarıları gider.";
const GONE = "Bu slayt silinmiş; listeye dön.";

export async function createHomeSlideAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("content");
  const form = parseHomeHeroForm(formData);
  if (!form.ok) return actionError(REFUSED, form.fieldErrors);
  const created = await createHomeHeroSlide(form.input);
  await logAudit({
    action: "create",
    entity: "home_hero_slide",
    entityId: created.id,
    payload: {
      title: `${created.titleLine1} ${created.titleLine2}`.trim(),
      isActive: created.isActive,
    },
  });
  revalidate();
  await setAdminFlash(`"${created.titleLine1}" slaytı eklendi.`);
  redirect(PANEL);
}

export async function updateHomeSlideAction(
  id: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("content");
  const form = parseHomeHeroForm(formData);
  if (!form.ok) return actionError(REFUSED, form.fieldErrors);
  const updated = await updateHomeHeroSlide(id, form.input);
  // Deleted while the form was open: the audit log must not claim an edit.
  if (!updated) return actionError(GONE);
  await logAudit({
    action: "update",
    entity: "home_hero_slide",
    entityId: id,
    payload: {
      title: `${updated.titleLine1} ${updated.titleLine2}`.trim(),
      isActive: updated.isActive,
    },
  });
  revalidate();
  await setAdminFlash(`"${updated.titleLine1}" kaydedildi.`);
  redirect(PANEL);
}

/** "Sil", behind ConfirmButton. */
export async function deleteHomeSlideAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("content");
  const id = String(formData.get("id") ?? "");
  if (!id) return actionError("Slayt seçilmedi.");
  const removed = await deleteHomeHeroSlide(id);
  revalidate();
  if (!removed) return actionError("Slayt zaten silinmiş.");
  await logAudit({ action: "delete", entity: "home_hero_slide", entityId: id });
  return actionOk("Slayt silindi, anasayfadan kalktı.");
}

/** "Yayına al" / "Yayından kaldır": one click, reversible. */
export async function toggleHomeSlideAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("content");
  const id = String(formData.get("id") ?? "");
  if (!id) return actionError("Slayt seçilmedi.");
  const isActive = formData.get("active") === "1";
  const updated = await setHomeHeroSlideActive(id, isActive);
  revalidate();
  if (!updated) return actionError(GONE);
  await logAudit({
    action: "update",
    entity: "home_hero_slide",
    entityId: id,
    payload: { isActive },
  });
  return actionOk(
    isActive ? "Slayt yayına alındı." : "Slayt yayından kaldırıldı.",
  );
}

/** The ↑ / ↓ buttons beside each row. */
export async function moveHomeSlideAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("content");
  const id = String(formData.get("id") ?? "");
  const direction = formData.get("direction");
  if (!id) return actionError("Slayt seçilmedi.");
  if (direction !== "up" && direction !== "down") {
    return actionError("Yön seçilmedi.");
  }
  const result = await moveHomeHeroSlide(id, direction);
  if (result === "not_found") return actionError(GONE);
  if (result === "edge") {
    return actionError(
      direction === "up" ? "Slayt zaten en başta." : "Slayt zaten en sonda.",
    );
  }
  await logAudit({
    action: "update",
    entity: "home_hero_slide",
    entityId: id,
    payload: { move: direction },
  });
  revalidate();
  return actionOk(
    direction === "up" ? "Slayt bir öne alındı." : "Slayt bir geriye alındı.",
  );
}

/**
 * "Varsayılanları içe aktar": the four bundled slides, karaoke included,
 * as rows the operator can edit. A default already in the list is left as
 * it is.
 */
export async function importDefaultHomeSlidesAction(
  _prev: ActionResult | null,
  _formData: FormData,
): Promise<ActionResult> {
  await requireRole("content");
  const settings = await getSettings();
  const { added, total } = await importDefaultHomeSlides({
    firstImage: settings.heroImageUrl,
  });
  revalidate();
  if (added === 0) {
    return actionOk(
      `${total} varsayılan slaytın hepsi zaten listede; hiçbir şey eklenmedi.`,
      "warning",
    );
  }
  await logAudit({
    action: "create",
    entity: "home_hero_slide",
    entityId: "varsayilanlar",
    payload: { imported: added },
  });
  return actionOk(
    added === total
      ? `${added} varsayılan slayt eklendi; artık buradan düzenleyebilirsin.`
      : `Eksik ${added} varsayılan slayt eklendi; düzenlediklerine dokunulmadı.`,
  );
}
