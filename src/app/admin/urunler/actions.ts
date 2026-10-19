"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  actionError,
  actionOk,
  type ActionResult,
} from "@/lib/admin/action-result";
import { logAudit, safeAudit } from "@/lib/admin/audit";
import { requireRole } from "@/lib/admin/auth";
import { bulkProductSchema } from "@/lib/admin/bulk-schema";
import { setAdminFlash } from "@/lib/admin/flash";
import {
  readMenuAllergens,
  tagsWithAllergens,
} from "@/lib/admin/menu-allergens-schema";
import { productFormSchema } from "@/lib/admin/product-schema";
import {
  bulkUpdateProducts,
  createProduct,
  deleteProduct,
  getProduct,
  listProductLabels,
  updateProduct,
  type AdminProduct,
  type BulkProductOp,
  type ProductVariantInput,
  type ShopCategoryId,
} from "@/lib/admin/store";
import { sceneColumns } from "@/lib/backdrop/scene";
import type { MenuAllergen } from "@/lib/menu/allergens";
import { discountRefusal, istanbulDayOf } from "@/lib/shop/discount";
import { FOOD_LABEL_KEYS } from "@/lib/shop/food-label";

function revalidateShop() {
  revalidatePath("/");
  revalidatePath("/admin/urunler");
  revalidatePath("/admin");
}

type ParsedProduct = ReturnType<typeof productFormSchema.parse>;

/**
 * The posted form, checked: the schema's fields, the fourteen allergen
 * boxes (their own schema, as on the menu form: nothing ticked is "not
 * entered", never "none") and the `nuts` tag kept in step with them.
 */
