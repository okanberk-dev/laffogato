import "server-only";

import {
  customerOrdersByEmail,
  listActiveAppAnnouncements,
  orderFulfillment,
  type AdminAppAnnouncement,
  type AdminOrder,
  type AdminOrderStatus,
} from "@/lib/admin/store";

/**
 * Notifications for the app's inbox (docs/API-MOBILE.md §8).
 *
 * Nothing is stored: the list is derived on every call from the member's
 * recent orders, the announcements currently on the home screen, and whether
 * a loyalty reward is waiting. The app keeps "read" state on the device, keyed
 * by `id`, so ids must be stable across calls — they are built from the order
 * id and the stage reached, never from a timestamp or a position.
 */

export type NotificationKind = "order" | "reward" | "campaign" | "announcement";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** ISO-8601. */
  at: string;
  orderId: string | null;
}

export const NOTIFICATION_WINDOW_DAYS = 30;

type OrderLike = Pick<
  AdminOrder,
  | "id"
  | "orderNo"
  | "status"
  | "createdAt"
  | "paidAt"
  | "preparingAt"
  | "shippedAt"
  | "completedAt"
> & { fulfillment?: string };

type StageKey = Extract<
  AdminOrderStatus,
  "paid" | "preparing" | "shipped" | "completed"
>;

/** The stages an order passes through, in order; a later stage implies the earlier ones. */
const STAGES: StageKey[] = ["paid", "preparing", "shipped", "completed"];

const STAGE_TITLES: Record<StageKey, string> = {
  paid: "Ödemen alındı",
  preparing: "Hazırlanıyor",
  shipped: "Yolda",
  completed: "Teslim edildi",
};

function stageTitle(stage: StageKey, fulfillment: string): string {
  // A pickup order is never "on the way": the member walks in for it.
  if (fulfillment === "pickup") {
    if (stage === "shipped") return "Hazır — gel al";
    if (stage === "completed") return "Teslim alındı";
  }
  return STAGE_TITLES[stage];
}

function stageBody(
  stage: StageKey,
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
      return `${no} numaralı siparişin kargoya verildi.`;
    case "completed":
      return `${no} numaralı siparişin teslim edildi. Afiyet olsun.`;
  }
}

/**
 * The instant a stage was reached. `transitionOrder` stamps one column per
 * stage; an order that finished before those columns existed falls back to the
 * closest earlier instant it has, which is what this used to do for every
 * stage. The fallback is why the window below is checked per stage and not
 * once per order.
 */
function stageAt(order: OrderLike, stage: StageKey): string {
  const paidAt = order.paidAt || order.createdAt;
  switch (stage) {
    case "paid":
      return paidAt;
    case "preparing":
      return order.preparingAt || paidAt;
    case "shipped":
      return order.shippedAt || order.preparingAt || paidAt;
    case "completed":
      return (
        order.completedAt || order.shippedAt || order.preparingAt || paidAt
      );
  }
}

function withinWindow(iso: string, now: Date): boolean {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return false;
  return now.getTime() - t <= NOTIFICATION_WINDOW_DAYS * 86_400_000;
}

/**
 * One record per stage an order has reached, so "Ödemen alındı" stays in the
 * inbox when "Hazırlanıyor" arrives and each stage is its own unread item.
 * Orders that never got paid, or that were cancelled or refunded, contribute
 * nothing: the app shows those on the order itself.
 */
export function deriveOrderNotifications(
  orders: readonly OrderLike[],
  now: Date,
): AppNotification[] {
  const out: AppNotification[] = [];
  for (const order of orders) {
    const reached = STAGES.indexOf(order.status as StageKey);
    if (reached < 0) continue;
    const fulfillment = orderFulfillment(order);
    for (const stage of STAGES.slice(0, reached + 1)) {
      const at = stageAt(order, stage);
      // The window is per stage, not per order: a gift box ordered 32 days
      // ago and shipped today still belongs in the inbox today.
      if (!withinWindow(at, now)) continue;
      out.push({
        id: `order-${order.id}-${stage}`,
        kind: "order",
        title: stageTitle(stage, fulfillment),
        body: stageBody(stage, order.orderNo, fulfillment),
        at,
        orderId: order.id,
      });
    }
  }
  return out;
}

