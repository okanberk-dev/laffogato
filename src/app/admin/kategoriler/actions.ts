"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { logAudit } from "@/lib/admin/audit";
import { requireRole } from "@/lib/admin/auth";
import {
  createCategory,
  deleteCategory,
  updateCategory,
  type ShopCategoryId,
} from "@/lib/admin/store";

const CAT_SLUGS: ShopCategoryId[] = ["beans", "gift", "gear", "merch", "pantry"];

function parseInput(formData: FormData) {
  const slugRaw = String(formData.get("slug") ?? "beans") as ShopCategoryId;
  const slug = CAT_SLUGS.includes(slugRaw) ? slugRaw : "beans";
  const label = String(formData.get("label") ?? "").trim();
  const icon = String(formData.get("icon") ?? "◯").trim() || "◯";
  const sortOrder = parseInt(String(formData.get("sortOrder") ?? "0"), 10) || 0;
  return { slug, label, icon, sortOrder };
}

export async function createCategoryAction(formData: FormData) {
  await requireRole("categories");
  const input = parseInput(formData);
  if (!input.label) return;
  const created = await createCategory(input);
  await logAudit({
    action: "create",
    entity: "category",
    entityId: created.id,
    payload: { slug: created.slug, label: created.label },
  });
  revalidatePath("/admin/kategoriler");
  revalidatePath("/admin/urunler");
  redirect("/admin/kategoriler");
}

export async function updateCategoryAction(id: string, formData: FormData) {
  await requireRole("categories");
  const input = parseInput(formData);
  await updateCategory(id, input);
  await logAudit({
    action: "update",
    entity: "category",
    entityId: id,
    payload: { slug: input.slug, label: input.label },
  });
  revalidatePath("/admin/kategoriler");
  revalidatePath("/admin/urunler");
  redirect("/admin/kategoriler");
}

export async function deleteCategoryAction(formData: FormData) {
  await requireRole("categories");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await deleteCategory(id);
  await logAudit({ action: "delete", entity: "category", entityId: id });
  revalidatePath("/admin/kategoriler");
  revalidatePath("/admin/urunler");
}
