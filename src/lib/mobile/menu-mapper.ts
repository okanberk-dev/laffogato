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
import { imageVersion } from "@/lib/admin/image-bytes";
import {
  isBackdropKey,
  isVesselKey,
  type BackdropKey,
  type VesselKey,
} from "@/lib/backdrop/families";
import {
  menuImagePath,
  productImagePath,
  servedImage,
} from "@/lib/admin/image-url";
import { MENU as SEED_MENU } from "@/components/laffogato/data";
import { addressLines } from "@/lib/utils/format";

import {
  DEFAULT_MOBILE_APP_CONFIG,
  toBootstrapApp,
  type BootstrapApp,
  type HappyHourDays,
  type MobileAppConfig,
} from "./app-config";

/**
 * The two lines §10 promises: street, then town.
 *
 * The settings address is ONE string carrying street, landmark and town
 * ("... No: 1 (Menemenci Cumhur'un yanı), 34940 Tuzla / İstanbul"). Putting it
 * whole on line 1 and the canonical town on line 2 printed the town twice and
 * put back the parenthetical the operator asked to be gone - the site's own
 * footer had already stopped doing that, and the app had not.
 *
 * `addressLines()` is that footer's splitter: it drops the parenthetical and
 * splits on newlines and commas, but not on "/", so "34940 Tuzla / İstanbul"
 * survives as one line. Its LAST line is the town, and the canonical one from
 * the legal entity is used instead so the postcode is always there.
 */
function venueAddressLines(
  address: string,
  a: {
    streetAddress: string;
    postalCode: string;
    addressLocality: string;
    addressRegion: string;
  },
): [string, string] {
  const town = `${a.postalCode} ${a.addressLocality} / ${a.addressRegion}`;
  const lines = addressLines(address, [a.streetAddress]);
  const street = (lines.length > 1 ? lines.slice(0, -1) : lines).join(", ");
  return [street || a.streetAddress, town];
}

/**
 * Pure mappers behind `/api/mobile/v1/{menu,shop,bootstrap}`
 * (docs/API-MOBILE.md §1, §2, §10).
 *
 * No "server-only", no database: everything here turns a store row into the
 * wire shape and is unit-tested directly. The loaders that fetch the rows
 * live in `./menu.ts`.
 *
 * Every mapper is an explicit allow-list. A store row carries `updatedAt`,
 * `isActive`, `sortOrder`, `costMinor`, `sku`, SEO copy - none of which the
 * app needs, and spreading the row would tie the wire format to the table
 * and leak the cafe's cost prices.
 */

// ─── Constants the app cannot edit (contract §2, §10) ─────────────────────


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
  /** weekday | weekend | everyday - the app prints its own label per value. */
  days: HappyHourDays;
  from: string;
  to: string;
  pct: number;
  categories: string[];
}

/**
 * The Happy Hour campaign as designed - NOT as priced.
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
/**
 * Every drink category the discount covers. It used to be the cold ones only;
 * the operator's rule is now "her içecekte" - every drink, and no line drawn
 * between coffee and the rest. Food and beans stay out: it is a drinks hour.
 */
export const HAPPY_HOUR_CATEGORIES: readonly string[] = [
  "matcha",
  "espresso",
  "ice-coffee",
  "cold",
  "hot",
  "frappe",
  "smoothie",
  "frozen",
  "ice-tea",
];

/**
 * What the app is told about the happy hour, or null when the operator has
 * not switched it on. The panel owns every value (Mobil Uygulama → Ayarlar →
 * Mutlu saatler); nothing here is a constant any more.
 */
export function happyHourFor(
  config: MobileAppConfig["happyHour"],
): HappyHour | null {
  if (!config.enabled) return null;
  return {
    days: config.days,
    from: config.from,
    to: config.to,
    pct: config.pct,
    categories: [...HAPPY_HOUR_CATEGORIES],
  };
}

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

// ─── Scene (§1, 24 Eyl 2026) ──────────────────────────────────────────────

/**
 * The three scene fields of a menu item or shop product (contract §1,
 * "backdrop · photoCutout · vessel", additive). Always present.
 */
export interface MobileScene {
  /** One of the twelve product families, or null: the app uses `hue`, then the category. */
  backdrop: BackdropKey | null;
  /** The published photo has transparency; false whenever there is no photo. */
  photoCutout: boolean;
  /** The operator's vessel shape for the drawn fallback, or null: from the category. */
  vessel: VesselKey | null;
}

/**
 * The stored columns → the published fields.
 *
 * Every value is checked, never passed through: `backdrop` and `vessel` are
 * free text in the table, and the app treats a key it does not know as null
 * anyway, so the server says null itself. The same guard covers deploy order
 * (the `tags` / `brand` precedent): until
 * `20260924001000_backdrop_fields.sql` runs, `select("*")` has none of these
 * keys, and null / false / null is exactly "as today" for the app.
 * `photoCutout` describes the photo, so no photo means no cutout whatever the
 * column still says.
 */
export function toMobileScene(
  row: Partial<Pick<AdminMenuItem, "backdrop" | "photoCutout" | "vessel">>,
  hasPhoto: boolean,
): MobileScene {
  return {
    backdrop: isBackdropKey(row.backdrop) ? row.backdrop : null,
    photoCutout: hasPhoto && row.photoCutout === true,
    vessel: isVesselKey(row.vessel) ? row.vessel : null,
  };
}

// ─── Menu (§1) ────────────────────────────────────────────────────────────

