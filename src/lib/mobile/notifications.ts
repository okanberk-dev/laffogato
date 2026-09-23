import "server-only";

import {
  customerOrdersByEmail,
  listActiveAppAnnouncements,
  orderFulfillment,
  type AdminAppAnnouncement,
  type AdminOrder,
  type AdminOrderStatus,
} from "@/lib/admin/store";

import {
  formatReservationDate,
  formatReservationTime,
  listReservationDecisions,
  type KaraokeReservation,
} from "./karaoke";
import { listMilestoneGrants, type MilestoneGrant } from "./milestones";
import { MILESTONE_TTL_DAYS } from "./milestones-core";

/**
 * Notifications for the app's inbox (docs/API-MOBILE.md §8).
 *
 * Nothing is stored: the list is derived on every call from the member's
 * recent orders, the announcements currently on the home screen, whether
 * a loyalty reward is waiting, the karaoke bookings the staff confirmed or
 * cancelled, and the milestone gifts the server gave. The app keeps "read"
 * state on the device, keyed by `id`, so ids must be stable across calls -
 * they are built from the order id and the stage reached, never from a
 * timestamp or a position.
 */

/**
 * `reservation` is additive (23 Eyl 2026). Builds that predate it map a kind
 * they do not know to `announcement` (lafmobil `src/data/http.ts`), so the
 * row still shows there, only with the announcement glyph.
 */
export type NotificationKind =
  | "order"
  | "reward"
  | "campaign"
  | "announcement"
  | "reservation";

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

/**
 * How many of the member's orders the inbox reads.
 *
 * The window above is 30 days and the read is `orderNo desc`, so the newest
 * page always contains every order that window can possibly keep - fifty is
 * far more than a month of one café's orders from one member. Without it the
 * inbox read the member's ENTIRE history (items jsonb, refund ledger and
 * consent evidence included) on every poll and threw all but the last month
 * away in JavaScript.
 */
export const NOTIFICATION_ORDER_LIMIT = 50;

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
    if (stage === "shipped") return "Hazır - gel al";
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
        : "Damgaların doldu - ücretsiz içeceğin seni bekliyor. Kasada kartını göster.",
    at,
    orderId: null,
  };
}

type ReservationLike = Pick<
  KaraokeReservation,
  "id" | "date" | "startHour" | "hours" | "guests" | "status" | "updatedAt"
>;

/**
 * One record per karaoke booking the staff decided on inside the window:
 * confirmed ("your hour is held") or cancelled. `at` is the booking's
 * `updatedAt`, which only a status change writes - the confirm or cancel
 * instant, the same on every call. A booking confirmed and later cancelled
 * shows the cancellation alone under a new id, so it arrives unread: the
 * member's plan changed. `requested` is silent; the member just made it.
 *
 * The wording is the confirmation and cancellation mails' own
 * (`src/lib/email/text.ts`), in the app's "sen".
 */
export function deriveReservationNotifications(
  reservations: readonly ReservationLike[],
  now: Date,
): AppNotification[] {
  const out: AppNotification[] = [];
  for (const r of reservations) {
    if (r.status !== "confirmed" && r.status !== "cancelled") continue;
    if (!withinWindow(r.updatedAt, now)) continue;
    const when = `${formatReservationDate(r.date)} · ${formatReservationTime(r.startHour, r.hours)}`;
    out.push(
      r.status === "confirmed"
        ? {
            id: `karaoke-${r.id}-confirmed`,
            kind: "reservation",
            title: "Karaoke saatin ayrıldı",
            body: `${when}, ${r.guests} kişi. Girişte ${r.id} kodunu söylemen yeterli.`,
            at: r.updatedAt,
            orderId: null,
          }
        : {
            id: `karaoke-${r.id}-cancelled`,
            kind: "reservation",
            title: "Karaoke rezervasyonun iptal edildi",
            body: `${when} rezervasyonun iptal edildi; oda serbest bırakıldı.`,
            at: r.updatedAt,
            orderId: null,
          },
    );
  }
  return out;
}

type MilestoneLike = Pick<
  MilestoneGrant,
  "milestone" | "couponId" | "itemName" | "createdAt"
>;

