// Client-safe (no server-only): what can be done to an order right now, by
// whom, and - when it cannot - why, in words the operator reads.
//
// ONE function both sides call. The order page and the order list draw their
// buttons and "⋯" menus from `orderActions`, and every order Server Action
// asks it again before it writes (CLAUDE.md rule 27: a hidden button is not
// a check). Before this, the buttons came from the status alone: staff saw
// "İptal et" on a paid order, clicked, confirmed and were then refused.

import { formatTRYMinor } from "@/lib/utils/commerce";

import { markShippedLabel, orderFulfillment } from "./order-channel";
import { canAccess, type AdminRole } from "./roles";
import type { AdminOrder, AdminOrderStatus } from "./store";
import type { AdminTone } from "./tone";

export type OrderActionId =
  /** Settle by hand (cash at the counter, a bank transfer). */
  | "mark_paid"
  /** Ask the POS whether a pending order was paid after all. */
  | "check_pos"
  | "start_preparing"
  /** A parcel: carrier + tracking number + "Kargoda", in one step. */
  | "ship"
  /** Pickup, courier or table: one confirmation. */
  | "mark_shipped"
  | "complete"
  | "cancel"
  | "refund"
  /** A cancelled order whose stock release did not go through: try again. */
  | "release_stock"
  | "clear_attention"
  /** Correct the carrier or number of a parcel that has already left. */
  | "edit_tracking"
  | "item_status"
  /** Send a customer mail of this order again ("Yeniden gönder"). */
  | "resend_mail";

export interface OrderActionState {
  enabled: boolean;
  /** Why it is off, shown under the disabled button. */
  reason?: string;
}

/** The actions offered for this order; a missing key is not offered at all. */
export type OrderActionMap = Partial<Record<OrderActionId, OrderActionState>>;

/** The order fields the rules read. */
export type OrderActionInput = Pick<
  AdminOrder,
  "status" | "totalMinor" | "refunds"
> &
  Partial<
    Pick<
      AdminOrder,
      | "fulfillment"
      | "source"
      | "attention"
      | "stockReleasedAt"
      | "paidAt"
      | "trackingNumber"
    >
  >;

/** What the store keeps of an internal note; the textarea says so too. */
export const ORDER_NOTE_MAX = 2000;

export const REFUND_ROLE_NEEDED =
  "Bunun için iade yetkisi gerekiyor (sahip ya da yönetici).";

const CANCELLABLE: readonly AdminOrderStatus[] = [
  "pending_payment",
  "paid",
  "preparing",
  "shipped",
];

/** Lines can be marked ready or cancelled only on an order that is live. */
const ITEM_EDIT_STATUSES: readonly AdminOrderStatus[] = [
  "paid",
  "preparing",
  "shipped",
  "completed",
];

/** The tracking form corrects a parcel that has left; before, "Kargoya ver" sets it. */
const TRACKING_EDIT_STATUSES: readonly AdminOrderStatus[] = [
  "shipped",
  "completed",
];

/** The order statuses `set_order_item_status` accepts (the SQL guard). */
export const ITEM_EDITABLE_ORDER_STATUSES = ITEM_EDIT_STATUSES;

/** A manual order has no POS payment behind it; every other order does. */
export function isPosOrder(order: { source?: string }): boolean {
  return order.source !== "manual";
}

/** A shop parcel: shipping needs a carrier and a tracking number. */
export function isParcel(order: { fulfillment?: string }): boolean {
  return orderFulfillment(order) === "shipping";
}

// ── Money ───────────────────────────────────────────────────────────────

export function refundedMinor(order: {
  refunds: ReadonlyArray<{ amountMinor: number }>;
}): number {
  return (order.refunds ?? []).reduce((s, r) => s + r.amountMinor, 0);
}

/**
 * The most that can ever go back: what was actually collected, never more
 * than the order total. `collectedMinor` is the sum of the order's succeeded
 * payment rows; `null` when there are none (a counter sale entered as paid),
 * and the total is the cap then. Nothing collected, nothing to refund.
 */
