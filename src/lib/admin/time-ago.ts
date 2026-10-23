// Client-safe and pure: how long ago something happened, as the panel says
// it beside a list's line ("3 saat önce"), on the köşk's clock (rule 22:
// Istanbul is UTC+3 all year).

const ISTANBUL_OFFSET_MS = 3 * 60 * 60_000;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const MONTHS_SHORT = [
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

/** The köşk's calendar day of an instant, as a day number since 1970. */
function istanbulDayNumber(ms: number): number {
  return Math.floor((ms + ISTANBUL_OFFSET_MS) / (24 * HOUR));
}

function istanbulClockLabel(ms: number): string {
  const d = new Date(ms + ISTANBUL_OFFSET_MS);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * "az önce", "12 dk önce", "3 saat önce" (today), "dün 14:05", "4 gün
 * önce"; from a week on, the day itself ("12 Eki", with the year when it
 * is another one). Days are the köşk's calendar days, so "dün" is
 * yesterday in Tuzla whatever the server's clock. A time ahead of `now`
 * (another machine's clock) is "az önce"; an unreadable one is "".
 */
export function timeAgo(iso: string, now: Date): string {
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return "";
  const nowMs = now.getTime();
  const ago = Math.max(0, nowMs - at);
  if (ago < MINUTE) return "az önce";
  if (ago < HOUR) return `${Math.floor(ago / MINUTE)} dk önce`;
  const days = istanbulDayNumber(nowMs) - istanbulDayNumber(at);
  if (days <= 0) return `${Math.floor(ago / HOUR)} saat önce`;
  if (days === 1) return `dün ${istanbulClockLabel(at)}`;
  if (days < 7) return `${days} gün önce`;
  const d = new Date(at + ISTANBUL_OFFSET_MS);
  const year = d.getUTCFullYear();
  const thisYear = new Date(nowMs + ISTANBUL_OFFSET_MS).getUTCFullYear();
  const day = `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}`;
  return year === thisYear ? day : `${day} ${year}`;
}
