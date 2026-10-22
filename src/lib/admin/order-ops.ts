import "server-only";

// What the order screens DO, one function per action, shared by the order
// page, the list's row menus and the bulk tool. Not a "use server" file
// (CLAUDE.md rule 27): nothing here is a POST endpoint. The Server Actions in
// app/admin/siparisler/actions.ts check the session, parse the form and call
// these with the signed-in actor; every function asks `orderActions` again
// with the order it just read, so a stale page cannot run what the menu
// would no longer offer.
//
// Each answers with one sentence for the toast ("Sipariş #10023 iptal
// edildi · 3 ürün stoğa döndü · ₺450,00 karta iade edildi · e-posta
// gönderildi."), a warning tone when something needs a hand.

import { baseNoticeKind, isResendableKind } from "@/lib/email/notice-kinds";
import { resendOrderNotice } from "@/lib/email/order-notices";
import { creditWalletRefund } from "@/lib/mobile/wallet";
import { getPaymentProvider } from "@/lib/payment";
import { isPaymentRefused, type PaymentProvider } from "@/lib/payment/provider";
import { formatTRYMinor } from "@/lib/utils/commerce";

import { safeAudit } from "./audit";
import {
  MANUAL_PAYMENT_LABELS,
  attentionText,
  bulkRefusal,
  bulkSummary,
  hasStockToReturn,
  isParcel,
  isPosOrder,
  mailPart,
  orderActions,
  outcomeSentence,
  refundDestinationFor,
  refundSentence,
  refundableMinor,
  refusalFor,
  restockPart,
  type BulkOrderAction,
  type BulkOrderOutcome,
  type ManualPaymentMethod,
  type NoticeOutcome,
  type OrderActionId,
  type OrderActionMap,
  type RefundDestination,
} from "./order-actions";
import { noticeKindLabel } from "./order-timeline";
import { canAccess, type AdminRole } from "./roles";
import {
  checkOrderWithPos,
  finalizeRefund,
  getOrder,
  getOrderPaymentRef,
  getOrdersByIds,
  listOrderMoney,
  markOrderPaidManually,
  orderMoney,
  refundRefusal,
  releaseRefund,
  reserveRefund,
  restockOrderLines,
  retryOrderRelease,
  setOrderAttention,
  setOrderItemStatus,
  setOrderTracking,
  shipParcel,
  transitionOrder,
  type AdminOrder,
  type AdminOrderItemStatus,
  type OrderMoney,
  type OrderTransition,
} from "./store";

/** Who is acting: the admin session's two fields the rules read. */
export interface OrderActor {
  email: string;
  role: AdminRole;
}

/**
 * What an order operation came to. `ok` carries the toast sentence; a
 * refusal carries the reason and, for a form field, where to show it.
 * `order` is for the caller's bookkeeping and never goes to the browser.
 */
export type OrderOpResult =
  | {
      ok: true;
      message: string;
      tone: "success" | "warning";
      order?: AdminOrder;
      /** For the bulk summary: what still needs a hand on this order. */
      followUp?: string;
    }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

const STALE = "Sipariş bu arada değişti. Sayfa yenilendi, tekrar bak.";

/**
 * Attention flags a money flag (`refund_unknown`, `refund_due`) replaces:
 * the e-Arşiv "Faturalı siparişte iade" (src/lib/invoice/run.ts). The
 * order has one slot, and an unconfirmed or owed refund matters more; the
 * invoice row keeps its own refund mark on Faturalar and the dashboard.
 */
const MONEY_FIRST: ReadonlySet<string> = new Set(["invoice_refund"]);

/** "Sipariş #10023" */
function orderLabel(order: Pick<AdminOrder, "orderNo">): string {
  return `Sipariş #${order.orderNo}`;
}

/** The worst of several mails, for the one mail part of a sentence. */
export function combinedMail(
  outcomes: ReadonlyArray<NoticeOutcome | null | undefined>,
): NoticeOutcome | null {
  if (outcomes.includes("failed")) return "failed";
  if (outcomes.includes("sent")) return "sent";
  if (outcomes.includes("duplicate")) return "duplicate";
  return null;
}

function done(
  parts: ReadonlyArray<string | false | null | undefined>,
  opts: { warn?: boolean; order?: AdminOrder; followUp?: string } = {},
): OrderOpResult {
  return {
    ok: true,
    message: outcomeSentence(parts),
    tone: opts.warn ? "warning" : "success",
    ...(opts.order ? { order: opts.order } : {}),
    ...(opts.followUp ? { followUp: opts.followUp } : {}),
  };
}

function refused(
  error: string,
  fieldErrors?: Record<string, string>,
): OrderOpResult {
  return fieldErrors ? { ok: false, error, fieldErrors } : { ok: false, error };
}

