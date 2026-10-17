import "server-only";

import { cache } from "react";
import { after } from "next/server";
import { isHandedOver, isStaleShipmentEvent } from "@/lib/mobile/geliver";

import type { DbError } from "@/lib/db";
import type { AnyOfCondition } from "@/lib/db/sql";

import {
  APP_ANNOUNCEMENT_KINDS,
  APP_POST_KINDS,
  APP_SLIDE_TONES,
  isAppSlideRoute,
  type AppAnnouncementKind,
  type AppPostKind,
  type AppSlideTone,
} from "./app-content-schema";

import { getDb, TABLES } from "@/lib/db";
import {
  memoizeUntilRejected,
  publicRead,
  raiseDbError,
} from "@/lib/db/health";
import { nextSeq } from "@/lib/db/counters";
import { deriveSku } from "@/lib/admin/sku";
import {
  applyCustomerCoupon,
  couponAllowedForKind,
  redeemCustomerCoupon,
  releaseCustomerCoupon,
} from "@/lib/customer/coupons";
import {
  cancelNoticeDue,
  notifyOrderCancelled,
  notifyOrderPaid,
  notifyOrderRefunded,
  notifyOrderShipped,
  type OrderNoticeOutcome,
} from "@/lib/email/order-notices";
import { normalizeNotifyRoles } from "@/lib/email/staff-order-notice-core";
import {
  DEFAULT_MOBILE_APP_CONFIG,
  normalizeMobileAppConfig,
  type MobileAppConfig,
} from "@/lib/mobile/app-config";
import type { LineOptions } from "@/lib/mobile/customization";
import {
  computeTotalsWithShipping,
  fulfillmentAllowed,
  normalizeScheduledFor,
  priceCafeLine,
  shippingModeFor,
  type ShippingMode,
} from "@/lib/mobile/order-pricing";
import type { CheckoutConfig } from "@/lib/utils/commerce";
import { priceLabel } from "@/lib/utils/format";
import {
  LEGAL_TAX_RATES,
  menuItemTaxRate,
  normalizeTaxRates,
  productTaxRate,
  type TaxRates,
} from "@/lib/utils/kdv";
import {
  WALLET_PROVIDER,
  walletProviderRef,
  walletSpendFor,
} from "@/lib/mobile/wallet";
import { imageVersion } from "./image-bytes";
import {
  heroImagePath,
  menuImagePath,
  productImagePath,
  servedImage,
} from "./image-url";
import {
  MENU as SEED_MENU,
  PRODUCTS as SEED_PRODUCTS,
  PRESS as SEED_PRESS,
  STORY as SEED_STORY,
  type MenuCategory as DesignMenuCategory,
  type Product as DesignProduct,
} from "@/components/laffogato/data";

import type {
  PaymentProvider,
  ReturnConfirmation,
} from "@/lib/payment/provider";
import type { WeeklyHours } from "./days";
import type { AdminRole } from "./roles";
import {
  orderChannel,
  orderKind,
  type OrderChannel,
  type OrderFulfillment,
  type OrderKind,
} from "./order-channel";
import {
  ITEM_EDITABLE_ORDER_STATUSES,
  MANUAL_PROVIDER_PREFIX,
  isManualProvider,
  refundCapMinor,
  refundDestinationFor,
  type ManualPaymentMethod,
  type OrderAttention,
  type RefundDestination,
} from "./order-actions";
import {
  manualShippingMode,
  type ManualFulfillment,
} from "./manual-order-schema";
import { OPEN_ORDER_STATUSES, type OrderListQuery } from "./order-filters";
import { ORDER_STATUS_LABELS } from "./order-ui";
import { ORDER_DETAILS_MESSAGES, emailMovesLedger } from "./order-details";
import { earnsStamp } from "@/lib/mobile/loyalty-core";

/**
 * Veri katmanı - yönetilen bir Postgres üzerinden çalışır (bugün Neon).
 * Sağlayıcıya özel bağımlılık yok; bkz. src/lib/db/index.ts.
 *
 * Public API'lerin tamamı async ve mevcut admin sayfalarıyla uyumlu kalır.
 * Tablo boşsa SEED verisi otomatik yüklenir (idempotent - yalnızca
 * count === 0 ise tetiklenir; insert'ler upsert/ignoreDuplicates ile
 * yarış-güvenli). İç-içe alanlar (variants, items, refunds, ...) JSONB
 * kolonlarda tutulur; tarih alanları ISO-8601 metni olarak saklanır.
 */

/**
 * Whether the seed writes the two demo orders.
 *
 * Off everywhere by default. Set `SEED_DEMO_ORDERS=1` in a local `.env.local`
 * when you want the admin panel to have something to look at; a real shop's
 * first day should start from zero, not from two invented ₺740 orders that
 * count as revenue and two invented customers in the CRM.
 */
const SEED_DEMO_ORDERS = process.env.SEED_DEMO_ORDERS === "1";

export type ShopCategoryId = "beans" | "gift" | "gear" | "merch" | "pantry";

export interface AdminProductVariant {
  id: string;
  name: string;
  /** Delta on top of the parent product's priceMinor. Can be negative. */
  priceDeltaMinor: number;
  stock: number;
  sku: string;
  isActive: boolean;
}

/** Where a row's `backdrop` came from: the photo (recomputed on upload) or the operator. */
export type BackdropSource = "auto" | "manual";

/**
 * The scene columns `menu_items` and `products` share
 * (`db/migrations/20260924001000_backdrop_fields.sql`, glass round). Raw
 * column values: `backdrop` and `vessel` are free text in the table, and the
 * mobile mapper publishes only the keys `src/lib/backdrop/families.ts` knows.
 * On `products` they describe `images[0]`.
 */
export interface BackdropColumns {
  /** A product family key ("caramel"), or null: no pick, the app falls back to hue. */
  backdrop: string | null;
  backdropSource: BackdropSource;
  /** The body colour the automatic pick read (#RRGGBB), for the panel swatch; null = none. */
  backdropHex: string | null;
  /** The stored photo has transparency (a cutout). */
  photoCutout: boolean;
  /** The drawn vessel shape the operator chose ("tulip"), or null: from the category. */
  vessel: string | null;
}

/**
 * What a new row starts with, and what every row read before the migration
 * ran is taken to mean: no pick yet, nothing chosen by hand. The same values
 * as the columns' defaults.
 */
export const NO_BACKDROP: Readonly<BackdropColumns> = {
  backdrop: null,
  backdropSource: "auto",
  backdropHex: null,
  photoCutout: false,
  vessel: null,
};

export interface AdminProduct extends BackdropColumns {
  id: string;
  name: string;
  slug: string;
  sku: string;
  tag: string;
  /** Minor units (kuruş) - e.g. 32000 = 320,00 ₺ */
  priceMinor: number;
  /** Optional "was" price for striked-out display. 0 = none. */
  compareAtPriceMinor: number;
  /** Internal cost (margin calc); not shown to customers. */
  costMinor: number;
  desc: string;
  cat: ShopCategoryId;
  /** Hue token from PhotoSurface palette (cream, caramel, matcha, ...). */
  img: string;
  /** External image URLs (gallery). The customer card uses the first one
   *  if present, otherwise falls back to the SVG hue tile. */
  images: string[];
  /**
   * Item tags, same column shape and same vocabulary as `menu_items.tags`
   * (`signature` | `new` | `iced` | `nuts`). `nuts` is an ALLERGEN: it is
   * published by `GET /shop` and drawn by the app, and it is never hidden.
   */
  tags: string[];
  /**
   * The maker's name, as the operator writes it ("Sirena"). The app draws it
   * as the eyebrow above the product name on screen 13; '' draws nothing.
   * Published by `GET /shop` (contract §2, additive).
   */
  brand: string;
  /**
   * Tasting notes ("Kakao", "Kuru incir"), each a short chip on screen 13.
   * [] draws none, and the app prints the whole description as before.
   */
  notes: string[];
  stock: number;
  lowStockThreshold: number;
  /** Approximate shipping weight in grams. */
  weightGrams: number;
  /**
   * The product's own KDV rate (whole %), or null: its category's default
   * from `settings.taxRates`. Read through `productTaxRate()`. Optional
   * because a row written before the column existed has no key.
   */
  taxRatePct?: number | null;
  featured: boolean;
  isNew: boolean;
  isActive: boolean;
  seoTitle: string;
  seoDescription: string;
  variants: AdminProductVariant[];
  updatedAt: string;
}

export interface AdminCategory {
  id: string;
  slug: ShopCategoryId;
  label: string;
  icon: string;
  sortOrder: number;
}

export type AdminOrderItemStatus = "pending" | "ready" | "cancelled";

/** Cup size of a cafe line; "single" when the menu item has one size only. */
export type OrderItemSize = "M" | "L" | "single";

export interface AdminOrderItem {
  productName: string;
  qty: number;
  unitPriceMinor: number;
  status: AdminOrderItemStatus;
  /**
   * What was actually taken from stock. Needed to give it back when the order
   * is cancelled - matching on `productName` would be guesswork the moment a
   * product is renamed. Absent on orders placed before this was recorded and
   * on manual admin orders that reference no catalogue product; those lines
   * are skipped rather than restored to the wrong SKU.
   */
  productId?: string;
  variantId?: string;
  /**
   * Cafe lines (mobile app, docs/API-MOBILE.md §3). A cafe line references a
   * `menu_items` row instead of a product, carries the chosen size and the
   * customisation the price was computed from, and a human-readable `detail`
   * ("M · yulaf · +1 shot") for receipts and the panel. All absent on shop
   * lines and on every order placed before the app existed.
   */
  menuItemId?: string;
  size?: OrderItemSize;
  options?: Record<string, unknown>;
  detail?: string;
  /**
   * Units of this line already given back to stock (a refund's "stoğa geri
   * al", or the release when the order was cancelled). Written by the SQL
   * functions `release_order_inventory` / `restock_order_lines` only, so a
   * line is never credited twice. Absent = none.
   */
  restockedQty?: number;
  /**
   * The KDV rate (whole %) this line was sold at, copied from the product or
   * menu item when the order was placed, so a rate changed in the panel later
   * never rewrites an old receipt. Absent on orders placed before
   * 20261017150000_kdv_rates.sql: those show no KDV split.
   */
  taxRatePct?: number;
}

export type {
  OrderChannel,
  OrderFulfillment,
  OrderKind,
} from "./order-channel";

export type AdminOrderStatus =
  | "pending_payment"
  | "paid"
  | "preparing"
  | "shipped"
  | "completed"
  | "cancelled"
  | "refunded";

export interface AdminRefund {
  id: string;
  amountMinor: number;
  reason: string;
  createdAt: string;
  /**
   * Where the money went, as the server decided it (`orderMoney`): the card
   * through the POS, the member's wallet, or nowhere (a record only, the
   * cash was handed back at the counter). Absent on entries written before.
   */
  destination?: RefundDestination;
  /**
   * The refund modal's one-time token. `reserve_order_refund_once` refuses a
   * second entry with the same token, so a double submit cannot refund twice.
   */
  token?: string;
}

/**
 * Distance-selling consent evidence captured at checkout.
 *
 * Mesafeli Sözleşmeler Yönetmeliği requires proof that the consumer confirmed
 * the Ön Bilgilendirme Formu and the Mesafeli Satış Sözleşmesi before ordering,
 * kept on a durable medium. Acquiring banks ask for the same record during a
 * virtual-POS review and when a chargeback is disputed.
 */
export interface OrderLegalConsent {
  /** ISO-8601 instant the customer ticked the box. */
  acceptedAt: string;
  /** Slugs of the documents shown at that moment. */
  documents: string[];
  /** Revision label of those documents (their "son güncelleme" date). */
  version: string;
  /** Origin of the confirmation - evidence only. */
  ip?: string;
  userAgent?: string;
}

export interface AdminOrder {
  id: string;
  orderNo: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  internalNote: string;
  status: AdminOrderStatus;
  items: AdminOrderItem[];
  subtotalMinor: number;
  /** Positive minor units; 0 when no promo. */
  discountMinor: number;
  /** Promo code applied at checkout; empty when none. */
  promoCode: string;
  shippingMinor: number;
  totalMinor: number;
  refunds: AdminRefund[];
  createdAt: string;
  /**
   * ISO-8601 instant the order's stock and promo were given back, "" while
   * they are still held. Guards the release path against running twice.
   */
  stockReleasedAt?: string;
  /**
   * Consent evidence; `{}` on manual/admin orders and on orders placed before
   * the consent box existed.
   */
  legalConsent?: OrderLegalConsent | Record<string, never>;
  /** Fulfillment - recorded when the shop owner ships the order. */
  trackingNumber?: string;
  carrier?: string;
  shippedAt?: string;
  /**
   * The CARRIER's own milestone, written by the Geliver webhook
   * (`/api/webhooks/geliver`) - one of `preparing | shipped | in_transit |
   * delivered | returned | failed`, or "" while no webhook has ever fired.
   *
   * Separate from `status` on purpose: `status` is where the ORDER is in the
   * köşk's own machine (paid → preparing → shipped → completed) and the shop
   * owner drives it, while this is where the PARCEL is and the carrier drives
   * it. They disagree routinely - a parcel is `in_transit` for two days while
   * the order sits at `shipped` - and collapsing them would make one of the
   * two lie. The app reads this one (docs/API-MOBILE.md §3.1); until the
   * Geliver account exists it stays "" and the mapper derives what it can.
   */
  shipmentStatus?: string;
  /** The carrier's own tracking page, whole. Empty when it publishes none. */
  trackingUrl?: string;
  /** ISO-8601 instant the carrier last said anything. */
  shipmentUpdatedAt?: string;
  /**
   * Mobile app fields (docs/API-MOBILE.md §3). Every one is optional with a
   * database default describing a web shop order, so the existing order
   * machine keeps writing rows exactly as before and an old row reads as
   * `channel: "web", kind: "shop", fulfillment: "shipping"`. Read through
   * `orderChannel()` / `orderFulfillment()` rather than defaulting inline.
   */
  channel?: OrderChannel;
  kind?: OrderKind;
  fulfillment?: OrderFulfillment;
  /** ISO-8601 requested time; "" means as soon as possible. */
  scheduledFor?: string;
  /** Courier instructions ("Kapı kodu 4821"). */
  deliveryNote?: string;
  /** ISO-8601 instant the payment succeeded; "" while unpaid. */
  paidAt?: string;
  /**
   * ISO-8601 instants the order reached each later stage; "" until it does.
   * Stamped by `transitionOrder`, so the app's timeline and its notification
   * inbox can date a stage instead of falling back to `paidAt`. `shippedAt`
   * above is the same idea and predates them - the shipping form writes it too.
   */
  preparingAt?: string;
  completedAt?: string;
  /**
   * The app's id for the checkout attempt that produced this row; "" for web,
   * admin and older app orders. Unique per member while non-empty, which is
   * what makes a retried `POST /orders` return this order instead of a second.
   */
  clientOrderId?: string;
  /**
   * Table orders (`fulfillment: "table"`, docs/API-MOBILE.md §3): the code
   * and name of the table the order was placed at, copied when the order is
   * written - a table renamed or re-coded later does not rewrite the order.
   * "" on every other order. Read through `orderTable()`.
   */
  tableCode?: string;
  tableName?: string;
  /**
   * What needs a human on this order (`OrderAttention`), '' when nothing:
   * a payment the machine could not apply, or money still owed back after
   * a cancel. Drives the list's "Dikkat" filter and the order page's banner.
   */
  attention?: string;
  /** "manual" for an order typed into the panel, '' for every other. */
  source?: string;
}

export {
  ORDER_CHANNEL_LABELS,
  ORDER_FULFILLMENT_LABELS,
  ORDER_KIND_LABELS,
  orderChannel,
  orderFulfillment,
  orderKind,
  orderTable,
} from "./order-channel";

export type { DayOfWeek, OpeningHour, WeeklyHours } from "./days";
export { DAYS_OF_WEEK, DAY_LABELS } from "./days";

export interface AdminSettings {
  name: string;
  tagline: string;
  phone: string;
  email: string;
  address: string;
  /** Legacy single-line display string (kept for footer back-compat). */
  openingHours: string;
  isShopOpen: boolean;
  heroImageUrl: string;

  /** Per-day open/close used by Visit page + footer table. */
  weeklyHours: WeeklyHours;

  /**
   * KDV defaults per kind of sale (`settings."taxRates"`, jsonb), always
   * normalised: a key the row lacks reads as the legal default. A product or
   * menu item with its own rate overrides its default. Prices are
   * KDV-included; these only split the KDV out (src/lib/utils/kdv.ts). The
   * old single `"taxRatePct"` column is no longer read.
   */
  taxRates: TaxRates;

  /** Flat shipping fee in minor units; suppressed above threshold. */
  shippingFlatMinor: number;
  shippingFreeThresholdMinor: number;

  /** SEO defaults. */
  seoTitle: string;
  seoOgImageUrl: string;
  /**
   * When false, robots.txt disallows every crawler and the sitemap is served
   * empty. Page-level meta stays as-is: making it conditional would force a
   * settings read into the root layout and turn every static page dynamic.
   */
  seoIndexable: boolean;

  /** Operational notifications email. */
  notificationEmail: string;

  /**
   * The staff "yeni sipariş" mail (`src/lib/email/staff-order-notice.ts`),
   * sent once when an order's payment is confirmed: the switch, the panel
   * roles whose active accounts receive it (env break-glass accounts by their
   * env role), and extra addresses, comma or newline separated. The
   * operations address above is always among the recipients while it is on.
   */
  orderNotifyEnabled: boolean;
  orderNotifyRoles: AdminRole[];
  orderNotifyEmails: string;

  /**
   * Transactional e-mail sender (Resend). Resend only delivers from a domain
   * verified on the account, so when that domain moves the address has to move
   * with it - from here, not from a deploy. Empty address = fall back to
   * `EMAIL_FROM`, then to the built-in default.
   */
  emailFromName: string;
  emailFromAddress: string;
  /** Where a member's reply lands. Empty falls back to `email`. */
  emailReplyTo: string;

  /**
   * Mobile app (docs/API-MOBILE.md §3, §7). Courier fee charged on a cafe
   * `delivery` order; karaoke room hourly price and the number of guests the
   * room takes. All in minor units except the capacity.
   */
  courierFeeMinor: number;
  /**
   * How long a pickup ("Gel-al") order takes to get ready, in minutes: the
   * home page's order card says "Gel-al · N dk". Presentation only.
   */
  pickupReadyMinutes: number;
  karaokeHourlyMinor: number;
  karaokeCapacity: number;
  /**
   * Where a new karaoke request is mailed (`sendKaraokeOperatorEmail`), from
   * the app or the web. Empty falls back to `email`.
   */
  karaokeNotifyEmail: string;
  /**
   * Karaoke bookings are paid online when they are made (PayNkolay, operator
   * 16 Eki 2026) and confirm themselves once paid. Off: the old flow - a
   * request the staff confirm, paid at the venue. Applies to new bookings
   * only: from the web, and from app builds that opt in (`prepay: true`).
   */
  karaokePrepay: boolean;

  /**
   * Everything else the app is configured with (/admin/mobil/ayarlar,
   * docs/API-MOBILE.md §10): one jsonb document, always normalised - a row
   * written before a key existed reads that key's default, never `undefined`.
   */
  mobileApp: MobileAppConfig;
}

// ─── Query helpers ─────────────────────────────────────────────────────────

// Every failed result goes through raiseDbError, which distinguishes a query
// the database rejected (fatal) from a database that was never reached
// (degradable). See src/lib/db/health.ts.
function rows<T>(
  res: { data: T[] | null; error: DbError | null; status: number },
  ctx: string,
): T[] {
  if (res.error) raiseDbError(ctx, res.error, res.status);
  return res.data ?? [];
}

function one<T>(
  res: { data: T | null; error: DbError | null; status: number },
  ctx: string,
): T | null {
  if (res.error) raiseDbError(ctx, res.error, res.status);
  return res.data;
}

function check(
  res: { error: DbError | null; status: number },
  ctx: string,
): void {
  if (res.error) raiseDbError(ctx, res.error, res.status);
}

async function countRows(table: string): Promise<number> {
  const sb = getDb();
  const { count, error, status } = await sb
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) raiseDbError(`count(${table})`, error, status);
  return count ?? 0;
}

async function setCounter(id: string, seq: number): Promise<void> {
  const sb = getDb();
  check(
    await sb.from(TABLES.counters).upsert({ id, seq }, { onConflict: "id" }),
    `setCounter(${id})`,
  );
}

// ─── ID + slug helpers ────────────────────────────────────────────────────

function parsePrice(price: string): number {
  // "320₺" → 32000 (minor units)
  const numeric = parseFloat(price.replace(/[^\d.,-]/g, "").replace(",", "."));
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric * 100);
}

function slugifyId(prefix: string, n: number): string {
  return `${prefix}-${String(n).padStart(4, "0")}`;
}

const TR_DIACRITICS: Record<string, string> = {
  ç: "c",
  Ç: "c",
  ğ: "g",
  Ğ: "g",
  ı: "i",
  I: "i",
  i̇: "i",
  İ: "i",
  ö: "o",
  Ö: "o",
  ş: "s",
  Ş: "s",
  ü: "u",
  Ü: "u",
};

export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[çÇğĞıIİöÖşŞüÜ]/g, (c) => TR_DIACRITICS[c] ?? c)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// ─── Seed (idempotent - yalnızca tablo boşsa çalışır) ─────────────────────

function defaultWeeklyHours(): WeeklyHours {
  // Every day 09:00-02:00. The close time is EARLIER than the open time
  // because 02:00 belongs to the following morning - schema.org expresses that
  // by simply letting `closes` be the smaller value, and openingHoursLd()
  // passes it through untouched. (Its "24:00" → "23:59" mapping exists for the
  // old 10:00-24:00 schedule and no longer applies to any day here.)
  const everyDay = { open: "09:00", close: "02:00", closed: false };
  return {
    mon: { ...everyDay },
    tue: { ...everyDay },
    wed: { ...everyDay },
    thu: { ...everyDay },
    fri: { ...everyDay },
    sat: { ...everyDay },
    sun: { ...everyDay },
  };
}

function defaultSettings(): AdminSettings {
  return {
    name: "L'Affogato",
    tagline: "Drink it. Eat the cup.",
    phone: "+90 536 429 09 19",
    email: "info@nextgenlab.com.tr",
    address:
      "Postane Mah. Atatürk Cad. No: 28 İç Kapı No: 1 (Menemenci Cumhur’un yanı), 34940 Tuzla / İstanbul",
    openingHours: "Pzt-Pş 10:00-23:00 · Cu-Ct 10:00-24:00 · Pz 10:00-23:00",
    isShopOpen: true,
    heroImageUrl: "",
    weeklyHours: defaultWeeklyHours(),
    taxRates: { ...LEGAL_TAX_RATES },
    shippingFlatMinor: 4900,
    shippingFreeThresholdMinor: 50000,
    // Empty = the home page's keyword title (app/page.tsx HOME_TITLE). A
    // non-empty default here meant that title was never used.
    seoTitle: "",
    seoOgImageUrl: "",
    seoIndexable: true,
    notificationEmail: "",
    orderNotifyEnabled: true,
    orderNotifyRoles: ["owner", "manager", "cashier"],
    orderNotifyEmails: "",
    emailFromName: "L'Affogato",
    emailFromAddress: "",
    emailReplyTo: "",
    courierFeeMinor: 5500,
    // 20261017173100_pickup_ready_minutes.sql gives the column the same
    // default: the 15 the home page's card always said.
    pickupReadyMinutes: 15,
    // ₺1.000 an hour (operator, 26 Eyl 2026); the live row is set by
    // 20260926090000_karaoke_price_and_notify.sql.
    karaokeHourlyMinor: 100000,
    karaokeCapacity: 8,
    karaokeNotifyEmail: "bizimfutbol9@gmail.com",
    // 20261016063311_karaoke_prepay.sql gives the column the same default.
    karaokePrepay: true,
    // A fresh copy: the constant is frozen and callers may edit sections.
    mobileApp: normalizeMobileAppConfig(DEFAULT_MOBILE_APP_CONFIG),
  };
}

const ensureSeed = memoizeUntilRejected(async (): Promise<void> => {
  {
    const sb = getDb();
    const now = new Date().toISOString();

    if ((await countRows(TABLES.products)) === 0) {
      const seeded: AdminProduct[] = SEED_PRODUCTS.map((p, i) => ({
        id: slugifyId("prd", i + 1),
        name: p.name,
        slug: slugify(p.name) || `urun-${i + 1}`,
        sku: deriveSku(p.name, i + 1),
        tag: p.tag,
        priceMinor: parsePrice(p.price),
        compareAtPriceMinor: 0,
        costMinor: 0,
        desc: p.desc,
        cat: p.cat as ShopCategoryId,
        img: p.img,
        images: [],
        // The seed marks the one product that carries an allergen (the
        // pistachio biscotti); `/admin/urunler` marks the rest.
        tags: p.tags ? [...p.tags] : [],
        // Null: the category's default. The seed sets it only where that
        // default is wrong (the edible cup box is food under "gift").
        taxRatePct: typeof p.taxRatePct === "number" ? p.taxRatePct : null,
        // Filled per product in /admin/urunler; empty draws nothing new.
        brand: "",
        notes: [],
        // No photo yet, so no scene pick and no cutout.
        ...NO_BACKDROP,
        stock: 25,
        lowStockThreshold: 5,
        weightGrams: 250,
        featured: Boolean(p.featured),
        isNew: Boolean(p.isNew),
        isActive: true,
        seoTitle: "",
        seoDescription: "",
        variants: [],
        updatedAt: now,
      }));
      if (seeded.length > 0) {
        check(
          await sb
            .from(TABLES.products)
            .upsert(seeded, { onConflict: "id", ignoreDuplicates: true }),
          "seed.products",
        );
        await setCounter("prd", seeded.length);
      }
    }

    if ((await countRows(TABLES.categories)) === 0) {
      const seededCats: AdminCategory[] = [
        {
          id: slugifyId("cat", 1),
          slug: "beans",
          label: "Çekirdek",
          icon: "◉",
          sortOrder: 0,
        },
        {
          id: slugifyId("cat", 2),
          slug: "gift",
          label: "Hediye",
          icon: "◈",
          sortOrder: 1,
        },
        {
          id: slugifyId("cat", 3),
          slug: "gear",
          label: "Ekipman",
          icon: "◇",
          sortOrder: 2,
        },
        {
          id: slugifyId("cat", 4),
          slug: "merch",
          label: "Giyim",
          icon: "◐",
          sortOrder: 3,
        },
        {
          id: slugifyId("cat", 5),
          slug: "pantry",
          label: "Kiler",
          icon: "◇",
          sortOrder: 4,
        },
      ];
      check(
        await sb
          .from(TABLES.categories)
          .upsert(seededCats, { onConflict: "id", ignoreDuplicates: true }),
        "seed.categories",
      );
      await setCounter("cat", seededCats.length);
    }

    if ((await countRows(TABLES.menuItems)) === 0) {
      let counter = 0;
      const seededMenu: AdminMenuItem[] = MENU_CATEGORY_KEYS.flatMap((key) =>
        SEED_MENU[key].items.map((it, idx) => {
          counter += 1;
          return {
            id: slugifyId("mnu", counter),
            categoryKey: key,
            name: it.name,
            desc: it.desc,
            priceMinor: parsePrice(it.price),
            priceMinorL: it.priceL ? parsePrice(it.priceL) : 0,
            hue: it.hue,
            image: it.image ?? "",
            tags: it.tags ? [...it.tags] : [],
            isActive: true,
            sortOrder: idx,
            // The bundled photos get their pick from
            // scripts/backfill-backdrops.mjs, like every stored photo.
            ...NO_BACKDROP,
            updatedAt: now,
          };
        }),
      );
      if (seededMenu.length > 0) {
        check(
          await sb
            .from(TABLES.menuItems)
            .upsert(seededMenu, { onConflict: "id", ignoreDuplicates: true }),
          "seed.menu",
        );
        await setCounter("mnu", counter);
      }
    }

    if ((await countRows(TABLES.settings)) === 0) {
      check(
        await sb
          .from(TABLES.settings)
          .upsert(
            { id: "main", ...defaultSettings() },
            { onConflict: "id", ignoreDuplicates: true },
          ),
        "seed.settings",
      );
    }

    // Demo orders are for a local walk-through of the panel, nothing else.
    // They used to be written on every fresh database, production included,
    // where two invented ₺740 orders became the shop's opening revenue figure
    // and two invented customers its CRM.
    if (SEED_DEMO_ORDERS && (await countRows(TABLES.orders)) === 0) {
      const demoOrders: AdminOrder[] = [
        {
          id: slugifyId("ord", 1),
          orderNo: 10_001,
          customerName: "Ali Yılmaz",
          customerEmail: "ali@example.com",
          customerPhone: "+90 532 111 22 33",
          shippingAddress:
            "Kadıköy Mah. Bağdat Cd. No: 142 Daire 7\nKadıköy / İstanbul 34710",
          internalNote: "",
          status: "preparing",
          items: [
            {
              productName: "Sirena - Espresso Blend",
              qty: 1,
              unitPriceMinor: 32000,
              status: "pending",
            },
            {
              productName: "Edible Cups - 6 Box",
              qty: 1,
              unitPriceMinor: 24000,
              status: "ready",
            },
          ],
          subtotalMinor: 56000,
          discountMinor: 0,
          promoCode: "",
          shippingMinor: 0,
          totalMinor: 56000,
          refunds: [],
          createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
        },
        {
          id: slugifyId("ord", 2),
          orderNo: 10_002,
          customerName: "Merve Kaya",
          customerEmail: "merve@example.com",
          customerPhone: "+90 533 222 33 44",
          shippingAddress:
            "Etiler Mah. Nispetiye Cd. No: 38\nBeşiktaş / İstanbul 34337",
          internalNote: "Hediye paketi istendi. Kart: 'İyi ki varsın 🤍'",
          status: "paid",
          items: [
            {
              productName: "Affogato Kit - For Two",
              qty: 1,
              unitPriceMinor: 78000,
              status: "pending",
            },
          ],
          subtotalMinor: 78000,
          discountMinor: 0,
          promoCode: "",
          shippingMinor: 0,
          totalMinor: 78000,
          refunds: [],
          createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        },
        {
          id: slugifyId("ord", 3),
          orderNo: 10_003,
          customerName: "Deniz Aydın",
          customerEmail: "deniz@example.com",
          customerPhone: "+90 535 444 55 66",
          shippingAddress:
            "Cihangir Mah. Akarsu Yokuşu No: 22\nBeyoğlu / İstanbul 34433",
          internalNote: "",
          status: "completed",
          items: [
            {
              productName: "Uji Matcha - Ceremonial",
              qty: 1,
              unitPriceMinor: 42000,
              status: "ready",
            },
            {
              productName: "Bambu Chasen",
              qty: 1,
              unitPriceMinor: 32000,
              status: "ready",
            },
          ],
          subtotalMinor: 74000,
          discountMinor: 0,
          promoCode: "",
          shippingMinor: 0,
          totalMinor: 74000,
          refunds: [],
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
        },
      ];
      check(
        await sb
          .from(TABLES.orders)
          .upsert(demoOrders, { onConflict: "id", ignoreDuplicates: true }),
        "seed.orders",
      );
      await setCounter("ord", demoOrders.length);
      await setCounter("orderNo", 10_003);
    }
  }
});

