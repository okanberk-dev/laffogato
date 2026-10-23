// Client-safe (no server-only): what the dashboard says and where its tiles
// lead, per role. Pure, so the role rules and the köşk's clock are tested
// without rendering the page.

import { formatTRYMinor } from "@/lib/utils/commerce";

import { canAccess, type AdminRole } from "./roles";
import type { AdminTone } from "./tone";

/** The köşk's clock: the panel's figures and its header read Tuzla time. */
const VENUE_TIME_ZONE = "Europe/Istanbul";

/**
 * The hour in Tuzla. The dashboard used `new Date().getHours()`, which on
 * Vercel is UTC: "İyi geceler" until 09:00 and "Günaydın" until 15:00
 * (admin audit SHE-15, KAR-M02).
 */
function istanbulHour(now: Date): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: VENUE_TIME_ZONE,
    hour: "numeric",
    hourCycle: "h23",
  }).format(now);
  return parseInt(hour, 10) || 0;
}

/**
 * The greeting, without a name (decision D35: the session carries the
 * e-mail only, and "İyi günler, info." read like a typo).
 */
export function dashboardGreeting(now: Date): string {
  const hour = istanbulHour(now);
  if (hour < 6) return "İyi geceler";
  if (hour < 12) return "Günaydın";
  if (hour < 18) return "İyi günler";
  return "İyi akşamlar";
}

/**
 * "18 Ekim Pazar" in Tuzla. Without the time zone, from midnight to 03:00
 * the header named yesterday above a karaoke card listing today.
 */
export function dashboardDateLabel(now: Date): string {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: VENUE_TIME_ZONE,
    day: "numeric",
    month: "long",
    weekday: "long",
  }).format(now);
}

/** A change against the figure a tile is read against. */
export interface DashboardDelta {
  /** What the pill says: "%32", "+2". */
  label: string;
  direction: "up" | "down";
  /**
   * Whether the change is good news: green when it is, red when not. More
   * money is; more refunds are not.
   */
  good: boolean;
  /** The pill's words for a screen reader, after the label: "artış". */
  spoken: string;
}

/**
 * One cell of the dashboard's KPI strip (Innex, 22 Eki 2026): a figure
 * and, under it, what to read it against. No figure stands alone: today's
 * money against the same weekday last week up to the same hour, the open
 * orders split by where they go, the empty shelves beside the ones running
 * low.
 */
export interface DashboardTile {
  key: "revenue" | "orders" | "open" | "attention" | "soldOut";
  label: string;
  value: string;
  /** The line under the figure: a fact, never a call to act under a 0. */
  reference: string;
  /** The change against `reference`'s figure, when one can be measured. */
  delta?: DashboardDelta;
  /** The list the figure counts; absent when the role may not open it. */
  href?: string;
  /** Set when the figure asks for a person. */
  tone?: AdminTone;
  /** A money figure: drawn in tabular digits and never cut short. */
  money?: boolean;
}

export interface DashboardTileInput {
  openOrderCount: number;
  /** The open orders by kind: the bar's and the shop's. */
  openByKind: { cafe: number; shop: number };
  /** When the café order that has waited longest was paid; null: none. */
  oldestCafeWaitingAt: string | null;
  attentionOrderCount: number;
  outOfStockCount: number;
  /** Active products at or under their line (the "Azalan stok" list). */
  lowStockCount: number;
  /**
   * Today's net revenue and orders so far, and the same weekday last week
   * up to this hour (`dashboardRevenue`), or null when the role may not see
   * revenue: the page does not read it then.
   */
  revenue: {
    todayMinor: number;
    todayOrders: number;
    lastWeekMinor: number;
    lastWeekOrders: number;
  } | null;
  now: Date;
}

/** "cuma": the weekday of `now` in Tuzla, as "geçen cuma" says it. */
export function venueWeekday(now: Date): string {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: VENUE_TIME_ZONE,
    weekday: "long",
  })
    .format(now)
    .toLocaleLowerCase("tr-TR");
}