export function refundCapMinor(
  order: { totalMinor: number },
  collected: boolean,
  collectedMinor: number | null = null,
): number {
  if (!collected) return 0;
  if (collectedMinor === null) return order.totalMinor;
  return Math.min(order.totalMinor, Math.max(0, collectedMinor));
}

/** What is still refundable: the cap minus what went back already. */
export function refundableMinor(
  order: {
    totalMinor: number;
    refunds: ReadonlyArray<{ amountMinor: number }>;
  },
  collected: boolean,
  collectedMinor: number | null = null,
): number {
  return Math.max(
    0,
    refundCapMinor(order, collected, collectedMinor) - refundedMinor(order),
  );
}

/** Where a refund goes. Decided on the server from the payment row. */
export type RefundDestination = "card" | "wallet" | "none";

export const MANUAL_PROVIDER_PREFIX = "manual:";

export function isManualProvider(provider: string | null | undefined): boolean {
  return String(provider ?? "").startsWith(MANUAL_PROVIDER_PREFIX);
}

/**
 * The destination for a refund through `provider` (the payment row a refund
 * goes back through): the wallet for a wallet payment, the card for a POS
 * payment, and nowhere for an order with neither - a manual or counter sale,
 * whose money the operator hands back themselves.
 */
export function refundDestinationFor(
  provider: string | null | undefined,
): RefundDestination {
  if (!provider || isManualProvider(provider)) return "none";
  if (provider === "wallet") return "wallet";
  return "card";
}

export const REFUND_DESTINATION_LABELS: Record<RefundDestination, string> = {
  card: "Kart",
  wallet: "Cüzdan",
  none: "Kayıt: para hareket etmez",
};

/** The sentence the refund and cancel modals show before anything moves. */
export const REFUND_DESTINATION_HINTS: Record<RefundDestination, string> = {
  card: "Tutar, ödemenin yapıldığı karta POS üzerinden geri gönderilir. Geri alınamaz.",
  wallet: "Tutar üyenin uygulama cüzdanına geri yazılır, karta gitmez.",
  none: "Bu siparişte POS ya da cüzdan ödemesi yok: yalnız kayıt düşülür, para hareket etmez. Parayı müşteriye sen ver (nakit ya da havale).",
};

/** "₺450,00 karta iade edildi", for the result sentence. */
export function refundSentence(
  amountMinor: number,
  destination: RefundDestination,
): string {
  const amount = formatTRYMinor(amountMinor);
  if (destination === "card") return `${amount} karta iade edildi`;
  if (destination === "wallet") return `${amount} cüzdana iade edildi`;
  return `${amount} iade kaydı düşüldü (para hareket etmedi)`;
}

// ── Manual payments ─────────────────────────────────────────────────────

export const MANUAL_PAYMENT_METHODS = [
  "nakit",
  "kart",
  "havale",
  "diger",
] as const;
export type ManualPaymentMethod = (typeof MANUAL_PAYMENT_METHODS)[number];

export const MANUAL_PAYMENT_LABELS: Record<ManualPaymentMethod, string> = {
  nakit: "Nakit",
  kart: "Kasadaki kart cihazı",
  havale: "Havale / EFT",
  diger: "Diğer",
};

export function isManualPaymentMethod(
  value: unknown,
): value is ManualPaymentMethod {
  return (
    typeof value === "string" &&
    (MANUAL_PAYMENT_METHODS as readonly string[]).includes(value)
  );
}

// ── Attention ───────────────────────────────────────────────────────────

export type OrderAttention =
  "amount_mismatch" | "order_not_open" | "duplicate_payment" | "refund_due";

export const ORDER_ATTENTION_TEXT: Record<
  OrderAttention,
  { title: string; body: string }
