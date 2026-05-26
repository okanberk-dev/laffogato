"use server";

import { revalidatePath } from "next/cache";

import { bulkOrderSchema } from "@/lib/admin/bulk-schema";
import {
  bulkUpdateOrders,
  updateOrderStatus,
  type AdminOrderStatus,
} from "@/lib/admin/store";

const STATUSES: AdminOrderStatus[] = [
  "pending_payment",
  "paid",
  "preparing",
  "shipped",
  "completed",
  "cancelled",
  "refunded",
];

export async function updateOrderStatusAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as AdminOrderStatus;
  if (!id || !STATUSES.includes(status)) return;
  await updateOrderStatus(id, status);
  revalidatePath("/admin/siparisler");
  revalidatePath("/admin");
}

export interface BulkOrderActionState {
  error?: string;
  ok?: { op: string; updated: number };
}

export async function bulkOrdersAction(
  _prev: BulkOrderActionState,
  formData: FormData,
): Promise<BulkOrderActionState> {
  const parsed = bulkOrderSchema.safeParse({
    ids: String(formData.get("ids") ?? ""),
    op: String(formData.get("op") ?? ""),
    value: String(formData.get("value") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz istek." };
  }
  const { ids, value } = parsed.data;
  const { updated } = await bulkUpdateOrders(ids, {
    kind: "set_status",
    status: value,
  });
  revalidatePath("/admin/siparisler");
  revalidatePath("/admin");
  return { ok: { op: "set_status", updated } };
}
