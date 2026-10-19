/**
 * A shop discount: when a "was" price may be shown, and when the panel may
 * save one (19 Oct 2026, X-DISCOUNT, decision OP-COMPARE-AT).
 *
 * - An advertisement that says a price is reduced names the price before
 *   the discount and the days the discount starts and ends (Ticari Reklam
 *   ve Haksız Ticari Uygulamalar Yönetmeliği m.14/1).
 * - For goods that price is the lowest one applied in the ten days before
 *   the discount starts (m.14/3), in the channel where the discount runs
 *   (m.14/5): the online shop's own price history, never the kiosk's shelf.
 *   The seller proves it (Fiyat Etiketi Yönetmeliği m.11/1).
 *
 * So a compare-at price ("Eski fiyat") is stored with a start and an end
 * day, saved only when it is that lowest price, and shown only between the
 * two days: a price without dates, out of its dates or not above the sale
 * price is shown nowhere (the web mapper leaves it out, the app gets 0).
 *
 * Days are Istanbul calendar days (fixed UTC+3, CLAUDE.md rule 22); the
 * stored values are UTC instants, the start at 00:00 and the end at
 * 23:59:59.999 of their days. Pure and client-safe: the panel form, the
 * save, the store, both mappers and the product page read it.
 */

import { istanbulToday, menuPricesDateLabel } from "@/lib/menu/price-list";
import { priceLabel } from "@/lib/utils/format";

/** The days before the start whose lowest price is the price before (m.14/3). */
export const DISCOUNT_LOOKBACK_DAYS = 10;

/** The panel's two date fields ("YYYY-MM-DD"). */
export const DISCOUNT_START_FIELD = "discountStartsOn";
export const DISCOUNT_END_FIELD = "discountEndsOn";

const DAY_MS = 24 * 60 * 60 * 1000;
const ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000;

/** What a surface reads to decide on a "was" price. */
export interface DiscountFields {
  priceMinor: number;
  compareAtPriceMinor: number;
  discountStartsAt?: string | null;
  discountEndsAt?: string | null;
}

