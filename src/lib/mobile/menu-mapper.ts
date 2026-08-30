import type {
  AdminMenuItem,
  AdminProduct,
  AdminSettings,
} from "@/lib/admin/store";

import {
  DAYS_OF_WEEK,
  type DayOfWeek,
  type WeeklyHours,
} from "@/lib/admin/days";
import {
  menuImagePath,
  productImagePath,
  servedImage,
} from "@/lib/admin/image-url";
import { MENU as SEED_MENU } from "@/components/laffogato/data";

/**
 * Pure mappers behind `/api/mobile/v1/{menu,shop,bootstrap}`
 * (docs/API-MOBILE.md §1, §2, §10).
 *
 * No "server-only", no database: everything here turns a store row into the
 * wire shape and is unit-tested directly. The loaders that fetch the rows
 * live in `./menu.ts`.
 *
 * Every mapper is an explicit allow-list. A store row carries `updatedAt`,
 * `isActive`, `sortOrder`, `costMinor`, `sku`, SEO copy — none of which the
 * app needs, and spreading the row would tie the wire format to the table
 * and leak the cafe's cost prices.
 */

// ─── Constants the app cannot edit (contract §2, §10) ─────────────────────

export const MIN_SUPPORTED_APP_VERSION = "1.0.0";

/** Grind choices offered on `category === "beans"`; sent as the line `note`. */
export const BEAN_GRINDS: readonly string[] = [
  "Çekirdek",
  "Espresso",
  "Filtre",
  "French Press",
];

/** Courier ETA window shown before an order is placed, in minutes. */
export const COURIER_ETA_MINUTES: readonly [number, number] = [25, 35];

export interface HappyHour {
  days: "weekday";
  from: string;
  to: string;
  pct: number;
  categories: string[];
}

/**
 * The Happy Hour campaign as designed — NOT as priced.
 *
 * Nothing anywhere applies this discount: not the mobile order path, not the
 * web checkout. Grep for HAPPY_HOUR and this file is the only hit. The app,
 * meanwhile, drew it on the home screen and the campaigns screen with the
 * words "kod gerekmez", so a member bought a cold drink between 14:00 and
 * 17:00 expecting a quarter off and was charged the full price.
 *
 * `happyHour` is therefore published as null (see `bootstrapVenue`) and both
 * app screens already skip the card when it is. The shape is kept because the
 * campaign itself is the operator's to run: once the discount exists in the
 * pricing path, publish HAPPY_HOUR again and the cards come back.
 */
export const HAPPY_HOUR: HappyHour = {
  days: "weekday",
  from: "14:00",
  to: "17:00",
  pct: 25,
  categories: ["ice-coffee", "cold", "frappe", "frozen", "ice-tea", "smoothie"],
};

// ─── Images ───────────────────────────────────────────────────────────────

/**
 * The app renders images from any origin, so a site-relative served path
 * (`/gorsel/menu/mnu-0007`) is prefixed with the site URL; an `https://` URL
 * an admin pasted passes through; anything else is "no image".
 */
