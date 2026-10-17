"use server";

import { revalidatePath } from "next/cache";

import { redirect } from "next/navigation";

import {
  actionError,
  actionOk,
  type ActionResult,
} from "@/lib/admin/action-result";
import { safeAudit } from "@/lib/admin/audit";
import { getAdminSession, requireRole } from "@/lib/admin/auth";
import { bulkOrderSchema } from "@/lib/admin/bulk-schema";
import { setAdminFlash } from "@/lib/admin/flash";
import { manualOrderSchema } from "@/lib/admin/manual-order-schema";
import {
  ORDER_NOTE_MAX,
  isManualPaymentMethod,
  type BulkOrderAction,
  type RefundDestination,
} from "@/lib/admin/order-actions";
import {
  BULK_ORDER_LIMIT,
  cancelOrder,
  changeItemStatus,
  checkWithPos,
  clearAttention,
  editTracking,
  markPaid,
  moveOrder,
  refundOrder,
  releaseStock,
  resendMail,
  runBulkOrderAction,
  shipOrder,
  type OrderActor,
  type OrderOpResult,
} from "@/lib/admin/order-ops";
import { OPEN_ORDER_STATUSES } from "@/lib/admin/order-filters";
import { canAccess } from "@/lib/admin/roles";
import {
  BULK_ORDER_TRANSITIONS,
  countOpenOrders,
  countOrdersAfter,
  createManualOrder,
  setOrderInternalNote,
  updateOrderDetails,
  type AdminOrderItemStatus,
  type AdminOrderStatus,
} from "@/lib/admin/store";
import { parseMoneyInput } from "@/lib/utils/format";

// Every order action below answers with an ActionResult for ActionModal /
// the toast (lib/admin/action-result.ts). The work itself lives in
// lib/admin/order-ops.ts, shared with the bulk tool; each action here only
// checks the session, reads its form and refreshes the pages. A refusal
// refreshes them too: the menu a refused click came from was stale.

function actorOf(session: {
  email: string;
  role: OrderActor["role"];
}): OrderActor {
  return { email: session.email, role: session.role };
}

function revalidateOrder(id: string) {
  revalidatePath("/admin/siparisler");
  revalidatePath(`/admin/siparisler/${id}`);
  revalidatePath("/admin");
}

function answer(id: string, res: OrderOpResult): ActionResult {
  if (id) revalidateOrder(id);
  return res.ok
    ? actionOk(res.message, res.tone)
    : actionError(res.error, res.fieldErrors);
}

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

const DESTINATIONS: readonly RefundDestination[] = ["card", "wallet", "none"];

function destinationOf(formData: FormData): RefundDestination | undefined {
  const raw = field(formData, "destination");
  return (DESTINATIONS as readonly string[]).includes(raw)
    ? (raw as RefundDestination)
    : undefined;
}

/** `restock_<line index>` fields: how many units of each line go back. */
function restockLinesOf(
  formData: FormData,
): Array<{ index: number; qty: number }> {
  const out: Array<{ index: number; qty: number }> = [];
  for (const [key, value] of formData.entries()) {
    const m = /^restock_(\d{1,3})$/.exec(key);
    if (!m || typeof value !== "string") continue;
    const qty = Number(value.trim() || "0");
    if (Number.isInteger(qty) && qty > 0 && qty <= 999) {
      out.push({ index: Number(m[1]), qty });
    }
  }
  return out;
}

// ── Bulk ────────────────────────────────────────────────────────────────

const BULK_OPS: Partial<Record<AdminOrderStatus, BulkOrderAction>> = {
  preparing: "start_preparing",
  shipped: "mark_shipped",
  completed: "complete",
  cancelled: "cancel",
};

/**
 * The list's bulk tool, through ActionModal. Each order is decided and
 * written on its own (order-ops.ts `runBulkOrderAction`): the refunds role
 * is checked per order (a paid order's cancel is a refund decision, an
 * unpaid one is a shift task), a pending POS order is asked about first,
 * and every order gets its own audit row. A cancel needs a reason and the
 * number of selected orders typed out.
 */