function readProductForm(formData: FormData):
  | {
      ok: true;
      parsed: ParsedProduct;
      allergens: MenuAllergen[] | null | undefined;
      tags: string[];
    }
  | { ok: false; state: ProductActionState } {
  const parsed = productFormSchema.safeParse(readFormDataToObject(formData));
  const allergens = readMenuAllergens(formData);
  const tags =
    parsed.success && allergens.ok
      ? tagsWithAllergens(parsed.data.tags, allergens.allergens)
      : null;
  if (!parsed.success || !allergens.ok || (tags && !tags.ok)) {
    const fieldErrors: Record<string, string> = {};
    const issues = [
      ...(parsed.success ? [] : parsed.error.issues),
      ...(allergens.ok ? [] : allergens.issues),
    ];
    for (const issue of issues) {
      const k = issue.path.join(".") || "form";
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    if (tags && !tags.ok) fieldErrors.allergens = tags.error;
    return {
      ok: false,
      state: {
        error: "Lütfen formdaki uyarıları gidermeden devam et.",
        fieldErrors,
      },
    };
  }
  return {
    ok: true,
    parsed: parsed.data,
    allergens: allergens.allergens,
    tags: (tags as { ok: true; tags: string[] }).tags,
  };
}

function toInput(
  parsed: ParsedProduct,
  allergens: MenuAllergen[] | null | undefined,
  tags: string[],
) {
  const variants: ProductVariantInput[] = parsed.variants.map((v, i) => ({
    id: v.id || `var-${i + 1}`,
    name: v.name,
    priceDeltaMinor: v.priceDeltaMinor,
    stock: v.stock,
    sku: v.sku,
    isActive: v.isActive,
    stockAtOpen: v.stockAtOpen,
  }));
  return {
    name: parsed.name,
    slug: parsed.slug,
    sku: parsed.sku,
    tag: parsed.tag,
    priceMinor: parsed.priceMinor,
    compareAtPriceMinor: parsed.compareAtPriceMinor,
    discountStartsOn: parsed.discountStartsOn,
    discountEndsOn: parsed.discountEndsOn,
    // The label fields the form sent; an absent one keeps the stored text.
    ...Object.fromEntries(
      FOOD_LABEL_KEYS.filter((k) => parsed[k] !== undefined).map((k) => [
        k,
        parsed[k],
      ]),
    ),
    // Never `allergens: undefined` written: absent keeps the stored list.
    ...(allergens === undefined ? {} : { allergens }),
    costMinor: parsed.costMinor,
    desc: parsed.desc,
    cat: parsed.cat,
    img: parsed.img,
    images: parsed.images,
    tags,
    brand: parsed.brand,
    notes: parsed.notes,
    stock: parsed.stock,
    stockAtOpen: parsed.stockAtOpen,
    saveToken: parsed.saveToken,
    stockFromVariants: parsed.stockFromVariants,
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
  /**
   * The stored stock after a save refused for it (admin audit CAT-03): the
   * form measures the next change from these instead of the values it was
   * opened with, so saving again does not repeat the refused change.
   */
  stockNow?: { stock: number; variants: Record<string, number> };
}

const PRODUCT_GONE_ERROR = "Bu ürün silinmiş; listeye dön.";
const DISCOUNT_REFUSED_ERROR =
  "Kaydedilmedi: eski fiyat ya da indirim tarihleri tutmuyor. Uyarıya bakıp yeniden kaydet.";
const STOCK_REFUSED_ERROR =
  "Fiyat, stok ve varyantlar kaydedilmedi; diğer alanlar kaydedildi. Uyarıya bakıp yeniden kaydet.";

export async function createProductAction(
  _prev: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  await requireRole("products");
  const form = readProductForm(formData);
  if (!form.ok) return form.state;
  const parsed = { data: form.parsed };
  // A new product has no online price history, so a compare-at price has
  // nothing to be the lowest of (Ticari Reklam Yön. m.14/3): refused here,
  // under the field, with the reason.
  const discount = discountRefusal({
    priceMinor: parsed.data.priceMinor,
    compareAtPriceMinor: parsed.data.compareAtPriceMinor,
    startDay: parsed.data.discountStartsOn,
    endDay: parsed.data.discountEndsOn,
    hasPricedVariants: false,
    history: [],
    stored: null,
    now: new Date(),
  });
  if (discount) {
    return {
      error: "Lütfen formdaki uyarıları gidermeden devam et.",
      fieldErrors: { [discount.field]: discount.message },
    };
  }
  const scene = await productScene(parsed.data, null);
  const created = await createProduct({
    ...toInput(parsed.data, form.allergens, form.tags),
    ...scene,
  });
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
  const session = await requireRole("products");
  const form = readProductForm(formData);
  if (!form.ok) return form.state;
  const parsed = { data: form.parsed };
  const previous = await getProduct(id);
  // Deleted in another tab: say so instead of "kaydedildi" and an audit row
  // for a save that wrote nothing (admin audit CAT-28).
  if (!previous) return { error: PRODUCT_GONE_ERROR };
  const scene = await productScene(parsed.data, previous);
  const saved = await updateProduct(
    id,
    { ...toInput(parsed.data, form.allergens, form.tags), ...scene },
    { actor: session.email },
  );
  if (!saved) return { error: PRODUCT_GONE_ERROR };
  // The compare-at price or its days were refused before anything was
  // written: nothing to audit, the form stays with the reason.
  if ("discountRefusal" in saved) {
    return {
      error: DISCOUNT_REFUSED_ERROR,
      fieldErrors: {
        [saved.discountRefusal.field]: saved.discountRefusal.message,
      },
    };
  }
  // The stock typed would go below zero (orders came in while the form was
  // open): price, variants and stock stay as stored, the rest is written.
  // The audit rows below come after the write: a failed one must not turn
  // the answer into an error the operator saves again over (safeAudit).
  if ("refusal" in saved) {
    await safeAudit({
      action: "update",
      entity: "product",
      entityId: id,
      payload: {
        name: parsed.data.name,
        sku: parsed.data.sku,
        stockRefused: saved.refusal.field,
      },
    });
    revalidateShop();
    return {
      error: STOCK_REFUSED_ERROR,
      fieldErrors: { [saved.refusal.field]: saved.refusal.message },
      stockNow: saved.refusal.stockNow,
    };
  }
  await safeAudit({
    action: "update",
    entity: "product",
    entityId: id,
    payload: {
      name: parsed.data.name,
      sku: parsed.data.sku,
      taxRatePct: parsed.data.taxRatePct,
      // The discount as saved: the record of what the page shows and from
      // when (the seller proves the price before it, Fiyat Etiketi m.11/1).
      // Read from the row written, not the form: an ended discount sent
      // back unchanged is cleared by the save.
      compareAtPriceMinor: saved.compareAtPriceMinor,
      discountStartsOn: istanbulDayOf(saved.discountStartsAt),
      discountEndsOn: istanbulDayOf(saved.discountEndsAt),
      ...(form.allergens === undefined ? {} : { allergens: form.allergens }),
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

/**
 * The row's one-click "Pasif yap" / "Aktif yap" (list ⋯ menu and the
 * product's page). The delete dialog told the operator to "pasif yap"
 * without offering it anywhere but the bulk bar (admin audit CAT-30).
 * `isActive` is the state asked for, not a flip, so a double click cannot
 * undo itself.
 */
export async function setProductActiveAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("products");
  const id = String(formData.get("id") ?? "");
  const raw = String(formData.get("isActive") ?? "");
  if (!id || (raw !== "true" && raw !== "false")) {
    return actionError("Geçersiz istek.");
  }
  const isActive = raw === "true";
  const product = await getProduct(id);
  if (!product) return actionError("Ürün bulunamadı; sayfayı yenile.");
  const { updated } = await bulkUpdateProducts([id], {
    kind: isActive ? "activate" : "deactivate",
  });
  revalidateShop();
  revalidatePath(`/admin/urunler/${id}`);
  if (updated > 0) {
    await safeAudit({
      action: "update",
      entity: "product",
      entityId: id,
      payload: { name: product.name, sku: product.sku, isActive },
    });
  }
  return actionOk(
    isActive
      ? `"${product.name}" yeniden mağazada.`
      : `"${product.name}" mağazadan kaldırıldı (pasif).`,
  );
}

/** How many product names one bulk audit row carries; the ids are all there. */
const BULK_AUDIT_NAMES = 100;

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
  // Read before the write: after a bulk delete the names are gone, and the
  // audit row is the only record of what was removed (admin audit CAT-20).
  const labels = await listProductLabels(ids);
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
    payload: {
      op,
      value,
      updated,
      idCount: ids.length,
      ids,
      names: labels.slice(0, BULK_AUDIT_NAMES).map((p) => p.name),
    },
  });
  revalidateShop();
  return { ok: { op, updated } };
}
