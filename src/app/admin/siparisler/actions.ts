"use server";

import { revalidatePath } from "next/cache";

import { redirect } from "next/navigation";

import { logAudit } from "@/lib/admin/audit";
import { getAdminSession, requireRole } from "@/lib/admin/auth";
import { bulkOrderSchema } from "@/lib/admin/bulk-schema";
import { manualOrderSchema } from "@/lib/admin/manual-order-schema";
import { canAccess } from "@/lib/admin/roles";
import {
  bulkUpdateOrders,
  countOpenOrders,
  countOrdersAfter,
  createManualOrder,
  getOrder,
  getOrderPaymentRef,
  finalizeRefund,
  orderWasCollected,
  refundRefusal,
  releaseRefund,
  reserveRefund,
  setOrderInternalNote,
  setOrderItemStatus,
  setOrderTracking,
  transitionOrder,
  updateOrderDetails,
  type AdminOrderItemStatus,
  type OrderTransition,
} from "@/lib/admin/store";
import { getPaymentProvider } from "@/lib/payment";
import { parseMoneyInput } from "@/lib/utils/format";

export interface BulkOrderActionState {
  error?: string;
  ok?: { op: string; updated: number; skipped: number };
}

export async function bulkOrdersAction(
  _prev: BulkOrderActionState,
  formData: FormData,
): Promise<BulkOrderActionState> {
  const session = await requireRole("orders");
  const parsed = bulkOrderSchema.safeParse({
    ids: String(formData.get("ids") ?? ""),
    op: String(formData.get("op") ?? ""),
    value: String(formData.get("value") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz istek." };
  }
  const { ids, value } = parsed.data;
  // Cancelling in bulk voids up to 500 orders in one click — paid ones
  // included, whose money then has to be sent back by hand. Same authority as
  // a refund, checked here rather than with requireRole so the staff member
  // gets an explanation instead of being bounced to /admin?denied=1.
  if (value === "cancelled" && !canAccess("refunds", session.role)) {
    return { error: "Toplu iptal için iade yetkisi gerekiyor." };
  }
  const { updated, skipped } = await bulkUpdateOrders(ids, {
    kind: "set_status",
    status: value,
  });
  await logAudit({
    action: "bulk_update",
    entity: "order",
    payload: { status: value, updated, skipped, idCount: ids.length },
  });
  revalidatePath("/admin/siparisler");
  revalidatePath("/admin");
  return { ok: { op: "set_status", updated, skipped } };
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

export interface TransitionActionState {
  error?: string;
}

/**
 * Move an order to its next status.
 *
 * `transitionOrder` refuses an illegal move (stale page, someone else already
 * advanced it, unknown id) and its result used to be discarded: the button
 * appeared to work, an audit row claimed a transition that never happened, and
 * the staff member found out only by reloading. The store's own message is now
 * what the operator sees, and the audit row is written only when the status
 * actually moved.
 */
export async function transitionOrderAction(
  _prev: TransitionActionState,
  formData: FormData,
): Promise<TransitionActionState> {
  const session = await requireRole("orders");
  const id = String(formData.get("id") ?? "");
  const transition = String(
    formData.get("transition") ?? "",
  ) as OrderTransition;
  if (!id || !TRANSITIONS.includes(transition)) {
    return { error: "Geçersiz işlem." };
  }
  // Cancelling an order that was paid voids money the shop holds — the same
  // authority as a refund, exactly as the bulk tool already demands. One
  // order at a time it only needed `orders`, so staff could do singly what
  // they were refused in bulk. An unpaid (pending) order is still theirs.
  if (transition === "cancel" && !canAccess("refunds", session.role)) {
    const current = await getOrder(id);
    if (current && current.status !== "pending_payment") {
      return {
        error: "Ödenmiş siparişi iptal etmek için iade yetkisi gerekiyor.",
      };
    }
  }
  const result = await transitionOrder(id, transition);
  // `TransitionResult` is a loose interface, so `order` is optional even on
  // the ok branch; the status is best-effort context for the log, not a gate.
  if (!result.ok) return { error: result.error ?? "İşlem yapılamadı." };
  await logAudit({
    action: "transition",
    entity: "order",
    entityId: id,
    payload: { transition, to: result.order?.status ?? "" },
  });
  revalidateOrder(id);
  return {};
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
  // parseMoneyInput, not parseFloat(replace(",", ".")): that read "1.250,00"
  // as 1.25, and ₺1,25 is what the card would have been credited.
  const amountMinor = parseMoneyInput(String(formData.get("amount") ?? ""));
  if (amountMinor === null || amountMinor <= 0) {
    return { error: "Geçerli bir iade tutarı gir (ör. 250 ya da 1.250,00)." };
  }
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 3) {
    return { error: "İade nedeni en az 3 karakter olmalı." };
  }

  // Every reason the ledger would refuse, checked BEFORE the money moves.
  // They used to run only inside refundOrder, after provider.refund: a
  // cancelled-and-unpaid order, an unpaid one or an amount above what is
  // left was refused on paper after the card had already been credited.
  const order = await getOrder(id);
  if (!order) return { error: "Sipariş bulunamadı." };
  const refusal = refundRefusal(
    order,
    amountMinor,
    await orderWasCollected(order),
  );
  if (refusal) return { error: refusal };

  // Reserve the ledger entry FIRST (atomic: it only lands if it still fits),
  // then ask the POS, then settle. The POS used to be asked before any write,
  // and two refunds submitted together could both pass the balance check and
  // both move money; now the second one is refused before the POS is called.
  // If the POS refuses, the entry is taken back and nothing is recorded.
  const reserved = await reserveRefund(id, { amountMinor, reason });
  if (!reserved.ok) return { error: reserved.error };

  const ref = await getOrderPaymentRef(id);
  if (ref) {
    try {
      // The payment row's own date and amount let the provider skip
      // searching its history for the transaction; rows from before the
      // column carry '' and the provider falls back to that search.
      await getPaymentProvider().refund(ref.providerRef, amountMinor, {
        trxDate: ref.trxDate,
        paidMinor: ref.amountMinor,
      });
    } catch (err) {
      console.error("[refund] provider refund failed", err);
      try {
        await releaseRefund(id, reserved.refund.id);
      } catch (releaseErr) {
        // The money did not move but the entry could not be taken back:
        // loud, because the ledger now over-states what was refunded.
        console.error(
          `[refund] RESERVED BUT NOT REFUNDED order=${id} refund=${reserved.refund.id}`,
          releaseErr,
        );
      }
      return {
        error:
          "Ödeme sağlayıcısı iadeyi reddetti; hiçbir kayıt oluşturulmadı. Sağlayıcı panelinden kontrol edip tekrar deneyin.",
      };
    }
  }

  try {
    await finalizeRefund(reserved.order);
  } catch (err) {
    // The money moved and the ledger entry stands; only the status/stamp
    // follow-up failed. Loud, because a human has to finish it.
    console.error(
      `[refund] REFUNDED BUT NOT FINALIZED order=${id} amountMinor=${amountMinor}`,
      err,
    );
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

/**
 * The two numbers the panel polls for while a page sits open.
 *
 * A gel-al order arrives from the app with nobody touching this browser, and
 * a server-rendered page is dead the moment it is rendered: without a poll
 * the barista learns about the order by remembering to press F5. Both
 * answers are `head: true` counts, cheap enough to ask for every half minute.
 *
 * `requireRole` cannot be used here. It REDIRECTS on denial, and a redirect
 * thrown out of a background poll would move the operator's page under them;
 * the sidebar also runs this for roles that have no order access at all. So
 * the gate is read rather than enforced, and a caller who may not see orders
 * gets `null` — the badge simply never appears.
 */
async function ordersSignalAllowed(): Promise<boolean> {
  const session = await getAdminSession();
  return Boolean(session && canAccess("orders", session.role));
}

/** Open orders (ödeme bekleniyor · ödendi · hazırlanıyor), for the nav badge. */
export async function openOrderCountAction(): Promise<number | null> {
  if (!(await ordersSignalAllowed())) return null;
  try {
    return await countOpenOrders();
  } catch (err) {
    // A poll must never turn a working panel into an error boundary.
    console.error("[admin/siparisler] açık sipariş sayılamadı", err);
    return null;
  }
}

/**
 * Orders newer than the highest `orderNo` the list has rendered.
 *
 * The count comes back without the list being re-fetched, so the rows the
 * operator is reading stay exactly where they are until they choose to
 * refresh.
 */
export async function newOrderCountAction(
  sinceOrderNo: number,
): Promise<number | null> {
  if (!(await ordersSignalAllowed())) return null;
  try {
    return await countOrdersAfter(Number(sinceOrderNo));
  } catch (err) {
    console.error("[admin/siparisler] yeni sipariş sayılamadı", err);
    return null;
  }
}
