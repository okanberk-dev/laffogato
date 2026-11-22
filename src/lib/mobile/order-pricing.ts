// Pure pricing rules of an app order (docs/API-MOBILE.md §3). NO "server-only",
// NO database - unit-tested directly. The store calls these with rows it has
// already fetched; nothing here ever trusts a price from the request.

import type { OrderFulfillment, OrderKind } from "@/lib/admin/order-channel";
import {
  computeOrderTotals,
  type CheckoutConfig,
  type OrderTotals,
} from "@/lib/utils/commerce";

import type { MobileAppConfig } from "./app-config";
import {
  DEFAULT_LINE_OPTIONS,
  DEFAULT_OPTION_PRICES,
  isCustomizableCategory,
  resolveOptionPricing,
  UnknownOptionError,
  type LineOptions,
  type OptionPrices,
  type OrderItemSize,
} from "./customization";

/** The slice of a `menu_items` row a cafe line is priced from. */
export interface CafePriceable {
  id: string;
  name: string;
  /** M price, or the only price when `priceMinorL` is 0. Minor units. */
  priceMinor: number;
  /** L price; 0 means the item has a single size. */
  priceMinorL: number;
  isActive: boolean;
  /**
   * The menu category. A dessert, snack or extra takes no options (W1-08);
   * absent means a drink, which is how a row without it was always priced.
   */
  categoryKey?: string;
}

export type CafeLinePrice =
  | {
      ok: true;
      unitPriceMinor: number;
      /** Normalised: "M" on a single-size item becomes "single". */
      size: OrderItemSize;
      /** "M · yulaf · +1 shot" - receipts and the panel show this. */
      detail: string;
      options: LineOptions;
    }
  | {
      ok: false;
      reason: "inactive" | "no_large_size" | "bad_size" | "bad_option";
      message: string;
    };

/**
 * Prices one cafe line: the size price from the menu row plus the option
 * surcharges from the customisation table, at the menu's option prices
 * (S8; `optionPrices`). `item.isActive` is "sold where the order is made"
 * (the table's branch, else Tuzla: the caller resolves it).
 *
 * A two-size item must be ordered as M or L; "single" on it is a stale cart,
 * not a guess we make for the customer. A single-size item ordered as "M"
 * is the same drink at the same price and is normalised, while "L" on it is
 * refused (contract: `size: "L"` needs `priceMinorL`, else 400).
 */
export function priceCafeLine(
  item: CafePriceable,
  size: OrderItemSize,
  options: Partial<LineOptions> | null | undefined,
  /** The paid options' prices from the menu (S8); the constant's by default. */
  optionPrices: OptionPrices = DEFAULT_OPTION_PRICES,
): CafeLinePrice {
  if (!item.isActive) {
    return {
      ok: false,
      reason: "inactive",
      message: `${item.name} şu an menüde değil.`,
    };
  }
  const hasLarge = item.priceMinorL > 0;
  let resolvedSize: OrderItemSize;
  let baseMinor: number;
  if (hasLarge) {
    if (size === "single") {
      return {
        ok: false,
        reason: "bad_size",
        message: `${item.name} için boy seç (M ya da L).`,
      };
    }
    resolvedSize = size;
    baseMinor = size === "L" ? item.priceMinorL : item.priceMinor;
  } else {
    if (size === "L") {
      return {
        ok: false,
        reason: "no_large_size",
        message: `${item.name} için büyük boy yok.`,
      };
    }
    resolvedSize = "single";
    baseMinor = item.priceMinor;
  }

  // Enforced here as well as in the app: options sent for a category that
  // takes none are IGNORED, not refused. The app never sends any (it draws no
  // customise screen for these), so this only meets a hand-made request or
  // an old basket - which then orders the plain item at its plain price
  // instead of being charged for oat milk on a cheesecake, or stopped by a
  // 400 the member could not fix from the basket.
  const effective = isCustomizableCategory(item.categoryKey)
    ? options
    : DEFAULT_LINE_OPTIONS;
  try {
    const priced = resolveOptionPricing(
      effective,
      resolvedSize,
      optionPrices,
    );
    const merged = withDefaults(effective);
    return {
      ok: true,
      unitPriceMinor: Math.max(0, baseMinor + priced.extraMinor),
      size: resolvedSize,
      detail: priced.detail,
      options: merged,
    };
  } catch (err) {
    if (err instanceof UnknownOptionError) {
      return { ok: false, reason: "bad_option", message: err.message };
    }
    throw err;
  }
}