> = {
  amount_mismatch: {
    title: "POS farklı bir tutar tahsil etti",
    body: "Ödeme siparişin tutarıyla eşleşmedi ve sipariş ilerlemedi. PayNkolay panelinde tahsil edilen tutara bak, müşteriyle konuş: farkı al ya da iade et.",
  },
  order_not_open: {
    title: "Kapalı siparişe ödeme geldi",
    body: "Para tahsil edildi ama sipariş iptal edilmiş ya da iade edilmişti. Ya siparişi hazırla ya da tutarı iade et.",
  },
  duplicate_payment: {
    title: "Bu siparişe ikinci bir ödeme geldi",
    body: "Müşteri iki kez ödemiş olabilir. Fazla çekimi PayNkolay panelinden iade et; buradaki iade yalnız sipariş tutarı kadar yapılabilir.",
  },
  refund_due: {
    title: "İptal edildi, iade bekliyor",
    body: "Ödemesi alınmış sipariş iptal edildi ama para henüz geri verilmedi. 'İade başlat' ile iade et.",
  },
};

/** The banner text for an `attention` value; null when there is none. */
export function attentionText(
  value: string | null | undefined,
): { title: string; body: string } | null {
  const key = String(value ?? "").trim();
  if (!key) return null;
  return (
    ORDER_ATTENTION_TEXT[key as OrderAttention] ?? {
      title: "Bu sipariş kontrol bekliyor",
      body: "Olay kaydında bu siparişin son satırlarına bak.",
    }
  );
}

// ── Payment badge ───────────────────────────────────────────────────────

/**
 * The payment column of the list and the badge on the order page. `collected`
 * covers a payment that landed after the sweep cancelled the order, which
 * has no `paidAt`; without it only `paidAt` is read.
 */
export function orderPaymentState(
  order: {
    status: AdminOrderStatus;
    paidAt?: string;
    totalMinor: number;
    refunds: ReadonlyArray<{ amountMinor: number }>;
  },
  collected: boolean = Boolean(order.paidAt),
): { label: string; tone: AdminTone } {
  const refunded = refundedMinor(order);
  if (refunded > 0 && refunded >= order.totalMinor) {
    return { label: "İade edildi", tone: "danger" };
  }
  if (refunded > 0) return { label: "Kısmi iade", tone: "warning" };
  if (collected) return { label: "Ödendi", tone: "success" };
  if (order.status === "pending_payment") {
    return { label: "Ödenmedi", tone: "warning" };
  }
  return { label: "Ödeme yok", tone: "neutral" };
}

// ── The rules ───────────────────────────────────────────────────────────

/**
 * What `role` may do to `order` now.
 *
 * - A key is present when the action makes sense in this state at all.
 * - `enabled: false` with a `reason` when it makes sense but this role may
 *   not do it: the button is drawn disabled with the reason, never hidden
 *   and never left to fail on click.
 *
 * `collected` is whether money was ever taken (`orderWasCollected`: paidAt
 * or a succeeded payment row). It decides the refund and the authority a
 * cancel needs: cancelling money the shop holds is a refund decision.
 * `collectedMinor` caps the refund at what the POS actually took.
 */
export function orderActions(
  order: OrderActionInput,
  role: AdminRole,
  collected: boolean,
  collectedMinor: number | null = null,
): OrderActionMap {
  const out: OrderActionMap = {};
  if (!canAccess("orders", role)) return out;
  const mayRefund = canAccess("refunds", role);
  const on: OrderActionState = { enabled: true };
  const needsRefundRole: OrderActionState = {
    enabled: false,
    reason: REFUND_ROLE_NEEDED,
  };
  const parcel = isParcel(order);
  const { status } = order;

  if (status === "pending_payment") {
    out.mark_paid = on;
    if (isPosOrder(order)) out.check_pos = on;
  }
  // From pending_payment only through "Ödendi olarak işaretle": starting an
  // unpaid order settled it silently (paidAt, stamp, "ödemen alındı").
  if (status === "paid") out.start_preparing = on;
  if (status === "paid" || status === "preparing") {
    if (parcel) out.ship = on;
    else out.mark_shipped = on;
  }
  // A parcel completes from "Kargoda" only: skipping it skipped the
  // tracking number the buyer is owed. A coffee can be handed over at once.
  if (status === "shipped" || (status === "preparing" && !parcel)) {
    out.complete = on;
  }
  if (CANCELLABLE.includes(status)) {
    out.cancel = collected && !mayRefund ? needsRefundRole : on;
  }
  if (
    collected &&
    status !== "pending_payment" &&
    refundableMinor(order, collected, collectedMinor) > 0
  ) {
    out.refund = mayRefund ? on : needsRefundRole;
  }
  if (status === "cancelled" && !order.stockReleasedAt) out.release_stock = on;
  if (String(order.attention ?? "").trim()) {
    out.clear_attention = mayRefund ? on : needsRefundRole;
  }
  if (parcel && TRACKING_EDIT_STATUSES.includes(status)) out.edit_tracking = on;
  if (ITEM_EDIT_STATUSES.includes(status)) out.item_status = on;
  // An unpaid attempt was mailed nothing; every other order may have been.
  if (status !== "pending_payment") out.resend_mail = on;
  return out;
}

