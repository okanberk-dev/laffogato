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
  createShopHeroSlide,
  deleteShopHeroSlide,
  updateShopHeroSlide,
  type ShopHeroSlideInput,
} from "@/lib/admin/store";

function parseInput(formData: FormData): ShopHeroSlideInput {
  return {
    title: String(formData.get("title") ?? ""),
    subtitle: String(formData.get("subtitle") ?? ""),
    imageUrl: String(formData.get("imageUrl") ?? ""),
    ctaLabel: String(formData.get("ctaLabel") ?? ""),
    ctaHref: String(formData.get("ctaHref") ?? ""),
    textTheme:
      String(formData.get("textTheme") ?? "light") === "dark"
        ? "dark"
        : "light",
    sortOrder: parseInt(String(formData.get("sortOrder") ?? "0"), 10) || 0,
    isActive: formData.get("isActive") === "on",
  };
}

export async function createSlideAction(formData: FormData) {
  // Server actions are public endpoints: without this, anyone who can POST
  // could rewrite the home page slider.
  await requireRole("shopHero");
  const input = parseInput(formData);
  if (!input.title.trim()) return;
  const created = await createShopHeroSlide(input);
  await logAudit({
    action: "create",
    entity: "shop_hero_slide",
    entityId: created.id,
    payload: { title: created.title, sortOrder: created.sortOrder },
  });
  revalidatePath("/admin/magaza-hero");
  revalidatePath("/", "layout");
  await setAdminFlash(`"${created.title}" slaytı eklendi.`);
  redirect("/admin/magaza-hero");
}

export async function updateSlideAction(id: string, formData: FormData) {
  // Server actions are public endpoints: without this, anyone who can POST
  // could rewrite the home page slider.
  await requireRole("shopHero");
  const input = parseInput(formData);
  await updateShopHeroSlide(id, input);
  await logAudit({
    action: "update",
    entity: "shop_hero_slide",
    entityId: id,
    payload: { title: input.title, isActive: input.isActive },
  });
  revalidatePath("/admin/magaza-hero");
  revalidatePath("/", "layout");
  await setAdminFlash("Slayt kaydedildi.");
  redirect("/admin/magaza-hero");
}

/** "Sil", behind a confirm. It used to delete on the first click, silently. */
export async function deleteSlideAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  // Server actions are public endpoints: without this, anyone who can POST
  // could rewrite the home page slider.
  await requireRole("shopHero");
  const id = String(formData.get("id") ?? "");
  if (!id) return actionError("Slayt seçilmedi.");
  const removed = await deleteShopHeroSlide(id);
  revalidatePath("/admin/magaza-hero");
  revalidatePath("/", "layout");
  if (!removed) return actionError("Slayt zaten silinmiş.");
  await logAudit({ action: "delete", entity: "shop_hero_slide", entityId: id });
  return actionOk("Slayt silindi, mağazadan kalktı.");
}
