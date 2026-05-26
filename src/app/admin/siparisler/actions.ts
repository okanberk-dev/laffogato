"use server";

import { revalidatePath } from "next/cache";

import { logAudit } from "@/lib/admin/audit";
import { bulkOrderSchema } from "@/lib/admin/bulk-schema";
import {
  bulkUpdateOrders,
  refundOrder,
  setOrderInternalNote,
  setOrderItemStatus,
  transitionOrder,
  updateOrderStatus,
  type AdminOrderItemStatus,
  type AdminOrderStatus,
  type OrderTransition,
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
  await logAudit({
    action: "bulk_update",
    entity: "order",
    payload: { status: value, updated, idCount: ids.length },
  });
  revalidatePath("/admin/siparisler");
  revalidatePath("/admin");
  return { ok: { op: "set_status", updated } };
}

const TRANSITIONS: OrderTransition[] = [
  "mark_paid",
  "start_preparing",
  "mark_shipped",
  "complete",
  "cancel",
];

const ITEM_STATUSES: AdminOrderItemStatus[] = ["pending", "ready", "cancelled"];

function revalidateOrder(id: string) {
  revalidatePath("/admin/siparisler");
  revalidatePath(`/admin/siparisler/${id}`);
  revalidatePath("/admin");
}

export async function transitionOrderAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const transition = String(formData.get("transition") ?? "") as OrderTransition;
  if (!id || !TRANSITIONS.includes(transition)) return;
  await transitionOrder(id, transition);
  await logAudit({
    action: "transition",
    entity: "order",
    entityId: id,
    payload: { transition },
  });
  revalidateOrder(id);
}

export interface NoteActionState {
  error?: string;
  savedAt?: string;
}

export async function saveOrderNoteAction(
  _prev: NoteActionState,
  formData: FormData,
): Promise<NoteActionState> {
  const id = String(formData.get("id") ?? "");
  const note = String(formData.get("note") ?? "");
  if (!id) return { error: "Sipariş ID eksik." };
  const result = await setOrderInternalNote(id, note);
  if (!result) return { error: "Sipariş bulunamadı." };
  await logAudit({
    action: "note",
    entity: "order",
    entityId: id,
    payload: { length: note.length },
  });
  revalidateOrder(id);
  return { savedAt: new Date().toISOString() };
}

export async function setItemStatusAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const index = parseInt(String(formData.get("index") ?? "-1"), 10);
  const status = String(formData.get("status") ?? "") as AdminOrderItemStatus;
  if (!id || !Number.isFinite(index) || !ITEM_STATUSES.includes(status)) return;
  await setOrderItemStatus(id, index, status);
  await logAudit({
    action: "update",
    entity: "order_item",
    entityId: `${id}#${index}`,
    payload: { status },
  });
  revalidateOrder(id);
}

export interface RefundActionState {
  error?: string;
  ok?: { refundedMinor: number };
}

export async function refundOrderAction(
  _prev: RefundActionState,
  formData: FormData,
): Promise<RefundActionState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Sipariş ID eksik." };
  const amountText = String(formData.get("amount") ?? "").replace(",", ".");
  const amountMajor = parseFloat(amountText);
  if (!Number.isFinite(amountMajor) || amountMajor <= 0) {
    return { error: "Geçerli bir iade tutarı gir." };
  }
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 3) {
    return { error: "İade nedeni en az 3 karakter olmalı." };
  }
  const amountMinor = Math.round(amountMajor * 100);
  const result = await refundOrder(id, { amountMinor, reason });
  if (!result.ok) return { error: result.error };
  await logAudit({
    action: "refund",
    entity: "order",
    entityId: id,
    payload: { amountMinor, reason },
  });
  revalidateOrder(id);
  return { ok: { refundedMinor: amountMinor } };
}