/** The typed confirmation: the order number, spaces and a "#" ignored. */
function confirmed(
  typed: string | undefined,
  order: Pick<AdminOrder, "orderNo">,
): boolean {
  return String(typed ?? "").replace(/[\s#]/g, "") === String(order.orderNo);
}

function unconfirmed(order: Pick<AdminOrder, "orderNo">): OrderOpResult {
  return refused("Onay için sipariş numarasını yaz.", {
    confirm: `${order.orderNo} yaz.`,
  });
}

/** The order, its money facts and what `actor` may do to it now. */
export async function loadOrderForAction(
  id: string,
  actor: OrderActor,
): Promise<{
  order: AdminOrder;
  money: OrderMoney;
  actions: OrderActionMap;
} | null> {
  const order = await getOrder(id);
  if (!order) return null;
  const money = await orderMoney(order);
  return {
    order,
    money,
    actions: orderActions(
      order,
      actor.role,
      money.collected,
      money.collectedMinor,
    ),
  };
}

async function gate(
  id: string,
  actor: OrderActor,
  action: OrderActionId,
): Promise<
  | { ok: true; order: AdminOrder; money: OrderMoney; actions: OrderActionMap }
  | { ok: false; result: OrderOpResult }
> {
  const ctx = await loadOrderForAction(id, actor);
  if (!ctx) return { ok: false, result: refused("Sipariş bulunamadı.") };
  const refusal = refusalFor(ctx.actions, action);
  if (refusal) return { ok: false, result: refused(refusal) };
  return { ok: true, ...ctx };
}

// ── Refund ──────────────────────────────────────────────────────────────

export interface RefundRequest {
  amountMinor: number;
  reason: string;
  /** The modal's one-time token (`AdminRefund.token`). */
  token?: string;
  /**
   * Where the modal said the money goes. When the server now decides
   * otherwise (a card payment landed since the page was drawn), nothing
   * moves: the operator confirmed a different sentence.
   */
  expectedDestination?: RefundDestination;
  /** Lines to give back to stock: `[{index, qty}]`. */
  restock?: ReadonlyArray<{ index: number; qty: number }>;
  /** The order number typed into the modal (ActionModal `confirmPhrase`). */
  confirm?: string;
}

/**
 * The refund itself, for the İade modal and for the cancel modal's "tutarın
 * tamamını iade et": every refusal before money moves (rule 25), the ledger
 * entry reserved atomically against what was COLLECTED and the modal's
 * one-time token, the money sent back through the payment it came from
 * (wallet, card, or nowhere for a counter sale), then the status, the stamp
 * and the buyer's mail. Nothing after the money moved can throw: a failed
 * follow-up or audit row becomes a warning in the sentence.
 *
 * Only a refund the POS certainly did not make (`PaymentRefusedError`)
 * takes the entry back. A POS that did not answer leaves it standing, flags
 * the order `refund_unknown` and tells nobody "iade edildi": the operator's
 * retry is refused by the ledger instead of reaching the card a second time.
 */
export async function issueRefund(
  order: AdminOrder,
  money: OrderMoney,
  request: RefundRequest,
  actor: OrderActor,
): Promise<
  | {
      ok: true;
      order: AdminOrder;
      parts: string[];
      mail: NoticeOutcome | null;
      warn: boolean;
    }
  | { ok: false; error: string }
> {
  const { amountMinor } = request;
  const reason = request.reason.trim();
  const refusal = refundRefusal(
    order,
    amountMinor,
    money.collected,
    money.collectedMinor,
  );
  if (refusal) return { ok: false, error: refusal };

  // The payment the money goes back through, read BEFORE anything is
  // written: the destination the operator confirmed must still be true.
  const ref = await getOrderPaymentRef(order.id);
  const destination = refundDestinationFor(ref?.provider ?? null);
  if (
    request.expectedDestination &&
    request.expectedDestination !== destination
  ) {
    return {
      ok: false,
      error:
        "Ödeme bilgisi bu arada değişti, iade yapılmadı. Sayfa yenilendi: iadenin nereye gideceğine yeniden bak.",
    };
  }

  const reserved = await reserveRefund(order.id, {
    amountMinor,
    reason,
    token: request.token,
    destination,
    collectedMinor: money.collectedMinor,
  });
  if (!reserved.ok) return { ok: false, error: reserved.error };

  // True when the POS was asked and did not answer: the refund may have gone
  // through (PaymentRefusedError, provider.ts). It is never rolled back.
  let unknown = false;
  if (destination === "wallet") {
    try {
      await creditWalletRefund({
        orderId: order.id,
        refundId: reserved.refund.id,
        amountMinor,
        title: `İade · Sipariş #${order.orderNo}`,
      });
    } catch (err) {
      console.error("[refund] wallet credit failed", err);
      await takeBack(order.id, reserved.refund.id, "CREDITED");
      return {
        ok: false,
        error:
          "Cüzdan iadesi yazılamadı, para geri gönderilmedi. Birazdan tekrar dene.",
      };
    }
  } else if (destination === "card" && ref) {
    let provider: PaymentProvider;
    try {
      provider = getPaymentProvider();
    } catch (err) {
      // Nothing was sent: the POS could not even be set up.
      console.error("[refund] payment provider unavailable", err);
      await takeBack(order.id, reserved.refund.id, "REFUNDED");
      return {
        ok: false,
        error:
          "Ödeme sağlayıcısına bağlanılamadı, para geri gönderilmedi. Birazdan tekrar dene.",
      };
    }
    try {
      // The payment row's own date and amount let the provider skip
      // searching its history for the transaction; rows from before the
      // column carry '' and the provider falls back to that search.
      await provider.refund(ref.providerRef, amountMinor, {
        trxDate: ref.trxDate,
        paidMinor: ref.amountMinor,
      });
    } catch (err) {
      if (isPaymentRefused(err)) {
        // A refusal, or a request that was never sent: no money moved, the
        // entry (and its token) goes, and the operator may try again.
        console.error("[refund] provider refused the refund", err);
        await takeBack(order.id, reserved.refund.id, "REFUNDED");
        return {
          ok: false,
          error:
            "Ödeme sağlayıcısı iadeyi reddetti, para geri gönderilmedi. PayNkolay panelinden bakıp tekrar dene.",
        };
      }
      // A timeout, a dropped line, an answer without a code: the refund may
      // have reached the card. Taking the entry back used to free the
      // amount and the modal's token, and the retry the operator then made
      // sent a second refund to the POS. The entry stays, so the ledger
      // refuses that retry; a person checks PayNkolay's panel (CLAUDE.md
      // rule 29, the refund side).
      console.error(
        `[refund] OUTCOME UNKNOWN, entry kept order=${order.id} refund=${reserved.refund.id} amountMinor=${amountMinor}`,
        err,
      );
      unknown = true;
    }
  }

  // The money moved (or, for a counter sale, the record stands; or the POS
  // did not say). Nothing below may turn that into an error: the operator
  // would retry, and a second refund passes while money is still "left".
  const parts = unknown
    ? [
        `${formatTRYMinor(amountMinor)} için POS yanıt vermedi: para karta dönmüş olabilir, iade kayda geçti`,
        "buradan tekrar deneme, PayNkolay panelinden bak",
      ]
    : [refundSentence(amountMinor, destination)];
  let warn = unknown;
  let after = reserved.order;
  let mail: NoticeOutcome | null = null;
  try {
    // An unknown outcome is not told to the buyer as "iade edildi": the
    // status and the stamps follow the entry, the mail waits for a person.
    const finalized = await finalizeRefund(
      reserved.order,
      unknown
        ? undefined
        : { refund: reserved.refund, viaCard: destination === "card" },
    );
    after = finalized.order;
    mail = finalized.mail;
  } catch (err) {
    console.error(
      `[refund] REFUNDED BUT NOT FINALIZED order=${order.id} amountMinor=${amountMinor}`,
      err,
    );
    warn = true;
    parts.push(
      "durum ve damgalar güncellenemedi, sayfayı yenileyip kontrol et",
    );
  }

  const lines = (request.restock ?? []).filter((l) => l.qty > 0);
  if (lines.length > 0) {
    try {
      const credited = await restockOrderLines(order, lines, actor.email);
      const units = credited.reduce((sum, l) => sum + l.qty, 0);
      parts.push(restockPart(units) || "stoğa dönen ürün olmadı");
    } catch (err) {
      console.error(`[refund] restock failed order=${order.id}`, err);
      warn = true;
      parts.push("stok geri alınamadı, stok hareketlerinden elle düzelt");
    }
  }

  const flag = String(order.attention ?? "");
  if (unknown) {
    // The red band until a person has looked at PayNkolay. A flag the order
    // already carries (a second charge, a wrong amount) says more and stays;
    // the e-Arşiv one gives way to money (`MONEY_FIRST`).
    if (flag === "" || flag === "refund_due" || MONEY_FIRST.has(flag)) {
      await setOrderAttention(order.id, "refund_unknown");
    }
  } else if (
    // "İptal edildi, iade bekliyor" is answered once nothing is left to give.
    flag === "refund_due" &&
    refundableMinor(after, money.collected, money.collectedMinor) === 0
  ) {
    await setOrderAttention(order.id, "");
  }

  const audited = await safeAudit({
    action: "refund",
    entity: "order",
    entityId: order.id,
    actor: actor.email,
    payload: {
      amountMinor,
      reason,
      provider: ref?.provider ?? "none",
      destination,
      restock: lines,
      ...(unknown ? { outcome: "unknown" } : {}),
    },
  });
  if (!audited) {
    warn = true;
    parts.push("olay kaydı yazılamadı");
  }
  if (mail === "failed") warn = true;
  return { ok: true, order: after, parts, mail, warn };
}

/** The reserved entry, taken back after the money did NOT move. */
async function takeBack(
  orderId: string,
  refundId: string,
  what: "CREDITED" | "REFUNDED",
): Promise<void> {
  try {
    await releaseRefund(orderId, refundId);
  } catch (err) {
    // The money did not move but the entry could not be taken back: loud,
    // because the ledger now over-states what was refunded.
    console.error(
      `[refund] RESERVED BUT NOT ${what} order=${orderId} refund=${refundId}`,
      err,
    );
  }
}

/** "İade başlat". */
export async function refundOrder(
  id: string,
  request: RefundRequest,
  actor: OrderActor,
): Promise<OrderOpResult> {
  const g = await gate(id, actor, "refund");
  if (!g.ok) return g.result;
  if (!confirmed(request.confirm, g.order)) return unconfirmed(g.order);
  const res = await issueRefund(g.order, g.money, request, actor);
  if (!res.ok) return refused(res.error);
  return done([orderLabel(g.order), ...res.parts, mailPart(res.mail)], {
    warn: res.warn,
    order: res.order,
  });
}

// ── Cancel ──────────────────────────────────────────────────────────────

export interface CancelRequest {
  reason: string;
  /**
   * Give the stock back. `null` = no decision was made, which is refused
   * for a parcel that already left (whether it comes back is the call).
   */
  restock: boolean | null;
  /** Refund what was collected in the same step (the refunds role only). */
  refund: boolean;
  refundToken?: string;
  expectedDestination?: RefundDestination;
  /**
   * The order number typed into the modal; required when money was taken
   * (ActionModal `confirmPhrase`, checked here too). The bulk tool checks
   * its own typed count instead.
   */
  confirm?: string;
  /** Part of a bulk run: one audit row per order, marked as such. */
  bulk?: boolean;
}

/**
 * "İptal et": the reason, the stock decision, and when money was taken and
 * the operator may refund, the refund in the same step.
 *
 * A pending POS order is asked about first (rule 29): a payment the POS
 * shows is booked and the order is NOT cancelled; a POS that cannot be
 * asked is not "unpaid". A cancel that keeps the money flags the order
 * "iade bekliyor" so it does not sit in the list looking finished.
 */
export async function cancelOrder(
  id: string,
  request: CancelRequest,
  actor: OrderActor,
): Promise<OrderOpResult> {
  const reason = request.reason.trim();
  if (reason.length < 3) {
    return refused("İptal nedenini yaz.", {
      reason: "En az 3 karakter yaz.",
    });
  }
  let g = await gate(id, actor, "cancel");
  if (!g.ok) return g.result;
  if (
    !request.bulk &&
    g.money.collected &&
    !confirmed(request.confirm, g.order)
  ) {
    return unconfirmed(g.order);
  }
  if (
    g.order.status === "shipped" &&
    request.restock === null &&
    hasStockToReturn(g.order)
  ) {
    return refused("Kargo yolda: stok kararını seç.", {
      restock: "Stoğa geri alınsın mı, seç.",
    });
  }

  if (g.order.status === "pending_payment" && isPosOrder(g.order)) {
    const verdict = await checkOrderWithPos(g.order, "cancel");
    if (verdict === "paid") {
      return refused(
        "POS'ta bu siparişin ödemesi bulundu ve sipariş ödendi olarak işlendi. İptal edilmedi, sayfa yenilendi.",
      );
    }
    if (verdict === "unknown") {
      return refused(
        "POS'a ulaşılamadı, ödemenin durumu bilinmiyor. Sipariş iptal edilmedi, birazdan tekrar dene.",
      );
    }
    // The POS may have booked a payment of the wrong amount just now. The
    // money facts changed under the operator: nothing is cancelled, and the
    // page (redrawn) shows the payment and its red band.
    const regated = await gate(id, actor, "cancel");
    if (!regated.ok) return regated.result;
    if (regated.money.collected && !g.money.collected) {
      return refused(
        "POS'ta bu sipariş için farklı tutarlı bir ödeme bulundu. Sipariş iptal edilmedi; sayfa yenilendi, dikkat bandına bak.",
      );
    }
    g = regated;
  }

  const restock = request.restock !== false;
  // From the status everything above was decided on (the role, the money,
  // the stock question): a payment landing in between must not let an
  // "unpaid" cancel take a paid order with it.
  const moved = await transitionOrder(id, "cancel", {
    restock,
    actor: actor.email,
    expectStatus: g.order.status,
  });
  if (!moved.ok || !moved.order) return refused(moved.error ?? STALE);

  const parts: string[] = [`${orderLabel(g.order)} iptal edildi`];
  let warn = false;
  let order = moved.order;
  if (moved.release?.released) {
    if (!restock) parts.push("stoğa alınmadı");
    else if (moved.release.units > 0)
      parts.push(restockPart(moved.release.units));
  }
  for (const w of moved.warnings ?? []) {
    warn = true;
    parts.push(w);
  }

  const mails: Array<NoticeOutcome | null | undefined> = [moved.mail];
  let refundedMinor = 0;
  const due = refundableMinor(order, g.money.collected, g.money.collectedMinor);
  let followUp: string | undefined;
  if (due > 0 && request.refund && canAccess("refunds", actor.role)) {
    const refunded = await issueRefund(
      order,
      g.money,
      {
        amountMinor: due,
        reason,
        token: request.refundToken,
        expectedDestination: request.expectedDestination,
      },
      actor,
    );
    if (refunded.ok) {
      order = refunded.order;
      refundedMinor = due;
      parts.push(...refunded.parts);
      mails.push(refunded.mail);
      if (refunded.warn) warn = true;
    } else {
      warn = true;
      parts.push(`iade yapılamadı: ${refunded.error}`);
    }
  }
  if (due > 0 && refundedMinor === 0) {
    // Money the shop still holds for an order that will not be made. A flag
    // already on the order (a second charge, a wrong amount) says more and
    // is kept: clearing "iade bekliyor" later must not forget it. The
    // e-Arşiv one gives way (`MONEY_FIRST`).
    const held = String(g.order.attention ?? "");
    if (!held || MONEY_FIRST.has(held)) {
      await setOrderAttention(id, "refund_due");
    }
    followUp = "iade bekliyor";
    parts.push("para henüz iade edilmedi, 'İade başlat' ile iade et");
    warn = true;
  }

  const mail = combinedMail(mails);
  if (mail === "failed") warn = true;
  parts.push(mailPart(mail));

  const audited = await safeAudit({
    action: "transition",
    entity: "order",
    entityId: id,
    actor: actor.email,
    payload: {
      transition: "cancel",
      to: "cancelled",
      from: g.order.status,
      reason,
      restock,
      units: moved.release?.units ?? 0,
      refundedMinor,
      ...(request.bulk ? { bulk: true } : {}),
    },
  });
  if (!audited) {
    warn = true;
    parts.push("olay kaydı yazılamadı");
  }
  return done(parts, { warn, order, followUp });
}

// ── Payment ─────────────────────────────────────────────────────────────

/**
 * "Ödendi olarak işaretle": the money was taken outside the POS.
 *
 * Refused for a POS order until the POS was asked, and the asking is part
 * of this call: a card payment the POS shows is booked as what it is (and
 * no manual row is written); a POS that cannot be asked refuses the whole
 * thing, because a manual "ödendi" on top of a card charge is a double
 * charge nobody sees. Otherwise a `manual:<method>` payment row is written
 * (store.markOrderPaidManually), so a late card payment is caught as a
 * duplicate. `alsoPrepare` moves it on to "Hazırlanıyor" in the same step.
 */
export async function markPaid(
  id: string,
  input: { method: ManualPaymentMethod; alsoPrepare: boolean },
  actor: OrderActor,
): Promise<OrderOpResult> {
  const g = await gate(id, actor, "mark_paid");
  if (!g.ok) return g.result;
  const parts: string[] = [];
  let order = g.order;
  const mails: Array<NoticeOutcome | null | undefined> = [];

  let viaPos = false;
  if (isPosOrder(order)) {
    const verdict = await checkOrderWithPos(order, "pay");
    if (verdict === "unknown") {
      const fresh = await getOrder(id);
      const flag = attentionText(fresh?.attention);
      return refused(
        flag
          ? `${flag.title}. Sipariş ödendi olarak işaretlenmedi: önce dikkat bandına bak.`
          : "POS'a ulaşılamadı. Kartla ödenmiş olabilir, bu yüzden işaretlenmedi. Birazdan tekrar dene.",
      );
    }
    if (verdict === "paid") {
      viaPos = true;
      parts.push(
        `${orderLabel(order)} POS'ta ödenmiş çıktı, ödendi olarak işlendi`,
      );
      order = (await getOrder(id)) ?? order;
    } else if (verdict === "not_pending") {
      return refused(STALE);
    }
  }

  if (!viaPos) {
    const res = await markOrderPaidManually(id, input.method, actor.email);
    if (!res.ok || !res.order) return refused(res.error ?? STALE);
    order = res.order;
    mails.push(res.mail);
    parts.push(
      `${orderLabel(order)} ödendi olarak işaretlendi (${MANUAL_PAYMENT_LABELS[input.method]})`,
    );
  }
  let warn = false;
  const audited = await auditTransition(id, actor, "mark_paid", "paid", {
    method: viaPos ? "pos" : input.method,
  });
  if (!audited) {
    warn = true;
    parts.push("olay kaydı yazılamadı");
  }

  if (input.alsoPrepare && order.status === "paid") {
    const prepared = await transitionOrder(id, "start_preparing", {
      actor: actor.email,
      expectStatus: "paid",
    });
    if (prepared.ok && prepared.order) {
      order = prepared.order;
      parts.push("hazırlanıyor");
      await auditTransition(id, actor, "start_preparing", "preparing");
    } else {
      warn = true;
      parts.push(`hazırlamaya alınamadı: ${prepared.error ?? STALE}`);
    }
  }
  const mail = combinedMail(mails);
  if (mail === "failed") warn = true;
  parts.push(mailPart(mail));
  return done(parts, { warn, order });
}

/**
 * "POS'tan kontrol et": asks the POS about a pending order and books a
 * payment it shows. Unpaid is an answer too; an unreachable POS is not.
 */
export async function checkWithPos(
  id: string,
  actor: OrderActor,
): Promise<OrderOpResult> {
  const g = await gate(id, actor, "check_pos");
  if (!g.ok) return g.result;
  const verdict = await checkOrderWithPos(g.order, "check");
  if (verdict === "paid") {
    const order = (await getOrder(id)) ?? g.order;
    return done(
      [`${orderLabel(order)} POS'ta ödenmiş, ödendi olarak işlendi`],
      {
        order,
      },
    );
  }
  if (verdict === "unpaid") {
    return done([
      `${orderLabel(g.order)} için POS'ta ödeme yok`,
      "müşteri hâlâ ödeme sayfasında olabilir",
    ]);
  }
  if (verdict === "unknown") {
    // A payment of the wrong amount reads "unknown" here, and is flagged on
    // the order: say what was found rather than "unreachable".
    const fresh = await getOrder(id);
    const flag = attentionText(fresh?.attention);
    if (flag)
      return done([`${orderLabel(g.order)}: ${flag.title}`], { warn: true });
    return refused("POS'a ulaşılamadı. Birazdan tekrar dene.");
  }
  return refused(STALE);
}

// ── Moves ───────────────────────────────────────────────────────────────

const SIMPLE_MOVES: Partial<Record<OrderActionId, OrderTransition>> = {
  start_preparing: "start_preparing",
  mark_shipped: "mark_shipped",
  complete: "complete",
};

const DONE_TEXT: Record<
  "start_preparing" | "mark_shipped" | "complete",
  (o: AdminOrder) => string
> = {
  start_preparing: () => "hazırlanıyor",
  mark_shipped: (o) => shippedWord(o),
  complete: () => "tamamlandı",
};

function shippedWord(order: AdminOrder): string {
  switch (order.fulfillment) {
    case "pickup":
      return "teslime hazır";
    case "delivery":
      return "kuryeye verildi";
    case "table":
      return "masaya götürüldü";
    default:
      return "kargoda";
  }
}

/**
 * The one-click moves: Hazırlamaya başla (from paid), Hazır / Kuryeye ver /
 * Masaya götürüldü (not a parcel), Tamamlandı.
 */
export async function moveOrder(
  id: string,
  action: "start_preparing" | "mark_shipped" | "complete",
  actor: OrderActor,
): Promise<OrderOpResult> {
  const transition = SIMPLE_MOVES[action];
  if (!transition) return refused("Geçersiz işlem.");
  const g = await gate(id, actor, action);
  if (!g.ok) return g.result;
  const moved = await transitionOrder(id, transition, {
    actor: actor.email,
    expectStatus: g.order.status,
  });
  if (!moved.ok || !moved.order) return refused(moved.error ?? STALE);
  const parts = [`${orderLabel(g.order)} ${DONE_TEXT[action](moved.order)}`];
  let warn = false;
  if (!(await auditTransition(id, actor, transition, moved.order.status))) {
    warn = true;
    parts.push("olay kaydı yazılamadı");
  }
  if (moved.mail === "failed") warn = true;
  parts.push(mailPart(moved.mail));
  return done(parts, { warn, order: moved.order });
}

/** "Kargoya ver" for a parcel: carrier + the required number + Kargoda. */
export async function shipOrder(
  id: string,
  input: { carrier: string; trackingNumber: string },
  actor: OrderActor,
): Promise<OrderOpResult> {
  const trackingNumber = input.trackingNumber.trim();
  if (!trackingNumber) {
    return refused("Takip numarasını yaz.", {
      trackingNumber: "Takip numarası olmadan kargoya verilemez.",
    });
  }
  const g = await gate(id, actor, "ship");
  if (!g.ok) return g.result;
  const moved = await shipParcel(id, {
    carrier: input.carrier,
    trackingNumber,
    actor: actor.email,
  });
  if (!moved.ok || !moved.order) return refused(moved.error ?? STALE);
  const parts = [`${orderLabel(g.order)} kargoya verildi`];
  let warn = false;
  if (
    !(await auditTransition(id, actor, "mark_shipped", "shipped", {
      carrier: input.carrier.trim(),
      tracking: "set",
    }))
  ) {
    warn = true;
    parts.push("olay kaydı yazılamadı");
  }
  if (moved.mail === "failed") warn = true;
  parts.push(
    moved.mail === "not_due"
      ? "müşteriye e-posta gitmedi (mağaza kargosu değil ya da e-posta yok)"
      : mailPart(moved.mail),
  );
  return done(parts, { warn, order: moved.order });
}

/** "Kargo bilgisini düzelt", for a parcel that has already left. */
export async function editTracking(
  id: string,
  input: { carrier: string; trackingNumber: string },
  actor: OrderActor,
): Promise<OrderOpResult> {
  if (!input.trackingNumber.trim()) {
    return refused("Takip numarasını yaz.", {
      trackingNumber: "Takip numarasını yaz.",
    });
  }
  const g = await gate(id, actor, "edit_tracking");
  if (!g.ok) return g.result;
  const res = await setOrderTracking(id, input.trackingNumber, input.carrier);
  if (!res.ok) return refused(res.error);
  const parts = [`${orderLabel(g.order)} kargo bilgisi kaydedildi`];
  let warn = false;
  // The number itself is not logged: it identifies a parcel, and a person.
  const audited = await safeAudit({
    action: "update",
    entity: "order",
    entityId: id,
    actor: actor.email,
    payload: { tracking: "set", carrier: input.carrier.trim() },
  });
  if (!audited) {
    warn = true;
    parts.push("olay kaydı yazılamadı");
  }
  if (res.mail === "failed") warn = true;
  parts.push(mailPart(res.mail));
  return done(parts, { warn, order: res.order });
}

export const ITEM_STATUS_LABELS: Record<AdminOrderItemStatus, string> = {
  pending: "Bekliyor",
  ready: "Hazır",
  cancelled: "İptal",
};

/** One line's "Bekliyor / Hazır / İptal", with the store's answer checked. */
export async function changeItemStatus(
  id: string,
  index: number,
  status: AdminOrderItemStatus,
  actor: OrderActor,
): Promise<OrderOpResult> {
  const g = await gate(id, actor, "item_status");
  if (!g.ok) return g.result;
  const item = g.order.items[index];
  if (!item) return refused("Bu kalem artık yok. Sayfa yenilendi.");
  const updated = await setOrderItemStatus(id, index, status);
  if (!updated) return refused(STALE);
  const parts = [`${item.productName}: ${ITEM_STATUS_LABELS[status]}`];
  if (status === "cancelled") {
    parts.push("tutar ve stok değişmedi, gerekirse 'İade başlat'");
  }
  const audited = await safeAudit({
    action: "update",
    entity: "order_item",
    entityId: `${id}#${index}`,
    actor: actor.email,
    payload: { status },
  });
  if (!audited) parts.push("olay kaydı yazılamadı");
  return done(parts, { warn: !audited, order: updated });
}

/** "Stoğu geri al": the release a cancel could not finish. */
export async function releaseStock(
  id: string,
  actor: OrderActor,
): Promise<OrderOpResult> {
  const g = await gate(id, actor, "release_stock");
  if (!g.ok) return g.result;
  const res = await retryOrderRelease(id, actor.email);
  if (!res.ok) return refused(res.error);
  await safeAudit({
    action: "update",
    entity: "order",
    entityId: id,
    actor: actor.email,
    payload: { event: "stock_released", units: res.release.units },
  });
  return done([
    `${orderLabel(g.order)} stoğu geri alındı`,
    restockPart(res.release.units) || "stoğa dönecek ürün yoktu",
  ]);
}

/** "Dikkat işaretini kaldır", after a human sorted it out. */
export async function clearAttention(
  id: string,
  note: string,
  actor: OrderActor,
): Promise<OrderOpResult> {
  const g = await gate(id, actor, "clear_attention");
  if (!g.ok) return g.result;
  const was = String(g.order.attention ?? "");
  if (!(await setOrderAttention(id, ""))) {
    return refused("İşaret kaldırılamadı. Birazdan tekrar dene.");
  }
  await safeAudit({
    action: "update",
    entity: "order",
    entityId: id,
    actor: actor.email,
    payload: {
      event: "attention_cleared",
      was,
      note: note.trim().slice(0, 500),
    },
  });
  return done([`${orderLabel(g.order)} dikkat işareti kaldırıldı`]);
}

/**
 * "Yeniden gönder": one customer mail of this order again, under a new
 * kind (`resendOrderNotice`), only while what it says is still true.
 */
export async function resendMail(
  id: string,
  kind: string,
  actor: OrderActor,
): Promise<OrderOpResult> {
  const g = await gate(id, actor, "resend_mail");
  if (!g.ok) return g.result;
  if (!isResendableKind(kind)) return refused("Bu e-posta buradan gönderilemez.");
  const mail = await resendOrderNotice(g.order, kind, {
    collected: g.money.collected,
  });
  if (mail === "not_due") {
    return refused(
      "Bu e-posta şu an gönderilemez: sipariş değişmiş ya da müşterinin e-posta adresi yok.",
    );
  }
  if (mail === "failed") {
    return refused("E-posta GÖNDERİLEMEDİ. Birazdan tekrar dene ya da müşteriye kendin ulaş.");
  }
  await safeAudit({
    action: "update",
    entity: "order",
    entityId: id,
    actor: actor.email,
    payload: { event: "mail_resent", kind: baseNoticeKind(kind) },
  });
  return done([
    `${orderLabel(g.order)}: ${noticeKindLabel(kind)} yeniden gönderildi`,
  ]);
}

async function auditTransition(
  id: string,
  actor: OrderActor,
  transition: OrderTransition,
  to: string,
  extra: Record<string, unknown> = {},
): Promise<boolean> {
  return safeAudit({
    action: "transition",
    entity: "order",
    entityId: id,
    actor: actor.email,
    payload: { transition, to, ...extra },
  });
}

// ── Bulk ────────────────────────────────────────────────────────────────

/** The bulk tool's ceiling per run: a page of the list, with room. */
export const BULK_ORDER_LIMIT = 100;

/** POS checks of a bulk cancel run side by side, a few at a time. */
const BULK_CONCURRENCY = 4;

async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  work: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const runners = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) {
        const i = next;
        next += 1;
        out[i] = await work(items[i]);
      }
    },
  );
  await Promise.all(runners);
  return out;
}