type AnnouncementLike = Pick<
  AdminAppAnnouncement,
  "id" | "kind" | "title" | "body" | "startsAt" | "createdAt"
>;

export function deriveAnnouncementNotifications(
  announcements: readonly AnnouncementLike[],
): AppNotification[] {
  return announcements.map((a) => ({
    id: `announcement-${a.id}`,
    kind: a.kind === "campaign" ? "campaign" : "announcement",
    title: a.title,
    body: a.body,
    at: a.startsAt || a.createdAt,
    orderId: null,
  }));
}

export function rewardNotification(
  rewardsReady: number,
  at: string,
): AppNotification | null {
  if (rewardsReady <= 0) return null;
  return {
    id: "reward-ready",
    kind: "reward",
    title: rewardsReady > 1 ? "Ödüllerin hazır" : "Ödülün hazır",
    body:
      rewardsReady > 1
        ? `${rewardsReady} ücretsiz içeceğin seni bekliyor. Kasada kartını göster.`
        : "Damgaların doldu — ücretsiz içeceğin seni bekliyor. Kasada kartını göster.",
    at,
    orderId: null,
  };
}

/** What the member asked to hear about (`customers.notificationPrefs`). */
export interface NotificationFilter {
  marketing?: boolean;
  orderUpdates?: boolean;
}

/** Pure composition: everything the route returns, newest first. */
export function buildNotifications(input: {
  orders: readonly OrderLike[];
  announcements: readonly AnnouncementLike[];
  rewardsReady: number;
  /**
   * When the waiting reward became ready. Must be the same instant on every
   * call — the app decides "unread" by comparing it with the moment the
   * member last opened the inbox, so `now` here would make it unread forever.
   */
  rewardAt?: string | null;
  now: Date;
  prefs?: NotificationFilter;
}): AppNotification[] {
  const items = [
    ...deriveOrderNotifications(input.orders, input.now),
    ...deriveAnnouncementNotifications(input.announcements),
  ];
  const reward = rewardNotification(
    input.rewardsReady,
    input.rewardAt || input.now.toISOString(),
  );
  if (reward) items.push(reward);
  // "Neyi duymak istediğine sen karar ver" is the promise under the switches:
  // marketing off means no campaign rows. Order and reward items stay — they
  // are the member's own transactions, not a commercial message.
  const noMarketing = input.prefs?.marketing === false;
  return items
    .filter((item) => !(noMarketing && item.kind === "campaign"))
    .sort((a, b) => b.at.localeCompare(a.at));
}

/**
 * Rewards waiting to be redeemed and since when, or none when the loyalty
 * module cannot answer. Owned by the rewards feature; a failure there must
 * not empty the inbox.
 */
async function resolveReward(
  email: string,
): Promise<{ rewardsReady: number; readyAt: string | null }> {
  const none = { rewardsReady: 0, readyAt: null };
  try {
    const mod = (await import("@/lib/mobile/loyalty")) as {
      getRewardStatus?: (
        email: string,
      ) => Promise<{ rewardsReady?: number; readyAt?: string | null } | null>;
    };
    if (typeof mod.getRewardStatus !== "function") return none;
    const status = await mod.getRewardStatus(email);
    const n = status?.rewardsReady;
    return {
      rewardsReady:
        typeof n === "number" && Number.isFinite(n) ? Math.max(0, n) : 0,
      readyAt: status?.readyAt ?? null,
    };
  } catch (err) {
    console.error(
      `[notifications] loyalty unavailable: ${err instanceof Error ? err.message : String(err)}`,
    );
    return none;
  }
}

/** GET /notifications for one member. Throws on a database failure. */
export async function deriveNotifications(
  email: string,
  now: Date = new Date(),
  prefs?: NotificationFilter,
): Promise<AppNotification[]> {
  const [orders, announcements, reward] = await Promise.all([
    customerOrdersByEmail(email),
    listActiveAppAnnouncements(),
    resolveReward(email),
  ]);
  return buildNotifications({
    orders,
    announcements,
    rewardsReady: reward.rewardsReady,
    rewardAt: reward.readyAt,
    now,
    prefs,
  });
}
