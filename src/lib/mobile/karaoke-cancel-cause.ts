import { karaokeStartInstant } from "./karaoke-time";

/**
 * Why the köşk cancels a PAID karaoke booking, from a fixed list (ASK-OTH-3
 * (c) and ASK-Y3-4 (c), 19 Ekim 2026). Pure and dependency-free like
 * karaoke-time.ts: the panel's dialog (a client component) prints the
 * labels, the action checks the code, the mail turns it into a sentence.
 *
 * - `ariza`, `kapanis`, `mucbir`, `diger`: the business cannot keep the
 *   booking. The karaoke terms §8 allow only a good reason, and the mail is
 *   the written notice MSY m.16/4 asks for (at the cancel, so well inside
 *   its 3 days): it names the reason and apologises. Always a full refund.
 * - `misafir`: the guest asked by phone or e-mail. The staff records the
 *   channel and the instant of the request, and the booking's own rule is
 *   judged at that instant (§7: a call counts when it is made, an e-mail
 *   when it is sent), not when the panel gets to it.
 * - `yeniden`: the hour was given to another guest (a no-show, or a guest
 *   who said nobody would come): everything paid goes back (§7).
 *
 * The free-text note the staff types stays in the audit row; the guest only
 * ever reads the sentence of the code.
 */
export const KARAOKE_CANCEL_CAUSES = [
  "ariza",
  "kapanis",
  "mucbir",
  "diger",
  "misafir",
  "yeniden",
] as const;

export type KaraokeCancelCause = (typeof KARAOKE_CANCEL_CAUSES)[number];

/** The business's own reasons (karaoke terms §8). */
export type KaraokeBusinessCause = Extract<
  KaraokeCancelCause,
  "ariza" | "kapanis" | "mucbir" | "diger"
>;

export function isBusinessCause(
  cause: string | undefined,
): cause is KaraokeBusinessCause {
  return (
    cause === "ariza" ||
    cause === "kapanis" ||
    cause === "mucbir" ||
    cause === "diger"
  );
}

/**
 * What the guest reads after "Rezervasyonunu biz iptal etmek zorunda kaldık:"
 * (sen). Never the staff's own note.
 */
export const KARAOKE_CAUSE_MAIL: Record<KaraokeBusinessCause, string> = {
  ariza: "odada teknik bir arıza oldu",
  kapanis: "köşkü geçici olarak kapatmak zorunda kaldık",
  mucbir: "elimizde olmayan bir sebep (mücbir sebep) çıktı",
  diger: "işletmemizden kaynaklanan bir sebeple saatini karşılayamıyoruz",
};

/** The panel's words for each code, in the dialog and the history. */
export const KARAOKE_CAUSE_LABEL: Record<KaraokeCancelCause, string> = {
  ariza: "Oda ya da ekipman arızası",
  kapanis: "Köşk geçici olarak kapalı",
  mucbir: "Mücbir sebep",
  diger: "İşletmeden kaynaklanan başka bir sebep",
  misafir: "Misafir iptal istedi",
  yeniden: "Saat başka bir misafire verildi",
};

/** How a guest's request reached the köşk. */
export const KARAOKE_REQUEST_CHANNELS = ["telefon", "e-posta"] as const;

export type KaraokeRequestChannel = (typeof KARAOKE_REQUEST_CHANNELS)[number];

export const KARAOKE_CHANNEL_LABEL: Record<KaraokeRequestChannel, string> = {
  telefon: "Telefon",
  "e-posta": "E-posta",
};

/** The panel's reminder (karaoke terms §8: under 24 hours we also call). */
export const KARAOKE_CALL_HINT =
  "Rezervasyona 24 saatten az kaldı: misafiri ara.";

const DAY_MS = 24 * 60 * 60_000;

/**
 * Does a business cancel now also need a call? Under 24 hours before the
 * start, and only when a phone is on the booking (a member's app booking
 * carries none, hence "kayıtlıysa" in §8).
 */
export function needsCallHint(
  r: { date: string; startHour: number; contactPhone?: string },
  now: Date,
): boolean {
  if (!r.contactPhone?.trim()) return false;
  const left =
    karaokeStartInstant(r.date, r.startHour).getTime() - now.getTime();
  return left > 0 && left < DAY_MS;
}
