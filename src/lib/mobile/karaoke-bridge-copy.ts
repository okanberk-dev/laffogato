/**
 * What the card page (`/odeme/paynkolay`) says when a karaoke booking's
 * payment page has expired. Pure, with no store and no database: the card
 * path may import neither (CLAUDE.md rule 28, tests/saved-cards.test.ts).
 *
 * The order wording ("Sepetin duruyor", a link to /odeme, the app's order
 * screen) is wrong for a booking: an expired page means the hold is about to
 * lapse, the card was not charged, and the way forward is a new booking.
 */

import { appKaraokeDeepLink } from "./deep-link";
import { isKaraokeRef } from "./karaoke-ref";

export interface BridgeNoticeCopy {
  title: string;
  body: string;
  link: { href: string; label: string };
}

/** Null for anything that is not a karaoke reference. */
export function karaokeExpiredNotice(
  ref: string,
  fromApp: boolean,
): BridgeNoticeCopy | null {
  if (!isKaraokeRef(ref)) return null;
  const body =
    "Ödeme sayfasının süresi doldu; kartından para çekilmedi, rezervasyon kesinleşmedi.";
  return fromApp
    ? {
        title: "Ödeme süresi doldu",
        body: `${body} Uygulamadan yeniden rezervasyon yapabilirsin.`,
        link: {
          href: appKaraokeDeepLink(ref, "failed"),
          label: "Uygulamaya dön",
        },
      }
    : {
        title: "Ödeme süresi doldu",
        body: `${body} Karaoke sayfasından yeniden rezervasyon yapabilirsin.`,
        link: { href: "/karaoke", label: "Karaoke sayfasına dön" },
      };
}
