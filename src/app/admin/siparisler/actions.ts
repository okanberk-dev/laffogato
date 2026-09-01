"use server";

import { revalidatePath } from "next/cache";

import { redirect } from "next/navigation";

import { logAudit } from "@/lib/admin/audit";
import { requireRole } from "@/lib/admin/auth";
import { bulkOrderSchema } from "@/lib/admin/bulk-schema";
import { manualOrderSchema } from "@/lib/admin/manual-order-schema";
import {
  bulkUpdateOrders,
  createManualOrder,
  getOrderPaymentRef,
  refundOrder,
  setOrderInternalNote,
  setOrderItemStatus,
  setOrderTracking,
  transitionOrder,
  updateOrderDetails,
  type AdminOrderItemStatus,
  type OrderTransition,
} from "@/lib/admin/store";
import { getPaymentProvider } from "@/lib/payment";

export interface BulkOrderActionState {
  error?: string;
  ok?: { op: string; updated: number };
}

export async function bulkOrdersAction(
  _prev: BulkOrderActionState,
  formData: FormData,
): Promise<BulkOrderActionState> {
  await requireRole("orders");
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
  await requireRole("orders");
  const id = String(formData.get("id") ?? "");
  const transition = String(
    formData.get("transition") ?? "",
  ) as OrderTransition;
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
  await requireRole("orders");
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
  await requireRole("orders");
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
  await requireRole("refunds");
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

  // The POS call comes FIRST, and its failure stops the refund.
  //
  // It used to run after the ledger write, inside a try/catch that only
  // logged: the admin was told "iade edildi", the order showed a refund, the
  // reports subtracted it — and the customer's card was never credited. The
  // refund record now only exists when the money actually moved.
  const ref = await getOrderPaymentRef(id);
  if (ref) {
    try {
      await getPaymentProvider().refund(ref.providerRef, amountMinor);
    } catch (err) {
      console.error("[refund] provider refund failed", err);
      return {
        error:
          "Ödeme sağlayıcısı iadeyi reddetti; hiçbir kayıt oluşturulmadı. Sağlayıcı panelinden kontrol edip tekrar deneyin.",
      };
    }
  }

  const result = await refundOrder(id, { amountMinor, reason });
  if (!result.ok) {
    // The money is out but the ledger write failed. Loud, because the two are
    // now out of step and only a human can reconcile them.
    if (ref) {
      console.error(
        `[refund] PROVIDER REFUNDED BUT NOT RECORDED order=${id} amountMinor=${amountMinor} providerRef=${ref.providerRef}`,
      );
    }
    return { error: result.error };
  }

  await logAudit({
    action: "refund",
    entity: "order",
    entityId: id,
    payload: { amountMinor, reason, provider: ref?.provider ?? "none" },
  });
  revalidateOrder(id);
  return { ok: { refundedMinor: amountMinor } };
}

export interface OrderDetailsActionState {
  error?: string;
  savedAt?: string;
}

export async function saveOrderDetailsAction(
  _prev: OrderDetailsActionState,
  formData: FormData,
): Promise<OrderDetailsActionState> {
  await requireRole("orders");
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Sipariş ID eksik." };
  const customerName = String(formData.get("customerName") ?? "").trim();
  if (customerName.length < 2) {
    return { error: "Müşteri adı en az 2 karakter olmalı." };
  }
  const result = await updateOrderDetails(id, {
    customerName,
    customerEmail: String(formData.get("customerEmail") ?? ""),
    customerPhone: String(formData.get("customerPhone") ?? ""),
    shippingAddress: String(formData.get("shippingAddress") ?? ""),
  });
  if (!result) return { error: "Sipariş bulunamadı." };
  await logAudit({
    action: "update",
    entity: "order",
    entityId: id,
    payload: { fields: "customer_delivery" },
  });
  revalidateOrder(id);
  return { savedAt: new Date().toISOString() };
}

export interface ManualOrderActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function createManualOrderAction(
  _prev: ManualOrderActionState,
  formData: FormData,
): Promise<ManualOrderActionState> {
  const session = await requireRole("orders");
  const fields: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (typeof v === "string") fields[k] = v;
  }
  const parsed = manualOrderSchema.safeParse(fields);
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) {
      const k = i.path.join(".") || "form";
      if (!fe[k]) fe[k] = i.message;
    }
    return { error: "Formdaki uyarıları gider.", fieldErrors: fe };
  }
  const d = parsed.data;
  const result = await createManualOrder({
    items: d.lines,
    customerName: d.customerName,
    customerEmail: d.customerEmail,
    customerPhone: d.customerPhone,
    shippingAddress: d.shippingAddress,
    internalNote: d.internalNote,
    promoCode: d.promoCode,
    status: d.status,
    actor: session.email,
  });
  if (!result.ok) {
    if (result.reason === "empty") {
      return { error: "En az bir ürün ekle." };
    }
    if (result.reason === "not_found") {
      return { error: `Ürün bulunamadı: ${result.productName}` };
    }
    if (result.reason === "out_of_stock") {
      return {
        error: `Yetersiz stok: ${result.productName} (mevcut: ${result.available}).`,
      };
    }
    return { error: "Sipariş oluşturulamadı." };
  }
  await logAudit({
    action: "create",
    entity: "order",
    entityId: result.order.id,
    payload: {
      orderNo: result.order.orderNo,
      manual: true,
      total: result.order.totalMinor,
    },
  });
  revalidatePath("/admin/siparisler");
  revalidatePath("/admin");
  revalidatePath("/");
  redirect(`/admin/siparisler/${result.order.id}`);
}

export async function saveOrderTrackingAction(formData: FormData) {
  await requireRole("orders");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const trackingNumber = String(formData.get("trackingNumber") ?? "");
  const carrier = String(formData.get("carrier") ?? "");
  const result = await setOrderTracking(id, trackingNumber, carrier);
  if (!result) return;
  await logAudit({
    action: "update",
    entity: "order",
    entityId: id,
    // Don't log the raw tracking number — just whether it was set.
    payload: { tracking: trackingNumber.trim() ? "set" : "cleared", carrier },
  });
  revalidateOrder(id);
}
