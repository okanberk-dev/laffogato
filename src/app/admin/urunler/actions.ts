"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createProduct,
  deleteProduct,
  updateProduct,
  type ShopCategoryId,
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
];

const CAT_VALUES: ShopCategoryId[] = ["beans", "gift", "gear", "merch", "pantry"];

function parseInput(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const tag = String(formData.get("tag") ?? "").trim();
  const priceText = String(formData.get("price") ?? "0").replace(",", ".");
  const priceMajor = parseFloat(priceText);
  const priceMinor = Number.isFinite(priceMajor) ? Math.round(priceMajor * 100) : 0;
  const desc = String(formData.get("desc") ?? "").trim();
  const catRaw = String(formData.get("cat") ?? "beans") as ShopCategoryId;
  const cat = CAT_VALUES.includes(catRaw) ? catRaw : "beans";
  const imgRaw = String(formData.get("img") ?? "cream");
  const img = HUE_VALUES.includes(imgRaw) ? imgRaw : "cream";
  const stock = parseInt(String(formData.get("stock") ?? "0"), 10) || 0;
  const featured = formData.get("featured") === "on";
  const isNew = formData.get("isNew") === "on";
  const isActive = formData.get("isActive") === "on";

  return { name, tag, priceMinor, desc, cat, img, stock, featured, isNew, isActive };
}

export async function createProductAction(formData: FormData) {
  const input = parseInput(formData);
  if (!input.name) {
    return;
  }
  await createProduct(input);
  revalidatePath("/admin/urunler");
  revalidatePath("/admin");
  redirect("/admin/urunler");
}

export async function updateProductAction(id: string, formData: FormData) {
  const input = parseInput(formData);
  await updateProduct(id, input);
  revalidatePath("/admin/urunler");
  revalidatePath(`/admin/urunler/${id}/duzenle`);
  revalidatePath("/admin");
  redirect("/admin/urunler");
}

export async function deleteProductAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await deleteProduct(id);
  revalidatePath("/admin/urunler");
  revalidatePath("/admin");
}
