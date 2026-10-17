/**
 * How a karaoke booking's day and hours are written for a reader - in mail,
 * on the panel, on the member's own page. Dependency-free, so a page or a
 * client component can import it without the store (karaoke.ts re-exports
 * both for its existing importers).
 */

const TR_MONTHS = [
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
];

/**
 * "2026-09-12" → "12 Eylül 2026".
 *
 * Built from the parts rather than through `Date`: a reservation date is a
 * Tuzla CALENDAR day, not an instant, and `new Date("2026-09-12")` is
 * midnight UTC - which in a formatter running anywhere west of Greenwich
 * prints the 11th. The app and the panel both show the day the room is
 * booked; so does the mail.
 */
export function formatReservationDate(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return date;
  const month = TR_MONTHS[Number(m[2]) - 1];
  return month ? `${Number(m[3])} ${month} ${m[1]}` : date;
}

/**
 * `(20, 2)` → "20:00 - 22:00", spaced like the site's opening hours; midnight
 * closes the evening as 24:00.
 */
export function formatReservationTime(
  startHour: number,
  hours: number,
): string {
  const pad = (h: number): string => `${String(h).padStart(2, "0")}:00`;
  return `${pad(startHour)} - ${pad(startHour + hours)}`;
}

// The "-den" ending a number takes follows its LAST spoken word: sıfır, bir,
// iki, üç, dört, beş, altı, yedi, sekiz, dokuz; then on, yirmi, otuz, kırk,
// elli, altmış, yetmiş, seksen, doksan.
// prettier-ignore
const ONES_FROM = ["dan", "den", "den", "ten", "ten", "ten", "dan", "den", "den", "dan"];
// prettier-ignore
const TENS_FROM = ["", "dan", "den", "dan", "tan", "den", "tan", "ten", "den", "dan"];

/**
 * `20` → "20:00’den", `16` → "16:00’dan", `15` → "15:00’ten": a clock hour
 * with the ending it takes when read aloud. One fixed "’dan" read "20:00’dan"
 * for every evening hour.
 */
export function hourFromLabel(hour: number): string {
  const h = Math.abs(Math.trunc(hour)) % 100;
  const ending =
    h % 10 !== 0 || h === 0 ? ONES_FROM[h % 10] : TENS_FROM[h / 10];
  return `${String(h).padStart(2, "0")}:00’${ending}`;
}