/** "2026-10-23": the köşk's calendar day, as the list's date filter reads it. */
export function venueDay(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: VENUE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** "12 dk", "1 sa 5 dk": how long since `since`, rounded down to minutes. */
export function waitedFor(since: string, now: Date): string | null {
  const ms = now.getTime() - Date.parse(since);
  if (!Number.isFinite(ms)) return null;
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  if (minutes < 60) return `${minutes} dk`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours} sa ${rest} dk` : `${hours} sa`;
}

/**
 * The change from `before` to `now` as the pill shows it: a percentage
 * for money (none against a 0: a rise from nothing has no size), a count
 * for orders. No pill when nothing changed.
 */
export function dashboardDelta(
  current: number,
  before: number,
  as: "percent" | "count",
  /** Which way is good news; "down" for refunds. */
  better: "up" | "down" = "up",
): DashboardDelta | undefined {
  if (current === before) return undefined;
  const direction = current > before ? "up" : "down";
  const good = direction === better;
  const spoken = direction === "up" ? "artış" : "düşüş";
  if (as === "count") {
    const diff = current - before;
    return {
      label: diff > 0 ? `+${diff}` : `−${Math.abs(diff)}`,
      direction,
      good,
      spoken,
    };
  }
  if (before <= 0) return undefined;
  const pct = Math.round((Math.abs(current - before) / before) * 100);
  return pct === 0 ? undefined : { label: `%${pct}`, direction, good, spoken };
}

/** A late café order: paid this long ago and still not handed over. */
export const CAFE_WAIT_WARN_MINUTES = 15;

/**
 * Where the stock figures lead, by role: the product's own page for the
 * roles that edit products, the stock page (which corrects stock) for
 * staff, who may move stock but not open Ürünler. Null: no link.
 */
export function stockLinks(role: AdminRole): {
  product: (id: string) => string | null;
  /** Every product, the emptiest first. */
  all: string | null;
  /** The sold-out ones. */
  soldOut: string | null;
} {
  if (canAccess("products", role)) {
    return {
      product: (id) => `/admin/urunler/${encodeURIComponent(id)}`,
      all: "/admin/urunler?sort=stock_asc",
      soldOut: "/admin/urunler?status=out_of_stock",
    };
  }
  if (canAccess("stock", role)) {
    return {
      product: (id) =>
        `/admin/stok-hareketleri?productId=${encodeURIComponent(id)}`,
      all: "/admin/stok-hareketleri",
      soldOut: "/admin/stok-hareketleri",
    };
  }
  return { product: () => null, all: null, soldOut: null };
}

/**
 * The tiles a role sees, each leading to the list it counts. Revenue only
 * for the roles that may open Raporlar (`reports`, owner and manager;
 * decision D1, admin audit SHE-14): staff saw the shop's net revenue here
 * while the role matrix hid it from them everywhere else. The money comes
 * first for those who may see it; a shift's own work after it.
 */
export function dashboardTiles(
  input: DashboardTileInput,
  role: AdminRole,
): DashboardTile[] {
  const tiles: DashboardTile[] = [];
  const weekday = venueWeekday(input.now);
  if (input.revenue && canAccess("reports", role)) {
    const r = input.revenue;
    tiles.push({
      key: "revenue",
      label: "Bugün net ciro",
      value: formatTRYMinor(r.todayMinor),
      reference: `Geçen ${weekday} bu saate kadar ${formatTRYMinor(r.lastWeekMinor)}`,
      delta: dashboardDelta(r.todayMinor, r.lastWeekMinor, "percent"),
      href: "/admin/raporlar",
      money: true,
    });
    if (canAccess("orders", role)) {
      const day = venueDay(input.now);
      tiles.push({
        key: "orders",
        label: "Bugünkü sipariş",
        value: String(r.todayOrders),
        reference: `Geçen ${weekday} bu saate kadar ${r.lastWeekOrders}`,
        delta: dashboardDelta(r.todayOrders, r.lastWeekOrders, "count"),
        href: `/admin/siparisler?odeme=odendi&bas=${day}&bit=${day}`,
      });
    }
  }
  if (canAccess("orders", role)) {
    const { cafe, shop } = input.openByKind;
    const waited = input.oldestCafeWaitingAt
      ? waitedFor(input.oldestCafeWaitingAt, input.now)
      : null;
    const late =
      input.oldestCafeWaitingAt !== null &&
      input.now.getTime() - Date.parse(input.oldestCafeWaitingAt) >=
        CAFE_WAIT_WARN_MINUTES * 60_000;
    tiles.push({
      key: "open",
      label: "Açık sipariş",
      value: String(input.openOrderCount),
      reference:
        input.openOrderCount === 0
          ? "Bekleyen sipariş yok"
          : `Kafe ${cafe} · Mağaza ${shop}${waited ? ` · barda en eskisi ${waited}` : ""}`,
      href: "/admin/siparisler?durum=acik",
      tone: late ? "warning" : undefined,
    });
    tiles.push({
      key: "attention",
      label: "Dikkat isteyen",
      value: String(input.attentionOrderCount),
      reference:
        input.attentionOrderCount > 0
          ? "Ödeme ya da iade kontrolü"
          : "Kontrol bekleyen sipariş yok",
      href: "/admin/siparisler?dikkat=1",
      tone: input.attentionOrderCount > 0 ? "danger" : undefined,
    });
  }
  if (canAccess("products", role) || canAccess("stock", role)) {
    tiles.push({
      key: "soldOut",
      label: "Stokta yok",
      value: String(input.outOfStockCount),
      reference:
        input.lowStockCount > 0
          ? `Azalan stokta ${input.lowStockCount} ürün`
          : "Azalan ürün yok",
      href: stockLinks(role).soldOut ?? undefined,
      tone: input.outOfStockCount > 0 ? "warning" : undefined,
    });
  }
  return tiles;
}

/** A booking as the room's occupancy reads it. */
export interface OccupancySlot {
  startHour: number;
  hours: number;
  status: string;
}

/** How full the karaoke room is on a day. */
export interface KaraokeOccupancy {
  /** Hours held by bookings not cancelled, inside the opening hours. */
  hours: number;
  /** The room's opening hours that day. */
  capacity: number;
  /** hours / capacity, whole percent; 0 for a day the room is shut. */
  pct: number;
}

/**
 * The share of the karaoke room's hours a day's bookings hold (Innex's
 * "Karaoke doluluğu %70 · geçen cuma %55", recipe §3.5): every booking not
 * cancelled holds its hours (an unpaid request too, the hour is not on
 * sale), counted inside the room's opening hours only, over those hours.
 */
export function karaokeOccupancy(
  rows: readonly OccupancySlot[],
  rules: { firstHour: number; closeHour: number },
): KaraokeOccupancy {
  const capacity = Math.max(0, rules.closeHour - rules.firstHour);
  let hours = 0;
  for (const r of rows) {
    if (r.status === "cancelled") continue;
    const from = Math.max(rules.firstHour, r.startHour);
    const to = Math.min(rules.closeHour, r.startHour + r.hours);
    hours += Math.max(0, to - from);
  }
  hours = Math.min(hours, capacity);
  return {
    hours,
    capacity,
    pct: capacity > 0 ? Math.round((hours / capacity) * 100) : 0,
  };
}