export interface MobileMenuItem extends MobileScene {
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
  const image = it.image
    ? absoluteImageUrl(
        servedImage(it.image, menuImagePath(it.id, imageVersion(it.image))),
        siteUrl,
      )
    : null;
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
    // The path carries a stamp derived from the photo's own bytes, so this URL
    // changes the moment the photo does and never otherwise: the app's disk
    // cache misses on the new one immediately and re-downloads nothing when
    // the photo is untouched. docs/API-MOBILE.md §1.
    image,
    ...toMobileScene(it, image !== null),
  };
}

/**
 * Groups active items under the category metadata the seed carries (title,
 * subtitle, Italian name, note). Categories keep `keys` order; items keep
 * their `sortOrder`. A category with no active item is still sent - the app
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

/** Newest `updatedAt` among the rows - the menu's own "last changed" stamp. */
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

export interface MobileShopProduct extends MobileScene {
  id: string;
  slug: string;
  name: string;
  tag: string;
  description: string;
  priceMinor: number;
  compareAtPriceMinor: number;
  category: AdminProduct["cat"];
  /**
   * Same field name, same shape and same vocabulary as `MobileMenuItem.tags`
   * (contract §1/§2), so the app reads a shop product's allergens with the
   * code it already has: `item.tags.includes("nuts")`.
   */
  tags: string[];
  /**
   * The maker's name for the eyebrow on the app's product page, or "" (no
   * eyebrow). Contract §2, additive (23 Eyl 2026).
   */
  brand: string;
  /**
   * Tasting-note chips, or [] (no chips: the app prints the whole
   * description as before). Contract §2, additive (23 Eyl 2026).
   */
  notes: string[];
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
  const image = first
    ? absoluteImageUrl(
        servedImage(first, productImagePath(p.id, 0, imageVersion(first))),
        siteUrl,
      )
    : null;
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
    // Allergens are never withheld (lafmobil rule 4). The menu has published
    // this field since v1; the shop shelf carries a pistachio biscotti and
    // published nothing, so `nuts` had no way to reach a product page.
    //
    // Guarded rather than spread straight, and the guard is about DEPLOY
    // ORDER: products are read with `select("*")`, so between this code
    // shipping and `20260916*_shop_allergens.sql` running, the row simply has
    // no `tags` key - and `[...undefined]` throws, which would take `GET
    // /shop` down for every member in the app rather than degrade. A shelf
    // that briefly publishes no allergen is the same state it has been in
    // since v1; a shelf that 500s is worse. The window closes the moment the
    // migration runs, and `products.tags` is `not null default '[]'` after it,
    // so this branch is unreachable from then on.
    tags: Array.isArray(p.tags) ? [...p.tags] : [],
    // Same deploy-order guard as `tags`: until
    // `20260923220000_product_brand_notes.sql` runs, `select("*")` has no
    // such keys, and the empty values are exactly what the app reads as
    // "nothing new to draw". Operator text is passed through, only trimmed.
    brand: typeof p.brand === "string" ? p.brand.trim() : "",
    notes: Array.isArray(p.notes)
      ? p.notes
          .filter((n): n is string => typeof n === "string")
          .map((n) => n.trim())
          .filter(Boolean)
      : [],
    hue: p.img,
    image,
    // The product's scene columns describe `images[0]`, the photo above.
    ...toMobileScene(p, image !== null),
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
 * `hoursLabel`, Monday-Friday and Saturday-Sunday for the live-status pair.
 *
 *   every listed day alike → "09:00 - 02:00" (or "Kapalı")
 *   otherwise              → "Pzt-Per 09:00 - 00:00 · Cum 09:00 - 01:00"
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
 *   all seven days alike → "Her gün 09:00 - 02:00"
 *   otherwise            → consecutive runs: "Pzt-Cum 09:00 - 01:00 · Cmt-Paz 10:00 - 02:00"
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

/** One row of the venue's weekly table: `{ label: "Pazartesi", value: "09:00 - 02:00" | "Kapalı" }`. */
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
    /** Seven rows, Monday first, never grouped - the app groups equal runs itself. */
    hours: BootstrapVenueHour[];
    /** Today's row (Europe/Istanbul); both "" on a closed day. */
    opensAt: string;
    closesAt: string;
  };
  hoursLabel: string;
  courierFeeMinor: number;
  /** Same value as `app.ordering.courierEtaMinutes`; kept for older app builds. */
  courierEtaMinutes: [number, number];
  /** null while the campaign is advertised but not priced - see HAPPY_HOUR. */
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
    | "isShopOpen"
  >,
  site: BootstrapSite,
  now: Date = new Date(),
  /** Karar 177: fA'L's AI reading is on (key AND switch). */
  falAi = false,
): MobileBootstrap {
  const a = site.address;
  const app = toBootstrapApp(settings.mobileApp, settings.isShopOpen, falAi);
  const today = settings.weeklyHours[istanbulDay(now)];
  return {
    minSupportedAppVersion: app.minSupportedAppVersion,
    venue: {
      name: site.name,
      shortName: settings.mobileApp.venue.shortName,
      addressLines: venueAddressLines(settings.address, a),
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
    // Advertise nothing the till will not honour: the switch is off until the
    // operator turns it on in the panel, and the discount is still applied by
    // hand at the counter rather than by the order's pricing.
    happyHour: happyHourFor(settings.mobileApp.happyHour),
    app,
  };
}