// ─── Products ─────────────────────────────────────────────────────────────

export async function listProducts(): Promise<AdminProduct[]> {
  await ensureSeed();
  const sb = getDb();
  return rows<AdminProduct>(
    await sb
      .from(TABLES.products)
      .select("*")
      .order("updatedAt", { ascending: false }),
    "listProducts",
  );
}

export async function getProduct(id: string): Promise<AdminProduct | null> {
  await ensureSeed();
  const sb = getDb();
  return one<AdminProduct>(
    await sb.from(TABLES.products).select("*").eq("id", id).maybeSingle(),
    "getProduct",
  );
}

/**
 * What the product wizard saves. The scene columns are part of it: the save
 * action computes them from the first photo and the form's "Sahne" and "Kap
 * biçimi" fields (`src/lib/backdrop/scene.ts`), and `updateProduct` writes
 * them over the stored ones like every other field.
 */
export interface ProductInput extends BackdropColumns {
  name: string;
  slug: string;
  sku: string;
  tag: string;
  priceMinor: number;
  compareAtPriceMinor: number;
  costMinor: number;
  desc: string;
  cat: ShopCategoryId;
  img: string;
  images: string[];
  tags: string[];
  brand: string;
  notes: string[];
  stock: number;
  lowStockThreshold: number;
  weightGrams: number;
  /** Own KDV rate, or null for the category default. Absent keeps the stored one. */
  taxRatePct?: number | null;
  featured: boolean;
  isNew: boolean;
  isActive: boolean;
  seoTitle: string;
  seoDescription: string;
  variants: AdminProductVariant[];
}

async function uniqueSlug(
  candidate: string,
  ignoreId?: string,
): Promise<string> {
  const base = candidate || "urun";
  let attempt = base;
  let n = 1;
  const sb = getDb();
  // 20 deneme yeter - gerçekçi tekrar sayısı çok düşük.
  for (let i = 0; i < 20; i += 1) {
    let q = sb.from(TABLES.products).select("id").eq("slug", attempt);
    if (ignoreId) q = q.neq("id", ignoreId);
    const found = rows<{ id: string }>(await q.limit(1), "uniqueSlug");
    if (found.length === 0) return attempt;
    n += 1;
    attempt = `${base}-${n}`;
  }
  return attempt;
}

export async function createProduct(
  input: ProductInput,
): Promise<AdminProduct> {
  await ensureSeed();
  const sb = getDb();
  const seq = await nextSeq("prd");
  const id = slugifyId("prd", seq);
  const slug = await uniqueSlug(
    input.slug || slugify(input.name) || `urun-${seq}`,
  );
  const sku = input.sku || deriveSku(input.name, seq);
  const product: AdminProduct = {
    ...NO_BACKDROP,
    ...input,
    id,
    slug,
    sku,
    updatedAt: new Date().toISOString(),
  };
  check(await sb.from(TABLES.products).insert(product), "createProduct");
  return product;
}

export async function updateProduct(
  id: string,
  input: ProductInput,
): Promise<AdminProduct | null> {
  await ensureSeed();
  const sb = getDb();
  const existing = await getProduct(id);
  if (!existing) return null;
  const slug = await uniqueSlug(
    input.slug || slugify(input.name) || existing.slug,
    id,
  );
  const next: AdminProduct = {
    ...existing,
    ...input,
    slug,
    // An empty field keeps the stored code; a product that never had one
    // gets the one its name and id imply (the wizard no longer prefills it).
    sku:
      input.sku ||
      existing.sku ||
      deriveSku(input.name, Number(id.replace(/\D/g, "")) || 0),
    updatedAt: new Date().toISOString(),
  };
  check(
    await sb.from(TABLES.products).update(next).eq("id", id),
    "updateProduct",
  );
  return next;
}

/** Id, name and SKU of the given products: what an audit row names. */
export async function listProductLabels(
  ids: readonly string[],
): Promise<Array<{ id: string; name: string; sku: string }>> {
  if (ids.length === 0) return [];
  await ensureSeed();
  const sb = getDb();
  return rows<{ id: string; name: string; sku: string }>(
    await sb.from(TABLES.products).select("id, name, sku").in("id", ids),
    "listProductLabels",
  );
}

/**
 * The columns the CSV import reads and may change, for every product: no
 * photos (a stored upload is a data URL of up to 2 MB), no SEO, no cost.
 * Variants come along because a new price must keep every variant at 1
 * kuruş or more.
 */
export type ProductImportView = Pick<
  AdminProduct,
  | "id"
  | "name"
  | "slug"
  | "sku"
  | "tag"
  | "desc"
  | "cat"
  | "img"
  | "priceMinor"
  | "compareAtPriceMinor"
  | "stock"
  | "taxRatePct"
  | "isActive"
  | "brand"
  | "weightGrams"
  | "variants"
>;

export async function listProductsForImport(): Promise<ProductImportView[]> {
  await ensureSeed();
  const sb = getDb();
  return rows<ProductImportView>(
    await sb
      .from(TABLES.products)
      .select(
        "id, name, slug, sku, tag, desc, cat, img, priceMinor, compareAtPriceMinor, stock, taxRatePct, isActive, brand, weightGrams, variants",
      )
      .order("id", { ascending: true }),
    "listProductsForImport",
  );
}

/** The fields the CSV import writes on an existing product. Never `stock`. */
export type ProductImportPatch = Partial<
  Pick<
    AdminProduct,
    | "name"
    | "tag"
    | "desc"
    | "cat"
    | "priceMinor"
    | "compareAtPriceMinor"
    | "taxRatePct"
    | "isActive"
    | "brand"
    | "weightGrams"
  >
> &
  Partial<BackdropColumns>;

/**
 * Writes only the given columns of one product, or answers null when the
 * row is gone. Stock is not among them on purpose: the import moves stock
 * by a delta through `adjustStock`, which records a stock move, so an order
 * taken in the meantime is not overwritten.
 */
export async function patchProductFromImport(
  id: string,
  patch: ProductImportPatch,
): Promise<{ id: string } | null> {
  await ensureSeed();
  const sb = getDb();
  const { stock: _ignored, ...safe } = patch as ProductImportPatch & {
    stock?: unknown;
  };
  const updated = rows<{ id: string }>(
    await sb
      .from(TABLES.products)
      .update({ ...safe, updatedAt: new Date().toISOString() })
      .eq("id", id)
      .select("id"),
    "patchProductFromImport",
  );
  return updated[0] ?? null;
}

export async function deleteProduct(id: string): Promise<boolean> {
  await ensureSeed();
  const sb = getDb();
  const deleted = rows<{ id: string }>(
    await sb.from(TABLES.products).delete().eq("id", id).select("id"),
    "deleteProduct",
  );
  return deleted.length > 0;
}

export type BulkProductOp =
  | { kind: "delete" }
  | { kind: "activate" }
  | { kind: "deactivate" }
  | { kind: "set_category"; cat: ShopCategoryId };

export interface BulkResult {
  updated: number;
}

export async function bulkUpdateProducts(
  ids: string[],
  op: BulkProductOp,
): Promise<BulkResult> {
  if (ids.length === 0) return { updated: 0 };
  await ensureSeed();
  const sb = getDb();
  const now = new Date().toISOString();

  if (op.kind === "delete") {
    const res = rows<{ id: string }>(
      await sb.from(TABLES.products).delete().in("id", ids).select("id"),
      "bulkUpdateProducts.delete",
    );
    return { updated: res.length };
  }

  if (op.kind === "activate") {
    const res = rows<{ id: string }>(
      await sb
        .from(TABLES.products)
        .update({ isActive: true, updatedAt: now })
        .in("id", ids)
        .eq("isActive", false)
        .select("id"),
      "bulkUpdateProducts.activate",
    );
    return { updated: res.length };
  }

  if (op.kind === "deactivate") {
    const res = rows<{ id: string }>(
      await sb
        .from(TABLES.products)
        .update({ isActive: false, updatedAt: now })
        .in("id", ids)
        .eq("isActive", true)
        .select("id"),
      "bulkUpdateProducts.deactivate",
    );
    return { updated: res.length };
  }

  // set_category
  const res = rows<{ id: string }>(
    await sb
      .from(TABLES.products)
      .update({ cat: op.cat, updatedAt: now })
      .in("id", ids)
      .neq("cat", op.cat)
      .select("id"),
    "bulkUpdateProducts.set_category",
  );
  return { updated: res.length };
}

// ─── Stock movements ──────────────────────────────────────────────────────

export type StockMoveReason =
  | "order_placed"
  | "order_cancelled"
  | "manual_adjust"
  | "refund_restock"
  | "seed";

export interface AdminStockMove {
  id: string;
  productId: string;
  productName: string;
  /** Negative for outgoing (sale), positive for incoming (restock/manual). */
  delta: number;
  /** Stock level AFTER this move was applied. */
  stockAfter: number;
  reason: StockMoveReason;
  note: string;
  /** Linked order id (for order_placed / refund_restock). */
  orderId?: string;
  /** Admin email or "system" / "customer". */
  actor: string;
  createdAt: string;
}

async function recordStockMove(
  input: Omit<AdminStockMove, "id" | "createdAt">,
): Promise<AdminStockMove> {
  const sb = getDb();
  const seq = await nextSeq("mov");
  const move: AdminStockMove = {
    id: `mov-${String(seq).padStart(6, "0")}`,
    createdAt: new Date().toISOString(),
    ...input,
  };
  check(await sb.from(TABLES.stockMoves).insert(move), "recordStockMove");
  return move;
}

export async function listStockMoves(filter?: {
  productId?: string;
  reason?: StockMoveReason;
  limit?: number;
}): Promise<AdminStockMove[]> {
  await ensureSeed();
  const sb = getDb();
  let q = sb.from(TABLES.stockMoves).select("*");
  if (filter?.productId) q = q.eq("productId", filter.productId);
  if (filter?.reason) q = q.eq("reason", filter.reason);
  return rows<AdminStockMove>(
    await q
      .order("createdAt", { ascending: false })
      .limit(filter?.limit ?? 500),
    "listStockMoves",
  );
}

export interface AdjustStockInput {
  productId: string;
  delta: number;
  note: string;
  actor: string;
}

export type AdjustStockResult =
  | { ok: true; move: AdminStockMove; product: AdminProduct }
  | { ok: false; error: string };

export async function adjustStock(
  input: AdjustStockInput,
): Promise<AdjustStockResult> {
  await ensureSeed();
  const sb = getDb();
  if (!Number.isFinite(input.delta) || input.delta === 0) {
    return { ok: false, error: "Geçerli bir değer gir (0 olamaz)." };
  }
  const product = await getProduct(input.productId);
  if (!product) return { ok: false, error: "Ürün bulunamadı." };

  // Applied inside the database, not read-modify-written here. Two adjustments
  // in flight - or one racing a customer's order, which decrements under a row
  // lock - used to lose a write, and the lost one was always the smaller
  // change, so the count drifted upward. Upward is the direction that oversells.
  const updatedAt = new Date().toISOString();
  const { data, error } = await sb.rpc("adjust_product_stock", {
    p_product_id: input.productId,
    p_delta: input.delta,
    p_now: updatedAt,
  });
  if (error) return { ok: false, error: error.message };
  const next = typeof data === "number" ? data : Number(data);
  if (next === -1) return { ok: false, error: "Ürün bulunamadı." };
  if (next === -2) {
    // Re-read so the message names the stock as it actually stands now.
    const fresh = await getProduct(input.productId);
    return {
      ok: false,
      error: `Stok eksiye düşemez (mevcut: ${fresh?.stock ?? product.stock}).`,
    };
  }

  const move = await recordStockMove({
    productId: product.id,
    productName: product.name,
    delta: input.delta,
    stockAfter: next,
    reason: "manual_adjust",
    note: input.note.trim().slice(0, 500),
    actor: input.actor,
  });
  return {
    ok: true,
    move,
    product: { ...product, stock: next, updatedAt },
  };
}

// ─── Categories ───────────────────────────────────────────────────────────

export async function listCategories(): Promise<AdminCategory[]> {
  await ensureSeed();
  const sb = getDb();
  return rows<AdminCategory>(
    await sb
      .from(TABLES.categories)
      .select("*")
      .order("sortOrder", { ascending: true }),
    "listCategories",
  );
}

export async function getCategory(id: string): Promise<AdminCategory | null> {
  await ensureSeed();
  const sb = getDb();
  return one<AdminCategory>(
    await sb.from(TABLES.categories).select("*").eq("id", id).maybeSingle(),
    "getCategory",
  );
}

export interface CategoryInput {
  slug: ShopCategoryId;
  label: string;
  icon: string;
  sortOrder: number;
}

export async function createCategory(
  input: CategoryInput,
): Promise<AdminCategory> {
  await ensureSeed();
  const sb = getDb();
  const seq = await nextSeq("cat");
  const c: AdminCategory = { id: slugifyId("cat", seq), ...input };
  check(await sb.from(TABLES.categories).insert(c), "createCategory");
  return c;
}

export async function updateCategory(
  id: string,
  input: CategoryInput,
): Promise<AdminCategory | null> {
  await ensureSeed();
  const sb = getDb();
  const existing = await getCategory(id);
  if (!existing) return null;
  const next: AdminCategory = { ...existing, ...input };
  check(
    await sb.from(TABLES.categories).update(next).eq("id", id),
    "updateCategory",
  );
  return next;
}

export async function deleteCategory(id: string): Promise<boolean> {
  await ensureSeed();
  const sb = getDb();
  const deleted = rows<{ id: string }>(
    await sb.from(TABLES.categories).delete().eq("id", id).select("id"),
    "deleteCategory",
  );
  return deleted.length > 0;
}

/**
 * Puts a just-deleted category back, id and all. For the panel's delete when
 * its after-check finds products left without a category (a twin deleted in
 * the same moment, or products moved in after the first check).
 */
export async function restoreCategory(category: AdminCategory): Promise<void> {
  const sb = getDb();
  check(
    await sb.from(TABLES.categories).insert({
      id: category.id,
      slug: category.slug,
      label: category.label,
      icon: category.icon,
      sortOrder: category.sortOrder,
    }),
    "restoreCategory",
  );
}

// ─── Orders ───────────────────────────────────────────────────────────────

/**
 * How many orders are still open: the sidebar badge, the same number the
 * "Açık" tab shows (`OPEN_ORDER_STATUSES`, lib/admin/order-filters.ts).
 *
 * A `head: true` count, not `listOrders().filter(...)`: the sidebar asks for
 * this every minute on every admin page, and paging every order row through
 * Node to length-check an array is the difference between a badge and a
 * second load on the pool.
 */
export async function countOpenOrders(): Promise<number> {
  const sb = getDb();
  const { count, error, status } = await sb
    .from(TABLES.orders)
    .select("*", { count: "exact", head: true })
    .in("status", [...OPEN_ORDER_STATUSES]);
  if (error) raiseDbError("countOpenOrders", error, status);
  return count ?? 0;
}

/**
 * How many orders arrived after the one the screen already knows about.
 *
 * The order list polls this with the highest `orderNo` it has rendered, so a
 * member ordering from the app while the page sits open turns into a visible
 * count without the list reordering itself under the operator's cursor. `0`
 * for a non-finite argument rather than a count of everything: a broken
 * client must not make the panel shout.
 */
export async function countOrdersAfter(
  orderNo: number,
  /** Only these statuses (the "Açık" tab's poll); every order when omitted. */
  statuses?: readonly AdminOrderStatus[],
): Promise<number> {
  if (!Number.isFinite(orderNo)) return 0;
  const sb = getDb();
  let q = sb
    .from(TABLES.orders)
    // `gte(n + 1)`, not `gt(n)`: the builder has no `gt`, and the sequence is
    // an integer so the two are the same predicate.
    .select("*", { count: "exact", head: true })
    .gte("orderNo", Math.trunc(orderNo) + 1);
  if (statuses) q = q.in("status", [...statuses]);
  const { count, error, status } = await q;
  if (error) raiseDbError("countOrdersAfter", error, status);
  return count ?? 0;
}

// There is deliberately no "every order, every column" reader any more (WP1).
// `listOrders()` had five callers and each one wanted a page, five rows or a
// few columns; reading the whole table with its jsonb was 596 ms and 27 MB
// per call at 20k orders. Read what the screen needs: `listRecentOrders`,
// `listOrdersFiltered`, or a projection like `reportOrders` below.

/**
 * The newest `limit` orders, whole rows.
 *
 * WP1: the dashboard used to read every order, every column,
 * including the items, refund ledger and consent evidence jsonb - to show
 * five of them. Measured on 20k orders: 596 ms and 27 MB per dashboard view,
 * against 1 ms for this (a walk down `orders_orderno_key`).
 */
export async function listRecentOrders(limit: number): Promise<AdminOrder[]> {
  await ensureSeed();
  const sb = getDb();
  return rows<AdminOrder>(
    await sb
      .from(TABLES.orders)
      .select("*")
      .order("orderNo", { ascending: false })
      .limit(Math.max(1, Math.trunc(limit))),
    "listRecentOrders",
  );
}

/** What the order list filters on (lib/admin/order-filters.ts). */
export type { OrderListQuery };

/** The filter methods the order list's queries use, for `withOrderQuery`. */
interface OrderFilterable<Q> {
  eq(column: string, value: unknown): Q;
  neq(column: string, value: unknown): Q;
  gte(column: string, value: unknown): Q;
  lt(column: string, value: unknown): Q;
  in(column: string, values: readonly unknown[]): Q;
  anyOf(conditions: readonly AnyOfCondition[]): Q;
}

/**
 * The order list's filters as SQL, shared by the page query and the tab
 * counts so a tab's number is exactly what the tab then shows. Every value
 * was validated by parseOrderListParams; the search pattern is escaped
 * there (`%`, `_`).
 */
function withOrderQuery<Q extends OrderFilterable<Q>>(
  q: Q,
  query: OrderListQuery,
): Q {
  let out = q;
  if (query.search) {
    const conditions: AnyOfCondition[] = [
      { column: "customerName", op: "ilike", value: query.search.pattern },
      { column: "customerEmail", op: "ilike", value: query.search.pattern },
    ];
    if (query.search.orderNo !== null) {
      conditions.unshift({
        column: "orderNo",
        op: "eq",
        value: query.search.orderNo,
      });
    }
    out = out.anyOf(conditions);
  }
  if (query.statuses) out = out.in("status", query.statuses);
  if (query.channel === "manual") out = out.eq("source", "manual");
  else if (query.channel) {
    out = out.eq("channel", query.channel).neq("source", "manual");
  }
  if (query.kind) out = out.eq("kind", query.kind);
  if (query.fulfillment) out = out.eq("fulfillment", query.fulfillment);
  if (query.payment === "paid") out = out.neq("paidAt", "");
  else if (query.payment === "unpaid") out = out.eq("paidAt", "");
  else if (query.payment === "refunded") out = out.neq("refunds", []);
  if (query.attention) out = out.neq("attention", "");
  if (query.fromIso) out = out.gte("createdAt", query.fromIso);
  if (query.beforeIso) out = out.lt("createdAt", query.beforeIso);
  return out;
}

export interface OrderListPage {
  orders: AdminOrder[];
  /** Rows matching the filters, across every page. */
  total: number;
}

/**
 * One numbered page of the order list, filtered and sorted.
 *
 * WP1 still holds: a page of rows, never the table. The sort column is one
 * of four the page allows (ORDER_SORT_COLUMNS); `orderNo` breaks ties so a
 * page boundary never splits or repeats an order.
 */
export async function listOrdersFiltered(input: {
  query: OrderListQuery;
  sort: {
    column: "orderNo" | "createdAt" | "totalMinor" | "customerName";
    ascending: boolean;
  };
  page: number;
  pageSize: number;
}): Promise<OrderListPage> {
  await ensureSeed();
  const sb = getDb();
  const size = Math.max(1, Math.trunc(input.pageSize));
  const page = Math.max(1, Math.trunc(input.page));
  let q = withOrderQuery(sb.from(TABLES.orders).select("*"), input.query).order(
    input.sort.column,
    { ascending: input.sort.ascending },
  );
  if (input.sort.column !== "orderNo") {
    q = q.order("orderNo", { ascending: false });
  }
  q = q.limit(size).offset((page - 1) * size);
  const countQ = withOrderQuery(
    sb.from(TABLES.orders).select("*", { count: "exact", head: true }),
    input.query,
  );
  const [orders, counted] = await Promise.all([
    q.then((r) => rows<AdminOrder>(r, "listOrdersFiltered")),
    countQ,
  ]);
  if (counted.error) {
    raiseDbError("listOrdersFiltered.count", counted.error, counted.status);
  }
  return { orders, total: counted.count ?? 0 };
}

/**
 * How many orders each status holds under the list's other filters (the
 * tab counts). One `head: true` count per status on `orders_status_idx`.
 */
export async function countOrdersByStatus(
  query: OrderListQuery,
): Promise<Record<AdminOrderStatus, number>> {
  const sb = getDb();
  const statuses: AdminOrderStatus[] = [
    "pending_payment",
    "paid",
    "preparing",
    "shipped",
    "completed",
    "cancelled",
    "refunded",
  ];
  const counts = await Promise.all(
    statuses.map(async (status) => {
      const res = await withOrderQuery(
        sb.from(TABLES.orders).select("*", { count: "exact", head: true }),
        { ...query, statuses: null },
      ).eq("status", status);
      if (res.error) raiseDbError("countOrdersByStatus", res.error, res.status);
      return res.count ?? 0;
    }),
  );
  return Object.fromEntries(statuses.map((s, i) => [s, counts[i]])) as Record<
    AdminOrderStatus,
    number
  >;
}

export interface CustomerSummary {
  email: string;
  name: string;
  phone: string;
  orderCount: number;
  lifetimeValueMinor: number;
  refundedMinor: number;
  lastOrderAt: string;
  firstOrderAt: string;
}

/** The order columns the customer roll-up reads. */
export type CustomerSummaryOrder = Pick<
  AdminOrder,
  | "customerEmail"
  | "customerName"
  | "customerPhone"
  | "status"
  | "totalMinor"
  | "refunds"
  | "createdAt"
>;

export async function listCustomers(): Promise<CustomerSummary[]> {
  // Seven columns, not `select *`: the roll-up needs every order (it counts a
  // lifetime) but none of the items, addresses or consent evidence. WP1,
  // measured on 20k orders: 596 ms / 27 MB -> 67 ms / 3.4 MB.
  await ensureSeed();
  const orders = rows<CustomerSummaryOrder>(
    await getDb()
      .from(TABLES.orders)
      .select(
        "customerEmail, customerName, customerPhone, status, totalMinor, refunds, createdAt",
      )
      .order("orderNo", { ascending: false }),
    "listCustomers",
  );
  return summarizeCustomers(orders);
}

/**
 * The pure half of {@link listCustomers}, exported for tests.
 *
 * Order count, lifetime value and refunds follow the reports' rule
 * ({@link isReportableOrder}): an abandoned checkout (`pending_payment`) and
 * a cancelled order are not money the customer spent. They used to count in
 * full, so after the one-page checkout every customer who opened the card
 * step and walked away carried that basket as lifetime value, and Müşteriler
 * disagreed with Raporlar. The profile itself still comes from every order:
 * someone who only ever abandoned a checkout is still a contact, shown with
 * 0 orders, and the last attempt still dates their activity.
 */
export function summarizeCustomers(
  orders: readonly CustomerSummaryOrder[],
): CustomerSummary[] {
  const byEmail = new Map<string, CustomerSummary>();
  for (const o of orders) {
    const email = o.customerEmail?.trim().toLowerCase();
    if (!email || email === "guest@laffogato.local") continue;
    const counts = isReportableOrder(o);
    const valueHere = counts ? o.totalMinor : 0;
    const refundedHere = counts
      ? o.refunds.reduce((s, r) => s + r.amountMinor, 0)
      : 0;
    const existing = byEmail.get(email);
    if (!existing) {
      byEmail.set(email, {
        email,
        name: o.customerName,
        phone: o.customerPhone,
        orderCount: counts ? 1 : 0,
        lifetimeValueMinor: valueHere,
        refundedMinor: refundedHere,
        lastOrderAt: o.createdAt,
        firstOrderAt: o.createdAt,
      });
    } else {
      if (counts) existing.orderCount += 1;
      existing.lifetimeValueMinor += valueHere;
      existing.refundedMinor += refundedHere;
      if (o.createdAt > existing.lastOrderAt) {
        existing.lastOrderAt = o.createdAt;
        existing.name = o.customerName || existing.name;
        existing.phone = o.customerPhone || existing.phone;
      }
      if (o.createdAt < existing.firstOrderAt) {
        existing.firstOrderAt = o.createdAt;
      }
    }
  }
  return Array.from(byEmail.values()).sort((a, b) =>
    b.lastOrderAt.localeCompare(a.lastOrderAt),
  );
}

/**
 * A customer's lifetime figures from their own orders, by the same rule as
 * {@link summarizeCustomers} and the reports. For the customer detail page.
 */
export function customerLifetime(
  orders: ReadonlyArray<Pick<AdminOrder, "status" | "totalMinor" | "refunds">>,
): { orderCount: number; lifetimeValueMinor: number; refundedMinor: number } {
  let orderCount = 0;
  let lifetimeValueMinor = 0;
  let refundedMinor = 0;
  for (const o of orders) {
    if (!isReportableOrder(o)) continue;
    orderCount += 1;
    lifetimeValueMinor += o.totalMinor;
    refundedMinor += o.refunds.reduce((s, r) => s + r.amountMinor, 0);
  }
  return { orderCount, lifetimeValueMinor, refundedMinor };
}

/** The columns the loyalty view and the badge rules actually read. */
export type LoyaltyOrderRow = Pick<
  AdminOrder,
  "status" | "createdAt" | "items"
>;

/**
 * A member's orders, newest first.
 *
 * `limit` is pushed into SQL, not applied afterwards. Every `/me`, `/orders`
 * and `/notifications` call reads this, and the row carries the items jsonb,
 * the consent evidence and the refund ledger - a two-year regular's whole
 * history was being transferred and deserialised several times per app
 * foreground. Callers that genuinely need the lifetime history (loyalty
 * tiers, badges) read `customerLoyaltyOrders` instead, which projects the
 * three columns those rules use.
 *
 * The match is `lower("customerEmail") = lower($1)`, which is exactly the
 * expression `orders_email_idx` is built on. It used to be an `ILIKE`
 * prefilter finished in JavaScript; Postgres has no btree opclass for `~~*`,
 * so that index could never be chosen and every member order read was a
 * sequential scan of the whole table - including the one on the checkout
 * path.
 */
export async function customerOrdersByEmail(
  email: string,
  limit?: number,
): Promise<AdminOrder[]> {
  return readCustomerOrders<AdminOrder>(email, "*", limit);
}

/**
 * The lifetime history the loyalty tier and the badges need - three columns,
 * no `items`-sized company. There is no limit here on purpose: tiers count a
 * rolling year and `orders-50` counts a lifetime, so a page would be wrong.
 */
export async function customerLoyaltyOrders(
  email: string,
): Promise<LoyaltyOrderRow[]> {
  return readCustomerOrders<LoyaltyOrderRow>(email, "status, createdAt, items");
}

async function readCustomerOrders<T>(
  email: string,
  columns: string,
  limit?: number,
): Promise<T[]> {
  const needle = email.trim().toLowerCase();
  if (!needle) return [];
  await ensureSeed();
  const sb = getDb();
  let q = sb
    .from(TABLES.orders)
    .select(columns)
    .ieq("customerEmail", needle)
    .order("orderNo", { ascending: false });
  if (limit && limit > 0) q = q.limit(limit);
  return rows<T>(await q, "customerOrdersByEmail");
}

export async function getOrder(id: string): Promise<AdminOrder | null> {
  await ensureSeed();
  const sb = getDb();
  return one<AdminOrder>(
    await sb.from(TABLES.orders).select("*").eq("id", id).maybeSingle(),
    "getOrder",
  );
}

/**
 * Several orders by id, in no particular order; unknown ids are absent. For
 * the bulk tool, which decides per order (lib/admin/order-ops.ts).
 */
export async function getOrdersByIds(
  ids: readonly string[],
): Promise<AdminOrder[]> {
  if (ids.length === 0) return [];
  await ensureSeed();
  return rows<AdminOrder>(
    await getDb().from(TABLES.orders).select("*").in("id", ids.slice(0, 500)),
    "getOrdersByIds",
  );
}

/**
 * The statuses the bulk tool may set, and the transition that gets there.
 *
 * `paid` and `refunded` are deliberately missing. Money moves with a
 * `payment_transactions` row or a refund ledger entry, and a bulk button that
 * writes the status column writes neither - a bulk "ödendi" produced paid
 * orders nobody had paid for, with no `paidAt` and no stamp. Those two are
 * done one order at a time, from the order page.
 *
 * The bulk tool itself (`runBulkOrderAction`, lib/admin/order-ops.ts) sends
 * every id through the same `transitionOrder` / `cancelOrder` the order page
 * uses: a raw `update({ status }).in("id", ids)` once left a bulk cancel's
 * stock claimed, its coupon burned and its stamp standing.
 */
export const BULK_ORDER_TRANSITIONS: Partial<
  Record<AdminOrderStatus, OrderTransition>
> = {
  preparing: "start_preparing",
  shipped: "mark_shipped",
  completed: "complete",
  cancelled: "cancel",
};

export interface PlaceOrderItemInput {
  /** Stable product id - preferred match key. */
  productId?: string;
  /** Product name - fallback match key for legacy carts. */
  name: string;
  /** Selected variant id, if any. */
  variantId?: string;
  qty: number;
  /** Client-sent price - IGNORED for charging; only used to detect drift. */
  priceMinor?: number;
}