export async function bulkOrdersAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireRole("orders");
  const parsed = bulkOrderSchema.safeParse({
    ids: field(formData, "ids"),
    op: field(formData, "op") || "set_status",
    value: field(formData, "value"),
    reason: field(formData, "reason"),
    confirm: field(formData, "confirm"),
  });
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Geçersiz istek.");
  }
  const { ids, value, reason, confirm } = parsed.data;
  const op = BULK_OPS[value];
  if (!op || !BULK_ORDER_TRANSITIONS[value]) {
    return actionError("Bu durum toplu olarak verilemez.");
  }
  if (ids.length > BULK_ORDER_LIMIT) {
    return actionError(
      `Bir seferde en fazla ${BULK_ORDER_LIMIT} sipariş seçebilirsin.`,
    );
  }
  if (op === "cancel") {
    if (reason.length < 3) {
      return actionError("İptal nedenini yaz.", {
        reason: "En az 3 karakter yaz.",
      });
    }
    if (confirm !== String(ids.length)) {
      return actionError("Onay için seçili sipariş sayısını yaz.", {
        confirm: `${ids.length} yaz.`,
      });
    }
  }
  const summary = await runBulkOrderAction(
    ids,
    op,
    { reason },
    actorOf(session),
  );
  revalidatePath("/admin/siparisler");
  revalidatePath("/admin");
  return actionOk(summary.message, summary.tone);
}

// ── One order ───────────────────────────────────────────────────────────

const MOVES = ["start_preparing", "mark_shipped", "complete"] as const;
type Move = (typeof MOVES)[number];

/**
 * The one-click moves: Hazırlamaya başla, Hazır / Kuryeye ver / Masaya
 * götürüldü, Tamamlandı. A parcel ships through `shipOrderAction` (it needs
 * the number), a cancel through `cancelOrderAction` (it needs a reason).
 *
 * "Hazırlamaya başla" on an UNPAID order settles it, so it is refused
 * unless the form says the money was taken (`paymentReceived=1` with a
 * method): it then runs as "Ödendi olarak işaretle" + "Hazırlamaya başla",
 * POS check and payment row included.
 */
export async function transitionOrderAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireRole("orders");
  const id = field(formData, "id");
  const transition = field(formData, "transition");
  if (!id || !(MOVES as readonly string[]).includes(transition)) {
    return actionError("Geçersiz işlem.");
  }
  if (
    transition === "start_preparing" &&
    field(formData, "paymentReceived") === "1"
  ) {
    const method = field(formData, "method");
    if (!isManualPaymentMethod(method)) {
      return actionError("Ödemenin nasıl alındığını seç.", {
        method: "Ödeme yöntemini seç.",
      });
    }
    return answer(
      id,
      await markPaid(id, { method, alsoPrepare: true }, actorOf(session)),
    );
  }
  return answer(id, await moveOrder(id, transition as Move, actorOf(session)));
}

/**
 * "İptal et": reason (required), the stock decision (required once the
 * parcel left), and for money that was taken, the refund in the same step
 * for those who may refund. Money collected = the order number typed out.
 */
export async function cancelOrderAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireRole("orders");
  const id = field(formData, "id");
  if (!id) return actionError("Sipariş ID eksik.");
  const restockRaw = field(formData, "restock");
  return answer(
    id,
    await cancelOrder(
      id,
      {
        reason: field(formData, "reason"),
        restock: restockRaw === "1" ? true : restockRaw === "0" ? false : null,
        refund: field(formData, "refund") === "1",
        refundToken: field(formData, "token"),
        expectedDestination: destinationOf(formData),
        confirm: field(formData, "confirm"),
      },
      actorOf(session),
    ),
  );
}

/**
 * "İade başlat": amount (parseMoneyInput, never parseFloat: "1.250,00" was
 * read as 1,25), reason, the destination the modal showed, its one-time
 * token and the lines to give back to stock. Refunds role only.
 */
export async function refundOrderAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireRole("refunds");
  const id = field(formData, "id");
  if (!id) return actionError("Sipariş ID eksik.");
  const amountMinor = parseMoneyInput(field(formData, "amount"));
  if (amountMinor === null || amountMinor <= 0) {
    return actionError("Geçerli bir iade tutarı gir.", {
      amount: "Ör. 250 ya da 1.250,00",
    });
  }
  const reason = field(formData, "reason").trim();
  if (reason.length < 3) {
    return actionError("İade nedenini yaz.", {
      reason: "En az 3 karakter yaz.",
    });
  }
  return answer(
    id,
    await refundOrder(
      id,
      {
        amountMinor,
        reason,
        token: field(formData, "token"),
        expectedDestination: destinationOf(formData),
        restock: restockLinesOf(formData),
        confirm: field(formData, "confirm"),
      },
      actorOf(session),
    ),
  );
}

