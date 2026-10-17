/**
 * The karaoke price quote, with no dependencies at all.
 *
 * The web booking form (`karaoke-booking.tsx`, a client component) shows the
 * running total as the member picks hours. It used to import these two
 * functions from `karaoke-core.ts`, whose default arguments read
 * `DEFAULT_MOBILE_APP_CONFIG` from `app-config.ts` - and both of those modules
 * build Zod schemas at load time. The bundler cannot drop a module with
 * top-level side effects, so the whole of Zod (~390 KB raw, ~85 KB gzip) was
 * shipped to every visitor of /karaoke for two lines of arithmetic.
 *
 * So the arithmetic lives here and takes the live discount as a required
 * argument; `karaoke-core.ts` keeps its defaulted signatures for the server,
 * the mobile endpoint and the tests, and delegates to these.
 */

export interface KaraokeQuote {
  priceMinor: number;
  discountMinor: number;
  totalMinor: number;
}

/** Discount for a loyalty tier; only ORO earns one. */
export function karaokeDiscountPctFor(
  tier: string | null | undefined,
  oroDiscountPct: number,
): number {
  return tier === "oro" ? oroDiscountPct : 0;
}

/** hours × hourly, minus the tier discount, all in kuruş. */
export function quoteKaraoke(
  hours: number,
  hourlyMinor: number,
  tier: string | null | undefined,
  oroDiscountPct: number,
): KaraokeQuote {
  const priceMinor = Math.max(0, Math.round(hours * hourlyMinor));
  const discountMinor = Math.round(
    (priceMinor * karaokeDiscountPctFor(tier, oroDiscountPct)) / 100,
  );
  return { priceMinor, discountMinor, totalMinor: priceMinor - discountMinor };
}