export interface PlaceOrderInput {
  items: PlaceOrderItemInput[];
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  shippingAddress?: string;
  promoCode?: string;
  /** Distance-selling consent captured on the checkout form. */
  legalConsent?: OrderLegalConsent;
}

export type PlaceOrderResult =
  | {
      ok: true;
      order: AdminOrder;
      priceAdjusted: boolean;
      promoDropped: boolean;
    }
  | {
      ok: false;
      reason: "out_of_stock";
      productName: string;
      available: number;
    }
  | { ok: false; reason: "empty" }
  | { ok: false; reason: "not_found"; productName: string }
  | { ok: false; reason: "qty_too_high"; productName: string; max: number }
  | { ok: false; reason: "shop_closed" };

/** Every way a shop order can be refused. */
export type PlaceOrderFailure = Exclude<PlaceOrderResult, { ok: true }>;

/** Per-line quantity ceiling. A retail cart, not a wholesale order. */
export const MAX_LINE_QTY = 99;

interface ResolvedLine {
  product: AdminProduct;
  variant: AdminProductVariant | null;
  qty: number;
  unitPriceMinor: number;
  label: string;
}

type ResolveLinesResult =
  | { ok: true; resolved: ResolvedLine[]; priceAdjusted: boolean }
  | { ok: false; result: PlaceOrderFailure };

/**
 * Resolves cart/manual lines against the DB. SECURITY: unit prices are taken
 * from the database (base price + active variant delta), never trusted from the
 * client. Stock is validated up-front for ALL lines (friendly fast path); the
 * atomic claim below closes the check→decrement race.
 */
async function resolveOrderLines(
  items: PlaceOrderItemInput[],
): Promise<ResolveLinesResult> {
  const sb = getDb();
  // A line over the cap used to be filtered out silently: the customer paid
  // for a cart that no longer contained what they asked for. Say so instead.
  const tooMany = items.find((it) => it.qty > MAX_LINE_QTY);
  if (tooMany) {
    return {
      ok: false,
      result: {
        ok: false,
        reason: "qty_too_high",
        productName: tooMany.name,
        max: MAX_LINE_QTY,
      },
    };
  }
  const cleanItems = items.filter((it) => it.qty > 0);
  if (cleanItems.length === 0) {
    return { ok: false, result: { ok: false, reason: "empty" } };
  }

  // Resolve each line against the DB by id (preferred) or name. Two filtered
  // reads merged by id avoids escaping issues with names in a combined .or().
  const ids = cleanItems.map((it) => it.productId).filter(Boolean) as string[];
  const names = cleanItems.map((it) => it.name);
  const [byIdDocs, byNameDocs] = await Promise.all([
    ids.length > 0
      ? rows<AdminProduct>(
          await sb.from(TABLES.products).select("*").in("id", ids),
          "placeOrder.byId",
        )
      : Promise.resolve([] as AdminProduct[]),
    names.length > 0
      ? rows<AdminProduct>(
          await sb.from(TABLES.products).select("*").in("name", names),
          "placeOrder.byName",
        )
      : Promise.resolve([] as AdminProduct[]),
  ]);
  const byId = new Map<string, AdminProduct>();
  const byName = new Map<string, AdminProduct>();
  for (const p of [...byIdDocs, ...byNameDocs]) {
    byId.set(p.id, p);
    byName.set(p.name, p);
  }

  const resolved: ResolvedLine[] = [];
  let priceAdjusted = false;

  for (const it of cleanItems) {
    const product =
      (it.productId ? byId.get(it.productId) : undefined) ??
      byName.get(it.name);
    if (!product || !product.isActive) {
      // Fall back to the id when no name is available (manual orders send no name).
      return {
        ok: false,
        result: {
          ok: false,
          reason: "not_found",
          productName: it.name || it.productId || "",
        },
      };
    }
    const variant = it.variantId
      ? (product.variants.find((v) => v.id === it.variantId && v.isActive) ??
        null)
      : null;
    // A chosen variant that no longer resolves to an active one must NOT silently
    // fall back to the base price/stock - reject the line so the stale selection
    // surfaces instead of mischarging.
    if (it.variantId && !variant) {
      return {
        ok: false,
        result: { ok: false, reason: "not_found", productName: product.name },
      };
    }
    // Server-authoritative price: base + variant delta.
    const unitPriceMinor = Math.max(
      0,
      product.priceMinor + (variant?.priceDeltaMinor ?? 0),
    );
    if (it.priceMinor !== undefined && it.priceMinor !== unitPriceMinor) {
      priceAdjusted = true;
    }
    // Stock check (variant stock when a variant is chosen, else product stock).
    const available = variant ? variant.stock : product.stock;
    if (available < it.qty) {
      return {
        ok: false,
        result: {
          ok: false,
          reason: "out_of_stock",
          productName: variant
            ? `${product.name} · ${variant.name}`
            : product.name,
          available,
        },
      };
    }
    resolved.push({
      product,
      variant,
      qty: it.qty,
      unitPriceMinor,
      label: variant ? `${product.name} · ${variant.name}` : product.name,
    });
  }

  return { ok: true, resolved, priceAdjusted };
}

type ClaimStockResult =
  | { ok: true; stockAfters: number[] }
  | { ok: false; result: PlaceOrderFailure };

/**
 * Atomically claims stock for ALL lines in one transaction. The RPC checks +
 * decrements product stock (and the chosen variant's JSONB stock) under a row
 * lock and raises INSUFFICIENT_STOCK if any line can't be met, rolling back
 * every line - prevents overselling, all-or-nothing.
 */
async function claimOrderStock(
  resolved: ResolvedLine[],
): Promise<ClaimStockResult> {
  const sb = getDb();
  const claim = await sb.rpc("claim_order_stock", {
    p_lines: resolved.map((l) => ({
      productId: l.product.id,
      variantId: l.variant?.id ?? null,
      qty: l.qty,
    })),
    p_now: new Date().toISOString(),
  });
  if (claim.error) {
    const m = /INSUFFICIENT_STOCK:(.*)$/.exec(claim.error.message);
    if (m) {
      const pid = m[1].trim();
      const line = resolved.find((l) => l.product.id === pid) ?? resolved[0];
      return {
        ok: false,
        result: {
          ok: false,
          reason: "out_of_stock",
          productName: line.label,
          available: line.variant ? line.variant.stock : line.product.stock,
        },
      };
    }
    throw new Error(`placeOrder.claim: ${claim.error.message}`);
  }
  return { ok: true, stockAfters: (claim.data ?? []) as number[] };
}

/**
 * Hands back stock that was claimed for an order that never got written.
 *
 * Placement is a sequence of auto-commit statements: claim the stock, take the
 * counters, write the stock moves, insert the row. A failure anywhere after
 * the claim used to leave the units decremented forever - the sweep that
 * releases abandoned checkouts iterates `orders` rows, and there is no row to
 * find. Best-effort by design: it runs while another error is already on its
 * way up, and must not replace it.
 */
