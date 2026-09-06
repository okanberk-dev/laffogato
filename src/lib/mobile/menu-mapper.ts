import type {
  AdminMenuItem,
  AdminProduct,
  AdminSettings,
} from "@/lib/admin/store";

import {
  DAY_LABELS,
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

import {
  DEFAULT_MOBILE_APP_CONFIG,
  toBootstrapApp,
  type BootstrapApp,
} from "./app-config";

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

/**
 * Default minimum version. The live value is `settings.mobileApp
 * .minSupportedAppVersion` (/admin/mobil/ayarlar); this is what an operator
 * who never touched the panel publishes.
 */
export const MIN_SUPPORTED_APP_VERSION =
  DEFAULT_MOBILE_APP_CONFIG.minSupportedAppVersion;

/** Grind choices offered on `category === "beans"`; sent as the line `note`. */
export const BEAN_GRINDS: readonly string[] = [
  "Çekirdek",
  "Espresso",
  "Filtre",
  "French Press",
];

/**
 * Default courier ETA window, in minutes. The live value is
 * `settings.mobileApp.ordering.courierEtaMinutes`.
 */
export const COURIER_ETA_MINUTES: readonly [number, number] =
  DEFAULT_MOBILE_APP_CONFIG.ordering.courierEtaMinutes;

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
  return `${h.open} - ${h.close}`;
}

/**
 * One line for a stretch of the week, grouping consecutive days that keep the
 * same hours. Callers pass the days they are describing: the whole week for
 * `hoursLabel`, Monday–Friday and Saturday–Sunday for the live-status pair.
 *
 *   every listed day alike → "09:00 – 01:00" (or "Kapalı")
 *   otherwise              → "Pzt–Per 09:00 – 00:00 · Cum 09:00 – 01:00"
 */
export function hoursLabelFor(
  weekly: WeeklyHours,
  days: readonly DayOfWeek[],
): string {
  const runs: { from: DayOfWeek; to: DayOfWeek; sig: string }[] = [];
  for (const day of days) {
    const sig = hourSignature(weekly[day]);
    const last = runs[runs.length - 1];
    if (last && last.sig === sig) last.to = day;
    else runs.push({ from: day, to: day, sig });
  }

  if (runs.length === 1) {
    const only = runs[0];
    return only.sig === "closed" ? "Kapalı" : hourRange(weekly[only.from]);
  }

  return runs
    .map((run) => {
      const label =
        run.from === run.to
          ? DAY_SHORT[run.from]
          : `${DAY_SHORT[run.from]}-${DAY_SHORT[run.to]}`;
      const range =
        run.sig === "closed" ? "Kapalı" : hourRange(weekly[run.from]);
      return `${label} ${range}`;
    })
    .join(" · ");
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
  const label = hoursLabelFor(weekly, DAYS_OF_WEEK);
  const uniform = DAYS_OF_WEEK.every(
    (day) => hourSignature(weekly[day]) === hourSignature(weekly.mon),
  );
  // "Her gün" only reads right when there is one open range for all seven.
  return uniform && !weekly.mon.closed ? `Her gün ${label}` : label;
}

/** One row of the venue's weekly table: `{ label: "Pazartesi", value: "09:00 - 01:00" | "Kapalı" }`. */
export interface BootstrapVenueHour {
  label: string;
  value: string;
}

export interface MobileBootstrap {
  /** Same value as `app.minSupportedAppVersion`; kept at the top level for older app builds. */
  minSupportedAppVersion: string;
  venue: {
    name: string;
    shortName: string;
    addressLines: [string, string];
    landmark: string;
    mapsQuery: string;
    phone: string;
    email: string;
    lat: number;
    lng: number;
    /** Seven rows, Monday first, never grouped — the app groups equal runs itself. */
    hours: BootstrapVenueHour[];
    /** Today's row (Europe/Istanbul); both "" on a closed day. */
    opensAt: string;
    closesAt: string;
  };
  hoursLabel: string;
  courierFeeMinor: number;
  /** Same value as `app.ordering.courierEtaMinutes`; kept for older app builds. */
  courierEtaMinutes: [number, number];
  /** null while the campaign is advertised but not priced — see HAPPY_HOUR. */
  happyHour: HappyHour | null;
  /** The operator-editable app configuration (docs/API-MOBILE.md §10). */
  app: BootstrapApp;
}

const ISTANBUL_TIMEZONE = "Europe/Istanbul";

const DAY_FROM_SHORT: Record<string, DayOfWeek> = {
  Mon: "mon",
  Tue: "tue",
  Wed: "wed",
  Thu: "thu",
  Fri: "fri",
  Sat: "sat",
  Sun: "sun",
};

/**
 * Which weekday it is at the venue right now. A local twin of
 * `istanbulClock` in ./venue.ts: that module starts with "server-only" and
 * reaches the database, and this file must stay importable by unit tests
 * and pure callers.
 */
export function istanbulDay(now: Date): DayOfWeek {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: ISTANBUL_TIMEZONE,
    weekday: "short",
  }).format(now);
  return DAY_FROM_SHORT[weekday] ?? "mon";
}

/** The seven-row table the Visit screen renders; closed days say so. */
export function weeklyHoursRows(weekly: WeeklyHours): BootstrapVenueHour[] {
  return DAYS_OF_WEEK.map((day) => {
    const h = weekly[day];
    return {
      label: DAY_LABELS[day],
      value: h.closed ? "Kapalı" : hourRange(h),
    };
  });
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
 * Settings carry what the admin edits (phone, e-mail, address, hours,
 * courier fee, the app config); the site constants carry what the tax
 * certificate fixes (name, coordinates, the address fallback). An admin who
 * blanks the phone or the address falls back to the site's.
 *
 * `now` decides which weekly row is "today" (opensAt/closesAt); it is a
 * parameter so tests can pin the day.
 */
export function buildBootstrap(
  settings: Pick<
    AdminSettings,
    | "phone"
    | "email"
    | "address"
    | "weeklyHours"
    | "courierFeeMinor"
    | "mobileApp"
  >,
  site: BootstrapSite,
  now: Date = new Date(),
): MobileBootstrap {
  const a = site.address;
  const app = toBootstrapApp(settings.mobileApp);
  const today = settings.weeklyHours[istanbulDay(now)];
  return {
    minSupportedAppVersion: app.minSupportedAppVersion,
    venue: {
      name: site.name,
      shortName: settings.mobileApp.venue.shortName,
      addressLines: [
        settings.address.trim() || a.streetAddress,
        `${a.postalCode} ${a.addressLocality} / ${a.addressRegion}`,
      ],
      landmark: settings.mobileApp.venue.landmark,
      mapsQuery: settings.mobileApp.venue.mapsQuery,
      phone: settings.phone.trim() || site.phone,
      email: settings.email.trim() || site.email,
      lat: site.geo.latitude,
      lng: site.geo.longitude,
      hours: weeklyHoursRows(settings.weeklyHours),
      opensAt: today.closed ? "" : today.open,
      closesAt: today.closed ? "" : today.close,
    },
    hoursLabel: hoursLabel(settings.weeklyHours),
    courierFeeMinor: settings.courierFeeMinor,
    courierEtaMinutes: [...app.ordering.courierEtaMinutes],
    // Advertise nothing the till will not honour. Restore with:
    //   happyHour: { ...HAPPY_HOUR, categories: [...HAPPY_HOUR.categories] },
    // once the discount is applied where the order is priced.
    happyHour: null,
    app,
  };
}
