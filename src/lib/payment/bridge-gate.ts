import "server-only";

import { getOrder, type AdminOrder } from "@/lib/admin/store";
import { appKaraokeDeepLink, appOrderDeepLink } from "@/lib/mobile/deep-link";
import { getReservation } from "@/lib/mobile/karaoke";
import {
  paymentStatusOf,
  type KaraokeReservation,
} from "@/lib/mobile/karaoke-core";
import { KARAOKE_LINK_PATH } from "@/lib/mobile/karaoke-link";
import { isKaraokeRef } from "@/lib/mobile/karaoke-ref";

/**
 * The card page's last look before a sale goes to the POS
 * (`/odeme/paynkolay` POST, docs/PAYNKOLAY.md §14.7).
 *
 * The signed payload is valid for its whole life, whatever happens to the
 * order meanwhile, and PayNkolay takes a second sale on the same
 * `clientRefCode` (§2). Two tabs, or the back button after the bank's page,
 * and the same card form posts twice: the second one charged an order (or a
 * karaoke hold) that the first had already paid. So the row is read here,
 * by the reference alone, right before the sale.
 *
 * This module gets the reference and nothing else from the card page: the
 * card path may not touch a store or a database itself (CLAUDE.md rule 28,
 * tests/saved-cards.test.ts), and nothing here could log a card it never
 * sees. It does not ask the POS - that is the reopen gates' job, before a
 * new page is handed out (`checkPendingOrderPaid`, `reopenKaraokePayment`).
 */

export interface BridgeNotice {
  title: string;
  body: string;
  link: { href: string; label: string };
}

export type BridgeGate =
  /** Still awaiting this payment: the sale may start. */
  | { kind: "open" }
  /**
   * Nothing to pay any more. `paid`: the money is already booked. Otherwise
   * cancelled, expired, refunded, or a reference with no row at all.
   */
  | { kind: "settled"; paid: boolean; notice: BridgeNotice }
  /**
   * The row could not be read. No sale either: a payment taken now could
   * not be recorded anywhere, and the customer would be charged for an
   * order nobody sees.
   */
  | { kind: "unreadable" };

type RowState = "payable" | "paid" | "closed";

/** Statuses an order reaches only after its money was booked. */
const PAID_ORDER: ReadonlySet<AdminOrder["status"]> = new Set([
  "paid",
  "preparing",
  "shipped",
  "completed",
]);

function orderState(order: AdminOrder | null): RowState {
  if (!order) return "closed";
  if (order.status === "pending_payment" && order.totalMinor > 0) {
    return "payable";
  }
  return PAID_ORDER.has(order.status) ? "paid" : "closed";
}

function reservationState(r: KaraokeReservation | null): RowState {
  if (!r) return "closed";
  const money = paymentStatusOf(r);
  if (money === "pending" && r.status === "requested" && r.totalMinor > 0) {
    return "payable";
  }
  return money === "paid" ? "paid" : "closed";
}

/**
 * Whether the card page may start a sale for `ref` now. `fromApp`: the
 * payload's return goes back into the app (`app=1`), which decides where the
 * notice's link leads. Never throws.
 */
export async function bridgeChargeGate(
  ref: string,
  fromApp: boolean,
): Promise<BridgeGate> {
  const karaoke = isKaraokeRef(ref);
  let state: RowState;
  try {
    state = karaoke
      ? reservationState(await getReservation(ref))
      : orderState(await getOrder(ref));
  } catch (err) {
    console.error(
      `[odeme/paynkolay] kayıt okunamadı, ödeme başlatılmadı order=${ref}:`,
      err instanceof Error ? err.message : "bilinmeyen hata",
    );
    return { kind: "unreadable" };
  }
  if (state === "payable") return { kind: "open" };
  const paid = state === "paid";
  console.warn(
    `[odeme/paynkolay] ödeme beklemeyen kayda kart gönderildi, satış başlatılmadı order=${ref} paid=${paid}`,
  );
  return {
    kind: "settled",
    paid,
    notice: karaoke
      ? reservationNotice(ref, paid, fromApp)
      : orderNotice(ref, paid, fromApp),
  };
}

function orderNotice(
  ref: string,
  paid: boolean,
  fromApp: boolean,
): BridgeNotice {
  // The app's order screen; on the web the success page (it shows the
  // order to its owner only) or, for an order that is gone, the checkout.
  const link = fromApp
    ? {
        href: appOrderDeepLink(ref, paid ? "success" : "failed"),
        label: "Uygulamaya dön",
      }
    : paid
      ? {
          href: `/odeme/basarili?ref=${encodeURIComponent(ref)}`,
          label: "Siparişini gör",
        }
      : { href: "/odeme", label: "Ödemeye dön" };
  if (paid) {
    return {
      title: "Ödemen zaten alındı",
      body: "Bu siparişin ödemesi daha önce alındı; kartından ikinci kez para çekilmedi.",
      link,
    };
  }
  return {
    title: "Bu sipariş ödeme beklemiyor",
    body: fromApp
      ? "Bu sipariş artık ödeme beklemiyor; kartından para çekilmedi. Siparişinin son durumunu uygulamada görebilirsin."
      : "Bu sipariş artık ödeme beklemiyor; kartından para çekilmedi. Sepetin duruyor, ödeme adımından yeniden devam edebilirsin.",
    link,
  };
}

function reservationNotice(
  ref: string,
  paid: boolean,
  fromApp: boolean,
): BridgeNotice {
  // The app's karaoke screen, or the page /odeme/donus sends a web booking
  // to, which shows the details only to its owner (karaoke-return.ts).
  const link = fromApp
    ? {
        href: appKaraokeDeepLink(ref, paid ? "success" : "failed"),
        label: "Uygulamaya dön",
      }
    : {
        href: `${KARAOKE_LINK_PATH}?ref=${encodeURIComponent(ref)}&odeme=${paid ? "basarili" : "sonuc"}`,
        label: "Rezervasyonuna git",
      };
  return paid
    ? {
        title: "Ödemen zaten alındı",
        body: "Bu rezervasyonun ödemesi daha önce alındı; kartından ikinci kez para çekilmedi.",
        link,
      }
    : {
        title: "Bu rezervasyon ödeme beklemiyor",
        body: "Bu rezervasyon artık ödeme beklemiyor; kartından para çekilmedi. Son durumunu rezervasyonunda görebilirsin.",
        link,
      };
}
