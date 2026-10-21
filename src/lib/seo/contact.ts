import type { WeeklyHours } from "@/lib/admin/days";
import type { FooterSettings } from "@/components/laffogato/chrome";
import { LEGAL_ENTITY } from "@/lib/legal/entity";
import { hoursLabel } from "@/lib/mobile/menu-mapper";
import { addressLines } from "@/lib/utils/format";

import { SITE } from "./site";

/**
 * The venue's contact facts as Ayarlar → Genel / Saatler says them, for every
 * place the site prints them: the footer on every page, the home page's facts
 * block (`SeoContent`) and the mail footers.
 *
 * The panel promised these fields "the footer and the visit page", but the
 * footer printed a fixed "Her gün 09:00 - 02:00", the facts block printed
 * `SITE.*`, and a cleared phone gave an empty `tel:` link (`??` lets "" through).
 * One function so no surface can read a different number than another, and
 * `||` so a blank field falls back to the bundled value instead of nothing.
 */

export interface ContactSource {
  phone?: string;
  email?: string;
  address?: string;
  weeklyHours?: WeeklyHours;
}

export interface VenueContact {
  phone: string;
  /** For `tel:`: the digits and the leading plus only. */
  phoneTel: string;
  email: string;
  /** Display lines of the venue's address (landmark in brackets dropped). */
  addressLines: string[];
  /** One line for the week, the same string the app shows (`hoursLabel`). */
  hoursLabel: string;
  /** The same week as rows: `["Her gün", "09:00 - 02:00"]`, or one per run. */
  hoursRows: [string, string][];
}

export const DEFAULT_ADDRESS_LINES = [
  SITE.address.streetAddress,
  `${SITE.address.postalCode} ${SITE.address.addressLocality} / ${SITE.address.addressRegion}`,
];

const DEFAULT_HOURS_ROWS: [string, string][] = [
  [
    "Her gün",
    `${LEGAL_ENTITY.cafeHours.opens} - ${LEGAL_ENTITY.cafeHours.closes}`,
  ],
];

/** `tel:` target: "+90 536 429 09 19" → "+905364290919". */
export function telHref(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}

/**
 * `hoursLabel` joins runs with " · " ("Pzt-Cum 09:00 - 01:00 · Cmt-Paz 10:00 -
 * 02:00", "Her gün 09:00 - 02:00", "Paz Kapalı"). The footer lays them out as
 * label/value rows, so the label is split back off the range here rather than
 * grouping the week a second time (and possibly differently).
 */
export function hoursRowsFromLabel(label: string): [string, string][] {
  const rows = label
    .split(" · ")
    .map((seg) => seg.trim())
    .filter(Boolean)
    .map((seg): [string, string] => {
      const m = /^(.*?)\s*(\d{2}:\d{2} - \d{2}:\d{2}|Kapalı)$/.exec(seg);
      if (!m) return ["", seg];
      return [m[1] || "Her gün", m[2]];
    });
  return rows.length > 0 ? rows : DEFAULT_HOURS_ROWS;
}

export function venueContact(s: ContactSource = {}): VenueContact {
  const phone = s.phone?.trim() || SITE.phone;
  const label = s.weeklyHours
    ? hoursLabel(s.weeklyHours)
    : LEGAL_ENTITY.cafeHours.display;
  return {
    phone,
    phoneTel: telHref(phone) || SITE.phoneE164,
    email: s.email?.trim() || SITE.email,
    addressLines: addressLines(s.address ?? "", DEFAULT_ADDRESS_LINES),
    hoursLabel: label,
    hoursRows: s.weeklyHours ? hoursRowsFromLabel(label) : DEFAULT_HOURS_ROWS,
  };
}

/**
 * What every `<SiteChrome>` / `<LaffogatoApp>` footer is given. Twelve pages
 * built this object by hand with three fields; the hours were the fourth no
 * one passed.
 */
export function footerSettings(s: ContactSource): FooterSettings {
  const c = venueContact(s);
  return {
    phone: c.phone,
    email: c.email,
    address: s.address ?? "",
    hours: c.hoursRows,
  };
}
