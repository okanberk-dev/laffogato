/**
 * The date of the cafe's price list (18 Oct 2026, decision OP-PRICE-LISTS).
 *
 * A price list carries the all-taxes-included price and the day that price
 * started to apply (Fiyat Etiketi Yönetmeliği m.5/2-c, d), and a café's list
 * is the one at the door and on the tables, which a table's QR code may
 * stand for (m.8/1-2): /masa/<kod> opens /menu. The day is the operator's
 * (Ayarlar > Vergi, `settings."menuPricesEffectiveDate"`), the same one the
 * printed lists at the kiosk carry.
 *
 * Stored as the Istanbul calendar day, "YYYY-MM-DD" (CLAUDE.md rule 22);
 * "" = not entered, and the menu then says only that prices include KDV.
 * Pure and client-safe: the settings action, the panel and the web menu
 * read it.
 */

/** Istanbul is UTC+3 all year (CLAUDE.md rule 22). */
const ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000;

const MONTHS = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
] as const;

/** The form field (Ayarlar > Vergi) and the settings key. */
export const MENU_PRICES_DATE_FIELD = "menuPricesEffectiveDate";

/** The earliest day the panel takes; anything before is a typo. */
const EARLIEST_DAY = "2020-01-01";

export const MENU_PRICES_DATE_ERROR = "Takvimden geçerli bir gün seç.";
export const MENU_PRICES_DATE_FUTURE_ERROR =
  "Tarih bugünden sonra olamaz: menüdeki fiyatlar şu an geçerli.";
export const MENU_PRICES_DATE_OLD_ERROR =
  "Tarih 2020'den önce olamaz; günü yeniden seç.";

/** Today in Tuzla as "YYYY-MM-DD" (Vercel runs on UTC). */
export function istanbulToday(now: Date): string {
  return new Date(now.getTime() + ISTANBUL_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

/** "YYYY-MM-DD" that is a real calendar day, else null. */
function calendarDay(text: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1) return null;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d > last ? null : { y, m, d };
}

/**
 * The posted day as it is stored: "" (cleared) or an Istanbul day from
 * 2020 up to today. A later day would date prices the menu already shows.
 */
export function parseMenuPricesDate(
  raw: unknown,
  now: Date,
): { ok: true; value: string } | { ok: false; error: string } {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) return { ok: true, value: "" };
  if (!calendarDay(text)) return { ok: false, error: MENU_PRICES_DATE_ERROR };
  if (text > istanbulToday(now)) {
    return { ok: false, error: MENU_PRICES_DATE_FUTURE_ERROR };
  }
  if (text < EARLIEST_DAY) {
    return { ok: false, error: MENU_PRICES_DATE_OLD_ERROR };
  }
  return { ok: true, value: text };
}

/**
 * The Istanbul day of the last price change when it is after the price
 * list's day, else null: a price moved, here or from the köşk's panel
 * (settings."menuPricesChangedAt", docs/PANEL-MENU.md), and the day under
 * the menu still says an earlier one. No day entered is not "stale" (the
 * menu page already asks for one); no change recorded is not either.
 */
export function menuPricesDateStale(
  effectiveDay: unknown,
  changedAt: unknown,
): string | null {
  if (typeof effectiveDay !== "string" || !calendarDay(effectiveDay.trim())) {
    return null;
  }
  const at = typeof changedAt === "string" ? Date.parse(changedAt) : NaN;
  if (!Number.isFinite(at)) return null;
  const changedDay = istanbulToday(new Date(at));
  return changedDay > effectiveDay.trim() ? changedDay : null;
}

/** "2026-10-18" as "18 Ekim 2026"; null when it is not a stored day. */
export function menuPricesDateLabel(day: unknown): string | null {
  const parts = typeof day === "string" ? calendarDay(day.trim()) : null;
  if (!parts) return null;
  return `${parts.d} ${MONTHS[parts.m - 1]} ${parts.y}`;
}

/**
 * The line under the menu: the KDV statement, and the day when one is set.
 * The wording is the regulation's ("uygulanmaya başladığı tarih"), the same
 * as the printed lists: "geçerlilik tarihi" reads as an end date.
 */
export function menuPriceNote(day: unknown): string {
  const label = menuPricesDateLabel(day);
  return label
    ? `Fiyatlarımıza KDV dahildir · Fiyatların uygulanmaya başladığı tarih: ${label}`
    : "Fiyatlarımıza KDV dahildir.";
}
