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

/** One tile at the top of the dashboard. */
export interface DashboardTile {
  key: "open" | "attention" | "soldOut" | "revenue";
  label: string;
  value: string;
  /** Only when it says something; "Acil dolum" stood under a 0. */
  hint?: string;
  /** The list the figure counts; absent when the role may not open it. */
  href?: string;
  /** Set when the figure asks for a person. */
  tone?: AdminTone;
  /** A money figure: drawn in tabular digits and never cut short. */
  money?: boolean;
}

export interface DashboardTileInput {
  openOrderCount: number;
  attentionOrderCount: number;
  outOfStockCount: number;
  /**
   * Today's and the last 14 days' net revenue (the report's buckets), or
   * null when the role may not see revenue: the page does not read it then.
   */
  revenue: { todayMinor: number; periodMinor: number } | null;
}

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
 * while the role matrix hid it from them everywhere else.
 */
export function dashboardTiles(
  input: DashboardTileInput,
  role: AdminRole,
): DashboardTile[] {
  const tiles: DashboardTile[] = [];
  if (canAccess("orders", role)) {
    tiles.push({
      key: "open",
      label: "Açık sipariş",
      value: String(input.openOrderCount),
      hint: input.openOrderCount > 0 ? "Henüz bitmemiş" : undefined,
      href: "/admin/siparisler?durum=acik",
    });
    tiles.push({
      key: "attention",
      label: "Dikkat isteyen",
      value: String(input.attentionOrderCount),
      hint:
        input.attentionOrderCount > 0 ? "Ödeme ya da iade kontrolü" : undefined,
      href: "/admin/siparisler?dikkat=1",
      tone: input.attentionOrderCount > 0 ? "danger" : undefined,
    });
  }
  if (canAccess("products", role) || canAccess("stock", role)) {
    tiles.push({
      key: "soldOut",
      label: "Stokta yok",
      value: String(input.outOfStockCount),
      hint: input.outOfStockCount > 0 ? "Dolum gerekiyor" : undefined,
      href: stockLinks(role).soldOut ?? undefined,
      tone: input.outOfStockCount > 0 ? "warning" : undefined,
    });
  }
  if (input.revenue && canAccess("reports", role)) {
    tiles.push({
      key: "revenue",
      label: "Bugün net ciro",
      value: formatTRYMinor(input.revenue.todayMinor),
      hint: `Son 14 gün ${formatTRYMinor(input.revenue.periodMinor)}`,
      href: "/admin/raporlar",
      money: true,
    });
  }
  return tiles;
}
