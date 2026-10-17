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
import { bulkProductSchema } from "@/lib/admin/bulk-schema";
import { setAdminFlash } from "@/lib/admin/flash";
import { productFormSchema } from "@/lib/admin/product-schema";
import {
  bulkUpdateProducts,
  createProduct,
  deleteProduct,
  getProduct,
  updateProduct,
  type AdminProduct,
  type AdminProductVariant,
  type BulkProductOp,
  type ShopCategoryId,
} from "@/lib/admin/store";
import { sceneColumns } from "@/lib/backdrop/scene";

function revalidateShop() {
  revalidatePath("/");
  revalidatePath("/admin/urunler");
  revalidatePath("/admin");
}

type ParsedProduct = ReturnType<typeof productFormSchema.parse>;

function toInput(parsed: ParsedProduct) {
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
    tags: parsed.tags,
    brand: parsed.brand,
    notes: parsed.notes,
    stock: parsed.stock,
    lowStockThreshold: parsed.lowStockThreshold,
    weightGrams: parsed.weightGrams,
    taxRatePct: parsed.taxRatePct,
    featured: parsed.featured,
    isNew: parsed.isNew,
    isActive: parsed.isActive,
    seoTitle: parsed.seoTitle,
    seoDescription: parsed.seoDescription,
    variants,
  };
}

/**
 * The scene columns for this save (glass round). They describe the FIRST
 * photo, the one the app draws: reordering the gallery changes the pick.
 * `previous` is the stored product on an edit, null on a new one.
 */
function productScene(parsed: ParsedProduct, previous: AdminProduct | null) {
  return sceneColumns(
    {
      photo: parsed.images[0] ?? "",
      hue: parsed.img,
      category: parsed.cat,
      backdrop: parsed.backdropChoice,
      vessel: parsed.vesselChoice,
    },
    previous ? { ...previous, photo: previous.images?.[0] ?? "" } : null,
  );
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
  await requireRole("products");
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
  const scene = await productScene(parsed.data, null);
  const created = await createProduct({ ...toInput(parsed.data), ...scene });
  await logAudit({
    action: "create",
    entity: "product",
    entityId: created.id,
    payload: { name: created.name, sku: created.sku },
  });
  revalidateShop();
  await setAdminFlash(`"${created.name}" eklendi.`);
  redirect("/admin/urunler");
}

export async function updateProductAction(
  id: string,
  _prev: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  await requireRole("products");
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
  const scene = await productScene(parsed.data, await getProduct(id));
  await updateProduct(id, { ...toInput(parsed.data), ...scene });
  await logAudit({
    action: "update",
    entity: "product",
    entityId: id,
    payload: {
      name: parsed.data.name,
      sku: parsed.data.sku,
      taxRatePct: parsed.data.taxRatePct,
    },
  });
  revalidateShop();
  revalidatePath(`/admin/urunler/${id}/duzenle`);
  await setAdminFlash(`"${parsed.data.name}" kaydedildi.`);
  redirect("/admin/urunler");
}

/** A row's "Sil", behind ConfirmButton; the answer comes back as a toast. */
export async function deleteProductAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("products");
  const id = String(formData.get("id") ?? "");
  if (!id) return actionError("Ürün seçilmedi.");
  const product = await getProduct(id);
  const removed = await deleteProduct(id);
  revalidateShop();
  if (!removed) return actionError("Ürün zaten silinmiş.");
  await logAudit({
    action: "delete",
    entity: "product",
    entityId: id,
    payload: product ? { name: product.name, sku: product.sku } : {},
  });
  return actionOk(`"${product?.name ?? id}" silindi.`);
}

export interface BulkActionState {
  error?: string;
  ok?: { op: string; updated: number };
}

export async function bulkProductsAction(
  _prev: BulkActionState,
  formData: FormData,
): Promise<BulkActionState> {
  await requireRole("products");
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
  await logAudit({
    action: op === "delete" ? "bulk_delete" : "bulk_update",
    entity: "product",
    payload: { op, value, updated, idCount: ids.length },
  });
  revalidateShop();
  return { ok: { op, updated } };
}