/**
 * One `reward` record per milestone gift given inside the window (karar
 * 175). Only a grant whose coupon was minted counts: a row without
 * `couponId` is a claim in flight or one withdrawn after a failure, and
 * telling the member about it would announce a coupon that is not there.
 * `at` is the grant's own instant; the id is the milestone, one per member.
 * Past tense on purpose: the record says what happened that day, and stays
 * true after the coupon is spent.
 */
export function deriveMilestoneNotifications(
  grants: readonly MilestoneLike[],
  now: Date,
): AppNotification[] {
  const out: AppNotification[] = [];
  for (const g of grants) {
    if (!g.couponId || !g.itemName) continue;
    if (!withinWindow(g.createdAt, now)) continue;
    out.push({
      id: `milestone-${g.milestone}`,
      kind: "reward",
      title: `${g.milestone} kahve oldu!`,
      body: `Teşekkürümüz: ${g.itemName} kuponlarına eklendi, ${MILESTONE_TTL_DAYS} gün geçerli.`,
      at: g.createdAt,
      orderId: null,
    });
  }
  return out;
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
  /** Karaoke bookings the staff decided on (§8, additive). */
  reservations?: readonly ReservationLike[];
  /** Milestone gifts given (§8, additive). */
  milestones?: readonly MilestoneLike[];
  rewardsReady: number;
  /**
   * When the waiting reward became ready. Must be the same instant on every
   * call - the app decides "unread" by comparing it with the moment the
   * member last opened the inbox, so `now` here would make it unread forever.
   */
  rewardAt?: string | null;
  now: Date;
  prefs?: NotificationFilter;
}): AppNotification[] {
  const items = [
    ...deriveOrderNotifications(input.orders, input.now),
    ...deriveAnnouncementNotifications(input.announcements),
    ...deriveReservationNotifications(input.reservations ?? [], input.now),
    ...deriveMilestoneNotifications(input.milestones ?? [], input.now),
  ];
  const reward = rewardNotification(
    input.rewardsReady,
    input.rewardAt || input.now.toISOString(),
  );
  if (reward) items.push(reward);
  // "Neyi duymak istediğine sen karar ver" is the promise under the switches:
  // marketing off means no campaign rows. Order, reward and reservation items
  // stay - they are the member's own transactions, not a commercial message.
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

/**
 * A source the inbox can live without. The karaoke book and the milestone
 * table are read beside the orders; if one of them fails (a deploy ahead of
 * its migration, a bad row) the inbox loses those rows, not the whole list.
 * A database that cannot be reached at all still fails the call through the
 * order read, which is not wrapped.
 */
async function optional<T>(label: string, read: () => Promise<T[]>): Promise<T[]> {
  try {
    return await read();
  } catch (err) {
    console.error(
      `[notifications] ${label} unavailable: ${err instanceof Error ? err.message : String(err)}`,
    );
    return [];
  }
}

/**
 * GET /notifications for one member. Throws on a database failure.
 *
 * `withOrders: false` leaves out every row matched by e-mail alone - the
 * orders, the karaoke bookings and the milestone gifts - for a member whose
 * address is not verified yet (see `listAppOrders`). Such a member can have
 * none of them legitimately: ordering, booking and the till QR all need a
 * verified address.
 */
export async function deriveNotifications(
  email: string,
  now: Date = new Date(),
  prefs?: NotificationFilter,
  { withOrders = true }: { withOrders?: boolean } = {},
): Promise<AppNotification[]> {
  const since = new Date(
    now.getTime() - NOTIFICATION_WINDOW_DAYS * 86_400_000,
  ).toISOString();
  const [orders, announcements, reward, reservations, milestones] =
    await Promise.all([
      withOrders
        ? customerOrdersByEmail(email, NOTIFICATION_ORDER_LIMIT)
        : Promise.resolve([]),
      listActiveAppAnnouncements(),
      resolveReward(email),
      withOrders
        ? optional("karaoke", () => listReservationDecisions(email, since))
        : Promise.resolve([]),
      withOrders
        ? optional("milestones", () => listMilestoneGrants(email))
        : Promise.resolve([]),
    ]);
  return buildNotifications({
    orders,
    announcements,
    reservations,
    milestones,
    rewardsReady: reward.rewardsReady,
    rewardAt: reward.readyAt,
    now,
    prefs,
  });
}
