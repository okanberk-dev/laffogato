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
import { parseShopHeroForm } from "@/lib/admin/shop-hero-schema";
import {
  createShopHeroSlide,
  deleteShopHeroSlide,
  getShopHeroSlide,
  updateShopHeroSlide,
} from "@/lib/admin/store";

const PANEL = "/admin/magaza-hero";
const REFUSED = "Formdaki uyarıları gider.";

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
  const updated = await updateShopHeroSlide(id, form.input);
  // Deleted in another tab while the form was open: say so, and do not
  // write an audit row for an edit that saved nothing (admin audit CAT-28).
  if (!updated) return actionError("Bu slayt silinmiş; listeye dön.");
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
  return actionOk("Slayt silindi, mağazadan kalktı.");
}