async function releaseClaimedStock(resolved: ResolvedLine[]): Promise<void> {
  if (resolved.length === 0) return;
  try {
    const { error } = await getDb().rpc("release_order_stock", {
      p_lines: resolved.map((l) => ({
        productId: l.product.id,
        variantId: l.variant?.id ?? null,
        qty: l.qty,
      })),
      p_now: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
  } catch (err) {
    console.error(
      "[orders] releasing the stock of a failed order placement failed",
      err,
    );
  }
}

/** One stock movement per claimed line, using the post-claim product stock. */
async function recordOrderStockMoves(
  resolved: ResolvedLine[],
  stockAfters: number[],
  orderId: string,
  note: string,
  actor: string,
): Promise<void> {
  for (let i = 0; i < resolved.length; i += 1) {
    const line = resolved[i];
    const stockAfter =
      stockAfters[i] ?? Math.max(0, line.product.stock - line.qty);
    await recordStockMove({
      productId: line.product.id,
      productName: line.label,
      delta: -line.qty,
      stockAfter,
      reason: "order_placed",
      note,
      orderId,
      actor,
    });
  }
}

interface FinalizeOrderInput {
  orderId: string;
  orderNo: number;
  /** App idempotency key; absent on web and admin orders. */
  clientOrderId?: string;
  status: AdminOrderStatus;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  internalNote: string;
  promoCode?: string;
  legalConsent?: OrderLegalConsent;
  /**
   * Mobile app columns (docs/API-MOBILE.md §3). All optional: the web path
   * leaves them out and the row takes the database defaults, so a web order
   * is byte-for-byte what it was before. The panel's manual order sets
   * `fulfillment` (Gel-al, Kurye, Kargo).
   */
  channel?: OrderChannel;
  kind?: OrderKind;
  fulfillment?: OrderFulfillment;
  scheduledFor?: string;
  deliveryNote?: string;
  /** Table orders only: the table snapshot (see `AdminOrder.tableCode`). */
  tableCode?: string;
  tableName?: string;
  /** "manual" for the panel's manual order (`AdminOrder.source`). */
  source?: "manual";
  /** How shipping is charged; the shop's settings when omitted. */
  shipping?: ShippingMode;
  /**
   * Pay the whole order from the member's wallet (docs/API-MOBILE.md §18).
   * The row and the spend are written by `wallet_place_order` in one
   * transaction; a balance that does not cover the total writes neither and
   * throws {@link WalletDeclinedError}. Ignored on a ₺0 order.
   */
  payWithWallet?: boolean;
  /**
   * With `payWithWallet`: the total the member agreed to. A different
   * server total writes nothing and throws {@link WalletTotalChangedError}.
   */
  expectedTotalMinor?: number;
}

/**
 * A wallet order whose server total is not the one the member agreed to.
 * Nothing was written or charged, and the claimed discount was handed back:
 * a wallet payment is taken at once, so it cannot be shown first.
 */
export class WalletTotalChangedError extends Error {
  constructor(readonly totalMinor: number) {
    super(`wallet order total changed to ${totalMinor}`);
    this.name = "WalletTotalChangedError";
  }
}

/**
 * The wallet could not cover the order: nothing was written, and whatever
 * discount the order claimed has been handed back. The caller answers 409
 * `insufficient_balance`.
 */
export class WalletDeclinedError extends Error {
  constructor(orderId: string) {
    super(`wallet balance does not cover order ${orderId}`);
    this.name = "WalletDeclinedError";
  }
}

/**
 * Order lines as they are written, from lines resolved against `products`.
 * Each carries the KDV rate it is sold at (the product's own, else its
 * category's default) - read at sale time and never again.
 */
function shopLineItems(
  resolved: ResolvedLine[],
  rates: TaxRates,
): AdminOrderItem[] {
  return resolved.map((line) => ({
    productName: line.label,
    qty: line.qty,
    unitPriceMinor: line.unitPriceMinor,
    status: "pending",
    productId: line.product.id,
    ...(line.variant ? { variantId: line.variant.id } : {}),
    taxRatePct: productTaxRate(line.product, rates),
  }));
}

/**
 * Builds + persists the order row from already-resolved lines. Promo is
 * re-validated against the authoritative subtotal; shipping + total come from
 * settings (single source of truth).
 */
async function finalizeOrder(
  resolved: ResolvedLine[],
  rates: TaxRates,
  f: FinalizeOrderInput,
): Promise<{ order: AdminOrder; promoDropped: boolean }> {
  return insertOrderRow(shopLineItems(resolved, rates), f);
}

/**
 * The write behind every order: claims the promo/coupon against the
 * authoritative subtotal, computes the totals and inserts the row. Shared by
 * the web checkout, the admin's manual order and the app, which differ only in
 * where their lines come from and how shipping is charged.
 */
async function insertOrderRow(
  items: AdminOrderItem[],
  f: FinalizeOrderInput,
): Promise<{ order: AdminOrder; promoDropped: boolean }> {
  const sb = getDb();
  const subtotalMinor = items.reduce(
    (s, it) => s + it.unitPriceMinor * it.qty,
    0,
  );

  // Promo is re-validated here against the authoritative subtotal. If the
  // customer applied a code at the cart preview but it expired / hit its limit
  // before submit, we drop it (no discount) AND flag `promoDropped` so the
  // caller can warn instead of silently charging full price.
  let promoCode = "";
  let discountMinor = 0;
  let promoDropped = false;
  if (f.promoCode && f.promoCode.trim()) {
    const code = f.promoCode.trim();
    let applied = false;
    // 1) A personal coupon owned by this member is tried first and claimed
    //    atomically (single-use) before any discount is honored.
    if (f.customerEmail) {
      const couponCheck = await applyCustomerCoupon(
        code,
        f.customerEmail,
        subtotalMinor,
      );
      // A free-drink coupon (loyalty / invite) pays for a drink at the cafe;
      // on a shop order it would be ₺280 off a bag of beans. Dropped with the
      // usual promoDropped flag so the app can say why. The rule itself lives
      // in coupon-utils so the preview cannot drift away from it again.
      if (
        couponCheck.ok &&
        couponCheck.coupon &&
        couponAllowedForKind(couponCheck.coupon, f.kind)
      ) {
        const claimed = await redeemCustomerCoupon(
          couponCheck.coupon.code,
          f.customerEmail,
          f.orderNo,
        );
        if (claimed) {
          promoCode = couponCheck.coupon.code;
          discountMinor = couponCheck.discountMinor ?? 0;
          applied = true;
        }
      }
    }
    // 2) Otherwise fall back to a global promo code (shared code input).
    if (!applied) {
      const promoCheck = await applyPromoCode(code, subtotalMinor);
      // The use is taken FIRST: the limit is enforced by the take, so a code
      // whose last use went to a concurrent checkout is dropped here rather
      // than discounted twice.
      if (promoCheck.ok && (await consumePromoUsage(promoCheck.promo.code))) {
        promoCode = promoCheck.promo.code;
        discountMinor = promoCheck.discountMinor;
        applied = true;
      }
    }
    if (!applied) promoDropped = true;
  }

  const settings = await getSettings();
  const cfg: CheckoutConfig = {
    shippingFlatMinor: settings.shippingFlatMinor,
    shippingFreeThresholdMinor: settings.shippingFreeThresholdMinor,
  };
  const totals = computeTotalsWithShipping(
    subtotalMinor,
    discountMinor,
    f.shipping ?? { mode: "settings" },
    cfg,
  );

  const createdAt = new Date().toISOString();
  const order: AdminOrder = {
    id: f.orderId,
    orderNo: f.orderNo,
    customerName: f.customerName,
    customerEmail: f.customerEmail,
    customerPhone: f.customerPhone,
    shippingAddress: f.shippingAddress,
    internalNote: f.internalNote,
    status: f.status,
    items,
    subtotalMinor: totals.subtotalMinor,
    discountMinor: totals.discountMinor,
    promoCode,
    shippingMinor: totals.shippingMinor,
    totalMinor: totals.totalMinor,
    refunds: [],
    createdAt,
    // An admin's manual order can START as settled (paid at the counter). It
    // got no paidAt, so once cancelled refundRefusal saw money that was taken
    // as never collected and refused to give it back.
    ...(f.status === "paid" || f.status === "preparing"
      ? { paidAt: createdAt }
      : {}),
    legalConsent: f.legalConsent ?? {},
    // Only the app sets these; a web/admin row keeps the column defaults.
    ...(f.channel ? { channel: f.channel } : {}),
    ...(f.kind ? { kind: f.kind } : {}),
    ...(f.fulfillment ? { fulfillment: f.fulfillment } : {}),
    ...(f.scheduledFor !== undefined ? { scheduledFor: f.scheduledFor } : {}),
    ...(f.deliveryNote !== undefined ? { deliveryNote: f.deliveryNote } : {}),
    ...(f.clientOrderId ? { clientOrderId: f.clientOrderId } : {}),
    ...(f.tableCode
      ? { tableCode: f.tableCode, tableName: f.tableName ?? "" }
      : {}),
    ...(f.source ? { source: f.source } : {}),
  };
  // The discount was claimed before the row existed - deliberately, so it
  // cannot be double-spent while the customer is on the POS page. If the row
  // never lands, the claim has to come back: a member's single-use coupon
  // was otherwise marked redeemed against an order number that does not
  // exist, and a shared code lost a use nobody ever received.
  const giveBackDiscount = async () => {
    if (!promoCode) return;
    // Never let the compensation replace the error that caused it.
    try {
      const returned = f.customerEmail
        ? await releaseCustomerCoupon(promoCode, f.customerEmail, f.orderNo)
        : false;
      if (!returned) await releasePromoUsage(promoCode);
      else await settleLoyaltyAfterRelease(f.customerEmail, f.orderNo);
    } catch (releaseErr) {
      console.error(
        `[orders] releasing ${promoCode} after a failed order insert failed`,
        releaseErr,
      );
    }
  };

  if (
    f.payWithWallet &&
    f.expectedTotalMinor !== undefined &&
    order.totalMinor !== f.expectedTotalMinor
  ) {
    // Before anything is written: the total is this server's own, from the
    // claimed discount and the database prices, so there is nothing to race.
    await giveBackDiscount();
    throw new WalletTotalChangedError(order.totalMinor);
  }

  if (f.payWithWallet && order.totalMinor > 0) {
    // The row and the wallet spend in ONE transaction (the SQL function), so
    // there is never an order the wallet did not pay for, nor a spend without
    // its order. The total it debits is this row's own `totalMinor`.
    let placed: boolean;
    try {
      const { data, error, status } = await sb.rpc<boolean | null>(
        "wallet_place_order",
        {
          p_order: order,
          p_title: `Sipariş #${order.orderNo}`,
          p_created_at: createdAt,
        },
      );
      if (error) raiseDbError("finalizeOrder.wallet", error, status);
      placed = data === true;
    } catch (err) {
      await giveBackDiscount();
      throw err;
    }
    if (!placed) {
      await giveBackDiscount();
      throw new WalletDeclinedError(order.id);
    }
    return { order, promoDropped };
  }

  try {
    check(await sb.from(TABLES.orders).insert(order), "finalizeOrder.insert");
  } catch (err) {
    await giveBackDiscount();
    throw err;
  }
  return { order, promoDropped };
}

/**
 * Creates an order from a customer cart. Status starts at `pending_payment`;
 * the payment webhook advances it. See {@link resolveOrderLines} for the
 * server-authoritative price + stock guarantees.
 */
/**
 * How long an unpaid order may hold its stock.
 *
 * Long enough for a slow 3-D Secure step and a retry, short enough that an
 * abandoned checkout does not keep the last unit of a product off the shelf
 * overnight.
 */
export const PENDING_ORDER_TTL_MINUTES = 45;

/**
 * The order a member's checkout attempt already produced, if any.
 *
 * `clientOrderId` is generated by the app once per attempt: the same id coming
 * back means the member's phone gave up on a slow response and retried, not
 * that they want a second latte. Scoped to the member as well as the id, so
 * one client's id can never reach another's order.
 */
export async function findAppOrderByClientId(
  customerEmail: string,
  clientOrderId: string,
): Promise<AdminOrder | null> {
  const key = clientOrderId.trim();
  const owner = customerEmail.trim().toLowerCase();
  if (!key || !owner) return null;
  await ensureSeed();
  const sb = getDb();
  const found = rows<AdminOrder>(
    await sb
      .from(TABLES.orders)
      .select("*")
      .eq("clientOrderId", key)
      .order("orderNo", { ascending: false })
      .limit(5),
    "findAppOrderByClientId",
  );
  return (
    found.find((o) => o.customerEmail?.trim().toLowerCase() === owner) ?? null
  );
}

/** How long a sweep waits for the POS before leaving an order for next time. */
const POS_LOOKUP_TIMEOUT_MS = 5_000;
/**
 * Past this age an unpaid order is cancelled even when the POS could not be
 * asked. A lookup that has failed for a day is an outage or a
 * misconfiguration, and stock must not stay held behind it forever; a payment
 * found afterwards still lands - as `order_not_open`, in front of a human
 * (applyPaymentSucceeded).
 */
const POS_LOOKUP_GIVE_UP_MS = 24 * 60 * 60_000;

type PendingVerdict = "paid" | "unpaid" | "unknown";

/**
 * The provider the sweeps ask, or null when none can be built (a deployment
 * without its POS configuration; tests). Resolved once per sweep. Lazily
 * imported: the payment modules have no business loading with the store.
 */
async function lookupProvider(): Promise<PaymentProvider | null> {
  try {
    const { getPaymentProvider } = await import("@/lib/payment");
    return getPaymentProvider();
  } catch {
    return null;
  }
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Asks the POS whether a pending order was paid after all, and books the
 * payment when it was.
 *
 * The browser return is the only other way a payment lands, and it does not
 * always arrive: a closed tab, a dropped connection, a phone that locked on
 * the bank's 3-D Secure page. The sweep used to cancel on the clock alone and
 * hand the stock back while the money sat at the POS (docs/AUDIT.md §8,
 * docs/PAYNKOLAY.md §14.6/2).
 *
 * "unknown" - the POS could not be asked - is never read as "unpaid". A
 * provider that cannot be asked at all (the mock; no provider configured) has
 * nothing to add, and the order is judged on the clock as before.
 */
async function settlePendingFromProvider(
  order: AdminOrder,
  provider: PaymentProvider | null,
  { onAmountMismatch = "unpaid" }: { onAmountMismatch?: PendingVerdict } = {},
): Promise<PendingVerdict> {
  // The wallet first: an order whose spend exists WAS paid - the spend is
  // written with the row - even if the process died before marking it so.
  // It is booked now, and never cancelled here whatever the booking says:
  // cancelling would keep the member's money for an order nobody makes.
  const wallet = await settleWalletPayment(order.id);
  if (wallet) {
    if (!wallet.ok) {
      console.error(
        `[orders] wallet payment found but not booked order=${order.id}`,
        wallet.error,
      );
    }
    return "paid";
  }

  if (!provider?.lookupPayment) return "unpaid";

  let found: ReturnConfirmation | null;
  try {
    found = await withTimeout(
      provider.lookupPayment(order.id, new Date(order.createdAt)),
      POS_LOOKUP_TIMEOUT_MS,
    );
  } catch (err) {
    console.error(`[orders] POS lookup failed order=${order.id}`, err);
    return "unknown";
  }
  if (!found || found.status !== "succeeded") return "unpaid";

  const applied = await applyPaymentSucceeded({
    orderId: order.id,
    provider: provider.name,
    providerRef: found.providerRef,
    amountMinor: found.amountMinor,
    currency: found.currency,
    raw: found.raw,
    trxDate: found.trxDate,
  });
  if (!applied.ok) {
    console.error(
      `[orders] payment found at the POS but not booked order=${order.id}`,
      applied.error,
    );
    return "unknown";
  }
  // Collected, but not what the order costs: the order cannot advance, and
  // applyPaymentSucceeded has already put it in front of a human. It is
  // cancelled like any unpaid order, so its stock does not stay held while
  // that is sorted out - which is what the sweep always did with it.
  if (applied.reconcile === "amount_mismatch") return onAmountMismatch;
  return "paid";
}

/**
 * Asks the POS whether this pending order was already paid, booking the
 * payment when it was - the check the web checkout runs BEFORE it hands a
 * customer the old order's payment payload again.
 *
 * The scenario it closes: the customer pays at the bank, the browser's
 * return POST is lost, they press "öde" again and the same order is charged
 * a second time. `paid` means the money is there and booked (go to the
 * success page); `unpaid` means the POS knows nothing (the retry may reuse
 * the order); `unknown` means the POS could not be asked - the caller must
 * NOT reuse the order then. Short deadline (`POS_LOOKUP_TIMEOUT_MS`).
 */
export async function checkPendingOrderPaid(
  order: AdminOrder,
  provider: PaymentProvider | null,
): Promise<PendingVerdict> {
  // The POS collected a DIFFERENT amount: the sweep may cancel that order, but
  // a checkout retry must not hand out its payload again (the customer would
  // be charged on top of the wrong charge). "unknown" makes the caller open a
  // new order and leaves the mismatch with the human it was put in front of.
  return settlePendingFromProvider(order, provider, {
    onAmountMismatch: "unknown",
  });
}

/**
 * Cancels one unpaid order and returns what it held - after asking the POS.
 * The write is conditional on `pending_payment`, so a payment or a staff
 * action that lands in between wins. Resolves true when this call cancelled.
 */
async function cancelUnpaidOrder(
  order: AdminOrder,
  provider: PaymentProvider | null,
  { giveUpOnUnknown }: { giveUpOnUnknown: boolean },
): Promise<boolean> {
  const verdict = await settlePendingFromProvider(order, provider);
  if (verdict === "paid") return false;
  if (verdict === "unknown" && !giveUpOnUnknown) return false;
  const moved = rows<{ id: string }>(
    await getDb()
      .from(TABLES.orders)
      .update({ status: "cancelled" })
      .eq("id", order.id)
      .eq("status", "pending_payment")
      .select("id"),
    "cancelUnpaidOrder",
  );
  if (moved.length === 0) return false;
  await releaseOrderInventory(order);
  return true;
}

/**
 * Cancels checkouts that were never paid for, and returns what they held.
 *
 * There is no scheduler in this deployment, so the sweep runs at the start of
 * a checkout - the moment stock accuracy actually matters. It is bounded and
 * idempotent, and a failure here must never block the order being placed.
 * Each order is checked with the POS first (`settlePendingFromProvider`);
 * the checks run side by side, each bounded by POS_LOOKUP_TIMEOUT_MS.
 */
export async function expireStalePendingOrders(): Promise<number> {
  const now = Date.now();
  const cutoff = new Date(
    now - PENDING_ORDER_TTL_MINUTES * 60_000,
  ).toISOString();
  const stale = rows<AdminOrder>(
    await getDb()
      .from(TABLES.orders)
      .select("*")
      .eq("status", "pending_payment")
      // A manual "Ödeme bekleniyor" order (a phone order paid on delivery)
      // has no POS payment to wait for: the sweep used to cancel it after 45
      // minutes and hand its stock back without telling anyone.
      .neq("source", "manual")
      .lt("createdAt", cutoff)
      .order("createdAt", { ascending: true })
      .limit(20),
    "expireStalePendingOrders",
  );
  if (stale.length === 0) return 0;
  const provider = await lookupProvider();
  const outcomes = await Promise.allSettled(
    stale.map((order) =>
      cancelUnpaidOrder(order, provider, {
        giveUpOnUnknown:
          now - Date.parse(order.createdAt) >= POS_LOOKUP_GIVE_UP_MS,
      }),
    ),
  );
  let expired = 0;
  for (const outcome of outcomes) {
    if (outcome.status === "fulfilled") {
      if (outcome.value) expired += 1;
    } else {
      console.error("[orders] expiring a stale order failed", outcome.reason);
    }
  }
  return expired;
}

/**
 * Cancels the member's own earlier web checkouts that were never paid, so a
 * new attempt gets back what they held.
 *
 * A declined card sends the customer back to /odeme with the cart intact, and
 * the retry is a new order. The first one kept holding its stock and - worse -
 * its single-use coupon for 45 minutes, so the retry came back "kupon
 * uygulanamadı" (docs/AUDIT.md §8). The new checkout is the proof the old one
 * was abandoned, and it comes from the signed-in owner: the POS's return POST
 * carries no session cookie (SameSite=Lax), so cancelling there could be
 * forged against anyone's order id.
 *
 * The POS is still asked first: an order whose return never arrived may have
 * been paid, and is then booked instead. Only web orders: an app checkout
 * may be open in the phone's in-app browser at that very moment, and the app
 * has its own cap on unpaid orders (MAX_OPEN_ORDERS).
 */
export async function supersedeUnpaidWebOrders(
  customerEmail: string,
): Promise<number> {
  const email = customerEmail.trim();
  if (!email || email === "guest@laffogato.local") return 0;
  const open = rows<AdminOrder>(
    await getDb()
      .from(TABLES.orders)
      .select("*")
      .eq("customerEmail", email)
      .eq("status", "pending_payment")
      .order("createdAt", { ascending: true })
      .limit(10),
    "supersedeUnpaidWebOrders",
    // A manual order carries the customer's address too, and is not theirs
    // to supersede: it was typed into the panel and has no checkout behind it.
  ).filter(
    (order) => orderChannel(order) === "web" && order.source !== "manual",
  );
  if (open.length === 0) return 0;
  const provider = await lookupProvider();
  const outcomes = await Promise.allSettled(
    open.map((order) =>
      cancelUnpaidOrder(order, provider, { giveUpOnUnknown: false }),
    ),
  );
  return outcomes.filter((o) => o.status === "fulfilled" && o.value).length;
}

/**
 * Whether order `orderNo` is the member's own web checkout still waiting
 * for its payment.
 *
 * A single-use coupon is claimed when the order is created, before payment.
 * After a declined card the customer is back on /odeme with that order
 * pending, and the promo preview read the claim as "Bu kupon zaten
 * kullanıldı" - although the next order would release it first
 * (`supersedeUnpaidWebOrders`) and the retry may even pay for this very
 * order. The preview asks this before calling the coupon spent.
 */
export async function isOwnUnpaidWebOrder(
  customerEmail: string,
  orderNo: number,
): Promise<boolean> {
  const owner = customerEmail.trim().toLowerCase();
  if (!owner || !Number.isSafeInteger(orderNo) || orderNo <= 0) return false;
  await ensureSeed();
  const found = rows<AdminOrder>(
    await getDb()
      .from(TABLES.orders)
      .select("*")
      .eq("orderNo", orderNo)
      .limit(1),
    "isOwnUnpaidWebOrder",
  );
  const order = found[0];
  return (
    !!order &&
    order.status === "pending_payment" &&
    orderChannel(order) === "web" &&
    order.customerEmail.trim().toLowerCase() === owner
  );
}

export async function placeOrder(
  input: PlaceOrderInput,
): Promise<PlaceOrderResult> {
  await ensureSeed();

  // Reclaim stock from checkouts that were abandoned before this one started.
  // Never fatal: a customer's order must not fail because housekeeping did.
  try {
    await expireStalePendingOrders();
  } catch (err) {
    console.error("[orders] expiring stale pending orders failed", err);
  }

  // Refuse customer checkout while the shop is flagged closed in settings.
  // (Admin manual orders bypass this - see createManualOrder.)
  const settings = await getSettings();
  if (!settings.isShopOpen) {
    return { ok: false, reason: "shop_closed" };
  }

  // A retry after a declined card: the earlier unpaid order gives back its
  // coupon and stock before this one claims them. Never fatal either.
  if (input.customerEmail) {
    try {
      await supersedeUnpaidWebOrders(input.customerEmail);
    } catch (err) {
      console.error("[orders] superseding unpaid web orders failed", err);
    }
  }

  const resolveRes = await resolveOrderLines(input.items);
  if (!resolveRes.ok) return resolveRes.result;
  const { resolved, priceAdjusted } = resolveRes;

  const claimRes = await claimOrderStock(resolved);
  if (!claimRes.ok) return claimRes.result;

  // Everything past the claim is compensated on failure: without an `orders`
  // row the stale-checkout sweep has nothing to find, so a dropped connection
  // between the claim and the insert took the last unit off the shelf forever.
  let placed: { order: AdminOrder; promoDropped: boolean };
  try {
    const orderSeq = await nextSeq("ord");
    const orderNo = await nextSeq("orderNo");
    const orderId = slugifyId("ord", orderSeq);

    await recordOrderStockMoves(
      resolved,
      claimRes.stockAfters,
      orderId,
      `Sipariş #${orderNo}`,
      input.customerEmail ?? "customer",
    );

    placed = await finalizeOrder(resolved, settings.taxRates, {
      orderId,
      orderNo,
      status: "pending_payment",
      customerName: input.customerName?.trim() || "Misafir",
      customerEmail: input.customerEmail?.trim() || "guest@laffogato.local",
      customerPhone: input.customerPhone?.trim() ?? "",
      shippingAddress: input.shippingAddress?.trim() ?? "",
      internalNote: "",
      promoCode: input.promoCode,
      legalConsent: input.legalConsent,
    });
  } catch (err) {
    await releaseClaimedStock(resolved);
    throw err;
  }
  const { order, promoDropped } = placed;
  return { ok: true, order, priceAdjusted, promoDropped };
}

/** Manual orders may start in any of these states (admin records a real sale). */
export type ManualOrderStatus = "pending_payment" | "paid" | "preparing";

export interface CreateManualOrderInput {
  items: Array<{ productId: string; variantId?: string; qty: number }>;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  shippingAddress?: string;
  internalNote?: string;
  promoCode?: string;
  status: ManualOrderStatus;
  /**
   * How the order reaches the customer (admin audit ORD-01, karar D4);
   * Gel-al when omitted. It decides the delivery fee: nothing for Gel-al,
   * the courier fee for Kurye, the shop's shipping rule for Kargo.
   */
  fulfillment?: ManualFulfillment;
  /**
   * How the money was taken, for a paid or preparing start (karar D5):
   * written as the same `manual:<method>` payment row "Ödendi olarak
   * işaretle" writes. Never for an unpaid start.
   */
  paymentMethod?: ManualPaymentMethod | null;
  /** Admin email recorded as the stock-move actor. */
  actor: string;
}

export type ManualOrderResult =
  | (Extract<PlaceOrderResult, { ok: true }> & {
      /**
       * The payment row of a paid start: written, failed (the order stands,
       * the caller says so), or none owed.
       */
      payment: "recorded" | "failed" | "none";
    })
  | PlaceOrderFailure;

/**
 * Creates an order entered by an admin (phone/in-store sale). Mirrors
 * {@link placeOrder} - prices resolved server-side, stock atomically claimed -
 * but the admin chooses the initial status and customer details directly.
 */
export async function createManualOrder(
  input: CreateManualOrderInput,
): Promise<ManualOrderResult> {
  await ensureSeed();
  // A manual order bypasses the shop's open switch (see placeOrder). The
  // settings give the KDV defaults and the courier fee; the shop's shipping
  // rule is applied by insertOrderRow.
  const settings = await getSettings();
  const fulfillment: ManualFulfillment = input.fulfillment ?? "pickup";

  const resolveRes = await resolveOrderLines(
    input.items.map((it) => ({
      productId: it.productId,
      variantId: it.variantId,
      name: "",
      qty: it.qty,
    })),
  );
  if (!resolveRes.ok) return resolveRes.result;
  const { resolved } = resolveRes;

  const claimRes = await claimOrderStock(resolved);
  if (!claimRes.ok) return claimRes.result;

  // Compensated on failure exactly like placeOrder: a manual order has no
  // pending_payment sweep to fall back on either (it may start `paid`), so a
  // throw between the claim and the insert took the units off the shelf for
  // good.
  let placed: { order: AdminOrder; promoDropped: boolean };
  try {
    const orderSeq = await nextSeq("ord");
    const orderNo = await nextSeq("orderNo");
    const orderId = slugifyId("ord", orderSeq);

    await recordOrderStockMoves(
      resolved,
      claimRes.stockAfters,
      orderId,
      `Manuel sipariş #${orderNo}`,
      input.actor || "admin",
    );

    placed = await finalizeOrder(resolved, settings.taxRates, {
      orderId,
      orderNo,
      status: input.status,
      customerName: input.customerName.trim() || "Müşteri",
      customerEmail: input.customerEmail?.trim() ?? "",
      customerPhone: input.customerPhone?.trim() ?? "",
      shippingAddress: input.shippingAddress?.trim() ?? "",
      internalNote: input.internalNote?.trim().slice(0, 2000) ?? "",
      promoCode: input.promoCode,
      // Every manual order used to be a parcel: a counter sale could only
      // be closed with an invented tracking number, and under the
      // free-shipping threshold it paid the flat shipping fee.
      fulfillment,
      shipping: manualShippingMode(fulfillment, settings),
      // No POS behind it: the stale-checkout sweep must leave it alone.
      source: "manual",
    });
  } catch (err) {
    await releaseClaimedStock(resolved);
    throw err;
  }
  const { order, promoDropped } = placed;

  // A paid start records how it was paid, like "Ödendi olarak işaretle":
  // the order page said "Bu siparişte ödeme kaydı yok." and cash, the
  // counter's card terminal and a transfer could not be told apart. After
  // the insert, and never fatal: the sale happened and its row is written.
  let payment: "recorded" | "failed" | "none" = "none";
  if (
    input.paymentMethod &&
    (order.status === "paid" || order.status === "preparing")
  ) {
    try {
      const row = await insertManualPaymentRow(
        order,
        input.paymentMethod,
        input.actor,
      );
      payment = row.error ? "failed" : "recorded";
      if (row.error) {
        console.error(
          `[orders] manual order ${order.id}: payment row not written`,
          row.error,
        );
      }
    } catch (err) {
      payment = "failed";
      console.error(
        `[orders] manual order ${order.id}: payment row not written`,
        err,
      );
    }
  }
  return { ok: true, order, priceAdjusted: false, promoDropped, payment };
}

// ── App orders (docs/API-MOBILE.md §3) ────────────────────────────────────

export interface AppCafeLineInput {
  menuItemId: string;
  qty: number;
  size: OrderItemSize;
  options: LineOptions;
}

export interface AppShopLineInput {
  productId: string;
  variantId?: string;
  qty: number;
  /** Grind choice etc.; shown on the line, no effect on price. */
  note?: string;
}

export type AppOrderLineInput = AppCafeLineInput | AppShopLineInput;

export function isAppCafeLine(
  line: AppOrderLineInput,
): line is AppCafeLineInput {
  return "menuItemId" in line;
}

export interface AppOrderInput {
  lines: AppOrderLineInput[];
  fulfillment: OrderFulfillment;
  customerName: string;
  /** The authenticated member's e-mail - never read from the request body. */
  customerEmail: string;
  customerPhone: string;
  /** Already formatted for the row; "" on a pickup. */
  shippingAddress: string;
  deliveryNote: string;
  /** ISO instant, or null/"" for as soon as possible. */
  scheduledFor: string | null;
  promoCode: string;
  legalConsent: OrderLegalConsent;
  /**
   * The app's own id for this checkout attempt; "" when it did not send one.
   * Stored on the row behind a partial unique index per member, so a retried
   * POST is recognised instead of placing a second order.
   */
  clientOrderId?: string;
  /**
   * Pay from the member's wallet (docs/API-MOBILE.md §18): all of it or
   * nothing. The caller has already checked that the wallet is enabled.
   */
  payWithWallet?: boolean;
  /** With `payWithWallet`: the total the member agreed to (§18). */
  expectedTotalMinor?: number;
  /**
   * `fulfillment: "table"` only: the ACTIVE table the caller resolved from
   * the request's code (`resolveActiveTable`). Snapshotted onto the row.
   */
  tableCode?: string;
  tableName?: string;
}

export type PlaceAppOrderResult =
  | { ok: true; order: AdminOrder; promoDropped: boolean }
  | Exclude<PlaceOrderResult, { ok: true }>
  | { ok: false; reason: "cafe_closed" }
  | { ok: false; reason: "insufficient_balance" }
  | { ok: false; reason: "total_changed"; totalMinor: number }
  | { ok: false; reason: "bad_line"; productName: string; message: string }
  | { ok: false; reason: "bad_request"; message: string };

/** Every way an app order can be refused. */
export type AppOrderFailure = Exclude<PlaceAppOrderResult, { ok: true }>;

type CafeLinesResult =
  | { ok: true; items: AdminOrderItem[] }
  | { ok: false; result: AppOrderFailure };

/**
 * Prices cafe lines against `menu_items`. SECURITY: the unit price is the
 * menu row's size price plus the option surcharges from the server-side
 * customisation table - nothing from the request. Cafe lines hold no stock,
 * so there is nothing to claim.
 */
async function resolveCafeLines(
  lines: AppCafeLineInput[],
  rates: TaxRates,
): Promise<CafeLinesResult> {
  const clean = lines.filter((l) => l.qty > 0);
  if (clean.length === 0) {
    return { ok: false, result: { ok: false, reason: "empty" } };
  }
  const ids = Array.from(new Set(clean.map((l) => l.menuItemId)));
  const sb = getDb();
  const docs = rows<AdminMenuItem>(
    await sb.from(TABLES.menuItems).select("*").in("id", ids),
    "placeAppOrder.menuItems",
  );
  const byId = new Map(docs.map((d) => [d.id, d]));

  const items: AdminOrderItem[] = [];
  for (const line of clean) {
    const item = byId.get(line.menuItemId);
    if (!item) {
      return {
        ok: false,
        result: {
          ok: false,
          reason: "not_found",
          productName: line.menuItemId,
        },
      };
    }
    if (line.qty > MAX_LINE_QTY) {
      return {
        ok: false,
        result: {
          ok: false,
          reason: "qty_too_high",
          productName: item.name,
          max: MAX_LINE_QTY,
        },
      };
    }
    const priced = priceCafeLine(item, line.size, line.options);
    if (!priced.ok) {
      return {
        ok: false,
        result: {
          ok: false,
          reason: "bad_line",
          productName: item.name,
          message: priced.message,
        },
      };
    }
    items.push({
      productName: item.name,
      qty: line.qty,
      unitPriceMinor: priced.unitPriceMinor,
      status: "pending",
      menuItemId: item.id,
      size: priced.size,
      options: { ...priced.options },
      detail: priced.detail,
      // The item's own rate, else the menu default: 10% for a yeme-içme
      // sale whether it is served, collected or couriered.
      taxRatePct: menuItemTaxRate(item, rates),
    });
  }
  return { ok: true, items };
}

function toPlaceOrderItem(line: AppShopLineInput): PlaceOrderItemInput {
  return {
    productId: line.productId,
    variantId: line.variantId,
    name: "",
    qty: line.qty,
  };
}

/**
 * Carries the app's per-line note (the grind) onto the written line. The
 * resolver keeps line order, and the app never sends a zero quantity, so the
 * two lists line up one to one; if they ever did not, the notes are dropped
 * rather than attached to the wrong product.
 */
function withShopNotes(
  items: AdminOrderItem[],
  lines: AppShopLineInput[],
): AdminOrderItem[] {
  const clean = lines.filter((l) => l.qty > 0);
  if (clean.length !== items.length) return items;
  return items.map((it, i) => {
    const note = clean[i].note?.trim();
    return note ? { ...it, detail: note.slice(0, 120) } : it;
  });
}

function splitAppLines(lines: AppOrderLineInput[]): {
  cafe: AppCafeLineInput[];
  shop: AppShopLineInput[];
} {
  const cafe: AppCafeLineInput[] = [];
  const shop: AppShopLineInput[] = [];
  for (const line of lines) {
    if (isAppCafeLine(line)) cafe.push(line);
    else shop.push(line);
  }
  return { cafe, shop };
}

const MIXED_BASKET_MSG =
  "Kafe ürünleri ile mağaza ürünleri aynı siparişte verilemez.";

export type AppOrderLinesResult =
  | { ok: true; items: AdminOrderItem[]; kind: OrderKind }
  | { ok: false; result: AppOrderFailure };

/**
 * Resolves and prices app lines WITHOUT claiming stock, a promo or a
 * sequence number - the basket preview (`POST /orders/preview`). Stock is
 * still checked so an out-of-stock line is reported before checkout.
 */
export async function previewAppOrderLines(
  lines: AppOrderLineInput[],
  rates: TaxRates,
): Promise<AppOrderLinesResult> {
  await ensureSeed();
  const { cafe, shop } = splitAppLines(lines);
  if (cafe.length > 0 && shop.length > 0) {
    return {
      ok: false,
      result: { ok: false, reason: "bad_request", message: MIXED_BASKET_MSG },
    };
  }
  if (cafe.length > 0) {
    const res = await resolveCafeLines(cafe, rates);
    return res.ok
      ? { ok: true, items: res.items, kind: "cafe" }
      : { ok: false, result: res.result };
  }
  const res = await resolveOrderLines(shop.map(toPlaceOrderItem));
  if (!res.ok) return { ok: false, result: res.result };
  return {
    ok: true,
    items: withShopNotes(shopLineItems(res.resolved, rates), shop),
    kind: "shop",
  };
}

/**
 * Creates an order placed from the mobile app. Cafe lines are priced from
 * `menu_items` and hold no stock; shop lines go through exactly the web
 * checkout's resolve → atomic claim → stock-move path. Status starts at
 * `pending_payment`; the payment webhook advances it.
 */
export async function placeAppOrder(
  input: AppOrderInput,
): Promise<PlaceAppOrderResult> {
  await ensureSeed();

  // Same housekeeping as the web checkout - and just as non-fatal.
  try {
    await expireStalePendingOrders();
  } catch (err) {
    console.error("[orders] expiring stale pending orders failed", err);
  }

  const settings = await getSettings();
  const { cafe, shop } = splitAppLines(input.lines);
  if (cafe.length === 0 && shop.length === 0) {
    return { ok: false, reason: "empty" };
  }
  if (cafe.length > 0 && shop.length > 0) {
    return { ok: false, reason: "bad_request", message: MIXED_BASKET_MSG };
  }
  const kind: OrderKind = cafe.length > 0 ? "cafe" : "shop";
  // "Online mağaza açık" is the parcel shop's switch - the one the owner
  // unticks to pause shipping for a holiday. It used to refuse every app
  // order, so the house stayed open, the live-status card said "Şu an açık",
  // and every gel-al latte came back `shop_closed`. Cafe ordering has its own
  // switches (`mobileApp.ordering`, checked by the caller) and the venue's
  // hours and manual override below.
  if (kind === "shop" && !settings.isShopOpen) {
    return { ok: false, reason: "shop_closed" };
  }
  if (!fulfillmentAllowed(kind, input.fulfillment)) {
    return {
      ok: false,
      reason: "bad_request",
      message:
        kind === "cafe"
          ? "Kafe siparişi gel-al, kurye ya da masaya servis ile teslim edilir."
          : "Mağaza siparişi kargo ile gönderilir.",
    };
  }
  // The wire schema and the use-case already hold these; the store does not
  // write a table order it cannot attribute to a table, nor a scheduled one.
  const tableCode = (input.tableCode ?? "").trim();
  if (input.fulfillment === "table") {
    if (!tableCode) {
      return { ok: false, reason: "bad_request", message: "Masa kodu gerekli." };
    }
    if (input.scheduledFor) {
      return {
        ok: false,
        reason: "bad_request",
        message: "Masaya sipariş planlanamaz; hemen hazırlanır.",
      };
    }
  }
  const scheduled = normalizeScheduledFor(input.scheduledFor, new Date());
  if (!scheduled.ok) {
    return { ok: false, reason: "bad_request", message: scheduled.message };
  }

  if (kind === "cafe") {
    // The house must be open - at the requested time for a scheduled order,
    // right now otherwise - with the staff override honoured either way.
    // Imported lazily: the venue module reads settings from this store.
    const { getVenueStatus, isCafeOpenNow } =
      await import("@/lib/mobile/venue");
    const venue = await getVenueStatus();
    const at = scheduled.value ? new Date(scheduled.value) : new Date();
    if (!isCafeOpenNow(settings.weeklyHours, venue.manualOverride, at)) {
      return { ok: false, reason: "cafe_closed" };
    }
  }

  const common = {
    status: "pending_payment" as const,
    customerName: input.customerName.trim() || "Üye",
    customerEmail: input.customerEmail.trim().toLowerCase(),
    customerPhone: input.customerPhone.trim(),
    // A table order goes across the room: no address is ever written for it.
    shippingAddress:
      input.fulfillment === "table" ? "" : input.shippingAddress.trim(),
    internalNote: "",
    promoCode: input.promoCode,
    legalConsent: input.legalConsent,
    channel: "app" as const,
    kind,
    fulfillment: input.fulfillment,
    scheduledFor: scheduled.value,
    deliveryNote: input.deliveryNote.trim().slice(0, 500),
    shipping: shippingModeFor(input.fulfillment, settings),
    ...(input.fulfillment === "table"
      ? {
          tableCode,
          tableName: (input.tableName ?? "").trim().slice(0, 40),
        }
      : {}),
  };

  if (kind === "cafe") {
    const cafeRes = await resolveCafeLines(cafe, settings.taxRates);
    if (!cafeRes.ok) return cafeRes.result;

    const orderSeq = await nextSeq("ord");
    const orderNo = await nextSeq("orderNo");
    const orderId = slugifyId("ord", orderSeq);
    try {
      const { order, promoDropped } = await insertOrderRow(cafeRes.items, {
        orderId,
        orderNo,
        clientOrderId: input.clientOrderId,
        payWithWallet: input.payWithWallet,
        expectedTotalMinor: input.expectedTotalMinor,
        ...common,
      });
      return { ok: true, order, promoDropped };
    } catch (err) {
      if (err instanceof WalletDeclinedError) {
        return { ok: false, reason: "insufficient_balance" };
      }
      if (err instanceof WalletTotalChangedError) {
        return { ok: false, reason: "total_changed", totalMinor: err.totalMinor };
      }
      throw err;
    }
  }

  const resolveRes = await resolveOrderLines(shop.map(toPlaceOrderItem));
  if (!resolveRes.ok) return resolveRes.result;
  const { resolved } = resolveRes;

  const claimRes = await claimOrderStock(resolved);
  if (!claimRes.ok) return claimRes.result;

  // A wallet order is refused by the balance only at the insert, which is an
  // everyday outcome rather than a fault. Its stock moves are therefore
  // written AFTER the row exists: written first, a short balance would leave
  // "Uygulama siparişi #…" sales in the stock ledger for an order that never
  // existed. A card order keeps the original order of writes.
  const walletPay = input.payWithWallet === true;
  const recordMoves = (orderId: string, orderNo: number) =>
    recordOrderStockMoves(
      resolved,
      claimRes.stockAfters,
      orderId,
      `Uygulama siparişi #${orderNo}`,
      common.customerEmail,
    );

  // Same compensation as the web checkout: nothing between the claim and the
  // insert may leave stock held by an order that does not exist.
  let placed: { order: AdminOrder; promoDropped: boolean };
  try {
    const orderSeq = await nextSeq("ord");
    const orderNo = await nextSeq("orderNo");
    const orderId = slugifyId("ord", orderSeq);
    if (!walletPay) await recordMoves(orderId, orderNo);
    placed = await insertOrderRow(
      withShopNotes(shopLineItems(resolved, settings.taxRates), shop),
      {
        orderId,
        orderNo,
        clientOrderId: input.clientOrderId,
        payWithWallet: walletPay,
        expectedTotalMinor: input.expectedTotalMinor,
        ...common,
      },
    );
  } catch (err) {
    await releaseClaimedStock(resolved);
    if (err instanceof WalletDeclinedError) {
      return { ok: false, reason: "insufficient_balance" };
    }
    if (err instanceof WalletTotalChangedError) {
      return { ok: false, reason: "total_changed", totalMinor: err.totalMinor };
    }
    throw err;
  }
  if (walletPay) {
    // The order exists and is paid for: a failed audit row must not hand its
    // stock back. Logged loudly instead, for a human to add the move.
    try {
      await recordMoves(placed.order.id, placed.order.orderNo);
    } catch (err) {
      console.error(
        `[orders] stock moves of wallet order ${placed.order.id} were not recorded`,
        err,
      );
    }
  }
  return { ok: true, order: placed.order, promoDropped: placed.promoDropped };
}

// ── Payment application ───────────────────────────────────────────────────

/** Why a payment arrived but could not be applied to its order. */
export type PaymentReconcileReason =
  | "amount_mismatch"
  | "order_not_open"
  | "duplicate_payment";

export type PaymentApplyResult =
  | { ok: true; reconcile?: PaymentReconcileReason }
  | { ok: false; error: string };

/**
 * Books a payment that arrived but could not be applied to its order.
 *
 * Both cases used to end at a `console.warn`: a confirmation for an order the
 * 45-minute sweep had already cancelled was recorded, the customer was mailed
 * "ödemen alındı", and the order stayed cancelled with nobody refunding
 * anything; an amount mismatch answered the provider with a 500 it retried
 * forever. The money is real either way, so it goes into the audit log where
 * a human finds it. Nothing refunds automatically - handing the drink over or
 * giving the money back is the venue's call, not this function's.
 */
async function noteUnreconciledPayment(
  order: AdminOrder,
  input: { provider: string; providerRef: string; amountMinor: number },
  reason: PaymentReconcileReason,
): Promise<void> {
  console.error(
    `[payment] UNRECONCILED order=${order.id} orderNo=${order.orderNo} ` +
      `reason=${reason} status=${order.status} expected=${order.totalMinor} ` +
      `collected=${input.amountMinor} provider=${input.provider} ref=${input.providerRef}`,
  );
  // The flag the order list's "Dikkat" filter and the order page's red
  // banner read. The audit row below says what exactly happened; this only
  // makes sure somebody opens it.
  await setOrderAttention(order.id, reason);
  try {
    // Lazily imported: the audit module reads the admin session, and a
    // bookkeeping failure must never turn a settled payment into an error.
    const { logAudit } = await import("./audit");
    await logAudit({
      actor: "system",
      action: "update",
      entity: "order",
      entityId: order.id,
      payload: {
        event: "payment_unreconciled",
        reason,
        orderNo: order.orderNo,
        status: order.status,
        expectedMinor: order.totalMinor,
        collectedMinor: input.amountMinor,
        provider: input.provider,
        providerRef: input.providerRef,
      },
    });
  } catch (err) {
    console.error(
      `[payment] audit row for the unreconciled payment failed order=${order.id}`,
      err,
    );
  }
}

/**
 * Sets (or with "" clears) what needs a human on this order. Never throws:
 * every caller has just written something that matters more - a payment, a
 * cancel - and a flag that did not land must not undo it.
 */
export async function setOrderAttention(
  orderId: string,
  attention: OrderAttention | "",
): Promise<boolean> {
  try {
    const { error } = await getDb()
      .from(TABLES.orders)
      .update({ attention })
      .eq("id", orderId);
    if (error) throw new Error(error.message);
    return true;
  } catch (err) {
    console.error(
      `[orders] attention flag not written order=${orderId} attention=${attention}`,
      err,
    );
    return false;
  }
}

/** Is there a succeeded transaction for this order under another reference? */
async function hasOtherSucceededPayment(
  orderId: string,
  input: { provider: string; providerRef: string },
): Promise<boolean> {
  const { data, error } = await getDb()
    .from(TABLES.paymentTransactions)
    .select("provider, providerRef")
    .eq("orderId", orderId)
    .eq("status", "succeeded");
  if (error) {
    // Unknown is not "no": log it and let the caller treat the confirmation
    // as the ordinary repeated one it most likely is.
    console.error(`[payment] duplicate check failed order=${orderId}`, error);
    return false;
  }
  return (
    (data as { provider: string; providerRef: string }[] | null) ?? []
  ).some(
    (t) => t.provider !== input.provider || t.providerRef !== input.providerRef,
  );
}

/**
 * Books the wallet payment of an order the wallet paid for, through the same
 * path a card confirmation takes - `paid`, the stamp, the invite, the
 * "ödemen alındı" e-mail. Null when the wallet did not pay this order.
 *
 * The amount is the spend row's, written in the same transaction as the order
 * from the row's own total, so it always matches. Idempotent like every
 * confirmation: one `payment_transactions` row per order (`wallet_<id>`).
 */
export async function settleWalletPayment(
  orderId: string,
): Promise<PaymentApplyResult | null> {
  const spend = await walletSpendFor(orderId);
  if (!spend) return null;
  return applyPaymentSucceeded({
    orderId,
    provider: WALLET_PROVIDER,
    providerRef: walletProviderRef(orderId),
    amountMinor: spend.amountMinor,
    currency: "TRY",
    raw: { source: "wallet" },
  });
}

/** How long after `paidAt` a repeated confirmation re-offers the customer's mail. */
const PAID_NOTICE_REOFFER_MS = 24 * 60 * 60_000;

/** Order states in which a repeated confirmation may re-offer the staff mail. */
const STAFF_NOTICE_STATES: ReadonlySet<string> = new Set([
  "paid",
  "preparing",
  "shipped",
  "completed",
]);

/**
 * Hands the staff "new order" mail to `after()`: sent once the response is
 * out, never awaited by the payment and never able to fail it. Outside a
 * request (a script, a test) there is nothing to run it after, and the mail
 * is skipped rather than sent from a promise nobody waits for.
 */
function scheduleStaffNewOrderNotice(orderId: string, provider: string): void {
  try {
    after(async () => {
      try {
        // Lazily: the notice module reads this store.
        const { notifyStaffNewOrder } =
          await import("@/lib/email/staff-order-notice");
        await notifyStaffNewOrder(orderId, { provider });
      } catch (err) {
        console.error(`[staff-order-notice] order=${orderId}`, err);
      }
    });
  } catch (err) {
    console.warn(
      `[staff-order-notice] not scheduled order=${orderId}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Records a successful payment and advances the order to `paid`. Idempotent:
 * the unique (provider, providerRef) index makes a duplicate insert a no-op
 * (23505) and the order update is guarded on `pending_payment`. Used by the
 * dev-only mock return handler (and reusable by a real provider webhook).
 */
export async function applyPaymentSucceeded(input: {
  orderId: string;
  provider: string;
  providerRef: string;
  amountMinor: number;
  currency: string;
  raw?: unknown;
  /**
   * The provider's calendar day for the transaction, `YYYY-MM-DD`
   * (`ReturnConfirmation.trxDate`). Kept on the row so a refund does not have
   * to search the provider for it; anything else is stored as ''.
   */
  trxDate?: string;
}): Promise<PaymentApplyResult> {
  const sb = getDb();

  // What the POS actually collected, against what the order costs.
  //
  // Nothing compared the two: a notification claiming ₺1 for a ₺500 order
  // marked it paid and sent the customer a confirmation. The transaction is
  // still recorded - the money did arrive and the row is the audit trail -
  // but the order does not advance, and the mismatch is logged loudly for a
  // human, because it means either a tampered notification or a real
  // short-collection that has to be reconciled by hand.
  const order = await getOrder(input.orderId);
  if (!order) return { ok: false, error: `order ${input.orderId} not found` };
  const shortfall = order.totalMinor - input.amountMinor;
  // One lira of slack for a provider that rounds its own way.
  const amountMatches = Math.abs(shortfall) <= 100;

  const ins = await sb.from(TABLES.paymentTransactions).insert({
    orderId: input.orderId,
    provider: input.provider,
    providerRef: input.providerRef,
    status: "succeeded",
    amountMinor: input.amountMinor,
    currency: input.currency,
    raw: input.raw ?? null,
    trxDate: isoDay(input.trxDate),
    createdAt: new Date().toISOString(),
  });
  // A clean insert means this is the FIRST confirmation; a 23505 is a duplicate
  // webhook/return - used below to tell a second charge from a replay.
  const isFirstConfirmation = !ins.error;
  if (ins.error && ins.error.code !== "23505") {
    return { ok: false, error: ins.error.message };
  }
  if (!amountMatches) {
    // Answered `ok` on purpose: the transaction row above IS the record, and a
    // failure here made the provider retry a notification that can never
    // succeed. The order still does not advance - a human reconciles it.
    await noteUnreconciledPayment(order, input, "amount_mismatch");
    return { ok: true, reconcile: "amount_mismatch" };
  }

  const paidAt = new Date().toISOString();
  const upd = await sb
    .from(TABLES.orders)
    .update({ status: "paid", paidAt })
    .eq("id", input.orderId)
    .eq("status", "pending_payment")
    .select("id");
  if (upd.error) return { ok: false, error: upd.error.message };
  // Zero rows means the order was no longer pending - expired to `cancelled`
  // by the stale sweep, or already paid. Loyalty must follow a payment that
  // actually advanced the order, never a late or repeated confirmation.
  const advanced = ((upd.data as { id: string }[] | null) ?? []).length > 0;

  // Not advancing has two very different causes. Either the order had already
  // moved on (a repeated confirmation, or staff starting it early) - harmless
  // - or the stale sweep cancelled it and handed its stock back while the
  // customer was still in the bank's 3-D Secure step, in which case we are
  // holding money for an order that will never be fulfilled.
  let unreconciled: PaymentReconcileReason | null = null;
  if (!advanced) {
    const current = await getOrder(input.orderId);
    if (current?.status === "cancelled" || current?.status === "refunded") {
      unreconciled = "order_not_open";
      await noteUnreconciledPayment(
        { ...order, status: current.status },
        input,
        "order_not_open",
      );
    } else if (
      isFirstConfirmation &&
      (await hasOtherSucceededPayment(input.orderId, input))
    ) {
      // A SECOND charge, not a repeated notification: a new reference on an
      // order another succeeded transaction already paid. PayNkolay allows
      // several attempts under one clientRefCode, and the bridge page can be
      // re-submitted from the browser's Back button. This used to pass as
      // "harmless" - the customer was charged twice and mailed "ödemen
      // alındı" twice, and nobody was told.
      unreconciled = "duplicate_payment";
      await noteUnreconciledPayment(
        { ...order, status: current?.status ?? order.status },
        input,
        "duplicate_payment",
      );
    } else {
      console.warn(
        `[payment] order ${input.orderId} was not pending — loyalty skipped`,
      );
      // A repeat of the confirmation that already paid it (the same
      // transaction again: the bank's return after the webhook, a replay):
      // the staff mail is offered again. The notice's own claim makes this a
      // no-op once one was sent or is being sent, so it only ever goes out
      // here if the first attempt reached nobody, and only while the order
      // is fresh. An order staff settled by hand is not a repeat and is not
      // re-announced.
      if (
        !isFirstConfirmation &&
        current &&
        STAFF_NOTICE_STATES.has(current.status)
      ) {
        scheduleStaffNewOrderNotice(order.id, input.provider);
      }
      // The same for the customer's "ödemen alındı": if the mail of the
      // confirmation that paid the order did not get out (the provider was
      // down for both attempts, the claim was released), the bank's return
      // arriving again is the next chance. The claim in `notifyOrderPaid`
      // makes this a no-op once one was sent or is being sent. Bounded by
      // the age of the payment: a replay weeks later is not news.
      if (
        !isFirstConfirmation &&
        current &&
        STAFF_NOTICE_STATES.has(current.status) &&
        Date.now() - Date.parse(current.paidAt ?? "") <= PAID_NOTICE_REOFFER_MS
      ) {
        await notifyOrderPaid(current);
      }
    }
  }

  // Loyalty follows the payment but must never undo it: a stamp that fails to
  // land is logged, the money stays recorded.
  if (advanced) {
    await awardLoyalty({ ...order, status: "paid", paidAt }, "payment");
    // The team's "yeni sipariş" mail: after the response, once per order
    // (the notice claims it; a repeated confirmation below may re-offer it).
    scheduleStaffNewOrderNotice(order.id, input.provider);
  }

  // "Ödemen alındı" - the customer's only order mail before shipping - goes
  // out when, and only when, THIS confirmation moved the order to paid. Not
  // for an order the sweep cancelled while the bank was asking (the customer
  // used to be told it was on its way while the row said otherwise), not for
  // a repeated or second confirmation, never twice (`notifyOrderPaid` claims
  // its row first). It never throws into the payment that just landed.
  if (advanced) {
    await notifyOrderPaid({ ...order, status: "paid", paidAt });
  }
  return unreconciled ? { ok: true, reconcile: unreconciled } : { ok: true };
}

/**
 * Records a refund the payment provider told us about, over its webhook.
 *
 * Distinct from `refundOrder`, which is the admin *initiating* a refund. Here
 * the money has already moved at the provider, so this only has to make the
 * order reflect it: append to the refund ledger and flip the status to
 * `refunded` **only** once the refunded total reaches the order total. A
 * partial refund leaves the order in its current state, which is what the
 * admin page, the reports and the customer's own order page all read.
 *
 * Idempotent on the provider reference: a retried webhook hits the unique
 * (provider, providerRef) index and returns without touching the order again.
 *
 * The ledger row is keyed on `${providerRef}:refund`, NOT on the bare
 * reference. `payment_txn_provider_ref_key` is (provider, "providerRef") with
 * no status column, and a provider may derive the same reference for a charge
 * and for its later refund - so the bare reference collided with the succeeded
 * row that is always inserted first, every provider-side refund was mistaken
 * for a duplicate notification, and the order silently stayed `paid` while
 * the money had left. Suffixing the refund gives the two events distinct
 * identities without a migration.
 *
 * Limitation worth naming: a notification that carries no per-refund id means
 * two SEPARATE partial refunds from the provider produce the same suffixed
 * reference and only the first is recorded. Partial refunds issued from the
 * admin panel go through `refundOrder`, which is unaffected.
 */
export async function recordProviderRefund(input: {
  orderId: string;
  provider: string;
  providerRef: string;
  amountMinor: number;
  currency: string;
  raw?: unknown;
}): Promise<PaymentApplyResult> {
  const sb = getDb();
  const refundRef = `${input.providerRef}:refund`;
  const ins = await sb.from(TABLES.paymentTransactions).insert({
    orderId: input.orderId,
    provider: input.provider,
    providerRef: refundRef,
    status: "refunded",
    amountMinor: input.amountMinor,
    currency: input.currency,
    raw: input.raw ?? null,
    createdAt: new Date().toISOString(),
  });
  if (ins.error) {
    // 23505 = duplicate notification; the ledger already has this refund.
    if (ins.error.code === "23505") return { ok: true };
    return { ok: false, error: ins.error.message };
  }

  const order = await getOrder(input.orderId);
  if (!order) return { ok: false, error: "Sipariş bulunamadı." };

  const already = order.refunds.reduce((sum, r) => sum + r.amountMinor, 0);
  // Never record more than the order is worth, however the provider reports it.
  const amount = Math.min(
    Math.max(0, input.amountMinor),
    Math.max(0, order.totalMinor - already),
  );
  if (amount === 0) return { ok: true };

  const refunds = [
    ...order.refunds,
    {
      id: `rfn-${order.refunds.length + 1}-${input.providerRef}`,
      amountMinor: amount,
      reason: `Sağlayıcı iadesi (${input.provider})`,
      createdAt: new Date().toISOString(),
    },
  ];
  const fullyRefunded =
    refunds.reduce((sum, r) => sum + r.amountMinor, 0) >= order.totalMinor;

  const upd = await sb
    .from(TABLES.orders)
    .update({ refunds, status: fullyRefunded ? "refunded" : order.status })
    .eq("id", input.orderId);
  if (upd.error) return { ok: false, error: upd.error.message };
  // Same rule as the admin path: after every refund the order keeps only the
  // stamps its remaining goods earn (none once fully refunded). Without this
  // a member could farm stamps by ordering and refunding through the
  // provider, in full or in parts.
  await reverseLoyalty(
    { ...order, refunds, status: fullyRefunded ? "refunded" : order.status },
    "provider-refund",
    { full: fullyRefunded },
  );
  // The provider has already moved the money back to the card it came from.
  await notifyOrderRefunded(
    {
      ...order,
      refunds,
      status: fullyRefunded ? "refunded" : order.status,
    },
    refunds[refunds.length - 1],
    { viaCard: true },
  );
  return { ok: true };
}

/** `YYYY-MM-DD` or ''. The column never holds a half-read provider date. */
function isoDay(value: string | undefined): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value ?? "") ? (value as string) : "";
}

/**
 * The payment a refund goes back through: the latest succeeded payment row
 * of the order - its provider reference, what was collected, and the
 * provider's day for it ('' on rows written before the column existed) so
 * the refund need not look it up.
 *
 * Manual rows (`manual:<method>`, "Ödendi olarak işaretle") are skipped: the
 * cash was taken at the counter, there is no card to send it back to, and
 * asking the POS to refund `manual-<id>` would be refused at best.
 */
export async function getOrderPaymentRef(orderId: string): Promise<{
  provider: string;
  providerRef: string;
  amountMinor: number;
  trxDate: string;
} | null> {
  const sb = getDb();
  const res = await sb
    .from(TABLES.paymentTransactions)
    .select("provider, providerRef, amountMinor, trxDate")
    .eq("orderId", orderId)
    .eq("status", "succeeded")
    .order("createdAt", { ascending: false })
    .limit(20);
  if (res.error) throw new Error(`getOrderPaymentRef: ${res.error.message}`);
  const row = (
    (res.data ?? []) as Array<{
      provider: string;
      providerRef: string;
      amountMinor?: number | null;
      trxDate?: string | null;
    }>
  ).find((r) => !isManualProvider(r.provider));
  return row
    ? {
        provider: row.provider,
        providerRef: row.providerRef,
        amountMinor: Number(row.amountMinor ?? 0),
        trxDate: isoDay(row.trxDate ?? ""),
      }
    : null;
}

/** One row of an order's payment ledger, as the order page lists it. */
export interface OrderPaymentRow {
  provider: string;
  providerRef: string;
  status: string;
  amountMinor: number;
  currency: string;
  trxDate: string;
  createdAt: string;
}

/**
 * Every payment row of an order, newest first: the card charge, a wallet
 * spend, a manual "ödendi", a provider refund. `raw` stays in the database:
 * it is the provider's own answer and has no business in a page payload.
 */
export async function listPaymentTransactions(
  orderId: string,
): Promise<OrderPaymentRow[]> {
  const res = await getDb()
    .from(TABLES.paymentTransactions)
    .select(
      "provider, providerRef, status, amountMinor, currency, trxDate, createdAt",
    )
    .eq("orderId", orderId)
    .order("createdAt", { ascending: false })
    .limit(50);
  return rows<OrderPaymentRow>(res, "listPaymentTransactions").map((r) => ({
    ...r,
    amountMinor: Number(r.amountMinor ?? 0),
    trxDate: isoDay(r.trxDate ?? ""),
  }));
}

/** One customer mail of an order (`order_notice_emails`), as the page lists it. */
export interface OrderNoticeRow {
  kind: string;
  status: string;
  error: string;
  createdAt: string;
  sentAt: string;
}

/** An order's mails, newest first: what went out, what is still sending. */
export async function listOrderNotices(
  orderId: string,
): Promise<OrderNoticeRow[]> {
  const res = await getDb()
    .from(TABLES.orderNoticeEmails)
    .select("kind, status, error, createdAt, sentAt")
    .eq("orderId", orderId)
    .order("createdAt", { ascending: false })
    .limit(50);
  return rows<OrderNoticeRow>(res, "listOrderNotices");
}

/** What the money side of an order comes to, for the rules and the page. */
export interface OrderMoney {
  /** Money was ever taken: `paidAt`, or a succeeded payment row. */
  collected: boolean;
  /**
   * What the succeeded payment rows add up to; null when there are none (a
   * counter sale entered as paid). Caps every refund (`refundCapMinor`).
   */
  collectedMinor: number | null;
  /** Where a refund would go now (`refundDestinationFor`). */
  destination: RefundDestination;
}

function moneyFrom(
  order: Pick<AdminOrder, "paidAt">,
  succeeded: ReadonlyArray<{ provider: string; amountMinor: number }>,
): OrderMoney {
  const refundVia = succeeded.find((r) => !isManualProvider(r.provider));
  return {
    collected: Boolean(order.paidAt) || succeeded.length > 0,
    collectedMinor:
      succeeded.length > 0
        ? succeeded.reduce((sum, r) => sum + Number(r.amountMinor ?? 0), 0)
        : null,
    destination: refundDestinationFor(refundVia?.provider ?? null),
  };
}

/** The order's money facts, from its payment rows (newest first). */
export function orderMoneyFromRows(
  order: Pick<AdminOrder, "paidAt">,
  transactions: ReadonlyArray<OrderPaymentRow>,
): OrderMoney {
  return moneyFrom(
    order,
    transactions.filter((t) => t.status === "succeeded"),
  );
}

/** The order's money facts, read now. */
export async function orderMoney(order: AdminOrder): Promise<OrderMoney> {
  const res = await getDb()
    .from(TABLES.paymentTransactions)
    .select("provider, amountMinor, createdAt")
    .eq("orderId", order.id)
    .eq("status", "succeeded")
    .order("createdAt", { ascending: false })
    .limit(50);
  if (res.error) throw new Error(`orderMoney: ${res.error.message}`);
  return moneyFrom(
    order,
    (res.data ?? []) as Array<{ provider: string; amountMinor: number }>,
  );
}

/**
 * The money facts of a page of orders in one query, for the list's row
 * menus (which cancel needs the refund role, which can be refunded).
 */
export async function listOrderMoney(
  orders: readonly AdminOrder[],
): Promise<Map<string, OrderMoney>> {
  const out = new Map<string, OrderMoney>();
  if (orders.length === 0) return out;
  const res = await getDb()
    .from(TABLES.paymentTransactions)
    .select("orderId, provider, amountMinor, createdAt")
    .in(
      "orderId",
      orders.map((o) => o.id),
    )
    .eq("status", "succeeded")
    .order("createdAt", { ascending: false });
  const byOrder = new Map<
    string,
    Array<{ provider: string; amountMinor: number }>
  >();
  for (const r of rows<{
    orderId: string;
    provider: string;
    amountMinor: number;
  }>(res, "listOrderMoney")) {
    const list = byOrder.get(r.orderId) ?? [];
    list.push(r);
    byOrder.set(r.orderId, list);
  }
  for (const o of orders) out.set(o.id, moneyFrom(o, byOrder.get(o.id) ?? []));
  return out;
}

export type OrderTransition =
  "start_preparing" | "mark_shipped" | "complete" | "cancel" | "mark_paid";

const TRANSITION_MAP: Record<
  OrderTransition,
  {
    from: AdminOrderStatus[];
    to: AdminOrderStatus;
  }
> = {
  mark_paid: { from: ["pending_payment"], to: "paid" },
  start_preparing: { from: ["paid", "pending_payment"], to: "preparing" },
  mark_shipped: { from: ["preparing", "paid"], to: "shipped" },
  complete: { from: ["shipped", "preparing"], to: "completed" },
  cancel: {
    from: ["pending_payment", "paid", "preparing", "shipped"],
    to: "cancelled",
  },
};

/**
 * The column that dates each stage. `paid` is absent because `paidAt` is only
 * written when the transition actually settles the order (see `settles`
 * below); a card payment stamped it long before staff touched the panel.
 */
const STAGE_INSTANT_COLUMN: Partial<
  Record<AdminOrderStatus, "preparingAt" | "shippedAt" | "completedAt">
> = {
  preparing: "preparingAt",
  shipped: "shippedAt",
  completed: "completedAt",
};

export function availableTransitions(
  status: AdminOrderStatus,
): OrderTransition[] {
  return (
    Object.entries(TRANSITION_MAP) as Array<
      [OrderTransition, (typeof TRANSITION_MAP)[OrderTransition]]
    >
  )
    .filter(([, { from }]) => from.includes(status))
    .map(([t]) => t);
}

export interface TransitionResult {
  ok: boolean;
  order?: AdminOrder;
  error?: string;
  /** The customer mail this move triggered: paid, shipped or cancelled. */
  mail?: OrderNoticeOutcome;
  /** A cancel's stock and coupon release (absent when it did not run). */
  release?: InventoryRelease;
  /** Something that did not go through after the status moved. */
  warnings?: string[];
}

/** What giving an order's inventory back came to. */
export interface InventoryRelease {
  /** This call released; false when an earlier call already had. */
  released: boolean;
  /** Units credited back to stock. */
  units: number;
  /** The lines credited, for the stock movement log. */
  lines: ReleasedLine[];
}

/** One line `release_order_inventory` / `restock_order_lines` credited. */
export interface ReleasedLine {
  index: number;
  productId: string;
  productName: string;
  qty: number;
  stockAfter: number;
}

/**
 * One stock movement per credited line. Best-effort: the stock itself was
 * credited in the same SQL transaction as the claim, and a log row that did
 * not land must not turn that into an error.
 */
async function recordReleasedMoves(
  order: Pick<AdminOrder, "id" | "orderNo">,
  lines: readonly ReleasedLine[],
  reason: StockMoveReason,
  note: string,
  actor: string,
): Promise<void> {
  for (const line of lines) {
    try {
      await recordStockMove({
        productId: line.productId,
        productName: line.productName,
        delta: line.qty,
        stockAfter: line.stockAfter,
        reason,
        note,
        orderId: order.id,
        actor,
      });
    } catch (err) {
      console.error(
        `[orders] stock move not logged order=${order.id} product=${line.productId}`,
        err,
      );
    }
  }
}

function releasedLines(data: unknown): ReleasedLine[] {
  const lines = (data as { lines?: unknown } | null)?.lines;
  if (!Array.isArray(lines)) return [];
  return lines.map((l: Record<string, unknown>) => ({
    index: Number(l.index ?? -1),
    productId: String(l.productId ?? ""),
    productName: String(l.productName ?? ""),
    qty: Number(l.qty ?? 0),
    stockAfter: Number(l.stockAfter ?? 0),
  }));
}

/**
 * Gives back everything an order took, when it will never be fulfilled.
 *
 * Placing an order claims stock, burns the customer's single-use coupon and
 * takes one use of a promo code - all before payment, so nothing can be
 * double-spent while the customer is on the POS page. Cancelling used to
 * reverse none of it: a cancelled order held its stock forever (the shop read
 * as sold out while the shelf was full), and the customer's coupon was gone
 * for an order they never paid for.
 *
 * The claim (`stockReleasedAt`) and the stock credit are ONE SQL function
 * (`release_order_inventory`). They used to be two statements: when the
 * credit failed, the marker was already set, the order already cancelled,
 * and the stock was never given back by anything. Now a failure leaves the
 * marker empty, and "Stoğu geri al" on the order page runs this again.
 *
 * Every line is credited what it has not given back yet - a line marked
 * "İptal" on its own changes no stock, so skipping cancelled lines lost
 * them. `restock: false` (a parcel already with the carrier) claims the
 * marker and gives the coupon back, but no units.
 */
async function releaseOrderInventory(
  order: AdminOrder,
  {
    restock = true,
    actor = "system",
  }: { restock?: boolean; actor?: string } = {},
): Promise<InventoryRelease> {
  const now = new Date().toISOString();
  const { data, error, status } = await getDb().rpc<unknown>(
    "release_order_inventory",
    { p_order_id: order.id, p_restock: restock, p_now: now },
  );
  if (error) raiseDbError("releaseOrderInventory", error, status);
  // NULL: another call already released this order.
  if (!data) return { released: false, units: 0, lines: [] };
  const lines = releasedLines(data);
  await recordReleasedMoves(
    order,
    lines,
    "order_cancelled",
    `Sipariş #${order.orderNo} iptal edildi`,
    actor,
  );

  if (order.promoCode) {
    // A personal coupon is returned to its owner; a shared promo gets its use
    // back. Only one of the two can have been applied.
    const returned = order.customerEmail
      ? await releaseCustomerCoupon(
          order.promoCode,
          order.customerEmail,
          order.orderNo,
        )
      : false;
    if (!returned) await releasePromoUsage(order.promoCode);
    else await settleLoyaltyAfterRelease(order.customerEmail, order.orderNo);
  }
  return {
    released: true,
    units: lines.reduce((sum, l) => sum + l.qty, 0),
    lines,
  };
}

/**
 * "Stoğu geri al": the release of a cancelled order whose first attempt did
 * not go through (the marker is still empty). A no-op for any other order.
 */
export async function retryOrderRelease(
  id: string,
  actor: string,
): Promise<
  { ok: true; release: InventoryRelease } | { ok: false; error: string }
> {
  await ensureSeed();
  const order = await getOrder(id);
  if (!order) return { ok: false, error: "Sipariş bulunamadı." };
  if (order.status !== "cancelled" || order.stockReleasedAt) {
    return { ok: false, error: "Bu siparişin stoğu zaten geri alınmış." };
  }
  return { ok: true, release: await releaseOrderInventory(order, { actor }) };
}

/**
 * Gives chosen lines back to stock (the refund modal's "stoğa geri al"):
 * `[{index, qty}]`, each capped by the SQL at what that line has not given
 * back yet, so two refunds of one line cannot both credit it.
 */
export async function restockOrderLines(
  order: Pick<AdminOrder, "id" | "orderNo">,
  lines: ReadonlyArray<{ index: number; qty: number }>,
  actor: string,
): Promise<ReleasedLine[]> {
  if (lines.length === 0) return [];
  const { data, error, status } = await getDb().rpc<unknown>(
    "restock_order_lines",
    {
      p_order_id: order.id,
      p_lines: lines.map((l) => ({ index: l.index, qty: l.qty })),
      p_now: new Date().toISOString(),
    },
  );
  if (error) raiseDbError("restockOrderLines", error, status);
  const credited = releasedLines(data);
  await recordReleasedMoves(
    order,
    credited,
    "refund_restock",
    `Sipariş #${order.orderNo} iadesi`,
    actor,
  );
  return credited;
}

/**
 * A coupon handed back by an order that was never paid is unused again. If
 * it is a free drink or a milestone gift whose stamps a refund or a cancel
 * took back while this order held it, the settlement then could not take it
 * (a held coupon reads as used) and left the debt on the ledger. Settle
 * again now, or the member keeps a reward for stamps they no longer have.
 * A no-op when nothing is owed.
 *
 * Lazily imported and best-effort, like the other loyalty hooks: the cancel
 * must go through whatever happens here.
 */
async function settleLoyaltyAfterRelease(
  email: string,
  orderNo: number,
): Promise<void> {
  try {
    const { settleLoyaltyDebt } = await import("@/lib/mobile/loyalty");
    await settleLoyaltyDebt(email);
  } catch (err) {
    console.error(
      `[loyalty] settlement after coupon release failed orderNo=${orderNo}`,
      err,
    );
  }
}

/**
 * Moves an order one step through the machine, and does what the step owes:
 * a cancel gives the inventory back, takes the stamps back and tells the
 * buyer; settling by hand stamps and mails "ödemen alındı"; shipping mails
 * the tracking number. The result says which mail went out (`mail`) and
 * what the release came to, so the panel can tell the operator.
 *
 * `restock: false` cancels without crediting stock (a parcel that already
 * left). Everything after the status write is best-effort and reported in
 * `warnings`: the status HAS moved, and an error there used to drop the
 * operator on the error page with the stamps and the mail never handled.
 *
 * `paymentReceived`: "Hazırlamaya başla" on an UNPAID order settles it
 * (paidAt, the stamp, "ödemen alındı"). The button never said so, so the
 * move is refused unless the caller says the money was taken.
 *
 * `expectStatus`: the status the caller decided from (lib/admin/order-ops.ts
 * reads the order, its money and the role first). Without it a payment that
 * landed in between was cancelled from `paid` by a decision made for an
 * unpaid order: no refund role asked, no "iade bekliyor" flag.
 */
export async function transitionOrder(
  id: string,
  transition: OrderTransition,
  opts: {
    restock?: boolean;
    actor?: string;
    paymentReceived?: boolean;
    expectStatus?: AdminOrderStatus;
  } = {},
): Promise<TransitionResult> {
  await ensureSeed();
  const sb = getDb();
  const existing = await getOrder(id);
  if (!existing) return { ok: false, error: "Sipariş bulunamadı." };
  const map = TRANSITION_MAP[transition];
  if (!map) return { ok: false, error: "Geçersiz işlem." };
  if (opts.expectStatus && existing.status !== opts.expectStatus) {
    return {
      ok: false,
      error: "Sipariş bu arada değişti. Sayfa yenilendi, tekrar bak.",
    };
  }
  if (!map.from.includes(existing.status)) {
    return {
      ok: false,
      error: `Bu işlem "${ORDER_STATUS_LABELS[existing.status] ?? existing.status}" durumundaki siparişte yapılamaz.`,
    };
  }
  if (
    transition === "start_preparing" &&
    existing.status === "pending_payment" &&
    opts.paymentReceived !== true
  ) {
    return {
      ok: false,
      error:
        'Ödemesi alınmamış sipariş hazırlanamaz. Önce "Ödendi olarak işaretle".',
    };
  }
  // Settling by hand is still settling. "Ödendi olarak işaretle" - the cash
  // pickup paid at the counter - used to write the status column and nothing
  // else: no `paidAt`, and no stamp, while the app told the member their app
  // cafe order had earned one. Same for staff who skip straight to
  // "Hazırlanıyor" on an unpaid order.
  const settles =
    !existing.paidAt &&
    existing.status === "pending_payment" &&
    (map.to === "paid" || map.to === "preparing");
  const paidAt = new Date().toISOString();
  // The instant this stage was reached. Only stamped the first time, so
  // re-reaching a stage (paid → preparing → paid is not possible, but
  // shipped → completed → shipped by hand would be) keeps the original.
  const stageColumn = STAGE_INSTANT_COLUMN[map.to];
  const patch: Record<string, string> = { status: map.to };
  if (settles) patch.paidAt = paidAt;
  if (stageColumn && !existing[stageColumn]) patch[stageColumn] = paidAt;
  // Conditional on the status the decision above was made from. A click on a
  // stale screen used to overwrite whatever had happened since - a payment
  // the POS lookup booked, or the sweep's cancel whose stock was already
  // handed back, which a "Hazırlanıyor" then revived with nothing on the
  // shelf behind it.
  const moved = rows<{ id: string }>(
    await sb
      .from(TABLES.orders)
      .update(patch)
      .eq("id", id)
      .eq("status", existing.status)
      .select("id"),
    "transitionOrder",
  );
  if (moved.length === 0) {
    return {
      ok: false,
      error: "Sipariş bu arada değişti. Sayfa yenilendi, tekrar bak.",
    };
  }
  const warnings: string[] = [];
  let mail: OrderNoticeOutcome | undefined;
  let release: InventoryRelease | undefined;
  if (map.to === "cancelled") {
    try {
      release = await releaseOrderInventory(existing, {
        restock: opts.restock !== false,
        actor: opts.actor,
      });
    } catch (err) {
      // The SQL function rolled back whole: the marker is still empty and
      // "Stoğu geri al" on the order page tries again.
      console.error(`[orders] release after cancel failed order=${id}`, err);
      warnings.push(
        "stok ve kupon geri alınamadı, 'Stoğu geri al' ile tekrar dene",
      );
    }
    await reverseLoyalty(existing, "cancelled", { full: true });
    mail = await noticeCancelled(
      { ...existing, status: "cancelled" },
      {
        unpaidAttempt:
          existing.status === "pending_payment" && !existing.paidAt,
      },
    );
  } else if (settles) {
    // Idempotent on the order id, so a later payment webhook for the same
    // order does not hand out a second stamp.
    await awardLoyalty({ ...existing, status: map.to, paidAt }, "transition");
    // Settled by hand is paid all the same: the customer's one order mail
    // goes out now, once (a later POS confirmation finds it claimed).
    mail = await notifyOrderPaid({ ...existing, status: map.to, paidAt });
  }
  const nextOrder = { ...existing, ...patch, status: map.to };
  // "Kargoya ver" after the tracking number was typed: the parcel has left,
  // and this is the moment the buyer is owed the number. Sent once per
  // number, so the tracking form having sent it already is a no-op here.
  if (map.to === "shipped") mail = await notifyOrderShipped(nextOrder);
  return {
    ok: true,
    order: nextOrder,
    ...(mail ? { mail } : {}),
    ...(release ? { release } : {}),
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

/**
 * The seller's cancellation, told to the buyer (a shop order only; see
 * `order-notices.ts`). Whether money was taken decides which sentence the
 * mail carries: the refund to come, or "no payment on record". A failed
 * lookup says neither rather than guess about somebody's card.
 */
async function noticeCancelled(
  order: AdminOrder,
  { unpaidAttempt = false }: { unpaidAttempt?: boolean } = {},
): Promise<OrderNoticeOutcome> {
  if (!cancelNoticeDue(order)) return "not_due";
  let collected: boolean | null = Boolean(order.paidAt) || null;
  if (collected === null) {
    try {
      collected = await orderWasCollected(order);
    } catch (err) {
      console.error(
        `[order-notice] payment lookup failed order=${order.id}; the cancellation mail stays silent on payment`,
        err,
      );
    }
  }
  // An attempt whose payment never completed was never an order for the
  // customer: no mail went out for it (orders are mailed once paid,
  // `notifyOrderPaid`) and it is not in their profile. Cancelling it says
  // nothing - unless the POS shows money was taken after all, which the
  // customer must hear about.
  if (unpaidAttempt && collected !== true) return "not_due";
  return notifyOrderCancelled(order, { collected });
}

/**
 * Awards the stamp a paid app cafe order earns, and settles the invite that
 * order was the first of.
 *
 * Lazily imported because the loyalty module reads orders from this one (a
 * static import would be a cycle), and best-effort because a stamp that fails
 * to land must never undo a payment. The hook is idempotent on the order id,
 * so a retried webhook - or a webhook arriving after staff already marked the
 * order paid - is harmless.
 */
async function awardLoyalty(order: AdminOrder, why: string): Promise<void> {
  try {
    const { onOrderPaid } = await import("@/lib/mobile/loyalty");
    await onOrderPaid(order);
  } catch (err) {
    console.error(
      `[loyalty] onOrderPaid failed order=${order.id} orderNo=${order.orderNo} (${why})`,
      err,
    );
  }
}

/**
 * Takes back the stamps an app order no longer earns: all of them when the
 * order is undone (`full`), otherwise the ones its refunds took the goods
 * below (`onOrderReversed` re-derives the target from `order.refunds`, so the
 * caller passes the order with the refund it just recorded).
 *
 * Best-effort and lazily imported for the same reasons the earning hook is:
 * loyalty reads orders from this module, and a bookkeeping failure must not
 * block the refund itself.
 */
async function reverseLoyalty(
  order: AdminOrder,
  why: string,
  opts: { full: boolean },
): Promise<void> {
  try {
    const { onOrderReversed } = await import("@/lib/mobile/loyalty");
    await onOrderReversed(order, opts);
  } catch (err) {
    console.error(
      `[loyalty] reversal failed order=${order.id} orderNo=${order.orderNo} (${why})`,
      err,
    );
  }
}

export async function setOrderInternalNote(
  id: string,
  note: string,
): Promise<AdminOrder | null> {
  await ensureSeed();
  const sb = getDb();
  const trimmed = note.slice(0, 2000);
  const existing = await getOrder(id);
  if (!existing) return null;
  check(
    await sb.from(TABLES.orders).update({ internalNote: trimmed }).eq("id", id),
    "setOrderInternalNote",
  );
  return { ...existing, internalNote: trimmed };
}

/** The statuses whose parcel has left: the tracking form corrects these only. */
export const TRACKING_EDITABLE_STATUSES: readonly AdminOrderStatus[] = [
  "shipped",
  "completed",
];

export type TrackingWrite =
  | { ok: true; order: AdminOrder; mail: OrderNoticeOutcome }
  | { ok: false; error: string };

/**
 * Corrects the carrier or the tracking number of a parcel that has already
 * left. A new number is a new "kargoya verildi" mail (one per number); the
 * same number saved again is not. `mail` says which.
 *
 * Refused on any other status: the form used to be open on unpaid,
 * cancelled and refunded orders, a number typed there stamped `shippedAt`
 * and the app showed "Kargoda" for an order that will never ship. Before
 * the parcel leaves, "Kargoya ver" takes the number and moves the status in
 * one step (`shipParcel`). The write is conditional on the status it read.
 */
export async function setOrderTracking(
  id: string,
  trackingNumber: string,
  carrier: string,
): Promise<TrackingWrite> {
  await ensureSeed();
  const sb = getDb();
  const existing = await getOrder(id);
  if (!existing) return { ok: false, error: "Sipariş bulunamadı." };
  if (!TRACKING_EDITABLE_STATUSES.includes(existing.status)) {
    return {
      ok: false,
      error:
        'Kargo bilgisi yalnız yola çıkmış siparişte düzeltilir. Önce "Kargoya ver".',
    };
  }
  const tn = trackingNumber.trim().slice(0, 120);
  const ca = carrier.trim().slice(0, 80);
  if (!tn) return { ok: false, error: "Takip numarasını yaz." };
  const shippedAt = existing.shippedAt || new Date().toISOString();
  const written = rows<{ id: string }>(
    await sb
      .from(TABLES.orders)
      .update({ trackingNumber: tn, carrier: ca, shippedAt })
      .eq("id", id)
      .eq("status", existing.status)
      .select("id"),
    "setOrderTracking",
  );
  if (written.length === 0) {
    return {
      ok: false,
      error: "Sipariş bu arada değişti. Sayfa yenilendi, tekrar bak.",
    };
  }
  const updated = { ...existing, trackingNumber: tn, carrier: ca, shippedAt };
  // A corrected number is a new notice for the buyer; a re-save of the same
  // number is not (one mail per number, `shipmentNoticeKind`).
  const mail = await notifyOrderShipped(updated);
  return { ok: true, order: updated, mail };
}

/**
 * "Kargoya ver" for a parcel: the carrier and the tracking number, then
 * the move to `shipped`, in one step - the number is what the buyer's
 * "kargoya verildi" mail carries, and shipping without it sent no mail and
 * showed "Kargoda" in the app with nothing to track.
 *
 * The number is written first, guarded on the status the decision was made
 * from; `transitionOrder` then stamps `shippedAt` and sends the one mail.
 * If the move is refused (the order changed meanwhile), the old values are
 * put back so a preparing order does not carry a number.
 */
export async function shipParcel(
  id: string,
  input: { carrier: string; trackingNumber: string; actor?: string },
): Promise<TransitionResult> {
  await ensureSeed();
  const existing = await getOrder(id);
  if (!existing) return { ok: false, error: "Sipariş bulunamadı." };
  if (!TRANSITION_MAP.mark_shipped.from.includes(existing.status)) {
    return {
      ok: false,
      error: `Bu işlem "${ORDER_STATUS_LABELS[existing.status] ?? existing.status}" durumundaki siparişte yapılamaz.`,
    };
  }
  const tn = input.trackingNumber.trim().slice(0, 120);
  const ca = input.carrier.trim().slice(0, 80);
  if (!tn) return { ok: false, error: "Takip numarasını yaz." };
  const written = rows<{ id: string }>(
    await getDb()
      .from(TABLES.orders)
      .update({ trackingNumber: tn, carrier: ca })
      .eq("id", id)
      .eq("status", existing.status)
      .select("id"),
    "shipParcel",
  );
  if (written.length === 0) {
    return {
      ok: false,
      error: "Sipariş bu arada değişti. Sayfa yenilendi, tekrar bak.",
    };
  }
  const res = await transitionOrder(id, "mark_shipped", { actor: input.actor });
  if (!res.ok) {
    try {
      check(
        await getDb()
          .from(TABLES.orders)
          .update({
            trackingNumber: existing.trackingNumber ?? "",
            carrier: existing.carrier ?? "",
          })
          .eq("id", id)
          .eq("status", existing.status),
        "shipParcel.revert",
      );
    } catch (err) {
      console.error(`[orders] tracking not reverted order=${id}`, err);
    }
  }
  return res;
}

/** What the Geliver webhook's write came to - the route answers each differently. */
export type ShipmentWrite =
  | { outcome: "applied"; order: AdminOrder }
  | { outcome: "stale"; order: AdminOrder }
  | { outcome: "unknown" };

/**
 * The carrier's own milestone, written by the Geliver webhook.
 *
 * Addressed by TRACKING NUMBER rather than by order id, because that is the
 * only identifier Geliver and this database share - the köşk's order id never
 * leaves this side. Should two orders ever carry the same number (a panel
 * typo), the NEWEST one is the parcel's: `maybeSingle` used to answer that
 * case with a PGRST116 error that read as "no order", so the update was
 * dropped with a 200 and nobody knew.
 *
 * `outcome: "unknown"` - no order carries that number. Not an error: a parcel
 * the köşk did not send is somebody else's webhook, and the route answers 200
 * either way so the sender stops retrying.
 *
 * `outcome: "stale"` - the event is OLDER than what is already stored.
 * Webhooks are not delivered in order: a retried SHIPPED can land after the
 * DELIVERED that followed it, and writing it would move the parcel backwards
 * on the phone. Decided in `isStaleShipmentEvent` (pure, tested); when
 * either side has no timestamp the event is applied, because "cannot prove it
 * is old" must not become "silently dropped".
 *
 * It deliberately does NOT move `orders.status`. Whether a delivered parcel
 * completes the order is the shop owner's decision in /admin/siparisler, and a
 * carrier's scan is not authority to close a sale - a parcel marked delivered
 * to a neighbour is still an open order.
 */
export async function setOrderShipmentStatus(
  trackingNumber: string,
  status: string,
  trackingUrl: string,
  updatedAt: string,
): Promise<ShipmentWrite> {
  await ensureSeed();
  const sb = getDb();
  const tn = trackingNumber.trim().slice(0, 120);
  if (!tn) return { outcome: "unknown" };
  const res = await sb
    .from(TABLES.orders)
    .select("*")
    .eq("trackingNumber", tn)
    .order("createdAt", { ascending: false })
    .limit(1);
  check(res, "setOrderShipmentStatus.lookup");
  const existing = ((res.data ?? []) as AdminOrder[])[0];
  if (!existing) return { outcome: "unknown" };

  const incomingAt = updatedAt.trim().slice(0, 40);
  if (isStaleShipmentEvent(existing.shipmentUpdatedAt ?? "", incomingAt)) {
    return { outcome: "stale", order: existing };
  }
  const patch = {
    shipmentStatus: status.trim().slice(0, 40),
    // An empty url never blanks one the panel already holds: Geliver sends
    // the page when it has one and says nothing when it does not.
    trackingUrl:
      trackingUrl.trim().slice(0, 500) || (existing.trackingUrl ?? ""),
    // The carrier's own instant when it sent one; the moment we heard it
    // otherwise - never "", or the next event could not be ordered against it.
    shipmentUpdatedAt: incomingAt || new Date().toISOString(),
  };
  check(
    await sb.from(TABLES.orders).update(patch).eq("id", existing.id),
    "setOrderShipmentStatus",
  );
  const updated = { ...existing, ...patch };
  // The carrier's own word that it has the parcel. Usually the panel's
  // tracking form got there first and this is a replay of the same number
  // (one notice per number); when it did not, this is the one that tells
  // the buyer, and it can carry the carrier's page.
  if (isHandedOver(patch.shipmentStatus)) await notifyOrderShipped(updated);
  return { outcome: "applied", order: updated };
}

export interface OrderDetailsInput {
  customerName: string;
  /** Left out: the stored e-mail stays (the form did not offer the field). */
  customerEmail?: string;
  customerPhone: string;
  shippingAddress: string;
}

export type OrderDetailsResult =
  | { ok: true; before: AdminOrder; order: AdminOrder }
  | { ok: false; error: string };

/**
 * Whether loyalty stamps or a member coupon are filed under this order's
 * e-mail. A cancel or refund finds them by the order's e-mail as it is
 * then (`onOrderReversed`, `releaseCustomerCoupon`), so an order moved to
 * another address left them with the old one and took back nothing: the
 * member kept the stamps of a refunded order, and a spent coupon was never
 * given back (admin audit ORD-16).
 *
 * A paid app cafe order that earns a stamp counts before its row is there:
 * the stamp is written just after the payment, under the e-mail the order
 * had then. A coupon is claimed when the order is placed, unpaid ones too.
 */
export async function orderEmailLedgerHeld(order: AdminOrder): Promise<boolean> {
  const paid = Boolean(order.paidAt) || order.status !== "pending_payment";
  if (
    paid &&
    orderChannel(order) === "app" &&
    orderKind(order) === "cafe" &&
    earnsStamp(order)
  ) {
    return true;
  }
  const sb = getDb();
  const stamps = rows<{ id: string }>(
    await sb
      .from(TABLES.loyaltyStamps)
      .select("id")
      .eq("orderId", order.id)
      .limit(1),
    "orderEmailLedgerHeld.stamps",
  );
  if (stamps.length > 0) return true;
  if (!order.promoCode || !(order.orderNo > 0)) return false;
  const coupons = rows<{ id: string }>(
    await sb
      .from(TABLES.customerCoupons)
      .select("id")
      .eq("redeemedOrderNo", order.orderNo)
      .limit(1),
    "orderEmailLedgerHeld.coupon",
  );
  return coupons.length > 0;
}

/**
 * Admin edit of an order's customer + delivery fields (no totals change).
 *
 * `refuse` is asked about the order as stored and stops the save with its
 * answer (who may change the e-mail, a closed order: lib/admin/
 * order-details.ts). An e-mail that would leave stamps or a member coupon
 * under the old address is refused here whoever asks
 * (`orderEmailLedgerHeld`). The write is conditional on the status and
 * e-mail those answers were given for, so an order completed, paid or moved
 * in between is "changed", never overwritten. `before` is the order as it
 * was: the caller's audit row keeps the old values.
 */
export async function updateOrderDetails(
  id: string,
  input: OrderDetailsInput,
  refuse?: (existing: AdminOrder) => string | null,
): Promise<OrderDetailsResult> {
  await ensureSeed();
  const sb = getDb();
  const existing = await getOrder(id);
  if (!existing) return { ok: false, error: "Sipariş bulunamadı." };
  const refusal = refuse?.(existing) ?? null;
  if (refusal) return { ok: false, error: refusal };
  if (
    emailMovesLedger(existing.customerEmail, input.customerEmail) &&
    (await orderEmailLedgerHeld(existing))
  ) {
    return { ok: false, error: ORDER_DETAILS_MESSAGES.emailLedger };
  }
  const update = {
    customerName: input.customerName.trim().slice(0, 120),
    ...(input.customerEmail !== undefined
      ? { customerEmail: input.customerEmail.trim().slice(0, 160) }
      : {}),
    customerPhone: input.customerPhone.trim().slice(0, 40),
    shippingAddress: input.shippingAddress.trim().slice(0, 600),
  };
  const written = rows<{ id: string }>(
    await sb
      .from(TABLES.orders)
      .update(update)
      .eq("id", id)
      .eq("status", existing.status)
      .eq("customerEmail", existing.customerEmail ?? "")
      .select("id"),
    "updateOrderDetails",
  );
  if (written.length === 0) {
    return {
      ok: false,
      error: "Sipariş bu arada değişti. Sayfa yenilendi, tekrar bak.",
    };
  }
  return { ok: true, before: existing, order: { ...existing, ...update } };
}

/**
 * One line's status ("Bekliyor", "Hazır", "İptal"), written in place by
 * `set_order_item_status`, and only while the order is live (paid,
 * preparing, shipped, completed). Null when refused: an unknown order or
 * line, or an order that is unpaid, cancelled or refunded.
 *
 * The line's stock is not touched: an "İptal" line is given back when the
 * order is cancelled (`release_order_inventory` credits every line), or
 * from the refund modal.
 */
export async function setOrderItemStatus(
  orderId: string,
  itemIndex: number,
  status: AdminOrderItemStatus,
): Promise<AdminOrder | null> {
  await ensureSeed();
  if (!Number.isInteger(itemIndex) || itemIndex < 0) return null;
  const existing = await getOrder(orderId);
  if (!existing) return null;
  const {
    data,
    error,
    status: httpStatus,
  } = await getDb().rpc<AdminOrderItem[] | null>("set_order_item_status", {
    p_order_id: orderId,
    p_index: itemIndex,
    p_status: status,
    p_allowed: [...ITEM_EDITABLE_ORDER_STATUSES],
  });
  if (error) raiseDbError("setOrderItemStatus", error, httpStatus);
  if (!data) return null;
  return { ...existing, items: data };
}

/**
 * "Ödendi olarak işaretle": the money was taken outside the POS (cash at the
 * counter, the counter's card terminal, a bank transfer).
 *
 * A `manual:<method>` payment row is written FIRST, so a card payment that
 * lands afterwards for the same order (the customer was still on the bank's
 * 3-D Secure page) meets an order another succeeded payment already paid,
 * and is flagged as a duplicate charge instead of passing as a harmless
 * repeat. Refunds skip manual rows (`getOrderPaymentRef`): that money goes
 * back by hand. If the move to `paid` is then refused, the row is taken
 * back. The POS check for a card order is the caller's (order-ops.ts).
 */
/**
 * The `manual:<method>` payment row of money taken outside the POS, for the
 * order's whole total. `error` is null once the row is there (a 23505 is an
 * earlier attempt's row, which stands for this one). Shared by "Ödendi
 * olarak işaretle" and a manual order that starts paid.
 */
async function insertManualPaymentRow(
  order: Pick<AdminOrder, "id" | "totalMinor">,
  method: ManualPaymentMethod,
  actor?: string,
): Promise<{ provider: string; providerRef: string; error: string | null }> {
  const provider = `${MANUAL_PROVIDER_PREFIX}${method}`;
  const providerRef = `manual-${order.id}`;
  const ins = await getDb()
    .from(TABLES.paymentTransactions)
    .insert({
      orderId: order.id,
      provider,
      providerRef,
      status: "succeeded",
      amountMinor: order.totalMinor,
      currency: "TRY",
      raw: { source: "admin", method, actor: actor ?? "" },
      trxDate: "",
      createdAt: new Date().toISOString(),
    });
  const error =
    ins.error && ins.error.code !== "23505" ? ins.error.message : null;
  return { provider, providerRef, error };
}

export async function markOrderPaidManually(
  id: string,
  method: ManualPaymentMethod,
  actor?: string,
): Promise<TransitionResult> {
  await ensureSeed();
  const existing = await getOrder(id);
  if (!existing) return { ok: false, error: "Sipariş bulunamadı." };
  if (existing.status !== "pending_payment") {
    return {
      ok: false,
      error: "Sipariş bu arada değişti. Sayfa yenilendi, tekrar bak.",
    };
  }
  const { provider, providerRef, error } = await insertManualPaymentRow(
    existing,
    method,
    actor,
  );
  if (error) {
    return { ok: false, error: `Ödeme kaydı yazılamadı: ${error}` };
  }
  const res = await transitionOrder(id, "mark_paid", { actor });
  if (!res.ok) {
    try {
      check(
        await getDb()
          .from(TABLES.paymentTransactions)
          .delete()
          .eq("orderId", id)
          .eq("provider", provider)
          .eq("providerRef", providerRef),
        "markOrderPaidManually.undo",
      );
    } catch (err) {
      console.error(
        `[orders] manual payment row left behind order=${id}; the order was not marked paid`,
        err,
      );
    }
  }
  return res;
}

/** What asking the POS about a pending order came to. */
export type PosCheckVerdict =
  | PendingVerdict
  /** The order is not waiting for a payment (any more). */
  | "not_pending"
  /** A manual order: there is no POS payment to ask about. */
  | "manual";

/**
 * Asks the POS whether this pending order was paid after all, and books the
 * payment when it was ("POS'tan kontrol et", and before an admin cancel or
 * a manual "ödendi" - CLAUDE.md rule 29: an unreachable POS is never "not
 * paid").
 *
 * `purpose: "cancel"` reads a payment of the WRONG amount as unpaid, the way
 * the sweep does: the order cannot go ahead, it is cancelled, and the money
 * shows as collected so it can be refunded. For "pay", the same case is
 * "unknown": a manual "ödendi" on top of a wrong card charge is wrong.
 */
export async function checkOrderWithPos(
  order: AdminOrder,
  purpose: "check" | "pay" | "cancel" = "check",
): Promise<PosCheckVerdict> {
  if (order.status !== "pending_payment") return "not_pending";
  if (order.source === "manual") return "manual";
  const provider = await lookupProvider();
  // No provider could be built: nobody was asked, so nothing is known.
  if (!provider) return "unknown";
  return purpose === "cancel"
    ? settlePendingFromProvider(order, provider)
    : checkPendingOrderPaid(order, provider);
}

export interface RefundInput {
  amountMinor: number;
  reason: string;
  /** The refund modal's one-time token (`AdminRefund.token`). */
  token?: string;
  /** Where the money goes, as the server decided (`orderMoney`). */
  destination?: RefundDestination;
  /**
   * What was collected (`OrderMoney.collectedMinor`): the refund cap when
   * the POS took less than the order total. Omitted or null: the total.
   */
  collectedMinor?: number | null;
}

export type RefundResult =
  | { ok: true; order: AdminOrder; refund: AdminRefund }
  | { ok: false; error: string; duplicate?: boolean };

/**
 * Why a refund of `amountMinor` cannot be issued against `order`, or `null`
 * when it can. Pure, and run BEFORE the POS is asked for the money: the admin
 * action used to call `provider.refund` first and only then learn here that
 * the order was unpaid or the amount too large - the card was credited, the
 * ledger refused, and the two were out of step for good.
 *
 * `collected` is whether money was ever taken (`paidAt`, or a succeeded
 * payment transaction). A cancelled order that WAS paid is refundable: the
 * cancel dialog promises "iade ayrıca başlatılır", and refusing it left the
 * customer's money with the shop with no way to give it back.
 *
 * `collectedMinor` caps the refund at what was actually collected: the
 * order total used to be the cap, and a POS that took ₺1 for a ₺500 order
 * (an amount mismatch) could be asked to send back ₺500.
 */
export function refundRefusal(
  order: Pick<AdminOrder, "status" | "totalMinor" | "refunds">,
  amountMinor: number,
  collected: boolean,
  collectedMinor: number | null = null,
): string | null {
  if (order.status === "cancelled" && !collected) {
    return "İptal edilen, ödemesi alınmamış siparişe iade yapılamaz.";
  }
  // Nothing was ever collected on an order still awaiting payment, so there is
  // nothing to give back - recording one would invent a negative in the
  // reports and, on a real POS, attempt a refund against no transaction.
  if (order.status === "pending_payment") {
    return "Ödemesi alınmamış siparişe iade yapılamaz; siparişi iptal edin.";
  }
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    return "İade tutarı pozitif olmalı.";
  }
  const already = order.refunds.reduce((s, r) => s + r.amountMinor, 0);
  const cap = collected
    ? refundCapMinor(order, collected, collectedMinor)
    : order.totalMinor;
  const remaining = Math.max(0, cap - already);
  if (amountMinor > remaining) {
    return cap < order.totalMinor
      ? `İade tutarı tahsil edilen tutarı aşıyor (iade edilebilir: ${priceLabel(remaining)}).`
      : `İade tutarı kalan bakiyeyi aşıyor (kalan: ${priceLabel(remaining)}).`;
  }
  return null;
}

/**
 * Was money ever collected on this order? `paidAt`, or any succeeded payment
 * row - a manual "ödendi" too: the cash was taken, it just cannot go back to
 * a card.
 */
export async function orderWasCollected(order: AdminOrder): Promise<boolean> {
  if (order.paidAt) return true;
  return (await orderMoney(order)).collected;
}

/**
 * Step 1 of a refund: write the ledger entry, if it still fits.
 *
 * `reserve_order_refund_once` appends the entry in ONE UPDATE whose WHERE
 * checks the remaining balance against what was collected and the modal's
 * one-time token, so two refunds submitted together cannot both fit where
 * only one does, and the same modal submitted twice records once. Called
 * BEFORE the POS: if the POS then refuses, {@link releaseRefund} takes the
 * entry back (token included, so a retry may run); if it accepts,
 * {@link finalizeRefund} settles the status and the stamp.
 */
export async function reserveRefund(
  orderId: string,
  input: RefundInput,
): Promise<RefundResult> {
  await ensureSeed();
  const existing = await getOrder(orderId);
  if (!existing) return { ok: false, error: "Sipariş bulunamadı." };
  const token = (input.token ?? "").trim().slice(0, 64);
  if (token && existing.refunds.some((r) => r.token === token)) {
    return {
      ok: false,
      duplicate: true,
      error: "Bu iade zaten kaydedildi. Sayfa yenilendi, iadeler bölümüne bak.",
    };
  }
  const collected = await orderWasCollected(existing);
  const refusal = refundRefusal(
    existing,
    input.amountMinor,
    collected,
    input.collectedMinor ?? null,
  );
  if (refusal) return { ok: false, error: refusal };
  const refund: AdminRefund = {
    id: `rfn-${existing.refunds.length + 1}-${Date.now()}`,
    amountMinor: input.amountMinor,
    reason: input.reason.slice(0, 500),
    createdAt: new Date().toISOString(),
    ...(input.destination ? { destination: input.destination } : {}),
    ...(token ? { token } : {}),
  };
  const { data, error, status } = await getDb().rpc<AdminRefund[] | null>(
    "reserve_order_refund_once",
    {
      p_order_id: orderId,
      p_refund: refund,
      // The same cap refundRefusal just applied; a row with no collected
      // signal at all (status says paid, nothing else does) keeps the total.
      p_cap: collected
        ? refundCapMinor(existing, collected, input.collectedMinor ?? null)
        : existing.totalMinor,
    },
  );
  if (error) raiseDbError("reserveRefund", error, status);
  if (!data) {
    // Another refund landed between the check above and this write - or the
    // same modal was submitted twice and the first one is in.
    const fresh = token ? await getOrder(orderId) : null;
    if (fresh?.refunds.some((r) => r.token === token)) {
      return {
        ok: false,
        duplicate: true,
        error:
          "Bu iade zaten kaydedildi. Sayfa yenilendi, iadeler bölümüne bak.",
      };
    }
    return {
      ok: false,
      error:
        "İade tutarı kalan bakiyeyi aşıyor - bu siparişe az önce başka bir iade kaydedildi. Sayfayı yenileyip tekrar dene.",
    };
  }
  return { ok: true, order: { ...existing, refunds: data }, refund };
}

/** Takes back a reserved entry the POS then refused. */
export async function releaseRefund(
  orderId: string,
  refundId: string,
): Promise<void> {
  const { error, status } = await getDb().rpc("drop_order_refund", {
    p_order_id: orderId,
    p_refund_id: refundId,
  });
  if (error) raiseDbError("releaseRefund", error, status);
}

/** What the buyer is told about a refund `finalizeRefund` settles. */
export interface RefundNotice {
  refund: AdminRefund;
  /** The POS returned it to the card; false for a refund booked by hand. */
  viaCard: boolean;
}

/** A settled refund: the order as it now stands, and the buyer's mail. */
export interface FinalizedRefund {
  order: AdminOrder;
  /** null when no notice was asked for. */
  mail: OrderNoticeOutcome | null;
}

/**
 * Step 2: the money moved. A fully refunded order becomes `refunded` - unless
 * it was cancelled, which already did that and must stay out of the reports.
 * After EVERY refund, partial ones included, the order's stamps are brought
 * down to what its remaining goods earn (none once fully refunded or
 * cancelled; a retry or a cancelled order's refund is a no-op there).
 *
 * With `notice`, the buyer is told first (a shop order only, once per refund
 * entry): the money has moved whatever the bookkeeping below then does.
 */
export async function finalizeRefund(
  order: AdminOrder,
  notice?: RefundNotice,
): Promise<FinalizedRefund> {
  let mail: OrderNoticeOutcome | null = null;
  if (notice) {
    mail = await notifyOrderRefunded(order, notice.refund, {
      viaCard: notice.viaCard,
    });
  }
  const refunded = order.refunds.reduce((s, r) => s + r.amountMinor, 0);
  const fullyRefunded = refunded >= order.totalMinor;
  const wasCancelled = order.status === "cancelled";
  if (!fullyRefunded || wasCancelled) {
    // A partial refund keeps the stamps of the goods that were kept; a
    // cancelled order keeps none (its cancel already took them back).
    const why = wasCancelled ? "cancelled-refund" : "partial-refund";
    await reverseLoyalty(order, why, { full: wasCancelled });
    return { order, mail };
  }
  check(
    await getDb()
      .from(TABLES.orders)
      .update({ status: "refunded" })
      .eq("id", order.id),
    "finalizeRefund",
  );
  // A fully refunded order keeps nothing: the stamps it earned go back too.
  await reverseLoyalty({ ...order, status: "refunded" }, "refunded", {
    full: true,
  });
  return { order: { ...order, status: "refunded" }, mail };
}

/**
 * A refund with no POS in the middle (nothing was charged through one):
 * reserve and finalize in one go.
 */
export async function refundOrder(
  orderId: string,
  input: RefundInput,
): Promise<RefundResult> {
  const reserved = await reserveRefund(orderId, input);
  if (!reserved.ok) return reserved;
  const { order } = await finalizeRefund(reserved.order, {
    refund: reserved.refund,
    viaCard: false,
  });
  return { ok: true, order, refund: reserved.refund };
}

// ─── Settings ─────────────────────────────────────────────────────────────

/**
 * Settings for public, presentational rendering (footer, opening hours, SEO).
 *
 * Degrades to the defaults with the shop forced CLOSED, so a database outage
 * can never leave checkout looking open. Commerce and admin must keep calling
 * `getSettings()`, which throws - deciding tax, shipping or whether an order
 * may be placed from fallback values would be a real financial error.
 *
 * Memoised per request (`React.cache`, WP1): the home page's metadata and its
 * body, and the /odeme and /uye layouts and their pages, each asked for the
 * same row in the same render. Scoped to one request - nothing is shared
 * between visitors, and outside a render (actions, route handlers) it reads
 * every time.
 */
export const getPublicSettings = cache(
  async (): Promise<AdminSettings> =>
    publicRead(
      "getPublicSettings",
      { ...defaultSettings(), isShopOpen: false },
      () => getSettings(),
    ),
);

export async function getSettings(): Promise<AdminSettings> {
  await ensureSeed();
  const sb = getDb();
  const doc = one<Record<string, unknown>>(
    await sb.from(TABLES.settings).select("*").eq("id", "main").maybeSingle(),
    "getSettings",
  );
  if (!doc) return defaultSettings();
  const { id: _id, ...rest } = doc;
  void _id;
  // A row seeded before a settings column existed reads that column from the
  // migration default once the column lands; keys the driver did not return
  // at all (a partial select in a test executor) fall back to the same
  // defaults here, so callers never see `undefined` for a number field.
  // The app config is a jsonb document, so a shallow spread cannot fill a
  // missing nested key - it is normalised leaf by leaf instead.
  return {
    ...defaultSettings(),
    ...rest,
    mobileApp: normalizeMobileAppConfig(rest.mobileApp),
    // jsonb as well: every key filled, a bad value reads as the legal rate.
    taxRates: normalizeTaxRates(rest.taxRates),
    // jsonb from the row: only known roles reach the recipient list.
    orderNotifyRoles: normalizeNotifyRoles(
      rest.orderNotifyRoles ?? defaultSettings().orderNotifyRoles,
    ),
  } as AdminSettings;
}

export async function updateSettings(
  input: Partial<AdminSettings>,
): Promise<AdminSettings> {
  await ensureSeed();
  const sb = getDb();
  check(
    await sb
      .from(TABLES.settings)
      .upsert({ id: "main", ...input }, { onConflict: "id" }),
    "updateSettings",
  );
  return getSettings();
}

// ─── Dashboard stats ──────────────────────────────────────────────────────

export interface DashboardStats {
  productCount: number;
  activeProductCount: number;
  outOfStockCount: number;
  categoryCount: number;
  orderCount: number;
  pendingOrderCount: number;
  revenueMinor: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  await ensureSeed();
  const sb = getDb();

  const [
    productCount,
    activeProductCount,
    outOfStockCount,
    categoryCount,
    orderCount,
    pendingOrderCount,
    revenueRows,
  ] = await Promise.all([
    countRows(TABLES.products),
    sb
      .from(TABLES.products)
      .select("*", { count: "exact", head: true })
      .eq("isActive", true)
      .then((r) => {
        if (r.error)
          throw new Error(`getDashboardStats.active: ${r.error.message}`);
        return r.count ?? 0;
      }),
    sb
      .from(TABLES.products)
      .select("*", { count: "exact", head: true })
      .eq("stock", 0)
      .then((r) => {
        if (r.error)
          throw new Error(`getDashboardStats.oos: ${r.error.message}`);
        return r.count ?? 0;
      }),
    countRows(TABLES.categories),
    countRows(TABLES.orders),
    sb
      .from(TABLES.orders)
      .select("*", { count: "exact", head: true })
      .in("status", [...OPEN_ORDER_STATUSES])
      .then((r) => {
        if (r.error)
          throw new Error(`getDashboardStats.pending: ${r.error.message}`);
        return r.count ?? 0;
      }),
    sb
      .from(TABLES.orders)
      .select("totalMinor, refunds")
      .in("status", ["paid", "preparing", "shipped", "completed"])
      .then((r) => {
        if (r.error)
          throw new Error(`getDashboardStats.revenue: ${r.error.message}`);
        return (r.data ?? []) as Array<{
          totalMinor: number;
          refunds: AdminRefund[] | null;
        }>;
      }),
  ]);

  // Net of refunds. The dashboard summed order totals and ignored the refund
  // ledger entirely, so money handed back still counted as revenue - and a
  // partially refunded order counted in full.
  const revenueMinor = revenueRows.reduce((sum, o) => {
    const refunded = (o.refunds ?? []).reduce(
      (r, entry) => r + (entry?.amountMinor ?? 0),
      0,
    );
    return sum + Math.max(0, (o.totalMinor ?? 0) - refunded);
  }, 0);

  return {
    productCount,
    activeProductCount,
    outOfStockCount,
    categoryCount,
    orderCount,
    pendingOrderCount,
    revenueMinor,
  };
}

// ─── Public read for customer site ────────────────────────────────────────

function toDesignProduct(p: AdminProduct): DesignProduct {
  return {
    id: p.id,
    name: p.name,
    tag: p.tag,
    price: priceLabel(p.priceMinor),
    compareAtPrice:
      p.compareAtPriceMinor > p.priceMinor
        ? priceLabel(p.compareAtPriceMinor)
        : undefined,
    desc: p.desc,
    cat: p.cat,
    img: p.img,
    featured: p.featured || undefined,
    isNew: p.isNew || undefined,
    // The allergen tags the app already reads from `GET /shop`; the PDP draws
    // its allergen row from them. Guarded for the same deploy-order reason as
    // the mobile mapper.
    tags: Array.isArray(p.tags) && p.tags.length > 0 ? [...p.tags] : undefined,
    // Rich fields for the PDP + cart.
    slug: p.slug,
    sku: p.sku,
    // Uploaded images are served from /gorsel/urun/... rather than inlined as
    // base64, with the content stamp that lets a cache keep them forever:
    // see src/lib/admin/image-url.ts.
    images:
      p.images.length > 0
        ? p.images.map((img, i) =>
            servedImage(img, productImagePath(p.id, i, imageVersion(img))),
          )
        : undefined,
    stock: p.stock,
    lowStockThreshold: p.lowStockThreshold,
    weightGrams: p.weightGrams,
    priceMinor: p.priceMinor,
    compareAtPriceMinor:
      p.compareAtPriceMinor > p.priceMinor ? p.compareAtPriceMinor : undefined,
    seoTitle: p.seoTitle || undefined,
    seoDescription: p.seoDescription || undefined,
    variants: p.variants
      .filter((v) => v.isActive)
      .map((v) => ({
        id: v.id,
        name: v.name,
        priceDelta: v.priceDeltaMinor / 100,
        stock: v.stock,
        isActive: v.isActive,
      })),
  };
}

export async function listShopProducts(): Promise<DesignProduct[]> {
  // Falls back to an EMPTY shop, never to the bundled seed products: a price or
  // a stock count from the seed would be fiction, and the shop must not sell
  // against fiction. An empty shop plus the outage banner is honest.
  return publicRead("listShopProducts", [] as DesignProduct[], async () => {
    const all = await listProducts();
    return all.filter((p) => p.isActive).map(toDesignProduct);
  });
}

/**
 * Single active product by slug - for the PDP (/magaza/urun/<slug>).
 *
 * Memoised per request (WP1): the product page's `generateMetadata` and its
 * body both read the product, which was two identical queries per view.
 * Display only - checkout re-reads prices and stock with its own query.
 */
export const getShopProductBySlug = cache(
  async (slug: string): Promise<DesignProduct | null> =>
    publicRead("getShopProductBySlug", null, () =>
      getShopProductBySlugLive(slug),
    ),
);

/**
 * `getShopProductBySlug` without the outage fallback: an unreachable database
 * throws instead of reading as "no such product". For a caller that keeps
 * what it gets - the product's link-preview card, cached an hour - where a
 * fallback stored during a blip would outlive the blip.
 */
export async function getShopProductBySlugLive(
  slug: string,
): Promise<DesignProduct | null> {
  await ensureSeed();
  const sb = getDb();
  const doc = one<AdminProduct>(
    await sb
      .from(TABLES.products)
      .select("*")
      .eq("slug", slug)
      .eq("isActive", true)
      .maybeSingle(),
    "getShopProductBySlug",
  );
  if (!doc) return null;
  return toDesignProduct(doc);
}

/** Up to `limit` other active products sharing the category (for cross-sell). */
export async function listRelatedShopProducts(
  cat: ShopCategoryId,
  excludeId: string,
  limit = 4,
): Promise<DesignProduct[]> {
  return publicRead("listRelatedShopProducts", [] as DesignProduct[], () =>
    listRelatedShopProductsLive(cat, excludeId, limit),
  );
}

async function listRelatedShopProductsLive(
  cat: ShopCategoryId,
  excludeId: string,
  limit: number,
): Promise<DesignProduct[]> {
  await ensureSeed();
  const sb = getDb();
  const docs = rows<AdminProduct>(
    await sb
      .from(TABLES.products)
      .select("*")
      .eq("cat", cat)
      .eq("isActive", true)
      .neq("id", excludeId)
      .limit(limit),
    "listRelatedShopProducts",
  );
  return docs.map(toDesignProduct);
}

// ─── Cafe menu items ──────────────────────────────────────────────────────

export type MenuCategoryKey =
  | "matcha"
  | "espresso"
  | "ice-coffee"
  | "cold"
  | "hot"
  | "frappe"
  | "smoothie"
  | "frozen"
  | "ice-tea"
  | "dessert"
  | "snack"
  | "extras";

export const MENU_CATEGORY_KEYS: MenuCategoryKey[] = [
  "matcha",
  "espresso",
  "ice-coffee",
  "cold",
  "hot",
  "frappe",
  "smoothie",
  "frozen",
  "ice-tea",
  "dessert",
  "snack",
  "extras",
];

export interface AdminMenuItem extends BackdropColumns {
  id: string;
  categoryKey: MenuCategoryKey;
  name: string;
  desc: string;
  /** Minor units (kuruş) - e.g. 13000 = 130,00 ₺. M size when two sizes exist. */
  priceMinor: number;
  /** L (large) price in minor units. 0 means the item has a single size. */
  priceMinorL: number;
  /** Hue token from PhotoSurface palette (used by MenuPlate). */
  hue: string;
  /** Site-relative product photo, e.g. "/menu/matcha-latte.webp". Empty = drawn fallback. */
  image: string;
  /** Free-form tags: "signature", "new", "iced", "nuts", "IGP", … */
  tags: string[];
  /**
   * The item's own KDV rate (whole %), or null: the menu default from
   * `settings.taxRates`. Read through `menuItemTaxRate()`. Optional because a
   * row written before the column existed has no key.
   */
  taxRatePct?: number | null;
  isActive: boolean;
  sortOrder: number;
  updatedAt: string;
}

export async function listMenuItems(): Promise<AdminMenuItem[]> {
  await ensureSeed();
  const sb = getDb();
  const docs = rows<AdminMenuItem>(
    await sb.from(TABLES.menuItems).select("*"),
    "listMenuItems",
  );
  return docs.sort((a, b) => {
    const aIdx = MENU_CATEGORY_KEYS.indexOf(a.categoryKey);
    const bIdx = MENU_CATEGORY_KEYS.indexOf(b.categoryKey);
    if (aIdx !== bIdx) return aIdx - bIdx;
    return a.sortOrder - b.sortOrder;
  });
}

export async function getMenuItem(id: string): Promise<AdminMenuItem | null> {
  await ensureSeed();
  const sb = getDb();
  return one<AdminMenuItem>(
    await sb.from(TABLES.menuItems).select("*").eq("id", id).maybeSingle(),
    "getMenuItem",
  );
}

/**
 * What the menu item form saves, scene columns included (computed by the
 * save action from the photo and the form, `src/lib/backdrop/scene.ts`).
 */
export interface MenuItemInput extends BackdropColumns {
  categoryKey: MenuCategoryKey;
  name: string;
  desc: string;
  priceMinor: number;
  priceMinorL: number;
  hue: string;
  image: string;
  tags: string[];
  /** Own KDV rate, or null for the menu default. Absent keeps the stored one. */
  taxRatePct?: number | null;
  isActive: boolean;
  sortOrder: number;
}

export async function createMenuItem(
  input: MenuItemInput,
): Promise<AdminMenuItem> {
  await ensureSeed();
  const sb = getDb();
  const seq = await nextSeq("mnu");
  const item: AdminMenuItem = {
    id: slugifyId("mnu", seq),
    ...NO_BACKDROP,
    ...input,
    updatedAt: new Date().toISOString(),
  };
  check(await sb.from(TABLES.menuItems).insert(item), "createMenuItem");
  return item;
}

export async function updateMenuItem(
  id: string,
  input: MenuItemInput,
): Promise<AdminMenuItem | null> {
  await ensureSeed();
  const sb = getDb();
  const existing = await getMenuItem(id);
  if (!existing) return null;
  const next: AdminMenuItem = {
    ...existing,
    ...input,
    updatedAt: new Date().toISOString(),
  };
  check(
    await sb.from(TABLES.menuItems).update(next).eq("id", id),
    "updateMenuItem",
  );
  return next;
}

export async function deleteMenuItem(id: string): Promise<boolean> {
  await ensureSeed();
  const sb = getDb();
  const deleted = rows<{ id: string }>(
    await sb.from(TABLES.menuItems).delete().eq("id", id).select("id"),
    "deleteMenuItem",
  );
  return deleted.length > 0;
}

export type BulkMenuOp =
  | { kind: "delete" }
  | { kind: "activate" }
  | { kind: "deactivate" }
  | { kind: "set_category"; categoryKey: MenuCategoryKey };

export async function bulkUpdateMenuItems(
  ids: string[],
  op: BulkMenuOp,
): Promise<BulkResult> {
  if (ids.length === 0) return { updated: 0 };
  await ensureSeed();
  const sb = getDb();
  const now = new Date().toISOString();

  if (op.kind === "delete") {
    const res = rows<{ id: string }>(
      await sb.from(TABLES.menuItems).delete().in("id", ids).select("id"),
      "bulkUpdateMenuItems.delete",
    );
    return { updated: res.length };
  }

  if (op.kind === "activate") {
    const res = rows<{ id: string }>(
      await sb
        .from(TABLES.menuItems)
        .update({ isActive: true, updatedAt: now })
        .in("id", ids)
        .eq("isActive", false)
        .select("id"),
      "bulkUpdateMenuItems.activate",
    );
    return { updated: res.length };
  }

  if (op.kind === "deactivate") {
    const res = rows<{ id: string }>(
      await sb
        .from(TABLES.menuItems)
        .update({ isActive: false, updatedAt: now })
        .in("id", ids)
        .eq("isActive", true)
        .select("id"),
      "bulkUpdateMenuItems.deactivate",
    );
    return { updated: res.length };
  }

  const res = rows<{ id: string }>(
    await sb
      .from(TABLES.menuItems)
      .update({ categoryKey: op.categoryKey, updatedAt: now })
      .in("id", ids)
      .neq("categoryKey", op.categoryKey)
      .select("id"),
    "bulkUpdateMenuItems.set_category",
  );
  return { updated: res.length };
}

/**
 * The bundled cafe menu with every price replaced by a hyphen.
 *
 * The menu is a view-only listing, so its structure is still worth showing
 * during an outage - but a price from the bundled seed may be out of date, and
 * showing a wrong price to someone standing at the counter is worse than
 * showing none.
 */
function menuWithoutPrices(): Record<string, DesignMenuCategory> {
  const out: Record<string, DesignMenuCategory> = {};
  for (const key of MENU_CATEGORY_KEYS) {
    const meta = SEED_MENU[key];
    if (!meta) continue;
    out[key] = {
      ...meta,
      items: meta.items.map((it) => ({
        ...it,
        price: "-",
        ...(it.priceL ? { priceL: "-" } : {}),
      })),
    };
  }
  return out;
}

export async function listMenuForCustomer(): Promise<
  Record<string, DesignMenuCategory>
> {
  return publicRead("listMenuForCustomer", menuWithoutPrices(), () =>
    listMenuForCustomerLive(),
  );
}

async function listMenuForCustomerLive(): Promise<
  Record<string, DesignMenuCategory>
> {
  const all = await listMenuItems();
  const out: Record<string, DesignMenuCategory> = {};
  for (const key of MENU_CATEGORY_KEYS) {
    const meta = SEED_MENU[key];
    const activeItems = all
      .filter((it) => it.categoryKey === key && it.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((it) => ({
        name: it.name,
        desc: it.desc,
        price: priceLabel(it.priceMinor),
        ...(it.priceMinorL > 0 ? { priceL: priceLabel(it.priceMinorL) } : {}),
        ...(it.tags.length > 0 ? { tags: [...it.tags] } : {}),
        hue: it.hue,
        ...(it.image
          ? {
              image: servedImage(
                it.image,
                menuImagePath(it.id, imageVersion(it.image)),
              ),
            }
          : {}),
      }));
    out[key] = {
      title: meta.title,
      sub: meta.sub,
      italian: meta.italian,
      note: meta.note,
      items: activeItems,
    };
  }
  return out;
}

export const MENU_CATEGORY_LABELS: Record<MenuCategoryKey, string> = {
  matcha: SEED_MENU.matcha.title,
  espresso: SEED_MENU.espresso.title,
  "ice-coffee": SEED_MENU["ice-coffee"].title,
  cold: SEED_MENU.cold.title,
  hot: SEED_MENU.hot.title,
  frappe: SEED_MENU.frappe.title,
  smoothie: SEED_MENU.smoothie.title,
  frozen: SEED_MENU.frozen.title,
  "ice-tea": SEED_MENU["ice-tea"].title,
  dessert: SEED_MENU.dessert.title,
  snack: SEED_MENU.snack.title,
  extras: SEED_MENU.extras.title,
};

// ─── Promo codes ──────────────────────────────────────────────────────────

export type PromoDiscountKind = "pct" | "fixed";

export interface AdminPromo {
  id: string;
  code: string;
  kind: PromoDiscountKind;
  value: number;
  minSubtotalMinor: number;
  usageLimit: number;
  usageCount: number;
  expiresAt: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function listPromos(): Promise<AdminPromo[]> {
  await ensureSeed();
  const sb = getDb();
  return rows<AdminPromo>(
    await sb
      .from(TABLES.promos)
      .select("*")
      .order("createdAt", { ascending: false }),
    "listPromos",
  );
}

export async function getPromo(id: string): Promise<AdminPromo | null> {
  await ensureSeed();
  const sb = getDb();
  return one<AdminPromo>(
    await sb.from(TABLES.promos).select("*").eq("id", id).maybeSingle(),
    "getPromo",
  );
}

export interface PromoInput {
  code: string;
  kind: PromoDiscountKind;
  value: number;
  minSubtotalMinor: number;
  usageLimit: number;
  expiresAt: string;
  isActive: boolean;
}

function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export type PromoMutationResult =
  | { ok: true; promo: AdminPromo }
  | { ok: false; error: string };

export async function createPromo(
  input: PromoInput,
): Promise<PromoMutationResult> {
  await ensureSeed();
  const code = normalizeCode(input.code);
  if (!code) return { ok: false, error: "Kod boş olamaz." };
  const sb = getDb();
  const conflict = one<{ id: string }>(
    await sb.from(TABLES.promos).select("id").eq("code", code).maybeSingle(),
    "createPromo.conflict",
  );
  if (conflict) return { ok: false, error: "Bu kod zaten kullanılıyor." };
  const seq = await nextSeq("prm");
  const now = new Date().toISOString();
  const promo: AdminPromo = {
    id: `prm-${String(seq).padStart(4, "0")}`,
    code,
    kind: input.kind,
    value: input.value,
    minSubtotalMinor: input.minSubtotalMinor,
    usageLimit: input.usageLimit,
    usageCount: 0,
    expiresAt: input.expiresAt,
    isActive: input.isActive,
    createdAt: now,
    updatedAt: now,
  };
  check(await sb.from(TABLES.promos).insert(promo), "createPromo.insert");
  return { ok: true, promo };
}

export async function updatePromo(
  id: string,
  input: PromoInput,
): Promise<PromoMutationResult> {
  await ensureSeed();
  const sb = getDb();
  const existing = await getPromo(id);
  if (!existing) return { ok: false, error: "Kod bulunamadı." };
  const code = normalizeCode(input.code);
  if (!code) return { ok: false, error: "Kod boş olamaz." };
  const conflict = one<{ id: string }>(
    await sb
      .from(TABLES.promos)
      .select("id")
      .eq("code", code)
      .neq("id", id)
      .maybeSingle(),
    "updatePromo.conflict",
  );
  if (conflict) return { ok: false, error: "Başka bir kod aynı koda sahip." };
  const next: AdminPromo = {
    ...existing,
    code,
    kind: input.kind,
    value: input.value,
    minSubtotalMinor: input.minSubtotalMinor,
    usageLimit: input.usageLimit,
    expiresAt: input.expiresAt,
    isActive: input.isActive,
    updatedAt: new Date().toISOString(),
  };
  check(
    await sb.from(TABLES.promos).update(next).eq("id", id),
    "updatePromo.update",
  );
  return { ok: true, promo: next };
}

/** The list's Aktif / Pasif switch; null when the code is gone. */
export async function setPromoActive(
  id: string,
  isActive: boolean,
): Promise<AdminPromo | null> {
  await ensureSeed();
  const sb = getDb();
  const updated = rows<AdminPromo>(
    await sb
      .from(TABLES.promos)
      .update({ isActive, updatedAt: new Date().toISOString() })
      .eq("id", id)
      .select("*"),
    "setPromoActive",
  );
  return updated[0] ?? null;
}

export async function deletePromo(id: string): Promise<boolean> {
  await ensureSeed();
  const sb = getDb();
  const deleted = rows<{ id: string }>(
    await sb.from(TABLES.promos).delete().eq("id", id).select("id"),
    "deletePromo",
  );
  return deleted.length > 0;
}

export type PromoApplyResult =
  | { ok: true; promo: AdminPromo; discountMinor: number }
  | { ok: false; error: string };

export async function applyPromoCode(
  code: string,
  subtotalMinor: number,
): Promise<PromoApplyResult> {
  await ensureSeed();
  const needle = normalizeCode(code);
  if (!needle) return { ok: false, error: "Kod gir." };
  const sb = getDb();
  const promo = one<AdminPromo>(
    await sb.from(TABLES.promos).select("*").eq("code", needle).maybeSingle(),
    "applyPromoCode",
  );
  if (!promo) return { ok: false, error: "Geçersiz kod." };
  if (!promo.isActive) return { ok: false, error: "Bu kod kapalı." };
  // parsePublishInstant reads a stored bare "YYYY-MM-DDTHH:mm" (promos saved
  // before expiry was normalised to UTC) as Istanbul time, and fails closed on
  // text that is not a time.
  if (promo.expiresAt) {
    const expires = parsePublishInstant(promo.expiresAt);
    if (expires === null || expires < Date.now()) {
      return { ok: false, error: "Kodun süresi doldu." };
    }
  }
  if (promo.usageLimit > 0 && promo.usageCount >= promo.usageLimit) {
    return { ok: false, error: "Kod kullanım limiti doldu." };
  }
  if (subtotalMinor < promo.minSubtotalMinor) {
    return {
      ok: false,
      error: `Bu koda uygulanabilmek için en az ${priceLabel(promo.minSubtotalMinor)} alışveriş gerek.`,
    };
  }
  let discountMinor =
    promo.kind === "pct"
      ? Math.floor((subtotalMinor * promo.value) / 100)
      : Math.min(promo.value, subtotalMinor);
  if (discountMinor < 0) discountMinor = 0;
  if (discountMinor > subtotalMinor) discountMinor = subtotalMinor;
  return { ok: true, promo, discountMinor };
}

/**
 * Takes one use of a promo code, enforcing the limit in the same statement.
 *
 * `applyPromoCode` checks the limit in a separate read, so two checkouts
 * racing on the last use of a code both passed that check and both
 * incremented. Returns false when the code was already exhausted or switched
 * off - the caller must then not honour the discount.
 */
async function consumePromoUsage(code: string): Promise<boolean> {
  await ensureSeed();
  const needle = normalizeCode(code);
  const sb = getDb();
  const { data, error } = await sb.rpc("redeem_promo", {
    promo_code: needle,
    p_now: new Date().toISOString(),
  });
  if (error) throw new Error(`consumePromoUsage: ${error.message}`);
  return data === true;
}

/** Gives a use back when the order that took it is cancelled. */
async function releasePromoUsage(code: string): Promise<void> {
  const needle = normalizeCode(code);
  if (!needle) return;
  const sb = getDb();
  const { error } = await sb.rpc("release_promo_usage", {
    promo_code: needle,
    p_now: new Date().toISOString(),
  });
  if (error) throw new Error(`releasePromoUsage: ${error.message}`);
}

// ─── Analytics aggregations ───────────────────────────────────────────────

export type BucketGranularity = "day" | "week" | "month";

const BUCKET_GRANULARITIES: readonly BucketGranularity[] = [
  "day",
  "week",
  "month",
];

/**
 * The report's `?g=` as a granularity; anything else is the default "day".
 * An unknown value used to draw the daily chart with no tab marked.
 */
export function parseGranularity(raw: unknown): BucketGranularity {
  return typeof raw === "string" &&
    (BUCKET_GRANULARITIES as readonly string[]).includes(raw)
    ? (raw as BucketGranularity)
    : "day";
}

/**
 * Whether an order is revenue.
 *
 * Only `cancelled` used to be skipped, so every `pending_payment` row counted
 * - and every app order starts there, for up to 45 minutes. Twenty members
 * opening checkout during a campaign and abandoning at the POS page added
 * twenty orders and their full totals to "Net ciro". Money is booked when it
 * has been collected: paid, preparing, shipped, completed, or refunded (whose
 * refund ledger is subtracted separately).
 */
export function isReportableOrder(o: Pick<AdminOrder, "status">): boolean {
  return o.status !== "cancelled" && o.status !== "pending_payment";
}

export interface RevenueBucket {
  bucket: string;
  label: string;
  revenueMinor: number;
  orderCount: number;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Report buckets are cut at the venue's midnight, not the server's. Vercel
 * runs in UTC, so an order placed at 01:30 in Tuzla used to land in the
 * previous day's bar. Turkey has been fixed at UTC+03:00 since 2016 (no DST),
 * the same constant `publish-window.ts` and the campaign scheduler use. Every
 * helper below takes a "wall" date - the Istanbul wall-clock time carried in
 * the UTC fields - and reads it only with the getUTC* / setUTC* family, so
 * the result no longer depends on the machine's TZ.
 */
const REPORT_TZ_OFFSET_MS = 3 * 60 * 60 * 1000;

function istanbulWall(d: Date): Date {
  return new Date(d.getTime() + REPORT_TZ_OFFSET_MS);
}

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = (x.getUTCDay() + 6) % 7;
  x.setUTCHours(0, 0, 0, 0);
  x.setUTCDate(x.getUTCDate() - day);
  return x;
}

function isoWeek(d: Date): { year: number; week: number } {
  const target = new Date(d);
  target.setUTCHours(0, 0, 0, 0);
  target.setUTCDate(target.getUTCDate() + 3 - ((target.getUTCDay() + 6) % 7));
  const week1 = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const diff = (target.getTime() - week1.getTime()) / (24 * 60 * 60 * 1000);
  const week = 1 + Math.round((diff - 3 + ((week1.getUTCDay() + 6) % 7)) / 7);
  return { year: target.getUTCFullYear(), week };
}

function bucketKey(d: Date, g: BucketGranularity): string {
  if (g === "day") {
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  }
  if (g === "week") {
    const { year, week } = isoWeek(d);
    return `${year}-W${pad2(week)}`;
  }
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
}

function bucketLabel(d: Date, g: BucketGranularity): string {
  if (g === "day") {
    return `${pad2(d.getUTCDate())} ${MONTH_SHORT[d.getUTCMonth()]}`;
  }
  if (g === "week") {
    const start = startOfWeek(d);
    return `${pad2(start.getUTCDate())} ${MONTH_SHORT[start.getUTCMonth()]}`;
  }
  return `${MONTH_SHORT[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`;
}

const MONTH_SHORT = [
  "Oca",
  "Şub",
  "Mar",
  "Nis",
  "May",
  "Haz",
  "Tem",
  "Ağu",
  "Eyl",
  "Eki",
  "Kas",
  "Ara",
];

/**
 * The orders the reports read, projected to the columns they use.
 *
 * WP1: /admin/raporlar read the whole orders table three times per view (headline,
 * buckets, top products) - three full reads of every column of every order,
 * serialised over the instance's single connection. Measured on 20k orders:
 * ~1.8 s and 3 x 27 MB, against ~0.28 s for the three projections. Only
 * `topProducts` asks for `items`, the heavy column.
 */
async function reportOrders<K extends keyof AdminOrder>(
  columns: readonly K[],
  ctx: string,
): Promise<Pick<AdminOrder, K>[]> {
  await ensureSeed();
  return rows<Pick<AdminOrder, K>>(
    await getDb()
      .from(TABLES.orders)
      .select(columns.join(", "))
      .order("orderNo", { ascending: false }),
    ctx,
  );
}

/** What {@link bucketRevenue} reads from an order. */
export type RevenueOrder = Pick<
  AdminOrder,
  "status" | "createdAt" | "totalMinor" | "refunds"
>;

export async function revenueBuckets(
  granularity: BucketGranularity,
  count: number,
): Promise<RevenueBucket[]> {
  const orders = await reportOrders(
    ["status", "createdAt", "totalMinor", "refunds"],
    "revenueBuckets",
  );
  return bucketRevenue(orders, granularity, count, new Date());
}

/**
 * The pure half of {@link revenueBuckets}, exported for tests.
 *
 * Month steps start from the 1st: `setMonth(m - 1)` on 31 October is
 * "31 September", which JavaScript rolls over to 1 October - so on the 29th,
 * 30th and 31st the monthly report showed the current month twice and dropped
 * the one before it.
 */
export function bucketRevenue(
  orders: RevenueOrder[],
  granularity: BucketGranularity,
  count: number,
  now: Date,
): RevenueBucket[] {
  const today = istanbulWall(now);
  const buckets: RevenueBucket[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    if (granularity === "day") d.setUTCDate(d.getUTCDate() - i);
    else if (granularity === "week") d.setUTCDate(d.getUTCDate() - i * 7);
    else {
      d.setUTCDate(1);
      d.setUTCMonth(d.getUTCMonth() - i);
    }
    buckets.push({
      bucket: bucketKey(d, granularity),
      label: bucketLabel(d, granularity),
      revenueMinor: 0,
      orderCount: 0,
    });
  }
  const byKey = new Map(buckets.map((b) => [b.bucket, b]));

  for (const o of orders) {
    if (!isReportableOrder(o)) continue;
    const k = bucketKey(istanbulWall(new Date(o.createdAt)), granularity);
    const slot = byKey.get(k);
    if (slot) {
      // Net of refunds, like the dashboard figure. A refund is booked against
      // the order's own bucket rather than the day it was issued: the two
      // numbers have to agree, and the order date is what the reports group by.
      const refunded = o.refunds.reduce((r, entry) => r + entry.amountMinor, 0);
      slot.revenueMinor += Math.max(0, o.totalMinor - refunded);
      slot.orderCount += 1;
    }
  }
  return buckets;
}

export interface TopProductRow {
  productName: string;
  qty: number;
  revenueMinor: number;
}

export async function topProducts(limit = 5): Promise<TopProductRow[]> {
  const orders = await reportOrders(["status", "items"], "topProducts");
  const tally = new Map<string, TopProductRow>();
  for (const o of orders) {
    if (!isReportableOrder(o)) continue;
    for (const it of o.items) {
      if (it.status === "cancelled") continue;
      const row = tally.get(it.productName);
      if (row) {
        row.qty += it.qty;
        row.revenueMinor += it.unitPriceMinor * it.qty;
      } else {
        tally.set(it.productName, {
          productName: it.productName,
          qty: it.qty,
          revenueMinor: it.unitPriceMinor * it.qty,
        });
      }
    }
  }
  return Array.from(tally.values())
    .sort((a, b) => b.revenueMinor - a.revenueMinor)
    .slice(0, limit);
}

export interface AnalyticsHeadline {
  /** What the counted orders were placed for, refunds not taken off. */
  grossRevenueMinor: number;
  /** Gross minus refunds, clamped per order like the chart's buckets. */
  netRevenueMinor: number;
  totalOrders: number;
  /** Gross per counted order. */
  averageOrderMinor: number;
  /** Refunds on the counted orders: the difference between gross and net. */
  refundedMinor: number;
  conversionRatePct: number | null;
}

export async function analyticsHeadline(): Promise<AnalyticsHeadline> {
  const orders = await reportOrders(
    ["status", "totalMinor", "refunds"],
    "analyticsHeadline",
  );
  return headlineFrom(orders);
}

/**
 * The pure half of {@link analyticsHeadline}, exported for tests.
 *
 * The page said "Net ciro" over a figure that was gross (refunded orders in
 * at their full total), with a refund line beside it that also summed the
 * refunds of cancelled orders the gross never counted. Both figures now read
 * the same orders ({@link isReportableOrder}), and net is gross minus those
 * refunds, per order as {@link bucketRevenue} books it, so the headline and
 * the chart agree.
 */
export function headlineFrom(
  orders: ReadonlyArray<Pick<AdminOrder, "status" | "totalMinor" | "refunds">>,
): AnalyticsHeadline {
  let grossRevenueMinor = 0;
  let netRevenueMinor = 0;
  let refundedMinor = 0;
  let totalOrders = 0;
  for (const o of orders) {
    if (!isReportableOrder(o)) continue;
    const refunded = o.refunds.reduce((r, x) => r + x.amountMinor, 0);
    totalOrders += 1;
    grossRevenueMinor += o.totalMinor;
    refundedMinor += refunded;
    netRevenueMinor += Math.max(0, o.totalMinor - refunded);
  }
  return {
    grossRevenueMinor,
    netRevenueMinor,
    totalOrders,
    averageOrderMinor:
      totalOrders > 0 ? Math.round(grossRevenueMinor / totalOrders) : 0,
    refundedMinor,
    conversionRatePct: null,
  };
}

/** The karaoke columns the revenue report reads. */
export interface KaraokeRevenueRow {
  paymentStatus?: string | null;
  paidMinor?: number | null;
  paidAt?: string | null;
  createdAt: string;
}

export interface KaraokeRevenue {
  /** Everything the POS collected for bookings, refunds not taken off. */
  collectedMinor: number;
  /** Paid back in full (`refunded`). */
  refundedMinor: number;
  /** Collected minus refunded: what the köşk keeps. */
  netMinor: number;
  /** Bookings whose money is still with the köşk (paid or refund pending). */
  paidCount: number;
  /** Part of net whose refund was started and is not settled yet. */
  refundPendingMinor: number;
  /** Net in the chart's period (same buckets as the order revenue). */
  periodNetMinor: number;
  periodCount: number;
}

/** The payment states that mean money reached the POS. */
const KARAOKE_COLLECTED = ["paid", "refunding", "refunded"] as const;

/**
 * Prepaid karaoke (16 Eki 2026) in the reports. The reports read only
 * `orders`, so the money collected for bookings was in no figure.
 *
 * Read from `karaoke_reservations`: `paidMinor` of every booking the POS
 * collected, minus the ones refunded. A refund is always the full amount,
 * so a `refunded` row nets to 0. A `refunding` row still counts: the POS has
 * not confirmed the money went back (CLAUDE.md rule 29), it is shown apart as
 * "iadesi bekleyen". The period figure books a payment in the bucket of its
 * `paidAt`, and its refund against that same bucket, as the order chart does.
 */
export async function karaokeRevenue(
  granularity: BucketGranularity,
  count: number,
): Promise<KaraokeRevenue> {
  const data = rows<KaraokeRevenueRow>(
    await getDb()
      .from(TABLES.karaokeReservations)
      .select("paymentStatus, paidMinor, paidAt, createdAt")
      .in("paymentStatus", [...KARAOKE_COLLECTED]),
    "karaokeRevenue",
  );
  return karaokeRevenueFrom(data, granularity, count, new Date());
}

/** The pure half of {@link karaokeRevenue}, exported for tests. */
export function karaokeRevenueFrom(
  bookings: readonly KaraokeRevenueRow[],
  granularity: BucketGranularity,
  count: number,
  now: Date,
): KaraokeRevenue {
  const period = new Set(
    bucketRevenue([], granularity, count, now).map((b) => b.bucket),
  );
  const out: KaraokeRevenue = {
    collectedMinor: 0,
    refundedMinor: 0,
    netMinor: 0,
    paidCount: 0,
    refundPendingMinor: 0,
    periodNetMinor: 0,
    periodCount: 0,
  };
  for (const r of bookings) {
    const status = r.paymentStatus ?? "";
    if (!(KARAOKE_COLLECTED as readonly string[]).includes(status)) continue;
    const paid = Math.max(0, Math.round(Number(r.paidMinor) || 0));
    if (paid === 0) continue;
    const kept = status === "refunded" ? 0 : paid;
    out.collectedMinor += paid;
    out.refundedMinor += paid - kept;
    out.netMinor += kept;
    if (kept > 0) out.paidCount += 1;
    if (status === "refunding") out.refundPendingMinor += paid;
    const at = new Date(r.paidAt || r.createdAt);
    if (Number.isNaN(at.getTime())) continue;
    if (period.has(bucketKey(istanbulWall(at), granularity)) && kept > 0) {
      out.periodNetMinor += kept;
      out.periodCount += 1;
    }
  }
  return out;
}

// ─── Shop hero slides ─────────────────────────────────────────────────────

export interface AdminShopHeroSlide {
  id: string;
  /** H1 başlık (italik serif olarak render edilir, son kelime script vurgu alabilir). */
  title: string;
  /** Başlığın altındaki küçük yazı; eyebrow tarzı veya küçük açıklama. */
  subtitle: string;
  /** Arkadaki görsel URL'si (full-width). Boşsa altın gradient fallback render edilir. */
  imageUrl: string;
  /** CTA buton yazısı - boşsa buton render edilmez. */
  ctaLabel: string;
  /** CTA hedef URL - full URL veya yerel "/odeme" gibi. */
  ctaHref: string;
  /** Metin teması: arka plan koyu görsel ise "light", aydınlık ise "dark". */
  textTheme: "light" | "dark";
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const SEED_SHOP_HERO_SLIDES: AdminShopHeroSlide[] = [
  {
    id: "shero-001",
    title: "Eve servis · İtalyan ritüeli",
    subtitle:
      "Bütün mağaza ürünleri 500₺ üzeri ücretsiz kargo, İstanbul içi aynı gün.",
    imageUrl: "",
    ctaLabel: "Mağazaya gir",
    ctaHref: "#products",
    textTheme: "light",
    sortOrder: 0,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "shero-002",
    title: "Yenilebilir kup koleksiyonu",
    subtitle: "1994 patentli waffle kup - 6'lı ve 12'li hediye kutuları.",
    imageUrl: "",
    ctaLabel: "Edible Cups",
    ctaHref: "#products",
    textTheme: "light",
    sortOrder: 1,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const ensureShopHeroSeed = memoizeUntilRejected(async (): Promise<void> => {
  {
    const sb = getDb();
    if ((await countRows(TABLES.shopHeroSlides)) === 0) {
      check(
        await sb.from(TABLES.shopHeroSlides).upsert(
          SEED_SHOP_HERO_SLIDES.map((s) => ({ ...s })),
          { onConflict: "id", ignoreDuplicates: true },
        ),
        "seed.shopHeroSlides",
      );
    }
  }
});

export async function listShopHeroSlides(): Promise<AdminShopHeroSlide[]> {
  await ensureShopHeroSeed();
  const sb = getDb();
  return rows<AdminShopHeroSlide>(
    await sb
      .from(TABLES.shopHeroSlides)
      .select("*")
      .order("sortOrder", { ascending: true })
      .order("createdAt", { ascending: true }),
    "listShopHeroSlides",
  );
}

export async function listActiveShopHeroSlides(): Promise<
  AdminShopHeroSlide[]
> {
  return publicRead("listActiveShopHeroSlides", [], async () => {
    const all = await listShopHeroSlides();
    return all
      .filter((s) => s.isActive)
      .map((s) => ({
        ...s,
        imageUrl: servedImage(
          s.imageUrl,
          heroImagePath(s.id, imageVersion(s.imageUrl)),
        ),
      }));
  });
}

export async function getShopHeroSlide(
  id: string,
): Promise<AdminShopHeroSlide | null> {
  await ensureShopHeroSeed();
  const sb = getDb();
  return one<AdminShopHeroSlide>(
    await sb.from(TABLES.shopHeroSlides).select("*").eq("id", id).maybeSingle(),
    "getShopHeroSlide",
  );
}

export interface ShopHeroSlideInput {
  title: string;
  subtitle: string;
  imageUrl: string;
  ctaLabel: string;
  ctaHref: string;
  textTheme: "light" | "dark";
  sortOrder: number;
  isActive: boolean;
}

function normalizeSlide(input: ShopHeroSlideInput): ShopHeroSlideInput {
  return {
    title: input.title.trim().slice(0, 120),
    subtitle: input.subtitle.trim().slice(0, 300),
    /* 4 MB clamp - yeterli data URL'i ve normal CDN URL'lerini kapsar.
       Hero görseli için 1920px JPEG @ 0.85 kalite tipik olarak ~600-1500KB
       base64 boyutuna ulaşır; sabit 500 char limiti URL'i kesip görseli
       bozardı. */
    imageUrl: input.imageUrl.trim().slice(0, 4 * 1024 * 1024),
    ctaLabel: input.ctaLabel.trim().slice(0, 40),
    ctaHref: input.ctaHref.trim().slice(0, 200),
    textTheme: input.textTheme === "dark" ? "dark" : "light",
    sortOrder: Number.isFinite(input.sortOrder)
      ? Math.max(0, Math.floor(input.sortOrder))
      : 0,
    isActive: !!input.isActive,
  };
}

export async function createShopHeroSlide(
  input: ShopHeroSlideInput,
): Promise<AdminShopHeroSlide> {
  await ensureShopHeroSeed();
  const sb = getDb();
  const now = new Date().toISOString();
  const slide: AdminShopHeroSlide = {
    id: `shero-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...normalizeSlide(input),
    createdAt: now,
    updatedAt: now,
  };
  check(
    await sb.from(TABLES.shopHeroSlides).insert(slide),
    "createShopHeroSlide",
  );
  return slide;
}

export async function updateShopHeroSlide(
  id: string,
  input: ShopHeroSlideInput,
): Promise<AdminShopHeroSlide | null> {
  await ensureShopHeroSeed();
  const sb = getDb();
  const update = {
    ...normalizeSlide(input),
    updatedAt: new Date().toISOString(),
  };
  check(
    await sb.from(TABLES.shopHeroSlides).update(update).eq("id", id),
    "updateShopHeroSlide",
  );
  return getShopHeroSlide(id);
}

/** True when a slide was removed (false: it was already gone). */
export async function deleteShopHeroSlide(id: string): Promise<boolean> {
  await ensureShopHeroSeed();
  const sb = getDb();
  const deleted = rows<{ id: string }>(
    await sb.from(TABLES.shopHeroSlides).delete().eq("id", id).select("id"),
    "deleteShopHeroSlide",
  );
  return deleted.length > 0;
}

// ─── Editorial content (reels / press / story) ─────────────────
//
// All five are simple sortable + toggleable lists. A single generic factory
// gives each one a seed-on-first-read + CRUD surface backed by the database, so
// the admin panel can manage what used to be hardcoded in data.ts. The
// customer SPA reads the *Active* lists via page.tsx props.

interface ContentRowBase {
  id: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

function contentResource<Row extends ContentRowBase>(
  table: string,
  seed: Row[],
  idPrefix: string,
) {
  const ensure = memoizeUntilRejected(async (): Promise<void> => {
    {
      const sb = getDb();
      if ((await countRows(table)) === 0) {
        check(
          await sb.from(table).upsert(
            seed.map((s) => ({ ...s })),
            {
              onConflict: "id",
              ignoreDuplicates: true,
            },
          ),
          `seed.${table}`,
        );
      }
    }
  });

  type Input = Omit<Row, "id" | "createdAt" | "updatedAt">;

  const list = async (): Promise<Row[]> => {
    await ensure();
    const sb = getDb();
    return rows<Row>(
      await sb
        .from(table)
        .select("*")
        .order("sortOrder", { ascending: true })
        .order("createdAt", { ascending: true }),
      `list.${table}`,
    );
  };

  const listActive = async (): Promise<Row[]> =>
    (await list()).filter((r) => r.isActive);

  const get = async (id: string): Promise<Row | null> => {
    await ensure();
    const sb = getDb();
    return one<Row>(
      await sb.from(table).select("*").eq("id", id).maybeSingle(),
      `get.${table}`,
    );
  };

  const create = async (input: Input): Promise<Row> => {
    await ensure();
    const sb = getDb();
    const now = new Date().toISOString();
    const row = {
      ...(input as object),
      id: `${idPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: now,
      updatedAt: now,
    } as Row;
    check(await sb.from(table).insert(row), `create.${table}`);
    return row;
  };

  const update = async (id: string, input: Input): Promise<Row | null> => {
    await ensure();
    const sb = getDb();
    check(
      await sb
        .from(table)
        .update({ ...(input as object), updatedAt: new Date().toISOString() })
        .eq("id", id),
      `update.${table}`,
    );
    return get(id);
  };

  /** True when a row was removed (false: it was already gone). */
  const remove = async (id: string): Promise<boolean> => {
    await ensure();
    const sb = getDb();
    const deleted = rows<{ id: string }>(
      await sb.from(table).delete().eq("id", id).select("id"),
      `delete.${table}`,
    );
    return deleted.length > 0;
  };

  return { list, listActive, get, create, update, remove };
}

// ── Press ────────────────────────────────────────────────────────────────--
export interface AdminPress extends ContentRowBase {
  name: string;
  quote: string;
}
export interface PressInput {
  name: string;
  quote: string;
  sortOrder: number;
  isActive: boolean;
}
const SEED_PRESS_ROWS: AdminPress[] = SEED_PRESS.map((p, i) => ({
  id: `press-${String(i + 1).padStart(3, "0")}`,
  name: p.name,
  quote: p.quote,
  sortOrder: i,
  isActive: true,
  createdAt: "",
  updatedAt: "",
}));
const pressResource = contentResource<AdminPress>(
  TABLES.press,
  SEED_PRESS_ROWS,
  "press",
);
export const listPress = pressResource.list;
export const listActivePress = (): Promise<AdminPress[]> =>
  publicRead(
    "listActivePress",
    SEED_PRESS_ROWS.filter((r) => r.isActive),
    () => pressResource.listActive(),
  );
export const createPress = (i: PressInput) => pressResource.create(i);
export const updatePress = (id: string, i: PressInput) =>
  pressResource.update(id, i);
export const deletePress = pressResource.remove;

// ── Story timeline ──────────────────────────────────────────────────────--
export interface AdminStoryEvent extends ContentRowBase {
  year: string;
  title: string;
  body: string;
}
export interface StoryEventInput {
  year: string;
  title: string;
  body: string;
  sortOrder: number;
  isActive: boolean;
}
const SEED_STORY_ROWS: AdminStoryEvent[] = SEED_STORY.heritage.map((e, i) => ({
  id: `story-${String(i + 1).padStart(3, "0")}`,
  year: e.y,
  title: e.t,
  body: e.d,
  sortOrder: i,
  isActive: true,
  createdAt: "",
  updatedAt: "",
}));
const storyResource = contentResource<AdminStoryEvent>(
  TABLES.storyTimeline,
  SEED_STORY_ROWS,
  "story",
);
export const listStoryEvents = storyResource.list;
export const listActiveStoryEvents = (): Promise<AdminStoryEvent[]> =>
  publicRead(
    "listActiveStoryEvents",
    SEED_STORY_ROWS.filter((r) => r.isActive),
    () => storyResource.listActive(),
  );
export const createStoryEvent = (i: StoryEventInput) => storyResource.create(i);
export const updateStoryEvent = (id: string, i: StoryEventInput) =>
  storyResource.update(id, i);
export const deleteStoryEvent = storyResource.remove;

// ─── Mobile app home content ──────────────────────────────────────────────
//
// The app's home screen carries a hero carousel and an announcements strip.
// Both are editorial: swapping a seasonal slide must not require an app store
// submission, so they live here and the app reads them over the API.
//
// Kept separate from `shop_hero_slides`, which is web-shaped (a full-width
// image, an absolute ctaHref). The app paints a brand `tone` and takes an
// OPTIONAL https image on top of it, and it needs a route KEY rather than a
// URL - CMS text must never be able to drive native navigation directly.

// The tones, routes, kinds and their labels live in a client-safe module and
// are re-exported here, so server code can keep importing them from the store
// while "use client" forms import them WITHOUT dragging `server-only` and `pg`
// into the browser bundle. See src/lib/admin/app-content-schema.ts.
export {
  APP_SLIDE_TONES,
  APP_SLIDE_TONE_LABELS,
  APP_SLIDE_ROUTES,
  APP_SLIDE_ROUTE_LABELS,
  isAppSlideRoute,
  APP_ANNOUNCEMENT_KINDS,
  APP_ANNOUNCEMENT_KIND_LABELS,
  APP_POST_KINDS,
  APP_POST_KIND_LABELS,
} from "./app-content-schema";
export type {
  AppSlideTone,
  AppSlideRoute,
  AppAnnouncementKind,
  AppPostKind,
} from "./app-content-schema";

export interface AdminAppSlide {
  id: string;
  /** Small kicker above the headline, e.g. "EVİN İMZASI". */
  eyebrow: string;
  title: string;
  body: string;
  /** Empty means the slide renders without a call to action. */
  ctaLabel: string;
  ctaRoute: string;
  tone: AppSlideTone;
  /** Absolute https URL painted over the tone, or "" for a plain ground. */
  image: string;
  sortOrder: number;
  isActive: boolean;
  /** ISO-8601; empty means unbounded. */
  startsAt: string;
  endsAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminAppAnnouncement {
  id: string;
  kind: AppAnnouncementKind;
  title: string;
  body: string;
  sortOrder: number;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Seed order is chosen so the burgundy slide never neighbours a green one:
 * premium → paper → brand → inverse. Burgundy against green measures 1.23:1
 * and the two blur into one another; the app's carousel shows the edges of
 * neighbouring slides, so the ordering matters visually.
 */
const SEED_APP_SLIDES: AdminAppSlide[] = [
  {
    id: "aslide-001",
    eyebrow: "EVİN İMZASI",
    title: "L'Affogato",
    body: "Bir top fior di latte üzerine Sirena espresso. Yenilebilir waffle kupada servis edilir.",
    ctaLabel: "Menüde gör",
    ctaRoute: "/menu",
    tone: "premium",
    image: "",
    sortOrder: 1,
    isActive: true,
    startsAt: "",
    endsAt: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "aslide-002",
    eyebrow: "TUZLA",
    title: "200 yıllık bir köşkte",
    body: "1897 Bologna'dan İstanbul'a. İtalya dışındaki tek L'Affogato.",
    ctaLabel: "Ziyaret",
    ctaRoute: "/ziyaret",
    tone: "paper",
    image: "",
    sortOrder: 2,
    isActive: true,
    startsAt: "",
    endsAt: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "aslide-003",
    eyebrow: "MATCHA BAR",
    title: "Strawberry Aşkı",
    body: "Uji ceremonial grade matcha, siparişten sonra çırpılır. Sezon boyunca menüde.",
    ctaLabel: "Matcha Bar",
    ctaRoute: "/menu",
    tone: "brand",
    image: "",
    sortOrder: 3,
    isActive: true,
    startsAt: "",
    endsAt: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "aslide-004",
    eyebrow: "RİTÜEL",
    title: "Drink it. Eat the cup.",
    body: "Waffle kupanın glaze kaplaması 1994'te patentlendi. Bugün hâlâ aynı reçete.",
    ctaLabel: "",
    ctaRoute: "",
    tone: "inverse",
    image: "",
    sortOrder: 4,
    isActive: true,
    startsAt: "",
    endsAt: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const SEED_APP_ANNOUNCEMENTS: AdminAppAnnouncement[] = [
  {
    id: "aann-001",
    kind: "hours",
    title: "Hafta sonu 24:00'e kadar",
    body: "Cuma ve cumartesi köşk bir saat daha uzun açık.",
    sortOrder: 1,
    isActive: true,
    startsAt: "",
    endsAt: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "aann-002",
    kind: "campaign",
    title: "Yeni: Çıtır Latte",
    body: "Karamelize çıtır katmanlı buzlu latte menüye eklendi.",
    sortOrder: 2,
    isActive: true,
    startsAt: "",
    endsAt: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const ensureAppContentSeed = memoizeUntilRejected(async (): Promise<void> => {
  const sb = getDb();
  if ((await countRows(TABLES.appHeroSlides)) === 0) {
    check(
      await sb.from(TABLES.appHeroSlides).upsert(
        SEED_APP_SLIDES.map((s) => ({ ...s })),
        { onConflict: "id", ignoreDuplicates: true },
      ),
      "seed.appHeroSlides",
    );
  }
  if ((await countRows(TABLES.appAnnouncements)) === 0) {
    check(
      await sb.from(TABLES.appAnnouncements).upsert(
        SEED_APP_ANNOUNCEMENTS.map((a) => ({ ...a })),
        { onConflict: "id", ignoreDuplicates: true },
      ),
      "seed.appAnnouncements",
    );
  }
  if ((await countRows(TABLES.appPosts)) === 0) {
    check(
      await sb.from(TABLES.appPosts).upsert(
        SEED_APP_POSTS.map((p) => ({ ...p })),
        { onConflict: "id", ignoreDuplicates: true },
      ),
      "seed.appPosts",
    );
  }
});

// Publish windows live in ./publish-window, which carries no "server-only":
// the /admin/mobil forms are client components and render the same instants.
export {
  isPublishWindowOpen,
  normalizePublishInstant,
  parsePublishInstant,
  toDateTimeLocalInput,
} from "./publish-window";
import {
  isPublishWindowOpen,
  normalizePublishInstant,
  parsePublishInstant,
} from "./publish-window";

export async function listAppSlides(): Promise<AdminAppSlide[]> {
  await ensureAppContentSeed();
  const sb = getDb();
  return rows<AdminAppSlide>(
    await sb
      .from(TABLES.appHeroSlides)
      .select("*")
      .order("sortOrder", { ascending: true })
      .order("createdAt", { ascending: true }),
    "listAppSlides",
  );
}

/** What the mobile API serves: active, in-window, in order. */
export async function listActiveAppSlides(): Promise<AdminAppSlide[]> {
  return publicRead("listActiveAppSlides", [], async () => {
    const all = await listAppSlides();
    return all.filter((s) => s.isActive && isPublishWindowOpen(s));
  });
}

export async function getAppSlide(id: string): Promise<AdminAppSlide | null> {
  await ensureAppContentSeed();
  const sb = getDb();
  return one<AdminAppSlide>(
    await sb.from(TABLES.appHeroSlides).select("*").eq("id", id).maybeSingle(),
    "getAppSlide",
  );
}

export interface AppSlideInput {
  eyebrow: string;
  title: string;
  body: string;
  ctaLabel: string;
  ctaRoute: string;
  tone: AppSlideTone;
  image: string;
  sortOrder: number;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
}

function normalizeAppSlide(input: AppSlideInput): AppSlideInput {
  const route = input.ctaRoute.trim();
  return {
    eyebrow: input.eyebrow.trim().slice(0, 32),
    title: input.title.trim().slice(0, 80),
    body: input.body.trim().slice(0, 240),
    ctaLabel: input.ctaLabel.trim().slice(0, 32),
    // Fail closed: an unrecognised route becomes "no action" rather than
    // reaching the app as an unknown target.
    ctaRoute: isAppSlideRoute(route) ? route : "",
    tone: APP_SLIDE_TONES.includes(input.tone) ? input.tone : "paper",
    // Same parse as a post's picture: the phone fetches this URL on every
    // home-screen load, so a data: blob or a bare path is stored as "" (plain
    // tone) rather than shipped to every device.
    image: safeHttpsUrl(input.image),
    sortOrder: Number.isFinite(input.sortOrder)
      ? Math.max(0, Math.floor(input.sortOrder))
      : 0,
    isActive: !!input.isActive,
    startsAt: normalizePublishInstant(input.startsAt),
    endsAt: normalizePublishInstant(input.endsAt),
  };
}

export async function createAppSlide(
  input: AppSlideInput,
): Promise<AdminAppSlide> {
  await ensureAppContentSeed();
  const sb = getDb();
  const now = new Date().toISOString();
  const slide: AdminAppSlide = {
    id: `aslide-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...normalizeAppSlide(input),
    createdAt: now,
    updatedAt: now,
  };
  check(await sb.from(TABLES.appHeroSlides).insert(slide), "createAppSlide");
  return slide;
}

export async function updateAppSlide(
  id: string,
  input: AppSlideInput,
): Promise<AdminAppSlide | null> {
  await ensureAppContentSeed();
  const sb = getDb();
  check(
    await sb
      .from(TABLES.appHeroSlides)
      .update({
        ...normalizeAppSlide(input),
        updatedAt: new Date().toISOString(),
      })
      .eq("id", id),
    "updateAppSlide",
  );
  return getAppSlide(id);
}

/** True when a slide was removed (false: it was already gone). */
export async function deleteAppSlide(id: string): Promise<boolean> {
  await ensureAppContentSeed();
  const sb = getDb();
  const deleted = rows<{ id: string }>(
    await sb.from(TABLES.appHeroSlides).delete().eq("id", id).select("id"),
    "deleteAppSlide",
  );
  return deleted.length > 0;
}

// ─── Mobile app posts: campaigns, collaborations, events ──────────────────
//
// Image-first cards in a horizontally scrollable strip below the hero. Unlike a
// hero slide, a post may point OUTWARD - at an Instagram collaboration or a
// ticket page - which is why its destination is a validated https URL opened in
// an in-app browser rather than a route key resolved natively.

export interface AdminAppPost {
  id: string;
  kind: AppPostKind;
  title: string;
  body: string;
  /** Absolute https URL, or a data: URL uploaded from the panel. */
  image: string;
  /** Optional outward link. https only. */
  linkUrl: string;
  linkLabel: string;
  sortOrder: number;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
  createdAt: string;
  updatedAt: string;
  /**
   * Id of the campaign e-mail opened for this post, or "" - the column's
   * default (migration 20260908150000). Set once by `setAppPostEmailCampaign`
   * and never cleared, so no later save can mail the members twice. Optional
   * in the type only so a post assembled in memory need not carry it; a row
   * read from the table always does.
   */
  emailCampaignId?: string;
}

export interface AppPostInput {
  kind: AppPostKind;
  title: string;
  body: string;
  image: string;
  linkUrl: string;
  linkLabel: string;
  sortOrder: number;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
}

const SEED_APP_POSTS: AdminAppPost[] = [
  {
    id: "apost-001",
    kind: "campaign",
    title: "Sabah ritüeli",
    body: "Hafta içi 09:00-11:00 arası tüm içeceklerde ikincisi yarı fiyatına.",
    image: "",
    linkUrl: "",
    linkLabel: "",
    sortOrder: 0,
    isActive: true,
    startsAt: "",
    endsAt: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "apost-002",
    kind: "event",
    title: "Karaoke geceleri",
    body: "Cuma ve cumartesi 21:00'den sonra üst kattaki karaoke odası açık. Rezervasyon öneriyoruz.",
    image: "",
    linkUrl: "",
    linkLabel: "",
    sortOrder: 1,
    isActive: true,
    startsAt: "",
    endsAt: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

/**
 * Fails closed on anything that is not plainly an https URL.
 *
 * This is the one field where panel text becomes a destination, so the check is
 * a parse rather than a pattern: `new URL` rejects the malformed cases a regex
 * waves through, and the protocol test rejects `javascript:` and `data:` - the
 * two that turn a link into an injection.
 */
function safeHttpsUrl(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString().slice(0, 2048) : "";
  } catch {
    return "";
  }
}

function normalizeAppPost(input: AppPostInput): AppPostInput {
  return {
    kind: APP_POST_KINDS.includes(input.kind) ? input.kind : "campaign",
    title: input.title.trim().slice(0, 80),
    body: input.body.trim().slice(0, 280),
    // The image goes through the same parse as the link. The form promises
    // "https ile başlayan tam adres", and a promise the store does not enforce
    // is a promise the panel breaks the first time someone pastes a path.
    image: safeHttpsUrl(input.image),
    linkUrl: safeHttpsUrl(input.linkUrl),
    linkLabel: input.linkLabel.trim().slice(0, 32),
    sortOrder: Number.isFinite(input.sortOrder)
      ? Math.max(0, Math.floor(input.sortOrder))
      : 0,
    isActive: !!input.isActive,
    startsAt: normalizePublishInstant(input.startsAt),
    endsAt: normalizePublishInstant(input.endsAt),
  };
}

export async function listAppPosts(): Promise<AdminAppPost[]> {
  await ensureAppContentSeed();
  const sb = getDb();
  return rows<AdminAppPost>(
    await sb
      .from(TABLES.appPosts)
      .select("*")
      .order("sortOrder", { ascending: true })
      .order("createdAt", { ascending: true }),
    "listAppPosts",
  );
}

/** What the mobile API serves: active, in-window, in order. */
export async function listActiveAppPosts(): Promise<AdminAppPost[]> {
  return publicRead("listActiveAppPosts", [], async () => {
    const all = await listAppPosts();
    return all.filter((p) => p.isActive && isPublishWindowOpen(p));
  });
}

export async function getAppPost(id: string): Promise<AdminAppPost | null> {
  await ensureAppContentSeed();
  const sb = getDb();
  return one<AdminAppPost>(
    await sb.from(TABLES.appPosts).select("*").eq("id", id).maybeSingle(),
    "getAppPost",
  );
}

export async function createAppPost(
  input: AppPostInput,
): Promise<AdminAppPost> {
  await ensureAppContentSeed();
  const sb = getDb();
  const now = new Date().toISOString();
  const post: AdminAppPost = {
    id: `apost-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...normalizeAppPost(input),
    createdAt: now,
    updatedAt: now,
  };
  check(await sb.from(TABLES.appPosts).insert(post), "createAppPost");
  return post;
}

export async function updateAppPost(
  id: string,
  input: AppPostInput,
): Promise<AdminAppPost | null> {
  await ensureAppContentSeed();
  const sb = getDb();
  check(
    await sb
      .from(TABLES.appPosts)
      .update({
        ...normalizeAppPost(input),
        updatedAt: new Date().toISOString(),
      })
      .eq("id", id),
    "updateAppPost",
  );
  return getAppPost(id);
}

/**
 * Marks the post as having its campaign e-mail (`campaign_emails.id`).
 *
 * The mark is the post hook's idempotency: it is written BEFORE the campaign
 * is queued and never cleared by a later save, so editing a post can never
 * mail the members a second time (docs/EMAIL-RESEND.md §7). Conditional on
 * the column still being empty; false means the post is gone or another save
 * marked it first - the caller must then not send.
 */
export async function setAppPostEmailCampaign(
  id: string,
  campaignId: string,
): Promise<boolean> {
  const sb = getDb();
  const res = await sb
    .from(TABLES.appPosts)
    .update({ emailCampaignId: campaignId })
    .eq("id", id)
    .eq("emailCampaignId", "")
    .select("id");
  return rows<{ id: string }>(res, "setAppPostEmailCampaign").length > 0;
}

/** True when a post was removed (false: it was already gone). */
export async function deleteAppPost(id: string): Promise<boolean> {
  await ensureAppContentSeed();
  const sb = getDb();
  const deleted = rows<{ id: string }>(
    await sb.from(TABLES.appPosts).delete().eq("id", id).select("id"),
    "deleteAppPost",
  );
  return deleted.length > 0;
}

export async function listAppAnnouncements(): Promise<AdminAppAnnouncement[]> {
  await ensureAppContentSeed();
  const sb = getDb();
  return rows<AdminAppAnnouncement>(
    await sb
      .from(TABLES.appAnnouncements)
      .select("*")
      .order("sortOrder", { ascending: true })
      .order("createdAt", { ascending: true }),
    "listAppAnnouncements",
  );
}

export async function listActiveAppAnnouncements(): Promise<
  AdminAppAnnouncement[]
> {
  return publicRead("listActiveAppAnnouncements", [], async () => {
    const all = await listAppAnnouncements();
    return all.filter((a) => a.isActive && isPublishWindowOpen(a));
  });
}

export async function getAppAnnouncement(
  id: string,
): Promise<AdminAppAnnouncement | null> {
  await ensureAppContentSeed();
  const sb = getDb();
  return one<AdminAppAnnouncement>(
    await sb
      .from(TABLES.appAnnouncements)
      .select("*")
      .eq("id", id)
      .maybeSingle(),
    "getAppAnnouncement",
  );
}

export interface AppAnnouncementInput {
  kind: AppAnnouncementKind;
  title: string;
  body: string;
  sortOrder: number;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
}

function normalizeAppAnnouncement(
  input: AppAnnouncementInput,
): AppAnnouncementInput {
  return {
    kind: APP_ANNOUNCEMENT_KINDS.includes(input.kind) ? input.kind : "info",
    title: input.title.trim().slice(0, 80),
    body: input.body.trim().slice(0, 200),
    sortOrder: Number.isFinite(input.sortOrder)
      ? Math.max(0, Math.floor(input.sortOrder))
      : 0,
    isActive: !!input.isActive,
    startsAt: normalizePublishInstant(input.startsAt),
    endsAt: normalizePublishInstant(input.endsAt),
  };
}

export async function createAppAnnouncement(
  input: AppAnnouncementInput,
): Promise<AdminAppAnnouncement> {
  await ensureAppContentSeed();
  const sb = getDb();
  const now = new Date().toISOString();
  const row: AdminAppAnnouncement = {
    id: `aann-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...normalizeAppAnnouncement(input),
    createdAt: now,
    updatedAt: now,
  };
  check(
    await sb.from(TABLES.appAnnouncements).insert(row),
    "createAppAnnouncement",
  );
  return row;
}

export async function updateAppAnnouncement(
  id: string,
  input: AppAnnouncementInput,
): Promise<AdminAppAnnouncement | null> {
  await ensureAppContentSeed();
  const sb = getDb();
  check(
    await sb
      .from(TABLES.appAnnouncements)
      .update({
        ...normalizeAppAnnouncement(input),
        updatedAt: new Date().toISOString(),
      })
      .eq("id", id),
    "updateAppAnnouncement",
  );
  return getAppAnnouncement(id);
}

/** True when an announcement was removed (false: it was already gone). */
export async function deleteAppAnnouncement(id: string): Promise<boolean> {
  await ensureAppContentSeed();
  const sb = getDb();
  const deleted = rows<{ id: string }>(
    await sb.from(TABLES.appAnnouncements).delete().eq("id", id).select("id"),
    "deleteAppAnnouncement",
  );
  return deleted.length > 0;
}