/**
 * The bulk tool: every order through the same function the order page uses,
 * each decided on its own (`bulkRefusal`: the role per order, a parcel
 * without a number is not shipped, a parcel on the road is not cancelled in
 * bulk), one audit row per order, and an answer that names what was skipped
 * and why. A throw on one order is that order's "atlandı", never the rest's.
 */
export async function runBulkOrderAction(
  ids: readonly string[],
  op: BulkOrderAction,
  input: { reason: string },
  actor: OrderActor,
): Promise<{ message: string; tone: "success" | "warning"; done: number }> {
  const unique = [...new Set(ids)].slice(0, BULK_ORDER_LIMIT);
  const orders = await getOrdersByIds(unique);
  const byId = new Map(orders.map((o) => [o.id, o]));
  const money = await listOrderMoney(orders);
  const results = await mapLimit(
    unique,
    BULK_CONCURRENCY,
    async (id): Promise<BulkOrderOutcome> => {
      const order = byId.get(id);
      if (!order) return { orderNo: 0, ok: false, note: "bulunamadı" };
      const m = money.get(id);
      const refusal = bulkRefusal(order, op, actor.role, m?.collected ?? false);
      if (refusal) return { orderNo: order.orderNo, ok: false, note: refusal };
      try {
        const res =
          op === "cancel"
            ? await cancelOrder(
                id,
                {
                  reason: input.reason,
                  restock: true,
                  refund: false,
                  bulk: true,
                },
                actor,
              )
            : op === "mark_shipped" && isParcel(order)
              ? // A parcel ships with the number it already carries (bulkRefusal
                // skipped the ones without), and its buyer gets the mail.
                await shipOrder(
                  id,
                  {
                    carrier: order.carrier ?? "",
                    trackingNumber: order.trackingNumber ?? "",
                  },
                  actor,
                )
              : await moveOrder(id, op, actor);
        if (!res.ok) {
          return {
            orderNo: order.orderNo,
            ok: false,
            note: shortReason(res.error),
          };
        }
        return {
          orderNo: order.orderNo,
          ok: true,
          ...(res.followUp ? { note: res.followUp } : {}),
        };
      } catch (err) {
        console.error(`[orders] bulk ${op} failed order=${id}`, err);
        return { orderNo: order.orderNo, ok: false, note: "hata oldu" };
      }
    },
  );
  return bulkSummary(op, results);
}

/** The first sentence of a refusal, lower-cased, for "#10023 <neden>". */
function shortReason(error: string): string {
  const first = error.split(/(?<=[.!?])\s/)[0]?.replace(/[.!?]$/, "") ?? error;
  return first.charAt(0).toLocaleLowerCase("tr-TR") + first.slice(1);
}
