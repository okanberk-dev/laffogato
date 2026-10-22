import type { AdminOrderStatus } from "@/lib/admin/store";

/**
 * The words an order's stages are told in, to the member: the app's inbox
 * (notifications.ts, docs/API-MOBILE.md §8) and the phone notification
 * (src/lib/push/order-push-core.ts) say the same sentence, so the push a
 * member taps and the row it leads to never disagree.
 *
 * Pure: no database, no server-only import, so the push core can share it.
 */

export type OrderStageKey = Extract<
  AdminOrderStatus,
  "paid" | "preparing" | "shipped" | "completed"
>;

/** The stages an order passes through, in order; a later stage implies the earlier ones. */
export const ORDER_STAGES: OrderStageKey[] = [
  "paid",
  "preparing",
  "shipped",
  "completed",
];

const STAGE_TITLES: Record<OrderStageKey, string> = {
  paid: "Ödemen alındı",
  preparing: "Hazırlanıyor",
  shipped: "Yolda",
  completed: "Teslim edildi",
};

export function stageTitle(stage: OrderStageKey, fulfillment: string): string {
  // A pickup order is never "on the way": the member walks in for it.
  if (fulfillment === "pickup") {
    if (stage === "shipped") return "Hazır - gel al";
    if (stage === "completed") return "Teslim alındı";
  }
  // Nor is a table order: it is carried to where the member sits.
  if (fulfillment === "table") {
    if (stage === "shipped") return "Masana getirildi";
    if (stage === "completed") return "Tamamlandı";
  }
  return STAGE_TITLES[stage];
}

export function stageBody(
  stage: OrderStageKey,
  orderNo: number,
  fulfillment: string,
): string {
  const no = `#${orderNo}`;
  switch (stage) {
    case "paid":
      return `${no} numaralı siparişinin ödemesi alındı. Hazırlamaya başlıyoruz.`;
    case "preparing":
      return `${no} numaralı siparişin hazırlanıyor.`;
    case "shipped":
      if (fulfillment === "pickup")
        return `${no} numaralı siparişin hazır, tezgâhta seni bekliyor.`;
      if (fulfillment === "delivery")
        return `${no} numaralı siparişin kuryede, yola çıktı.`;
      if (fulfillment === "table")
        return `${no} numaralı siparişin masana getirildi. Afiyet olsun.`;
      return `${no} numaralı siparişin kargoya verildi.`;
    case "completed":
      return `${no} numaralı siparişin teslim edildi. Afiyet olsun.`;
  }
}
