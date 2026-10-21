// Client-safe: the köşk chip's rules (top bar, components/admin/venue-quick.tsx;
// its actions in app/admin/mobil/canli-durum/actions.ts). No server-only:
// the chip imports this in the browser.

/** `venue_status."manualOverride"` (lib/mobile/venue.ts VENUE_OVERRIDES). */
export type VenueOverride = "auto" | "open" | "closed";

/**
 * The chip's four choices. "Yoğun" is not a stored state: the room is full,
 * which the app reads from `freeTables = 0` ("Masaların hepsi dolu."), the
 * same as the page's "Boş masa 0". It writes only that: the open/closed
 * stays as it is, so an Açık match night stays open past the hours and a
 * manual Kapalı stays closed (PR #189 review, F1).
 */
export type VenueQuickChoice = "auto" | "open" | "busy" | "closed";

export const VENUE_QUICK_CHOICES: readonly VenueQuickChoice[] = [
  "auto",
  "open",
  "busy",
  "closed",
];

export const VENUE_QUICK_LABELS: Record<
  VenueQuickChoice,
  { label: string; hint: string }
> = {
  auto: { label: "Otomatik", hint: "Çalışma saatlerine göre" },
  open: { label: "Açık", hint: "Saatlerden bağımsız" },
  busy: { label: "Yoğun", hint: "Masalar dolu, açık/kapalı değişmez" },
  closed: { label: "Kapalı", hint: "Saatlerden bağımsız" },
};

/**
 * What the top bar polls (venueQuickSignalAction): the venue's status as
 * the chip needs it, and nothing else. Every field is one the app's public
 * GET /api/mobile/v1/live-status already shows; no person, no account.
 */
export interface VenueQuickStatus {
  manualOverride: VenueOverride;
  freeTables: number;
  totalTables: number;
  /** What the app says right now: the override, else the posted hours. */
  isOpen: boolean;
  /**
   * False until someone saved the status once: the app then shows no free
   * table count (`freeTables: null` on the wire), so 0 is not "full".
   */
  saved: boolean;
}

/** The status's fields, in order: the poll answers these and no others. */
export const VENUE_QUICK_STATUS_KEYS = [
  "manualOverride",
  "freeTables",
  "totalTables",
  "isOpen",
  "saved",
] as const satisfies readonly (keyof VenueQuickStatus)[];

/**
 * What the chip's poll answers (src/lib/admin/venue-signal.ts), the nav
 * badges' shape (panel-signal-core.ts) with a status for a count:
 *
 * - `{ unchanged: true }`: nothing written since the cursor was handed out
 *   and the hours have not turned; read without the database. The chip
 *   keeps what it shows.
 * - `{ status, cursor }`: read now, after the account was read again.
 *   `status` is null for a role without Canlı durum, signed out, or a read
 *   that failed: the chip then shows no state.
 */
export type VenueSignalAnswer =
  { unchanged: true } | { status: VenueQuickStatus | null; cursor: string };

/** One full read stands at most this long without a write (a day). */
export const VENUE_SIGNAL_HORIZON_MS = 24 * 60 * 60 * 1000;

const MINUTE_MS = 60_000;
const VENUE_KEY_RE = /^v([0-9a-z]{1,10})$/;

/**
 * The cursor's key for an answer that holds until `untilMs`: "v" and the
 * minute (since 1970, base 36) the open/closed of the hours next turns, or
 * the horizon. Fits panel-signal-core's key shape.
 */
export function venueSignalKey(untilMs: number): string {
  const minute = Math.max(0, Math.ceil(untilMs / MINUTE_MS));
  return `v${minute.toString(36)}`;
}

/**
 * Whether a cursor's key still holds at `nowMs`: before its minute, and no
 * further out than the horizon (a key from elsewhere, or made up, never
 * holds; it only costs its sender a full read).
 */
export function venueKeyHolds(key: string, nowMs: number): boolean {
  const m = VENUE_KEY_RE.exec(key);
  if (!m) return false;
  const until = parseInt(m[1], 36) * MINUTE_MS;
  return (
    Number.isFinite(until) &&
    nowMs < until &&
    until - nowMs <= VENUE_SIGNAL_HORIZON_MS + MINUTE_MS
  );
}

