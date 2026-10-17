import { PHASE_PRODUCTION_BUILD } from "next/constants";

import type { WeeklyHours } from "@/lib/admin/days";
import { getPublicSettings } from "@/lib/admin/store";
import { OG_JPEG, OG_SIZE, ogJpeg } from "@/lib/seo/og-card";
import { visitCard } from "@/lib/seo/og-pages";
import { SITE } from "@/lib/seo/site";

/**
 * /ziyaret's link preview: the köşk at night, the hours and the address.
 *
 * The hours are the panel's (Ayarlar), the ones the page prints, so the
 * card is redrawn hourly from `getPublicSettings()`. The build has no
 * database and does not read one: the card drawn there carries the köşk's
 * constant hours until the first revalidation.
 */
export const runtime = "nodejs";
export const revalidate = 3600;
export const alt = `${SITE.name} Tuzla: 200 yıllık köşkün akşam görünümü`;
export const size = OG_SIZE;
export const contentType = OG_JPEG;

/** The panel's weekly hours, or null at build time and on any error. */
async function panelHours(): Promise<WeeklyHours | null> {
  if (process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD) return null;
  try {
    return (await getPublicSettings()).weeklyHours;
  } catch {
    return null;
  }
}

export default async function Image() {
  return ogJpeg(await visitCard(await panelHours()));
}