/**
 * The one "next step" button on the order page: the move a shift makes
 * most often from here. A pending POS order's next step is asking the POS
 * (the customer may be on the bank's page); "Ödendi" is in the menu.
 */
export function nextStep(
  order: OrderActionInput,
  actions: OrderActionMap,
): OrderActionId | null {
  const candidates: OrderActionId[] =
    order.status === "pending_payment"
      ? isPosOrder(order)
        ? ["check_pos", "mark_paid"]
        : ["mark_paid"]
      : ["start_preparing", "ship", "mark_shipped", "complete"];
  return candidates.find((id) => actions[id]?.enabled) ?? null;
}

/** The button text of an action, in this order's own words. */
export function orderActionLabel(
  id: OrderActionId,
  order: { fulfillment?: string },
): string {
  switch (id) {
    case "mark_paid":
      return "Ödendi olarak işaretle";
    case "check_pos":
      return "POS'tan kontrol et";
    case "start_preparing":
      return "Hazırlamaya başla";
    case "ship":
      return "Kargoya ver";
    case "mark_shipped":
      return markShippedLabel(orderFulfillment(order));
    case "complete":
      return "Tamamlandı";
    case "cancel":
      return "İptal et";
    case "refund":
      return "İade başlat";
    case "release_stock":
      return "Stoğu geri al";
    case "clear_attention":
      return "Dikkat işaretini kaldır";
    case "edit_tracking":
      return "Kargo bilgisini düzelt";
    case "item_status":
      return "Kalem durumu";
    case "resend_mail":
      return "Yeniden gönder";
  }
}

/**
 * A server-side refusal for `id`: null when the action may run, otherwise
 * the message to answer with. The server actions call this with the order
 * they just read, so a stale page cannot run what the menu would no longer
 * offer.
 */
export function refusalFor(
  actions: OrderActionMap,
  id: OrderActionId,
): string | null {
  const state = actions[id];
  if (!state) {
    return "Bu işlem siparişin şu anki durumunda yapılamaz. Sayfa yenilendi, tekrar bak.";
  }
  if (!state.enabled) return state.reason ?? "Bu işlem için yetkin yok.";
  return null;
}

// ── Bulk ────────────────────────────────────────────────────────────────

export type BulkOrderAction =
  "start_preparing" | "mark_shipped" | "complete" | "cancel";

export const BULK_ORDER_ACTIONS: readonly BulkOrderAction[] = [
  "start_preparing",
  "mark_shipped",
  "complete",
  "cancel",
];

export const BULK_ACTION_LABELS: Record<BulkOrderAction, string> = {
  start_preparing: "Hazırlamaya başla",
  mark_shipped: "Kargoda / Hazır",
  complete: "Tamamlandı",
  cancel: "İptal et",
};

/** The past tense the bulk result reads in ("3 sipariş iptal edildi"). */
export const BULK_ACTION_DONE: Record<BulkOrderAction, string> = {
  start_preparing: "hazırlanıyor",
  mark_shipped: "kargoda / hazır",
  complete: "tamamlandı",
  cancel: "iptal edildi",
};

/**
 * Whether the bulk tool may run `op` on this order, and why not. The same
 * rules as one order at a time, plus two the bulk tool cannot ask about:
 * a parcel without a tracking number is not shipped (the number is the
 * point of the "kargoya verildi" mail), and a parcel that already left is
 * not cancelled in bulk (whether its stock comes back is a per-order call).
 */