/** "Ödendi olarak işaretle": method required, POS asked first for a POS order. */
export async function markPaidAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireRole("orders");
  const id = field(formData, "id");
  if (!id) return actionError("Sipariş ID eksik.");
  const method = field(formData, "method");
  if (!isManualPaymentMethod(method)) {
    return actionError("Ödemenin nasıl alındığını seç.", {
      method: "Ödeme yöntemini seç.",
    });
  }
  return answer(
    id,
    await markPaid(
      id,
      { method, alsoPrepare: field(formData, "alsoPrepare") === "1" },
      actorOf(session),
    ),
  );
}

/** "Kargoya ver" for a parcel: carrier + tracking number + Kargoda, one step. */
export async function shipOrderAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireRole("orders");
  const id = field(formData, "id");
  if (!id) return actionError("Sipariş ID eksik.");
  return answer(
    id,
    await shipOrder(
      id,
      {
        carrier: field(formData, "carrier"),
        trackingNumber: field(formData, "trackingNumber"),
      },
      actorOf(session),
    ),
  );
}

/** "Kargo bilgisini düzelt" on a parcel that already left. */
export async function saveOrderTrackingAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireRole("orders");
  const id = field(formData, "id");
  if (!id) return actionError("Sipariş ID eksik.");
  return answer(
    id,
    await editTracking(
      id,
      {
        carrier: field(formData, "carrier"),
        trackingNumber: field(formData, "trackingNumber"),
      },
      actorOf(session),
    ),
  );
}

/** "POS'tan kontrol et". */
export async function checkPosAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireRole("orders");
  const id = field(formData, "id");
  if (!id) return actionError("Sipariş ID eksik.");
  return answer(id, await checkWithPos(id, actorOf(session)));
}

const ITEM_STATUSES: readonly AdminOrderItemStatus[] = [
  "pending",
  "ready",
  "cancelled",
];

/**
 * One line's status. The store's answer is checked now: the audit row used
 * to be written for an order or line that did not exist, and the select
 * kept showing a value that was never saved.
 */
export async function setItemStatusAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireRole("orders");
  const id = field(formData, "id");
  const index = Number(field(formData, "index"));
  const status = field(formData, "status") as AdminOrderItemStatus;
  if (!id || !Number.isInteger(index) || index < 0) {
    return actionError("Geçersiz kalem.");
  }
  if (!ITEM_STATUSES.includes(status)) return actionError("Geçersiz durum.");
  return answer(
    id,
    await changeItemStatus(id, index, status, actorOf(session)),
  );
}

/** "Yeniden gönder" for one customer mail of the order, after a confirm. */
export async function resendMailAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireRole("orders");
  const id = field(formData, "id");
  const kind = field(formData, "kind");
  if (!id || !kind) return actionError("Geçersiz istek.");
  return answer(id, await resendMail(id, kind, actorOf(session)));
}

/** "Stoğu geri al": a cancel whose stock release did not go through. */
export async function releaseStockAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireRole("orders");
  const id = field(formData, "id");
  if (!id) return actionError("Sipariş ID eksik.");
  return answer(id, await releaseStock(id, actorOf(session)));
}

/** "Dikkat işaretini kaldır" (refunds role: it is about money). */
export async function clearAttentionAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireRole("orders");
  const id = field(formData, "id");
  if (!id) return actionError("Sipariş ID eksik.");
  return answer(
    id,
    await clearAttention(id, field(formData, "reason"), actorOf(session)),
  );
}

// ── Note, customer, manual order ────────────────────────────────────────

export interface NoteActionState {
  error?: string;
  savedAt?: string;
}

export async function saveOrderNoteAction(
  _prev: NoteActionState,
  formData: FormData,
): Promise<NoteActionState> {
  await requireRole("orders");
  const id = field(formData, "id");
  const note = field(formData, "note");
  if (!id) return { error: "Sipariş ID eksik." };
  if (note.length > ORDER_NOTE_MAX) {
    return { error: `Not en fazla ${ORDER_NOTE_MAX} karakter olabilir.` };
  }
  const result = await setOrderInternalNote(id, note);
  if (!result) return { error: "Sipariş bulunamadı." };
  await safeAudit({
    action: "note",
    entity: "order",
    entityId: id,
    payload: { length: note.length },
  });
  revalidateOrder(id);
  return { savedAt: new Date().toISOString() };
}

