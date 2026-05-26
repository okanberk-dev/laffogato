"use server";

import { revalidatePath } from "next/cache";

import { getAdminSession } from "@/lib/admin/auth";
import { adjustStock } from "@/lib/admin/store";

export interface AdjustStockState {
  error?: string;
  ok?: { productName: string; delta: number; stockAfter: number };
}

export async function adjustStockAction(
  _prev: AdjustStockState,
  formData: FormData,
): Promise<AdjustStockState> {
  const session = await getAdminSession();
  const actor = session?.email ?? "admin";

  const productId = String(formData.get("productId") ?? "").trim();
  const deltaRaw = String(formData.get("delta") ?? "").replace(",", ".").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (!productId) return { error: "Ürün seçilmedi." };
  if (!deltaRaw) return { error: "Değişiklik miktarı gir (+/−)." };
  const delta = parseInt(deltaRaw, 10);
  if (!Number.isFinite(delta) || delta === 0) {
    return { error: "Geçerli bir tam sayı gir (0 olamaz)." };
  }
  if (note.length < 3) {
    return { error: "Not en az 3 karakter olmalı (denetim için)." };
  }

  const result = await adjustStock({ productId, delta, note, actor });
  if (!result.ok) return { error: result.error };

  revalidatePath("/admin/stok-hareketleri");
  revalidatePath("/admin/urunler");
  revalidatePath("/admin");
  revalidatePath("/");

  return {
    ok: {
      productName: result.product.name,
      delta,
      stockAfter: result.product.stock,
    },
  };
}
