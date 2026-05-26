"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { bulkProductSchema } from "@/lib/admin/bulk-schema";
import { productFormSchema } from "@/lib/admin/product-schema";
import {
  bulkUpdateProducts,
  createProduct,
  deleteProduct,
  updateProduct,
  type AdminProductVariant,
  type BulkProductOp,
  type ShopCategoryId,
} from "@/lib/admin/store";

function revalidateShop() {
  revalidatePath("/");
  revalidatePath("/admin/urunler");
  revalidatePath("/admin");
}

function toInput(parsed: ReturnType<typeof productFormSchema.parse>) {
  const variants: AdminProductVariant[] = parsed.variants.map((v, i) => ({
    id: v.id || `var-${i + 1}`,
    name: v.name,
    priceDeltaMinor: v.priceDeltaMinor,
    stock: v.stock,
    sku: v.sku,
    isActive: v.isActive,
  }));
  return {
    name: parsed.name,
    slug: parsed.slug,
    sku: parsed.sku,
    tag: parsed.tag,
    priceMinor: parsed.priceMinor,
    compareAtPriceMinor: parsed.compareAtPriceMinor,
    costMinor: parsed.costMinor,
    desc: parsed.desc,
    cat: parsed.cat,
    img: parsed.img,
    images: parsed.images,
    stock: parsed.stock,
    lowStockThreshold: parsed.lowStockThreshold,
    weightGrams: parsed.weightGrams,
    featured: parsed.featured,
    isNew: parsed.isNew,
    isActive: parsed.isActive,
    seoTitle: parsed.seoTitle,
    seoDescription: parsed.seoDescription,
    variants,
  };
}

function readFormDataToObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") {
      out[key] = value;
    }
  }
  return out;
}

export interface ProductActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function createProductAction(
  _prev: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const parsed = productFormSchema.safeParse(readFormDataToObject(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path.join(".") || "form";
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return {
      error: "Lütfen formdaki uyarıları gidermeden devam et.",
      fieldErrors,
    };
  }
  await createProduct(toInput(parsed.data));
  revalidateShop();
  redirect("/admin/urunler");
}

export async function updateProductAction(
  id: string,
  _prev: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const parsed = productFormSchema.safeParse(readFormDataToObject(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path.join(".") || "form";
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return {
      error: "Lütfen formdaki uyarıları gidermeden devam et.",
      fieldErrors,
    };
  }
  await updateProduct(id, toInput(parsed.data));
  revalidateShop();
  revalidatePath(`/admin/urunler/${id}/duzenle`);
  redirect("/admin/urunler");
}

export async function deleteProductAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await deleteProduct(id);
  revalidateShop();
}

export interface BulkActionState {
  error?: string;
  ok?: { op: string; updated: number };
}

export async function bulkProductsAction(
  _prev: BulkActionState,
  formData: FormData,
): Promise<BulkActionState> {
  const parsed = bulkProductSchema.safeParse({
    ids: String(formData.get("ids") ?? ""),
    op: String(formData.get("op") ?? ""),
    value: formData.get("value") ? String(formData.get("value")) : undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz istek." };
  }
  const { ids, op, value } = parsed.data;
  let storeOp: BulkProductOp;
  if (op === "set_category") {
    storeOp = { kind: "set_category", cat: value as ShopCategoryId };
  } else {
    storeOp = { kind: op };
  }
  const { updated } = await bulkUpdateProducts(ids, storeOp);
  revalidateShop();
  return { ok: { op, updated } };
}