export function absoluteImageUrl(
  stored: string,
  siteUrl: string,
): string | null {
  if (!stored) return null;
  if (/^https?:\/\//i.test(stored)) return stored;
  if (stored.startsWith("/")) return `${siteUrl.replace(/\/$/, "")}${stored}`;
  return null;
}

// ─── Menu (§1) ────────────────────────────────────────────────────────────

export interface MobileMenuItem {
  id: string;
  categoryKey: string;
  name: string;
  description: string;
  priceMinor: number;
  priceLargeMinor: number | null;
  tags: string[];
  hue: string;
  image: string | null;
}

export interface MobileMenuCategory {
  key: string;
  title: string;
  subtitle: string;
  italian: string;
  note: string;
  items: MobileMenuItem[];
}

export function toMobileMenuItem(
  it: AdminMenuItem,
  siteUrl: string,
): MobileMenuItem {
  return {
    id: it.id,
    categoryKey: it.categoryKey,
    name: it.name,
    description: it.desc,
    priceMinor: it.priceMinor,
    // 0 in the store means "one size"; the app draws M/L only when this is set.
    priceLargeMinor: it.priceMinorL > 0 ? it.priceMinorL : null,
    tags: [...it.tags],
    hue: it.hue,
    image: it.image
      ? absoluteImageUrl(servedImage(it.image, menuImagePath(it.id)), siteUrl)
      : null,
  };
}

/**
 * Groups active items under the category metadata the seed carries (title,
 * subtitle, Italian name, note). Categories keep `keys` order; items keep
 * their `sortOrder`. A category with no active item is still sent — the app
 * shows the heading with its note rather than dropping a section silently.
 */
export function buildMobileMenuCategories(
  items: readonly AdminMenuItem[],
  keys: readonly string[],
  siteUrl: string,
): MobileMenuCategory[] {
  const out: MobileMenuCategory[] = [];
  for (const key of keys) {
    const meta = SEED_MENU[key];
    if (!meta) continue;
    const active = items
      .filter((it) => it.categoryKey === key && it.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((it) => toMobileMenuItem(it, siteUrl));
    out.push({
      key,
      title: meta.title,
      subtitle: meta.sub,
      italian: meta.italian,
      note: meta.note,
      items: active,
    });
  }
  return out;
}

/** Newest `updatedAt` among the rows — the menu's own "last changed" stamp. */
export function latestUpdatedAt(
  items: readonly { updatedAt: string }[],
  fallback: string,
): string {
  let latest = "";
  for (const it of items) {
    if (it.updatedAt > latest) latest = it.updatedAt;
  }
  return latest || fallback;
}

// ─── Shop (§2) ────────────────────────────────────────────────────────────

export interface MobileShopVariant {
  id: string;
  name: string;
  priceMinor: number;
  inStock: boolean;
}

export interface MobileShopProduct {
  id: string;
  slug: string;
  name: string;
  tag: string;
  description: string;
  priceMinor: number;
  compareAtPriceMinor: number;
  category: AdminProduct["cat"];
  hue: string;
  image: string | null;
  inStock: boolean;
  variants: MobileShopVariant[];
  /** Only on `category === "beans"` (contract §2). */
  grinds?: string[];
}

export function toMobileShopProduct(
  p: AdminProduct,
  siteUrl: string,
): MobileShopProduct {
  const first = p.images[0];
  const product: MobileShopProduct = {
    id: p.id,
    slug: p.slug,
    name: p.name,
    tag: p.tag,
    description: p.desc,
    priceMinor: p.priceMinor,
    // A "was" price only means something above the current one; the web card
    // applies the same rule.
    compareAtPriceMinor:
      p.compareAtPriceMinor > p.priceMinor ? p.compareAtPriceMinor : 0,
    category: p.cat,
    hue: p.img,
    image: first
      ? absoluteImageUrl(servedImage(first, productImagePath(p.id, 0)), siteUrl)
      : null,
    // Product-level stock, as the web card decides "Tükendi". Variant stock is
    // reported per variant below; placeOrder checks whichever was chosen.
    inStock: p.stock > 0,
    variants: p.variants
      .filter((v) => v.isActive)
      .map((v) => ({
        id: v.id,
        name: v.name,
        // Server-computed, so the app never adds a delta itself.
        priceMinor: p.priceMinor + v.priceDeltaMinor,
        inStock: v.stock > 0,
      })),
  };
  if (p.cat === "beans") product.grinds = [...BEAN_GRINDS];
  return product;
}

// ─── Bootstrap (§10) ──────────────────────────────────────────────────────

const DAY_SHORT: Record<DayOfWeek, string> = {
  mon: "Pzt",
  tue: "Sal",
  wed: "Çar",
  thu: "Per",
  fri: "Cum",
  sat: "Cmt",
  sun: "Paz",
};

function hourSignature(h: { open: string; close: string; closed: boolean }) {
  return h.closed ? "closed" : `${h.open}|${h.close}`;
}

function hourRange(h: { open: string; close: string }) {
  return `${h.open} – ${h.close}`;
}

/**
 * One line for the whole week, derived from the same `weeklyHours` the Visit
 * page renders so the app can never say a different time than the site.
 *
 *   all seven days alike → "Her gün 09:00 – 01:00"
 *   otherwise            → consecutive runs: "Pzt–Cum 09:00 – 01:00 · Cmt–Paz 10:00 – 02:00"
 *   closed run           → "Paz Kapalı"
 */
export function hoursLabel(weekly: WeeklyHours): string {
  const runs: { from: DayOfWeek; to: DayOfWeek; sig: string }[] = [];
  for (const day of DAYS_OF_WEEK) {
    const sig = hourSignature(weekly[day]);
    const last = runs[runs.length - 1];
    if (last && last.sig === sig) last.to = day;
    else runs.push({ from: day, to: day, sig });
  }

  if (runs.length === 1) {
    const only = runs[0];
    return only.sig === "closed"
      ? "Kapalı"
      : `Her gün ${hourRange(weekly[only.from])}`;
  }

  return runs
    .map((run) => {
      const days =
        run.from === run.to
          ? DAY_SHORT[run.from]
          : `${DAY_SHORT[run.from]}–${DAY_SHORT[run.to]}`;
      const range =
        run.sig === "closed" ? "Kapalı" : hourRange(weekly[run.from]);
      return `${days} ${range}`;
    })
    .join(" · ");
}

export interface MobileBootstrap {
  minSupportedAppVersion: string;
  venue: {
    name: string;
    addressLines: [string, string];
    phone: string;
    email: string;
    lat: number;
    lng: number;
  };
  hoursLabel: string;
  courierFeeMinor: number;
  courierEtaMinutes: [number, number];
  /** null while the campaign is advertised but not priced — see HAPPY_HOUR. */
  happyHour: HappyHour | null;
}

export interface BootstrapSite {
  name: string;
  phone: string;
  email: string;
  address: {
    streetAddress: string;
    addressLocality: string;
    addressRegion: string;
    postalCode: string;
  };
  geo: { latitude: number; longitude: number };
}

/**
 * Settings carry what the admin edits (phone, e-mail, hours, courier fee);
 * the site constants carry what the tax certificate fixes (name, address,
 * coordinates). An admin who blanks the phone falls back to the site's.
 */
export function buildBootstrap(
  settings: Pick<
    AdminSettings,
    "phone" | "email" | "weeklyHours" | "courierFeeMinor"
  >,
  site: BootstrapSite,
): MobileBootstrap {
  const a = site.address;
  return {
    minSupportedAppVersion: MIN_SUPPORTED_APP_VERSION,
    venue: {
      name: site.name,
      addressLines: [
        a.streetAddress,
        `${a.postalCode} ${a.addressLocality} / ${a.addressRegion}`,
      ],
      phone: settings.phone.trim() || site.phone,
      email: settings.email.trim() || site.email,
      lat: site.geo.latitude,
      lng: site.geo.longitude,
    },
    hoursLabel: hoursLabel(settings.weeklyHours),
    courierFeeMinor: settings.courierFeeMinor,
    courierEtaMinutes: [...COURIER_ETA_MINUTES],
    // Advertise nothing the till will not honour. Restore with:
    //   happyHour: { ...HAPPY_HOUR, categories: [...HAPPY_HOUR.categories] },
    // once the discount is applied where the order is priced.
    happyHour: null,
  };
}