function withDefaults(
  options: Partial<LineOptions> | null | undefined,
): LineOptions {
  return {
    milk: options?.milk ?? "normal",
    roast: options?.roast ?? "intense",
    sugar: options?.sugar ?? 0,
    syrup: options?.syrup ?? "none",
    extraShot: options?.extraShot ?? false,
    note: options?.note ?? "",
  };
}

/**
 * The operator's ordering switches (`settings."mobileApp".ordering`, edited
 * at /admin/mobil/ayarlar). Only the flags matter here; the ETA window is
 * display copy the app reads from bootstrap.
 */
export type OrderingRules = Pick<
  MobileAppConfig["ordering"],
  "cafeEnabled" | "deliveryEnabled" | "pickupEnabled" | "closedMessage"
> & {
  /** Table service (15 Eki 2026). Absent reads as on, its default. */
  tableEnabled?: boolean;
};

/** Message the app shows when a chosen fulfillment is switched off. */
export const FULFILLMENT_UNAVAILABLE_MESSAGE =
  "Bu teslimat seçeneği şu an kapalı.";

/**
 * Why an ordering rule refused the basket. Same shape the order use-cases
 * hand the route (`{ status, code, message }`), so the refusal travels
 * unchanged into the `{ error, message }` body.
 */
export interface OrderingRefusal {
  status: 409 | 400;
  code: "ordering_closed" | "fulfillment_unavailable";
  message: string;
}

/**
 * Shape rule: cafe orders are picked up, brought by the courier or served at
 * a table; shop goods ship. A basket that mixes the two cannot be fulfilled
 * one way, so the schema refuses it before this is asked.
 */
function fulfillmentFitsKind(
  kind: OrderKind,
  fulfillment: OrderFulfillment,
): boolean {
  return kind === "cafe"
    ? fulfillment === "pickup" ||
        fulfillment === "delivery" ||
        fulfillment === "table"
    : fulfillment === "shipping";
}

/**
 * The operator's switches, applied to a basket that already fits its kind.
 *
 * A cafe basket while cafe ordering is off - or while both ways of getting a
 * cafe order to the customer are off, which is the same thing said twice -
 * is a 409 `ordering_closed` carrying the operator's own copy. A single
 * switched-off fulfillment is a 400 `fulfillment_unavailable`: the basket is
 * fine, the customer only has to pick the other option. Shop goods ship and
 * are not governed by these switches (the shop has `isShopOpen`).
 *
 * `null` means the rules let the order through.
 */
export function orderingRefusal(
  kind: OrderKind,
  fulfillment: OrderFulfillment,
  ordering: OrderingRules,
): OrderingRefusal | null {
  if (kind !== "cafe") return null;
  // A table order is placed by someone already sitting in the köşk: the
  // courier and gel-al switches say nothing about it, so "both of them off"
  // closes ordering for the other two only. `cafeEnabled` stays the master
  // switch for all three.
  if (fulfillment === "table") {
    if (!ordering.cafeEnabled) {
      return {
        status: 409,
        code: "ordering_closed",
        message: ordering.closedMessage,
      };
    }
    if (ordering.tableEnabled === false) {
      return {
        status: 400,
        code: "fulfillment_unavailable",
        message: FULFILLMENT_UNAVAILABLE_MESSAGE,
      };
    }
    return null;
  }
  const closed =
    !ordering.cafeEnabled ||
    (!ordering.deliveryEnabled && !ordering.pickupEnabled);
  if (closed) {
    return {
      status: 409,
      code: "ordering_closed",
      message: ordering.closedMessage,
    };
  }
  const unavailable =
    (fulfillment === "delivery" && !ordering.deliveryEnabled) ||
    (fulfillment === "pickup" && !ordering.pickupEnabled);
  if (unavailable) {
    return {
      status: 400,
      code: "fulfillment_unavailable",
      message: FULFILLMENT_UNAVAILABLE_MESSAGE,
    };
  }
  return null;
}

