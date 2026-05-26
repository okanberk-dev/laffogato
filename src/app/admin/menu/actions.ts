"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createMenuItem,
  deleteMenuItem,
  MENU_CATEGORY_KEYS,
  updateMenuItem,
  type MenuCategoryKey,
} from "@/lib/admin/store";

const HUE_VALUES = [
  "cream",
  "warm",
  "stone",
  "caramel",
  "espresso",
  "matcha",
  "pistachio",
  "rose",
  "dawn",
  "gold",
  "sky",
  "dark",
  "strawberry",
];

function parseInput(formData: FormData) {
  const categoryRaw = String(formData.get("categoryKey") ?? "affogato") as MenuCategoryKey;
  const categoryKey: MenuCategoryKey = MENU_CATEGORY_KEYS.includes(categoryRaw)
    ? categoryRaw
    : "affogato";
  const name = String(formData.get("name") ?? "").trim();
  const desc = String(formData.get("desc") ?? "").trim();
  const priceText = String(formData.get("price") ?? "0").replace(",", ".");
  const priceMajor = parseFloat(priceText);
  const priceMinor = Number.isFinite(priceMajor) ? Math.round(priceMajor * 100) : 0;
  const hueRaw = String(formData.get("hue") ?? "cream");
  const hue = HUE_VALUES.includes(hueRaw) ? hueRaw : "cream";
  const tagsRaw = String(formData.get("tags") ?? "");
  const tags = tagsRaw
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const sortOrder = parseInt(String(formData.get("sortOrder") ?? "0"), 10) || 0;
  const isActive = formData.get("isActive") === "on";

  return { categoryKey, name, desc, priceMinor, hue, tags, sortOrder, isActive };
}

function revalidateMenu() {
  revalidatePath("/admin/menu");
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function createMenuItemAction(formData: FormData) {
  const input = parseInput(formData);
  if (!input.name) return;
  await createMenuItem(input);
  revalidateMenu();
  redirect("/admin/menu");
}

export async function updateMenuItemAction(id: string, formData: FormData) {
  const input = parseInput(formData);
  await updateMenuItem(id, input);
  revalidateMenu();
  revalidatePath(`/admin/menu/${id}/duzenle`);
  redirect("/admin/menu");
}

export async function deleteMenuItemAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await deleteMenuItem(id);
  revalidateMenu();
}
