import "server-only";

import { cache } from "react";
import { isHandedOver, isStaleShipmentEvent } from "@/lib/mobile/geliver";

import type { DbError } from "@/lib/db";

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
import {
  applyCustomerCoupon,
  couponAllowedForKind,
  redeemCustomerCoupon,
  releaseCustomerCoupon,
} from "@/lib/customer/coupons";
import {
  cancelNoticeDue,
  notifyOrderCancelled,
  notifyOrderRefunded,
  notifyOrderShipped,
} from "@/lib/email/order-notices";
import { sendOrderPaidEmail } from "@/lib/email/send";
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
import {
  orderChannel,
  type OrderChannel,
  type OrderFulfillment,
  type OrderKind,
} from "./order-channel";

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
}

export {
  ORDER_CHANNEL_LABELS,
  ORDER_FULFILLMENT_LABELS,
  ORDER_KIND_LABELS,
  orderChannel,
  orderFulfillment,
  orderKind,
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

  /** Tax (VAT) percentage applied to subtotals at checkout. */
  taxRatePct: number;

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
  karaokeHourlyMinor: number;
  karaokeCapacity: number;
  /**
   * Where a new karaoke request is mailed (`sendKaraokeOperatorEmail`), from
   * the app or the web. Empty falls back to `email`.
   */
  karaokeNotifyEmail: string;

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

function deriveSku(name: string, n: number): string {
  const prefix = name
    .replace(/[^A-Za-z0-9]+/g, "")
    .slice(0, 4)
    .toUpperCase()
    .padEnd(4, "X");
  return `${prefix}-${String(n).padStart(5, "0")}`;
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
    taxRatePct: 20,
    shippingFlatMinor: 4900,
    shippingFreeThresholdMinor: 50000,
    // Empty = the home page's keyword title (app/page.tsx HOME_TITLE). A
    // non-empty default here meant that title was never used.
    seoTitle: "",
    seoOgImageUrl: "",
    seoIndexable: true,
    notificationEmail: "",
    emailFromName: "L'Affogato",
    emailFromAddress: "",
    emailReplyTo: "",
    courierFeeMinor: 5500,
    // ₺1.000 an hour (operator, 26 Eyl 2026); the live row is set by
    // 20260926090000_karaoke_price_and_notify.sql.
    karaokeHourlyMinor: 100000,
    karaokeCapacity: 8,
    karaokeNotifyEmail: "bizimfutbol9@gmail.com",
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
    sku: input.sku || existing.sku,
    updatedAt: new Date().toISOString(),
  };
  check(
    await sb.from(TABLES.products).update(next).eq("id", id),
    "updateProduct",
  );
  return next;
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

// ─── Orders ───────────────────────────────────────────────────────────────

/** The statuses a shift still owes work on. Same set the dashboard counts. */
const OPEN_ORDER_STATUSES: AdminOrderStatus[] = [
  "pending_payment",
  "paid",
  "preparing",
];

/**
 * How many orders are still waiting on the counter.
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
    .in("status", OPEN_ORDER_STATUSES);
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
export async function countOrdersAfter(orderNo: number): Promise<number> {
  if (!Number.isFinite(orderNo)) return 0;
  const sb = getDb();
  const { count, error, status } = await sb
    .from(TABLES.orders)
    // `gte(n + 1)`, not `gt(n)`: the builder has no `gt`, and the sequence is
    // an integer so the two are the same predicate.
    .select("*", { count: "exact", head: true })
    .gte("orderNo", Math.trunc(orderNo) + 1);
  if (error) raiseDbError("countOrdersAfter", error, status);
  return count ?? 0;
}

// There is deliberately no "every order, every column" reader any more (WP1).
// `listOrders()` had five callers and each one wanted a page, five rows or a
// few columns; reading the whole table with its jsonb was 596 ms and 27 MB
// per call at 20k orders. Read what the screen needs: `listRecentOrders`,
// `listOrdersPage`, or a projection like `reportOrders` below.

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

/** How many orders `/admin/siparisler` shows per page. */
export const ORDERS_PAGE_SIZE = 100;

export interface OrdersPage {
  orders: AdminOrder[];
  /** Every order in the table, for the "N sipariş" line. */
  total: number;
  /**
   * The `orderNo` to pass as `before` for the next (older) page, or null when
   * this page reached the oldest order.
   */
  nextBefore: number | null;
}

/**
 * One page of the order list, newest first, keyed on `orderNo`.
 *
 * WP1: the page used to render the whole table into a
 * client component, so every order's jsonb went over the wire to the
 * operator's browser and was hydrated there (27 MB of JSON for 20k orders).
 *
 * Keyset rather than offset (the query builder has no offset, and a keyset
 * page does not shift when a new order arrives while the operator is paging):
 * `before` is the last `orderNo` of the previous page. One row more than the
 * page is read to learn whether an older page exists.
 */
export async function listOrdersPage(input: {
  before?: number | null;
  pageSize?: number;
}): Promise<OrdersPage> {
  await ensureSeed();
  const sb = getDb();
  const size = Math.max(1, Math.trunc(input.pageSize ?? ORDERS_PAGE_SIZE));
  let q = sb
    .from(TABLES.orders)
    .select("*")
    .order("orderNo", { ascending: false })
    .limit(size + 1);
  const before = input.before;
  if (typeof before === "number" && Number.isFinite(before)) {
    q = q.lt("orderNo", Math.trunc(before));
  }
  const [page, total] = await Promise.all([
    q.then((r) => rows<AdminOrder>(r, "listOrdersPage")),
    countRows(TABLES.orders),
  ]);
  const orders = page.slice(0, size);
  return {
    orders,
    total,
    nextBefore:
      page.length > size ? (orders[orders.length - 1]?.orderNo ?? null) : null,
  };
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
type CustomerSummaryOrder = Pick<
  AdminOrder,
  | "customerEmail"
  | "customerName"
  | "customerPhone"
  | "totalMinor"
  | "refunds"
  | "createdAt"
>;

export async function listCustomers(): Promise<CustomerSummary[]> {
  // Six columns, not `select *`: the roll-up needs every order (it counts a
  // lifetime) but none of the items, addresses or consent evidence. WP1,
  // measured on 20k orders: 596 ms / 27 MB -> 67 ms / 3.4 MB.
  await ensureSeed();
  const orders = rows<CustomerSummaryOrder>(
    await getDb()
      .from(TABLES.orders)
      .select(
        "customerEmail, customerName, customerPhone, totalMinor, refunds, createdAt",
      )
      .order("orderNo", { ascending: false }),
    "listCustomers",
  );
  const byEmail = new Map<string, CustomerSummary>();
  for (const o of orders) {
    const email = o.customerEmail?.trim().toLowerCase();
    if (!email || email === "guest@laffogato.local") continue;
    const existing = byEmail.get(email);
    const refundedHere = o.refunds.reduce((s, r) => s + r.amountMinor, 0);
    if (!existing) {
      byEmail.set(email, {
        email,
        name: o.customerName,
        phone: o.customerPhone,
        orderCount: 1,
        lifetimeValueMinor: o.totalMinor,
        refundedMinor: refundedHere,
        lastOrderAt: o.createdAt,
        firstOrderAt: o.createdAt,
      });
    } else {
      existing.orderCount += 1;
      existing.lifetimeValueMinor += o.totalMinor;
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

export type BulkOrderOp = { kind: "set_status"; status: AdminOrderStatus };

export interface BulkOrderResult extends BulkResult {
  /**
   * Ids the state machine refused: already in that status, not allowed to
   * reach it from where they are, or a target the bulk tool must not set.
   */
  skipped: number;
}

/**
 * The statuses the bulk tool may set, and the transition that gets there.
 *
 * `paid` and `refunded` are deliberately missing. Money moves with a
 * `payment_transactions` row or a refund ledger entry, and a bulk button that
 * writes the status column writes neither - a bulk "ödendi" produced paid
 * orders nobody had paid for, with no `paidAt` and no stamp. Those two are
 * done one order at a time, from the order page.
 */
export const BULK_ORDER_TRANSITIONS: Partial<
  Record<AdminOrderStatus, OrderTransition>
> = {
  preparing: "start_preparing",
  shipped: "mark_shipped",
  completed: "complete",
  cancelled: "cancel",
};

/**
 * Bulk status change - every id through the same machine the order page uses.
 *
 * This used to be a raw `update({ status }).in("id", ids)`: it wrote the
 * column and nothing else, so a bulk cancel left the stock claimed, the
 * customer's single-use coupon burned and the loyalty stamp standing, and it
 * accepted every status including `paid` and `refunded`. Ids the machine
 * refuses are counted in `skipped` rather than silently forced.
 */
export async function bulkUpdateOrders(
  ids: string[],
  op: BulkOrderOp,
): Promise<BulkOrderResult> {
  if (ids.length === 0) return { updated: 0, skipped: 0 };
  const transition = BULK_ORDER_TRANSITIONS[op.status];
  if (!transition) return { updated: 0, skipped: ids.length };
  await ensureSeed();
  let updated = 0;
  let skipped = 0;
  for (const id of ids) {
    // "Hazırlanıyor" from pending_payment SETTLES the order (paidAt, stamp,
    // revenue) - the very thing dropping bulk "paid" was meant to stop. One
    // order at a time it is a deliberate call (paid at the counter); in bulk
    // it is a stray tick. Unpaid orders are skipped here.
    if (transition === "start_preparing") {
      const current = await getOrder(id);
      if (current?.status === "pending_payment") {
        skipped += 1;
        continue;
      }
    }
    const res = await transitionOrder(id, transition);
    if (res.ok) updated += 1;
    else skipped += 1;
  }
  return { updated, skipped };
}

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
   * Mobile app columns (docs/API-MOBILE.md §3). All optional: the web and
   * admin paths leave them out and the row takes the database defaults, so
   * an order written by those paths is byte-for-byte what it was before.
   */
  channel?: OrderChannel;
  kind?: OrderKind;
  fulfillment?: OrderFulfillment;
  scheduledFor?: string;
  deliveryNote?: string;
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

/** Order lines as they are written, from lines resolved against `products`. */
function shopLineItems(resolved: ResolvedLine[]): AdminOrderItem[] {
  return resolved.map((line) => ({
    productName: line.label,
    qty: line.qty,
    unitPriceMinor: line.unitPriceMinor,
    status: "pending",
    productId: line.product.id,
    ...(line.variant ? { variantId: line.variant.id } : {}),
  }));
}

/**
 * Builds + persists the order row from already-resolved lines. Promo is
 * re-validated against the authoritative subtotal; shipping + total come from
 * settings (single source of truth).
 */
async function finalizeOrder(
  resolved: ResolvedLine[],
  f: FinalizeOrderInput,
): Promise<{ order: AdminOrder; promoDropped: boolean }> {
  return insertOrderRow(shopLineItems(resolved), f);
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
    taxRatePct: settings.taxRatePct,
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
  if (applied.reconcile === "amount_mismatch") return "unpaid";
  return "paid";
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
  ).filter((order) => orderChannel(order) === "web");
  if (open.length === 0) return 0;
  const provider = await lookupProvider();
  const outcomes = await Promise.allSettled(
    open.map((order) =>
      cancelUnpaidOrder(order, provider, { giveUpOnUnknown: false }),
    ),
  );
  return outcomes.filter((o) => o.status === "fulfilled" && o.value).length;
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

    placed = await finalizeOrder(resolved, {
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
  /** Admin email recorded as the stock-move actor. */
  actor: string;
}

/**
 * Creates an order entered by an admin (phone/in-store sale). Mirrors
 * {@link placeOrder} - prices resolved server-side, stock atomically claimed -
 * but the admin chooses the initial status and customer details directly.
 */
export async function createManualOrder(
  input: CreateManualOrderInput,
): Promise<PlaceOrderResult> {
  await ensureSeed();

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

    placed = await finalizeOrder(resolved, {
      orderId,
      orderNo,
      status: input.status,
      customerName: input.customerName.trim() || "Müşteri",
      customerEmail: input.customerEmail?.trim() ?? "",
      customerPhone: input.customerPhone?.trim() ?? "",
      shippingAddress: input.shippingAddress?.trim() ?? "",
      internalNote: input.internalNote?.trim().slice(0, 2000) ?? "",
      promoCode: input.promoCode,
    });
  } catch (err) {
    await releaseClaimedStock(resolved);
    throw err;
  }
  const { order, promoDropped } = placed;
  return { ok: true, order, priceAdjusted: false, promoDropped };
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
    const res = await resolveCafeLines(cafe);
    return res.ok
      ? { ok: true, items: res.items, kind: "cafe" }
      : { ok: false, result: res.result };
  }
  const res = await resolveOrderLines(shop.map(toPlaceOrderItem));
  if (!res.ok) return { ok: false, result: res.result };
  return {
    ok: true,
    items: withShopNotes(shopLineItems(res.resolved), shop),
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
          ? "Kafe siparişi gel-al ya da kurye ile teslim edilir."
          : "Mağaza siparişi kargo ile gönderilir.",
    };
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
    shippingAddress: input.shippingAddress.trim(),
    internalNote: "",
    promoCode: input.promoCode,
    legalConsent: input.legalConsent,
    channel: "app" as const,
    kind,
    fulfillment: input.fulfillment,
    scheduledFor: scheduled.value,
    deliveryNote: input.deliveryNote.trim().slice(0, 500),
    shipping: shippingModeFor(input.fulfillment, settings),
  };

  if (kind === "cafe") {
    const cafeRes = await resolveCafeLines(cafe);
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
      withShopNotes(shopLineItems(resolved), shop),
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
  // webhook/return - used below to send the "paid" e-mail exactly once.
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
    }
  }

  // Loyalty follows the payment but must never undo it: a stamp that fails to
  // land is logged, the money stays recorded.
  if (advanced) {
    await awardLoyalty({ ...order, status: "paid", paidAt }, "payment");
  }

  // No "ödemen alındı" for an order that is cancelled: the customer used to be
  // told their order was on its way while the row said otherwise.
  if (isFirstConfirmation && !unreconciled) {
    // Best-effort payment-confirmed e-mail (logs in dev when Resend is unset).
    try {
      if (
        order.customerEmail &&
        order.customerEmail !== "guest@laffogato.local"
      ) {
        await sendOrderPaidEmail({
          to: order.customerEmail,
          customerName: order.customerName,
          orderNo: order.orderNo,
          items: order.items.map((it) => ({
            productName: it.productName,
            qty: it.qty,
            unitPriceMinor: it.unitPriceMinor,
          })),
          subtotalMinor: order.subtotalMinor,
          shippingMinor: order.shippingMinor,
          totalMinor: order.totalMinor,
        });
      }
    } catch (err) {
      console.error("[email] order paid notification failed", err);
    }
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
  // Same rule as the admin path: a fully refunded order keeps nothing, so the
  // stamp it earned goes back. Without this a member could farm stamps by
  // ordering and refunding through the provider.
  if (fullyRefunded) await reverseLoyalty(order, "provider-refund");
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
 * Latest succeeded payment for an order (for refunds): the provider
 * reference, what was collected, and the provider's day for it ('' on rows
 * written before the column existed) so the refund need not look it up.
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
    .limit(1);
  if (res.error) throw new Error(`getOrderPaymentRef: ${res.error.message}`);
  const row = res.data?.[0] as
    | {
        provider: string;
        providerRef: string;
        amountMinor?: number | null;
        trxDate?: string | null;
      }
    | undefined;
  return row
    ? {
        provider: row.provider,
        providerRef: row.providerRef,
        amountMinor: Number(row.amountMinor ?? 0),
        trxDate: isoDay(row.trxDate ?? ""),
      }
    : null;
}

export type OrderTransition =
  | "start_preparing"
  | "mark_shipped"
  | "complete"
  | "cancel"
  | "mark_paid";

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
 * Guarded on `stockReleasedAt`, and the guard is part of the UPDATE, so two
 * concurrent cancels cannot both credit the stock.
 */
async function releaseOrderInventory(order: AdminOrder): Promise<void> {
  const sb = getDb();
  const now = new Date().toISOString();

  // Claim the right to release. Only the writer that flips the empty marker
  // proceeds.
  const claimed = rows<{ id: string }>(
    await sb
      .from(TABLES.orders)
      .update({ stockReleasedAt: now })
      .eq("id", order.id)
      .eq("stockReleasedAt", "")
      .select("id"),
    "releaseOrderInventory.claim",
  );
  if (claimed.length === 0) return;

  // Lines from before productId was recorded, and manual admin lines that
  // reference no catalogue product, are skipped: restoring by name would
  // credit the wrong SKU the moment a product had been renamed.
  const lines = order.items
    .filter((it) => it.productId && it.status !== "cancelled" && it.qty > 0)
    .map((it) => ({
      productId: it.productId as string,
      variantId: it.variantId ?? null,
      qty: it.qty,
      productName: it.productName,
    }));

  if (lines.length > 0) {
    const released = await sb.rpc("release_order_stock", {
      p_lines: lines.map(({ productId, variantId, qty }) => ({
        productId,
        variantId,
        qty,
      })),
      p_now: now,
    });
    if (released.error) {
      throw new Error(`releaseOrderInventory: ${released.error.message}`);
    }
    const stockAfters = (released.data ?? []) as number[];
    for (let i = 0; i < lines.length; i += 1) {
      // -1 means the product row is gone; there is no stock level to log.
      if (stockAfters[i] === -1 || stockAfters[i] === undefined) continue;
      await recordStockMove({
        productId: lines[i].productId,
        productName: lines[i].productName,
        delta: lines[i].qty,
        stockAfter: stockAfters[i],
        reason: "order_cancelled",
        note: `Sipariş #${order.orderNo} iptal edildi`,
        orderId: order.id,
        actor: "system",
      });
    }
  }

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
  }
}

export async function transitionOrder(
  id: string,
  transition: OrderTransition,
): Promise<TransitionResult> {
  await ensureSeed();
  const sb = getDb();
  const existing = await getOrder(id);
  if (!existing) return { ok: false, error: "Sipariş bulunamadı." };
  const map = TRANSITION_MAP[transition];
  if (!map) return { ok: false, error: "Geçersiz işlem." };
  if (!map.from.includes(existing.status)) {
    return {
      ok: false,
      error: `Bu işlem '${existing.status}' durumunda yapılamaz.`,
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
      error: "Sipariş bu arada değişti. Sayfayı yenileyip tekrar dene.",
    };
  }
  if (map.to === "cancelled") {
    await releaseOrderInventory(existing);
    await reverseLoyalty(existing, "cancelled");
    await noticeCancelled({ ...existing, status: "cancelled" });
  } else if (settles) {
    // Idempotent on the order id, so a later payment webhook for the same
    // order does not hand out a second stamp.
    await awardLoyalty({ ...existing, status: map.to, paidAt }, "transition");
  }
  const nextOrder = { ...existing, ...patch, status: map.to };
  // "Kargoya ver" after the tracking number was typed: the parcel has left,
  // and this is the moment the buyer is owed the number. Sent once per
  // number, so the tracking form having sent it already is a no-op here.
  if (map.to === "shipped") await notifyOrderShipped(nextOrder);
  return { ok: true, order: nextOrder };
}

/**
 * The seller's cancellation, told to the buyer (a shop order only; see
 * `order-notices.ts`). Whether money was taken decides which sentence the
 * mail carries: the refund to come, or "no payment on record". A failed
 * lookup says neither rather than guess about somebody's card.
 */
async function noticeCancelled(order: AdminOrder): Promise<void> {
  if (!cancelNoticeDue(order)) return;
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
  await notifyOrderCancelled(order, { collected });
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
 * Gives back the stamp an app order earned, when the order is undone.
 *
 * Best-effort and lazily imported for the same reasons the earning hook is:
 * loyalty reads orders from this module, and a bookkeeping failure must not
 * block the refund itself.
 */
async function reverseLoyalty(order: AdminOrder, why: string): Promise<void> {
  try {
    const { onOrderReversed } = await import("@/lib/mobile/loyalty");
    await onOrderReversed(order);
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

export async function setOrderTracking(
  id: string,
  trackingNumber: string,
  carrier: string,
): Promise<AdminOrder | null> {
  await ensureSeed();
  const sb = getDb();
  const existing = await getOrder(id);
  if (!existing) return null;
  const tn = trackingNumber.trim().slice(0, 120);
  const ca = carrier.trim().slice(0, 80);
  const shippedAt = existing.shippedAt || (tn ? new Date().toISOString() : "");
  check(
    await sb
      .from(TABLES.orders)
      .update({ trackingNumber: tn, carrier: ca, shippedAt })
      .eq("id", id),
    "setOrderTracking",
  );
  const updated = { ...existing, trackingNumber: tn, carrier: ca, shippedAt };
  // The form IS the hand-over as far as the site knows: it stamps shippedAt,
  // and the app's band reads "Yola çıktı" from it. So the buyer is owed the
  // number now; a corrected number is a new notice, a re-save is not.
  if (tn) await notifyOrderShipped(updated);
  return updated;
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
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
}

/** Admin edit of an order's customer + delivery fields (no totals change). */
export async function updateOrderDetails(
  id: string,
  input: OrderDetailsInput,
): Promise<AdminOrder | null> {
  await ensureSeed();
  const sb = getDb();
  const existing = await getOrder(id);
  if (!existing) return null;
  const update = {
    customerName: input.customerName.trim().slice(0, 120),
    customerEmail: input.customerEmail.trim().slice(0, 160),
    customerPhone: input.customerPhone.trim().slice(0, 40),
    shippingAddress: input.shippingAddress.trim().slice(0, 600),
  };
  check(
    await sb.from(TABLES.orders).update(update).eq("id", id),
    "updateOrderDetails",
  );
  return { ...existing, ...update };
}

export async function setOrderItemStatus(
  orderId: string,
  itemIndex: number,
  status: AdminOrderItemStatus,
): Promise<AdminOrder | null> {
  await ensureSeed();
  const sb = getDb();
  const existing = await getOrder(orderId);
  if (!existing) return null;
  if (itemIndex < 0 || itemIndex >= existing.items.length) return null;
  const nextItems = existing.items.map((it, i) =>
    i === itemIndex ? { ...it, status } : it,
  );
  check(
    await sb.from(TABLES.orders).update({ items: nextItems }).eq("id", orderId),
    "setOrderItemStatus",
  );
  return { ...existing, items: nextItems };
}

export interface RefundInput {
  amountMinor: number;
  reason: string;
}

export type RefundResult =
  | { ok: true; order: AdminOrder; refund: AdminRefund }
  | { ok: false; error: string };

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
 */
export function refundRefusal(
  order: Pick<AdminOrder, "status" | "totalMinor" | "refunds">,
  amountMinor: number,
  collected: boolean,
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
  const remaining = order.totalMinor - already;
  if (amountMinor > remaining) {
    return `İade tutarı kalan bakiyeyi aşıyor (kalan: ${priceLabel(remaining)}).`;
  }
  return null;
}

/** Was money ever collected on this order? */
export async function orderWasCollected(order: AdminOrder): Promise<boolean> {
  if (order.paidAt) return true;
  return (await getOrderPaymentRef(order.id)) !== null;
}

/**
 * Step 1 of a refund: write the ledger entry, if it still fits.
 *
 * `reserve_order_refund` appends the entry in ONE UPDATE whose WHERE checks
 * the remaining balance, so two refunds submitted together cannot both fit
 * where only one does - the read-modify-write this replaced let both through,
 * and each had already moved money. Called BEFORE the POS: if the POS then
 * refuses, {@link releaseRefund} takes the entry back; if it accepts,
 * {@link finalizeRefund} settles the status and the stamp.
 */
export async function reserveRefund(
  orderId: string,
  input: RefundInput,
): Promise<RefundResult> {
  await ensureSeed();
  const existing = await getOrder(orderId);
  if (!existing) return { ok: false, error: "Sipariş bulunamadı." };
  const refusal = refundRefusal(
    existing,
    input.amountMinor,
    await orderWasCollected(existing),
  );
  if (refusal) return { ok: false, error: refusal };
  const refund: AdminRefund = {
    id: `rfn-${existing.refunds.length + 1}-${Date.now()}`,
    amountMinor: input.amountMinor,
    reason: input.reason.slice(0, 500),
    createdAt: new Date().toISOString(),
  };
  const { data, error, status } = await getDb().rpc<AdminRefund[] | null>(
    "reserve_order_refund",
    { p_order_id: orderId, p_refund: refund },
  );
  if (error) raiseDbError("reserveRefund", error, status);
  if (!data) {
    // Another refund landed between the check above and this write.
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

/**
 * Step 2: the money moved. A fully refunded order becomes `refunded` and
 * gives its stamp back - unless it was cancelled, which already did both and
 * must stay out of the reports.
 *
 * With `notice`, the buyer is told first (a shop order only, once per refund
 * entry): the money has moved whatever the bookkeeping below then does.
 */
export async function finalizeRefund(
  order: AdminOrder,
  notice?: RefundNotice,
): Promise<AdminOrder> {
  if (notice) {
    await notifyOrderRefunded(order, notice.refund, {
      viaCard: notice.viaCard,
    });
  }
  const refunded = order.refunds.reduce((s, r) => s + r.amountMinor, 0);
  const fullyRefunded = refunded >= order.totalMinor;
  const wasCancelled = order.status === "cancelled";
  if (!fullyRefunded || wasCancelled) return order;
  check(
    await getDb()
      .from(TABLES.orders)
      .update({ status: "refunded" })
      .eq("id", order.id),
    "finalizeRefund",
  );
  // A fully refunded order keeps nothing: the stamp it earned goes back too.
  await reverseLoyalty(order, "refunded");
  return { ...order, status: "refunded" };
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
  const order = await finalizeRefund(reserved.order, {
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
      .in("status", ["pending_payment", "paid", "preparing"])
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

async function getShopProductBySlugLive(
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
  totalRevenueMinor: number;
  totalOrders: number;
  averageOrderMinor: number;
  refundedMinor: number;
  conversionRatePct: number | null;
}

export async function analyticsHeadline(): Promise<AnalyticsHeadline> {
  const orders = await reportOrders(
    ["status", "totalMinor", "refunds"],
    "analyticsHeadline",
  );
  const valid = orders.filter(isReportableOrder);
  const totalRevenueMinor = valid.reduce((s, o) => s + o.totalMinor, 0);
  const totalOrders = valid.length;
  const refundedMinor = orders.reduce(
    (s, o) => s + o.refunds.reduce((r, x) => r + x.amountMinor, 0),
    0,
  );
  return {
    totalRevenueMinor,
    totalOrders,
    averageOrderMinor:
      totalOrders > 0 ? Math.round(totalRevenueMinor / totalOrders) : 0,
    refundedMinor,
    conversionRatePct: null,
  };
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

export async function deleteShopHeroSlide(id: string): Promise<void> {
  await ensureShopHeroSeed();
  const sb = getDb();
  check(
    await sb.from(TABLES.shopHeroSlides).delete().eq("id", id),
    "deleteShopHeroSlide",
  );
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

  const remove = async (id: string): Promise<void> => {
    await ensure();
    const sb = getDb();
    check(await sb.from(table).delete().eq("id", id), `delete.${table}`);
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

export async function deleteAppSlide(id: string): Promise<void> {
  await ensureAppContentSeed();
  const sb = getDb();
  check(
    await sb.from(TABLES.appHeroSlides).delete().eq("id", id),
    "deleteAppSlide",
  );
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

export async function deleteAppPost(id: string): Promise<void> {
  await ensureAppContentSeed();
  const sb = getDb();
  check(await sb.from(TABLES.appPosts).delete().eq("id", id), "deleteAppPost");
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

export async function deleteAppAnnouncement(id: string): Promise<void> {
  await ensureAppContentSeed();
  const sb = getDb();
  check(
    await sb.from(TABLES.appAnnouncements).delete().eq("id", id),
    "deleteAppAnnouncement",
  );
}