/**
 * Whether `fulfillment` is allowed for a `kind` of order. Without `ordering`
 * this is the shape rule alone (the wire schema and the store ask it that
 * way - a wrong shape is a bad request, not a closed shop); with it the
 * operator's switches apply too. The status and code behind a `false` come
 * from `orderingRefusal`.
 */
export function fulfillmentAllowed(
  kind: OrderKind,
  fulfillment: OrderFulfillment,
  ordering?: OrderingRules,
): boolean {
  if (!fulfillmentFitsKind(kind, fulfillment)) return false;
  return ordering
    ? orderingRefusal(kind, fulfillment, ordering) === null
    : true;
}

/**
 * How shipping is charged on an order. `settings` is the shop's flat fee and
 * free-shipping threshold (the web checkout); `fixed` is a flat courier fee
 * with no threshold, or 0 for a pickup.
 */
export type ShippingMode =
  | { mode: "settings" }
  | { mode: "fixed"; minor: number };

export function shippingModeFor(
  fulfillment: OrderFulfillment,
  settings: { courierFeeMinor: number },
): ShippingMode {
  switch (fulfillment) {
    case "pickup":
    case "table":
      return { mode: "fixed", minor: 0 };
    case "delivery":
      return { mode: "fixed", minor: Math.max(0, settings.courierFeeMinor) };
    default:
      return { mode: "settings" };
  }
}

/**
 * Totals with the chosen shipping mode. A fixed fee reuses the shop's
 * arithmetic with the threshold switched off, so the rounding, the discount
 * clamp and the VAT split stay identical between a web and an app order.
 */
export function computeTotalsWithShipping(
  subtotalMinor: number,
  discountMinor: number,
  shipping: ShippingMode,
  cfg: CheckoutConfig,
): OrderTotals {
  if (shipping.mode === "settings") {
    return computeOrderTotals(subtotalMinor, discountMinor, cfg);
  }
  // A fixed fee (courier) is owed whatever the coupon did to the subtotal:
  // computeOrderTotals waives shipping on a zero net, which is right for the
  // shop's free-shipping rule and wrong for a rider who still has to ride.
  const fee = Math.max(0, Math.round(shipping.minor));
  const base = computeOrderTotals(subtotalMinor, discountMinor, {
    ...cfg,
    shippingFlatMinor: 0,
    shippingFreeThresholdMinor: 0,
  });
  return {
    ...base,
    shippingMinor: fee,
    totalMinor: base.totalMinor + fee,
    freeShippingRemainingMinor: 0,
  };
}

/** How far ahead a scheduled order may be placed. */
export const SCHEDULE_MAX_DAYS = 7;
/** Tolerance for a "now" that the phone's clock put slightly in the past. */
export const SCHEDULE_PAST_TOLERANCE_MS = 5 * 60_000;

/**
 * Normalises `scheduledFor`: "" for as-soon-as-possible, otherwise a
 * well-formed ISO instant within the ordering window.
 */
export function normalizeScheduledFor(
  raw: string | null | undefined,
  now: Date,
): { ok: true; value: string } | { ok: false; message: string } {
  if (!raw) return { ok: true, value: "" };
  const t = Date.parse(raw);
  if (!Number.isFinite(t)) {
    return { ok: false, message: "Planlanan saat geçersiz." };
  }
  if (t < now.getTime() - SCHEDULE_PAST_TOLERANCE_MS) {
    return { ok: false, message: "Planlanan saat geçmişte kalmış." };
  }
  if (t > now.getTime() + SCHEDULE_MAX_DAYS * 24 * 60 * 60_000) {
    return {
      ok: false,
      message: `En fazla ${SCHEDULE_MAX_DAYS} gün sonrasına planlayabilirsin.`,
    };
  }
  return { ok: true, value: new Date(t).toISOString() };
}
