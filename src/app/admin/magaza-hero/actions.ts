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
import { deletedAnswer } from "@/lib/admin/delete-answer";
import { setAdminFlash } from "@/lib/admin/flash";
import {
  moveAnswer,
  readActiveForm,
  readMoveForm,
} from "@/lib/admin/list-order";
import { parseShopHeroForm } from "@/lib/admin/shop-hero-schema";
import {
  createShopHeroSlide,
  deleteShopHeroSlide,
  getShopHeroSlide,
  moveShopHeroSlide,
  setShopHeroSlideActive,
  updateShopHeroSlide,
} from "@/lib/admin/store";
import {
  NEW_DATA_IMAGE_REFUSAL,
  refusesNewDataImages,
} from "@/lib/images/store";

const PANEL = "/admin/magaza-hero";
const REFUSED = "Formdaki uyarıları gider.";
const GONE = "Bu slayt silinmiş; listeye dön.";

function revalidate() {
  revalidatePath(PANEL);
  revalidatePath("/", "layout");
}

/**
 * "Slaytı kaydet". Answers an ActionResult (ActionForm): a refusal comes
 * back under its field and the form keeps what was typed. It used to return
 * nothing for a blank title, and React's form reset then wiped the form.
 */
export async function createSlideAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  // Server actions are public endpoints: without this, anyone who can POST
  // could rewrite the shop page's slider.
  await requireRole("shopHero");
  const form = parseShopHeroForm(formData);
  if (!form.ok) return actionError(REFUSED, form.fieldErrors);
  if (refusesNewDataImages([form.input.imageUrl], [])) {
    return actionError(NEW_DATA_IMAGE_REFUSAL, {
      imageUrl: NEW_DATA_IMAGE_REFUSAL,
    });
  }
  const created = await createShopHeroSlide(form.input);
  await logAudit({
    action: "create",
    entity: "shop_hero_slide",
    entityId: created.id,
    payload: { title: created.title, sortOrder: created.sortOrder },
  });
  revalidate();
  await setAdminFlash(`"${created.title}" slaytı eklendi.`);
  redirect(PANEL);
}

/** "Değişiklikleri kaydet", bound to the slide's id. */
export async function updateSlideAction(
  id: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  // Server actions are public endpoints: without this, anyone who can POST
  // could rewrite the shop page's slider.
  await requireRole("shopHero");
  const form = parseShopHeroForm(formData);
  if (!form.ok) return actionError(REFUSED, form.fieldErrors);
  const stored = await getShopHeroSlide(id);
  if (refusesNewDataImages([form.input.imageUrl], [stored?.imageUrl])) {
    return actionError(NEW_DATA_IMAGE_REFUSAL, {
      imageUrl: NEW_DATA_IMAGE_REFUSAL,
    });
  }
  const updated = await updateShopHeroSlide(id, form.input);
  // Deleted in another tab while the form was open: say so, and do not
  // write an audit row for an edit that saved nothing (admin audit CAT-28).
  if (!updated) return actionError(GONE);
  await logAudit({
    action: "update",
    entity: "shop_hero_slide",
    entityId: id,
    payload: { title: updated.title, isActive: updated.isActive },
  });
  revalidate();
  await setAdminFlash(`"${updated.title}" kaydedildi.`);
  redirect(PANEL);
}

/** "Sil", behind a confirm. It used to delete on the first click, silently. */
export async function deleteSlideAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  // Server actions are public endpoints: without this, anyone who can POST
  // could rewrite the shop page's slider.
  await requireRole("shopHero");
  const id = String(formData.get("id") ?? "");
  if (!id) return actionError("Slayt seçilmedi.");
  // Read before the delete: afterwards the audit row is the only place
  // that can name what was removed (admin audit CAT-20).
  const slide = await getShopHeroSlide(id);
  const removed = await deleteShopHeroSlide(id);
  revalidate();
  if (!removed) return actionError("Slayt zaten silinmiş.");
  await logAudit({
    action: "delete",
    entity: "shop_hero_slide",
    entityId: id,
    payload: slide ? { title: slide.title } : {},
  });
  return deletedAnswer(formData, "Slayt silindi, mağazadan kalktı.", PANEL);
}

/**
 * "Yayına al" / "Yayından kaldır" from the list: one click, reversible. The
 * delete dialog used to send the operator into the form for this.
 */
export async function setSlideActiveAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("shopHero");
  const form = readActiveForm(formData);
  if (!form.ok) return actionError(form.error);
  const found = await setShopHeroSlideActive(form.id, form.isActive);
  revalidate();
  if (!found) return actionError(GONE);
  await logAudit({
    action: "update",
    entity: "shop_hero_slide",
    entityId: form.id,
    payload: { isActive: form.isActive },
  });
  return actionOk(
    form.isActive
      ? "Slayt yayına alındı; mağazada dönüyor."
      : "Slayt yayından kaldırıldı; mağazada görünmüyor.",
  );
}

/** The ↑ / ↓ beside each row. */
export async function moveSlideAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("shopHero");
  const form = readMoveForm(formData);
  if (!form.ok) return actionError(form.error);
  const outcome = await moveShopHeroSlide(form.id, form.direction);
  if (outcome === "moved") {
    await logAudit({
      action: "update",
      entity: "shop_hero_slide",
      entityId: form.id,
      payload: { move: form.direction },
    });
    revalidate();
  }
  return moveAnswer(outcome, form.direction, "Slayt", GONE);
}