export function bulkRefusal(
  order: OrderActionInput,
  op: BulkOrderAction,
  role: AdminRole,
  collected: boolean,
): string | null {
  const actions = orderActions(order, role, collected);
  if (op === "mark_shipped") {
    if (isParcel(order)) {
      if (!actions.ship) return "bu durumda yapılamaz";
      if (!String(order.trackingNumber ?? "").trim()) {
        return "takip numarası yok, sipariş sayfasından kargoya ver";
      }
      return null;
    }
    return actions.mark_shipped ? null : "bu durumda yapılamaz";
  }
  if (op === "start_preparing" && order.status === "pending_payment") {
    return "ödemesi alınmadı";
  }
  if (op === "cancel" && order.status === "shipped") {
    return "yola çıkmış, stok kararı için tek tek iptal et";
  }
  const state = actions[op];
  if (!state) return "bu durumda yapılamaz";
  if (!state.enabled) {
    return op === "cancel"
      ? "ödemesi alınmış, iade yetkisi gerekiyor"
      : (state.reason ?? "yetkin yok");
  }
  return null;
}

export interface BulkOrderOutcome {
  orderNo: number;
  ok: boolean;
  /** For a skipped order: why. For a done one: anything to follow up. */
  note?: string;
}

/** How many skipped / follow-up orders the bulk message names before "ve N daha". */
const BULK_NAMED = 6;

function named(list: BulkOrderOutcome[]): string {
  const shown = list
    .slice(0, BULK_NAMED)
    .map((o) => `#${o.orderNo}${o.note ? ` ${o.note}` : ""}`);
  const more = list.length - shown.length;
  return more > 0
    ? `${shown.join("; ")} ve ${more} sipariş daha`
    : shown.join("; ");
}

/**
 * The bulk result in sentences: how many were done, which were skipped and
 * why, and which done ones still need a hand ("iadeyi sipariş sayfasından
 * başlat"). Warning tone when anything was skipped or needs a follow-up.
 */
export function bulkSummary(
  op: BulkOrderAction,
  results: readonly BulkOrderOutcome[],
): { message: string; tone: "success" | "warning"; done: number } {
  const done = results.filter((r) => r.ok);
  const skipped = results.filter((r) => !r.ok);
  const followUp = done.filter((r) => r.note);
  const parts = [`${done.length} sipariş ${BULK_ACTION_DONE[op]}.`];
  if (followUp.length > 0) parts.push(`Bak: ${named(followUp)}.`);
  if (skipped.length > 0) {
    parts.push(`Atlandı (${skipped.length}): ${named(skipped)}.`);
  }
  return {
    message: parts.join(" "),
    tone: skipped.length > 0 || followUp.length > 0 ? "warning" : "success",
    done: done.length,
  };
}

// ── Result sentences ────────────────────────────────────────────────────

/** How a customer mail went, as one part of a result sentence. */
export type NoticeOutcome = "sent" | "failed" | "duplicate" | "not_due";

export function mailPart(outcome: NoticeOutcome | null | undefined): string {
  if (outcome === "sent") return "e-posta gönderildi";
  if (outcome === "failed") {
    return "e-posta GÖNDERİLEMEDİ, müşteriye kendin ulaş";
  }
  if (outcome === "duplicate") return "e-posta daha önce gönderilmişti";
  return "";
}

/**
 * Parts joined into the one sentence a toast shows:
 * "Sipariş #10023 iptal edildi · 3 ürün stoğa döndü · ₺450,00 karta iade
 * edildi · e-posta gönderildi."
 */
export function outcomeSentence(
  parts: ReadonlyArray<string | false | null | undefined>,
): string {
  const text = parts
    .map((p) => (typeof p === "string" ? p.trim().replace(/\.$/, "") : ""))
    .filter(Boolean)
    .join(" · ");
  if (!text) return "";
  return `${text.charAt(0).toLocaleUpperCase("tr-TR")}${text.slice(1)}.`;
}

/** "3 ürün stoğa döndü"; "" for none. */
export function restockPart(units: number): string {
  return units > 0 ? `${units} ürün stoğa döndü` : "";
}
