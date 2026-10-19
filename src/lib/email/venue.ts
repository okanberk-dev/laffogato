/**
 * The venue's phone, address and hours in every mail footer, from Ayarlar.
 *
 * The 23 templates and the text signature carried "Her gün 09:00 - 02:00 ·
 * +90 536 429 09 19" and the address as literals, so an owner who moved the
 * closing time or the number in the panel saw the site follow and every mail
 * keep the old values (admin audit SYS-04). They are `[FIELD]`s now:
 *
 *   [KOSK_SAAT]    "Her gün 09:00 - 02:00" (the app's `hoursLabel`)
 *   [TELEFON]      "+90 536 429 09 19"
 *   [TELEFON_TEL]  "+905364290919", for `tel:`
 *   [KOSK_ADRES]   "Postane Mah. ..., 34940 Tuzla / İstanbul"
 *
 * `commonVars` fills them with the bundled values, so a render with no
 * settings at hand (the dev preview, the tests) still has every field; the
 * send paths lay the panel's values over them (`loadVenueVars`).
 */

import { LEGAL_ENTITY } from "@/lib/legal/entity";
import { SITE } from "@/lib/seo/site";

import type { TemplateVars } from "./fill";

export interface VenueFacts {
  phone: string;
  phoneTel: string;
  addressLines: string[];
  hoursLabel: string;
}

export function venueVars(v: VenueFacts): TemplateVars {
  return {
    KOSK_SAAT: v.hoursLabel,
    TELEFON: v.phone,
    TELEFON_TEL: v.phoneTel,
    KOSK_ADRES: v.addressLines.join(", "),
  };
}

export const DEFAULT_VENUE_VARS: TemplateVars = venueVars({
  phone: SITE.phone,
  phoneTel: SITE.phoneE164,
  addressLines: [
    SITE.address.streetAddress,
    `${SITE.address.postalCode} ${SITE.address.addressLocality} / ${SITE.address.addressRegion}`,
  ],
  hoursLabel: LEGAL_ENTITY.cafeHours.display,
});

/**
 * The panel's values. Dynamic imports, as in `emailIdentity`: the store
 * imports the mail modules for order mail, and a static import both ways is a
 * cycle. A settings read that fails keeps the bundled footer: a password
 * reset is not dropped over the hours line.
 */
export async function loadVenueVars(): Promise<TemplateVars> {
  try {
    const [{ getPublicSettings }, { venueContact }] = await Promise.all([
      import("@/lib/admin/store"),
      import("@/lib/seo/contact"),
    ]);
    return venueVars(venueContact(await getPublicSettings()));
  } catch {
    return DEFAULT_VENUE_VARS;
  }
}
