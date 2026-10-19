// Client-safe: the köşk chip's rules (top bar, components/admin/venue-quick.tsx;
// its actions in app/admin/mobil/canli-durum/actions.ts). No server-only:
// the chip imports this in the browser.

/** `venue_status."manualOverride"` (lib/mobile/venue.ts VENUE_OVERRIDES). */
export type VenueOverride = "auto" | "open" | "closed";

/**
 * The chip's four choices. "Yoğun" is not a stored state: the room is full,
 * which the app reads from `freeTables = 0` ("Masaların hepsi dolu.") while
 * the hours still decide open and closed. So it saves as Otomatik with no
 * free table. An after-hours night that fills up is "Açık" with the count
 * stepped down to 0: "Yoğun" never keeps the house open past its hours.
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
  busy: { label: "Yoğun", hint: "Masalar dolu, saatlere göre" },
  closed: { label: "Kapalı", hint: "Saatlerden bağımsız" },
};

/** What the top bar polls (venueQuickStatusAction). */
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

/** The radio a stored status opens the popover on. */
export function quickChoiceOf(status: VenueQuickStatus): VenueQuickChoice {
  if (status.manualOverride === "open") return "open";
  if (status.manualOverride === "closed") return "closed";
  return status.saved && status.freeTables === 0 ? "busy" : "auto";
}

/** The two fields a choice saves (the quick action writes nothing else). */
export function quickPatchFor(
  choice: VenueQuickChoice,
  freeTables: number,
): { manualOverride: VenueOverride; freeTables: number } {
  if (choice === "busy") return { manualOverride: "auto", freeTables: 0 };
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
 * The radio after a −/+ step. Under the hours, a full room is "Yoğun" and
 * a free table makes it "Otomatik" again; a manual Açık or Kapalı stays as
 * chosen.
 */
export function choiceAfterStep(
  choice: VenueQuickChoice,
  freeTables: number,
): VenueQuickChoice {
  if (choice !== "auto" && choice !== "busy") return choice;
  return freeTables === 0 ? "busy" : "auto";
}