export interface OrderDetailsActionState {
  error?: string;
  savedAt?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function saveOrderDetailsAction(
  _prev: OrderDetailsActionState,
  formData: FormData,
): Promise<OrderDetailsActionState> {
  await requireRole("orders");
  const id = field(formData, "id");
  if (!id) return { error: "Sipariş ID eksik." };
  const customerName = field(formData, "customerName").trim();
  if (customerName.length < 2) {
    return { error: "Müşteri adı en az 2 karakter olmalı." };
  }
  const customerEmail = field(formData, "customerEmail").trim();
  // The manual order form checks the address; this form did not, and a typo
  // here moves the order into another member's history.
  if (customerEmail && !EMAIL_RE.test(customerEmail)) {
    return { error: "Geçerli bir e-posta yaz." };
  }
  const result = await updateOrderDetails(id, {
    customerName,
    customerEmail,
    customerPhone: field(formData, "customerPhone"),
    shippingAddress: field(formData, "shippingAddress"),
  });
  if (!result) return { error: "Sipariş bulunamadı." };
  await safeAudit({
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
    fulfillment: d.fulfillment,
    paymentMethod: d.paymentMethod,
    actor: session.email,
  });
  if (!result.ok) {
    // Under the product list, where the line to change is.
    const refusal = (message: string): ManualOrderActionState => ({
      error: "Ürün satırlarındaki uyarıyı gider.",
      fieldErrors: { items: message },
    });
    if (result.reason === "empty") return refusal("En az bir ürün ekle.");
    if (result.reason === "not_found") {
      return refusal(`Ürün bulunamadı: ${result.productName}`);
    }
    if (result.reason === "out_of_stock") {
      return refusal(
        `Yetersiz stok: ${result.productName} (mevcut: ${result.available}).`,
      );
    }
    if (result.reason === "qty_too_high") {
      return refusal(
        `${result.productName}: bir satırda en fazla ${result.max} adet.`,
      );
    }
    return { error: "Sipariş oluşturulamadı." };
  }
  await safeAudit({
    action: "create",
    entity: "order",
    entityId: result.order.id,
    payload: {
      orderNo: result.order.orderNo,
      manual: true,
      total: result.order.totalMinor,
      fulfillment: d.fulfillment,
      ...(d.paymentMethod ? { paymentMethod: d.paymentMethod } : {}),
      ...(result.payment === "failed" ? { paymentRow: "failed" } : {}),
      ...(result.promoDropped ? { promoDropped: d.promoCode ?? "" } : {}),
    },
  });
  // A code that no longer applies is dropped by the store. It used to be
  // dropped silently: the admin quoted a discount the order does not carry.
  const warnings = [
    result.promoDropped
      ? `${d.promoCode ? `"${d.promoCode}" ` : ""}promosyon kodu artık geçerli değil: indirim uygulanmadı. Müşteriye söyle.`
      : "",
    result.payment === "failed"
      ? "Ödeme kaydı yazılamadı: ödemenin nasıl alındığını iç nota yaz."
      : "",
  ].filter(Boolean);
  await setAdminFlash(
    warnings.length > 0
      ? `Sipariş #${result.order.orderNo} oluşturuldu, ama ${warnings.join(" ")}`
      : `Sipariş #${result.order.orderNo} oluşturuldu.`,
    warnings.length > 0 ? "warning" : "success",
  );
  revalidatePath("/admin/siparisler");
  revalidatePath("/admin");
  revalidatePath("/");
  redirect(`/admin/siparisler/${result.order.id}`);
}

// ── Polls ───────────────────────────────────────────────────────────────

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
 * gets `null` - the badge simply never appears.
 */
async function ordersSignalAllowed(): Promise<boolean> {
  const session = await getAdminSession();
  return Boolean(session && canAccess("orders", session.role));
}

/** Open orders (`OPEN_ORDER_STATUSES`, the "Açık" tab's set), for the nav badge. */
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
  /** `open`: only open orders (the "Açık" tab's poll); anything else: all. */
  scope?: string,
): Promise<number | null> {
  if (!(await ordersSignalAllowed())) return null;
  try {
    return scope === "open"
      ? await countOrdersAfter(Number(sinceOrderNo), OPEN_ORDER_STATUSES)
      : await countOrdersAfter(Number(sinceOrderNo));
  } catch (err) {
    console.error("[admin/siparisler] yeni sipariş sayılamadı", err);
    return null;
  }
}
