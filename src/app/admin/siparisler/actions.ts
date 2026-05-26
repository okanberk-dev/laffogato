"use server";

import { revalidatePath } from "next/cache";

import {
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
