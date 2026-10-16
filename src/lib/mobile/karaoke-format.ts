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