/** "YYYY-MM-DD" that is a real calendar day. */
export function isCalendarDay(text: unknown): text is string {
  if (typeof text !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return false;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (m < 1 || m > 12 || d < 1) return false;
  return d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** The UTC instant an Istanbul day starts, `addDays` later. */
export function istanbulDayStartIso(day: string, addDays = 0): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(
    Date.UTC(y, m - 1, d + addDays) - ISTANBUL_OFFSET_MS,
  ).toISOString();
}

/** The last millisecond of an Istanbul day, as a UTC instant. */
export function istanbulDayEndIso(day: string): string {
  return new Date(Date.parse(istanbulDayStartIso(day, 1)) - 1).toISOString();
}

/** The Istanbul day an instant falls on, or null when it is not one. */
export function istanbulDayOf(iso: unknown): string | null {
  if (typeof iso !== "string" || !iso) return null;
  const at = Date.parse(iso);
  return Number.isFinite(at) ? istanbulToday(new Date(at)) : null;
}

/**
 * The discount a surface may show now: both dates set, now between them,
 * and the compare-at price above the sale price. Null otherwise.
 */
export function liveDiscount(
  p: DiscountFields,
  now: Date = new Date(),
): { compareAtPriceMinor: number; startsAt: string; endsAt: string } | null {
  const compare = Number(p.compareAtPriceMinor) || 0;
  if (!(compare > p.priceMinor)) return null;
  const startsAt = p.discountStartsAt;
  const endsAt = p.discountEndsAt;
  if (typeof startsAt !== "string" || typeof endsAt !== "string") return null;
  const from = Date.parse(startsAt);
  const to = Date.parse(endsAt);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  const t = now.getTime();
  if (t < from || t > to) return null;
  return { compareAtPriceMinor: compare, startsAt, endsAt };
}

/** The compare-at price to show now, or 0 (the app's "no discount"). */
export function liveCompareAtMinor(
  p: DiscountFields,
  now: Date = new Date(),
): number {
  return liveDiscount(p, now)?.compareAtPriceMinor ?? 0;
}

/** "19 Ekim 2026 - 31 Ekim 2026"; null when either day is unreadable. */
export function discountDatesLabel(
  startsAt: unknown,
  endsAt: unknown,
): string | null {
  const from = menuPricesDateLabel(istanbulDayOf(startsAt));
  const to = menuPricesDateLabel(istanbulDayOf(endsAt));
  return from && to ? `${from} - ${to}` : null;
}

/** The sentence beside the badge (m.14/1); null without both days. */
export function discountNotice(
  startsAt: unknown,
  endsAt: unknown,
): string | null {
  const dates = discountDatesLabel(startsAt, endsAt);
  return dates ? `İndirim ${dates} tarihleri arasında geçerli` : null;
}

const SHORT_MONTHS = [
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
] as const;

function shortDay(iso: unknown): string | null {
  const day = istanbulDayOf(iso);
  if (!day) return null;
  const [, m, d] = day.split("-").map(Number);
  return `${d} ${SHORT_MONTHS[m - 1]}`;
}

/** "19 Eki - 31 Eki", for the shop card's narrow price row. */
export function discountShortLabel(
  startsAt: unknown,
  endsAt: unknown,
): string | null {
  const from = shortDay(startsAt);
  const to = shortDay(endsAt);
  return from && to ? `İndirim ${from} - ${to}` : null;
}

// ─── The save ──────────────────────────────────────────────────────────────

/** One row of `product_price_history`. */
export interface PricePoint {
  priceMinor: number;
  startedAt: string;
}

/**
 * The lowest price applied in [from, to): the price in force when the
 * window opens and every price set inside it. `since` is the first
 * recorded instant (null: no record at all) when the history starts after
 * `from`, so the window cannot be proven.
 */
export function lowestPriceIn(
  history: readonly PricePoint[],
  fromIso: string,
  toIso: string,
): { ok: true; lowestMinor: number } | { ok: false; since: string | null } {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  const points = history
    .map((h) => ({ price: Number(h.priceMinor), at: Date.parse(h.startedAt) }))
    .filter((h) => Number.isFinite(h.price) && Number.isFinite(h.at))
    .sort((a, b) => a.at - b.at);
  let opening: number | null = null;
  const inside: number[] = [];
  for (const point of points) {
    if (point.at <= from) opening = point.price;
    else if (point.at < to) inside.push(point.price);
  }
  if (opening === null) {
    return {
      ok: false,
      since: points.length > 0 ? new Date(points[0].at).toISOString() : null,
    };
  }
  return { ok: true, lowestMinor: Math.min(opening, ...inside) };
}

export const DISCOUNT_DATES_REQUIRED_ERROR =
  "Eski fiyat yalnız indirim başlangıcı ve bitişiyle kaydedilir: iki günü de seç.";
export const DISCOUNT_DAY_ERROR = "Takvimden geçerli bir gün seç.";
export const DISCOUNT_END_BEFORE_START_ERROR =
  "İndirim bitişi başlangıçtan önce olamaz.";
export const DISCOUNT_NOT_ABOVE_ERROR =
  "Eski fiyat satış fiyatından yüksek olmalı; indirim yoksa alanı boş bırak.";
export const DISCOUNT_VARIANTS_ERROR =
  "Fiyat farkı olan varyantı bulunan üründe eski fiyat gösterilmez: her varyantın kendi indirim öncesi fiyatı olur. Alanı boş bırak.";
export const DISCOUNT_START_PAST_ERROR =
  "Yeni bir indirim bugünden önce başlamış gösterilemez: başlangıç olarak bugünü seç.";
export const DISCOUNT_START_FUTURE_ERROR =
  "İndirim, satış fiyatını düşürdüğün gün başlar: başlangıç olarak bugünü seç. İleri tarihli indirim için o gün fiyatı düşürüp kaydet.";
export const DISCOUNT_END_PAST_ERROR = "İndirim bitişi bugünden önce olamaz.";

/** What the save checks a compare-at price against. */
export interface DiscountCheck {
  priceMinor: number;
  compareAtPriceMinor: number;
  /** The panel's days, "YYYY-MM-DD", or null when empty. */
  startDay: string | null;
  endDay: string | null;
  /** An active variant sells at a price of its own (a non-zero difference). */
  hasPricedVariants: boolean;
  /** The product's `product_price_history`, any order. */
  history: readonly PricePoint[];
  /** The stored product on an edit, null for a new one. */
  stored: {
    compareAtPriceMinor: number;
    discountStartsAt?: string | null;
    discountEndsAt?: string | null;
  } | null;
  now: Date;
}

/**
 * What the form alone can tell (the schema's check): a compare-at price
 * comes with both days, real ones, the end not before the start, and above
 * the sale price. Null when it does, or when there is no compare-at price.
 */
export function discountShapeRefusal(c: {
  priceMinor: number;
  compareAtPriceMinor: number;
  startDay: string | null;
  endDay: string | null;
}): { field: string; message: string } | null {
  if (!(c.compareAtPriceMinor > 0)) return null;
  if (!c.startDay || !c.endDay) {
    return {
      field: c.startDay ? DISCOUNT_END_FIELD : DISCOUNT_START_FIELD,
      message: DISCOUNT_DATES_REQUIRED_ERROR,
    };
  }
  if (!isCalendarDay(c.startDay)) {
    return { field: DISCOUNT_START_FIELD, message: DISCOUNT_DAY_ERROR };
  }
  if (!isCalendarDay(c.endDay)) {
    return { field: DISCOUNT_END_FIELD, message: DISCOUNT_DAY_ERROR };
  }
  if (c.endDay < c.startDay) {
    return {
      field: DISCOUNT_END_FIELD,
      message: DISCOUNT_END_BEFORE_START_ERROR,
    };
  }
  if (c.compareAtPriceMinor <= c.priceMinor) {
    return { field: "compareAtPrice", message: DISCOUNT_NOT_ABOVE_ERROR };
  }
  return null;
}

/**
 * Why a compare-at price may not be saved, under `compareAtPrice` or one
 * of the date fields; null when it may (or when there is none). The shape
 * (dates present, end after start, above the sale price) is the schema's
 * as well; this adds what needs the history and the stored row.
 *
 * A new discount (none stored, a different start, or the stored one over)
 * starts today: the price before it is the lowest of the ten days before
 * today, and a later start would let the lowered price apply, unmarked,
 * inside its own ten days. A running discount keeps its start, and the
 * price is checked against the same ten days again on every save.
 */
export function discountRefusal(
  c: DiscountCheck,
): { field: string; message: string } | null {
  const shape = discountShapeRefusal(c);
  if (shape || !(c.compareAtPriceMinor > 0)) return shape;
  const field = "compareAtPrice";
  if (c.hasPricedVariants) return { field, message: DISCOUNT_VARIANTS_ERROR };
  const startDay = c.startDay!;
  const endDay = c.endDay!;

  const today = istanbulToday(c.now);
  const stored = c.stored;
  const storedStart = istanbulDayOf(stored?.discountStartsAt);
  const storedEnd = istanbulDayOf(stored?.discountEndsAt);
  const storedOver =
    typeof stored?.discountEndsAt === "string" &&
    Date.parse(stored.discountEndsAt) < c.now.getTime();
  const running =
    stored !== null &&
    stored.compareAtPriceMinor > 0 &&
    storedStart === startDay &&
    storedEnd !== null &&
    !storedOver;
  if (!running) {
    if (startDay < today) {
      return {
        field: DISCOUNT_START_FIELD,
        message: DISCOUNT_START_PAST_ERROR,
      };
    }
    if (startDay > today) {
      return {
        field: DISCOUNT_START_FIELD,
        message: DISCOUNT_START_FUTURE_ERROR,
      };
    }
  }
  if (endDay !== storedEnd && endDay < today) {
    return { field: DISCOUNT_END_FIELD, message: DISCOUNT_END_PAST_ERROR };
  }

  const from = istanbulDayStartIso(startDay, -DISCOUNT_LOOKBACK_DAYS);
  const to = istanbulDayStartIso(startDay);
  const window = lowestPriceIn(c.history, from, to);
  if (!window.ok) {
    const firstDay = window.since
      ? menuPricesDateLabel(earliestStartDay(window.since))
      : null;
    return {
      field,
      message: firstDay
        ? `Bu ürünün çevrim içi fiyat kaydı indirimden önceki 10 günü kapsamıyor. İndirim en erken ${firstDay} günü başlayabilir; o güne kadar alanı boş bırak.`
        : "Bu ürünün çevrim içi fiyat kaydı yok; indirimden önceki 10 günün fiyatı kanıtlanamaz. Alanı boş bırak.",
    };
  }
  if (window.lowestMinor <= c.priceMinor) {
    return {
      field,
      message: `İndirimden önceki 10 günün en düşük satış fiyatı ${priceLabel(window.lowestMinor)}; satış fiyatı bunun altında değil, indirim gösterilemez.`,
    };
  }
  if (window.lowestMinor !== c.compareAtPriceMinor) {
    return {
      field,
      message: `Eski fiyat, indirimden önceki 10 günün en düşük satış fiyatı olmalı: ${priceLabel(window.lowestMinor)}. Bu tutarı yaz.`,
    };
  }
  return null;
}

/**
 * The first Istanbul day a discount may start on when the history begins
 * at `since`: the day whose ten days before start no earlier than that.
 */
export function earliestStartDay(since: string): string | null {
  const at = Date.parse(since);
  if (!Number.isFinite(at)) return null;
  let day = istanbulDayOf(
    new Date(at + DISCOUNT_LOOKBACK_DAYS * DAY_MS).toISOString(),
  )!;
  if (Date.parse(istanbulDayStartIso(day, -DISCOUNT_LOOKBACK_DAYS)) < at) {
    day = istanbulDayOf(istanbulDayStartIso(day, 1))!;
  }
  return day;
}

/** The stored instants for the panel's two days, or nulls without a discount. */
export function discountInstants(
  compareAtPriceMinor: number,
  startDay: string | null,
  endDay: string | null,
): { discountStartsAt: string | null; discountEndsAt: string | null } {
  if (
    !(compareAtPriceMinor > 0) ||
    !isCalendarDay(startDay) ||
    !isCalendarDay(endDay)
  ) {
    return { discountStartsAt: null, discountEndsAt: null };
  }
  return {
    discountStartsAt: istanbulDayStartIso(startDay),
    discountEndsAt: istanbulDayEndIso(endDay),
  };
}
