import "server-only";

import {
  listKaraokeAttention,
  listReservationsForDate,
} from "@/lib/mobile/karaoke";

import {
  karaokeAttentionViews,
  karaokeRowViews,
  type KaraokePanelContext,
  type KaraokeRowView,
} from "./karaoke-panel";

/** What the dashboard's karaoke card draws (KaraokeTodayCard). */
export interface KaraokeTodayCardData {
  /** Today's bookings on the köşk's calendar. */
  today: KaraokeRowView[];
  /** Every booking that waits for a person, any day: the Dikkat tab's set. */
  attention: KaraokeRowView[];
}

/**
 * The dashboard's karaoke card: today's bookings, and what waits for a
 * person counted from the same set as the karaoke page's Dikkat tab
 * (`listKaraokeAttention`), so the two never disagree (admin audit KAR-07:
 * the card read today's rows and the refunds owed only, and missed a paid
 * request from yesterday or a request for tomorrow). Null when the
 * bookings could not be read: the card says so and the dashboard stands.
 */
export async function loadKaraokeTodayCard(
  ctx: KaraokePanelContext,
): Promise<KaraokeTodayCardData | null> {
  try {
    const [today, attention] = await Promise.all([
      listReservationsForDate(ctx.today),
      listKaraokeAttention(ctx.today),
    ]);
    return {
      today: karaokeRowViews(today, ctx),
      attention: karaokeAttentionViews(attention, ctx),
    };
  } catch (err) {
    console.error("[admin] karaoke kartı okunamadı", err);
    return null;
  }
}