const isTableCount = (n: unknown): n is number =>
  typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 999;

/** A status as the browser trusts it, or null for anything else. */
export function readVenueStatus(value: unknown): VenueQuickStatus | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const override = v.manualOverride;
  if (override !== "auto" && override !== "open" && override !== "closed") {
    return null;
  }
  if (!isTableCount(v.freeTables) || !isTableCount(v.totalTables)) return null;
  if (typeof v.isOpen !== "boolean" || typeof v.saved !== "boolean") {
    return null;
  }
  return {
    manualOverride: override,
    freeTables: v.freeTables,
    totalTables: v.totalTables,
    isOpen: v.isOpen,
    saved: v.saved,
  };
}

/** The poll's answer as the browser trusts it; junk reads as "no state". */
export function readVenueAnswer(value: unknown): VenueSignalAnswer {
  if (value && typeof value === "object") {
    const v = value as {
      unchanged?: unknown;
      status?: unknown;
      cursor?: unknown;
    };
    if (v.unchanged === true) return { unchanged: true };
    return {
      status: readVenueStatus(v.status),
      cursor: typeof v.cursor === "string" ? v.cursor : "",
    };
  }
  return { status: null, cursor: "" };
}

/**
 * The radio a stored status opens the popover on: the chip's own word
 * (venueChipState) where it says Yoğun, whichever mode the köşk is open
 * in; otherwise the stored mode.
 */
export function quickChoiceOf(status: VenueQuickStatus): VenueQuickChoice {
  if (status.manualOverride === "closed") return "closed";
  if (venueChipState(status).label === "Yoğun") return "busy";
  return status.manualOverride;
}

/**
 * The fields a choice saves (the quick action writes nothing else): the
 * mode and the free tables, or for Yoğun the free tables alone.
 */
export function quickPatchFor(
  choice: VenueQuickChoice,
  freeTables: number,
): { manualOverride?: VenueOverride; freeTables: number } {
  if (choice === "busy") return { freeTables: 0 };
  return { manualOverride: choice, freeTables };
}

export type VenueChipTone = "success" | "warning" | "neutral";

/**
 * The chip's word, as the app would put it: closed, full, or open. Full
 * only once a count was saved; colour is never the only signal (the word
 * is always there).
 */
export function venueChipState(status: VenueQuickStatus): {
  label: "Açık" | "Yoğun" | "Kapalı";
  tone: VenueChipTone;
} {
  if (!status.isOpen) return { label: "Kapalı", tone: "neutral" };
  if (status.saved && status.freeTables === 0) {
    return { label: "Yoğun", tone: "warning" };
  }
  return { label: "Açık", tone: "success" };
}

/** The chip's tooltip: the mode and the count it does not print. */
export function venueChipTitle(status: VenueQuickStatus): string {
  const mode =
    status.manualOverride === "auto"
      ? "Otomatik, saatlere göre"
      : `Elle ${VENUE_QUICK_LABELS[status.manualOverride].label.toLocaleLowerCase("tr-TR")}`;
  const count = status.saved
    ? `boş masa ${status.freeTables} / ${status.totalTables}`
    : "boş masa henüz girilmedi";
  return `Köşk durumu: ${mode}, ${count}`;
}

/** One −/+ step, kept between 0 and the table count. */
export function stepFreeTables(
  freeTables: number,
  delta: number,
  totalTables: number,
): number {
  const max = Math.max(0, Math.floor(totalTables));
  return Math.min(max, Math.max(0, Math.floor(freeTables) + delta));
}

/**
 * The radio after a −/+ step. A free table ends Yoğun: the radio goes back
 * to the mode the köşk is in (`stored`, which Yoğun never changed), never
 * to Otomatik, which would close an Açık night past the hours. A mode the
 * operator picked stays as picked; stepping it to 0 saves that mode with
 * no free table, the same full room.
 */
export function choiceAfterStep(
  choice: VenueQuickChoice,
  freeTables: number,
  stored: VenueOverride,
): VenueQuickChoice {
  if (choice === "busy" && freeTables > 0) return stored;
  return choice;
}
