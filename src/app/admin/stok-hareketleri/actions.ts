"use server";

import { revalidatePath } from "next/cache";

import {
  actionError,
  actionOk,
  type ActionResult,
} from "@/lib/admin/action-result";
import { logAudit } from "@/lib/admin/audit";
import { requireRole } from "@/lib/admin/auth";
import { parseStockDelta } from "@/lib/admin/stock-delta";
import { adjustStock } from "@/lib/admin/store";

/**
 * The manual adjustment. Each field answers under itself (ActionForm), the
 * success comes back as a toast with the new stock. The amount is read by
 * parseStockDelta: "+12", "-3" and "−3" all work, "1.5" is refused rather
 * than cut to 1.
 */
export async function adjustStockAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireRole("stock");
  const actor = session.email;

  const productId = String(formData.get("productId") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const delta = parseStockDelta(String(formData.get("delta") ?? ""));

  const fieldErrors: Record<string, string> = {};
  if (!productId) fieldErrors.productId = "Ürün seç.";
  if (!delta.ok) fieldErrors.delta = delta.error;
  if (note.length < 3) {
    fieldErrors.note = "Not en az 3 karakter olmalı (denetim için).";
  }
  if (!delta.ok || Object.keys(fieldErrors).length > 0) {
    return actionError("Formdaki uyarıları gider.", fieldErrors);
  }

  const result = await adjustStock({
    productId,
    delta: delta.delta,
    note,
    actor,
  });
  if (!result.ok) return actionError(result.error);

  await logAudit({
    action: "update",
    entity: "stock",
    entityId: productId,
    payload: {
      delta: delta.delta,
      stockAfter: result.product.stock,
      note,
    },
  });

  revalidatePath("/admin/stok-hareketleri");
  revalidatePath("/admin/urunler");
  revalidatePath("/admin");
  revalidatePath("/");

  const signed = delta.delta > 0 ? `+${delta.delta}` : String(delta.delta);
  return actionOk(
    `${result.product.name}: ${signed} adet. Yeni stok: ${result.product.stock}.`,
  );
}
