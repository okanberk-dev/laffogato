"use client";

import { useEffect, useState } from "react";

import { loadKaraokeToday, type KaraokeToday } from "./karaoke-today";

/**
 * Today's free karaoke hours, read in the browser after hydration.
 *
 * The home page is force-dynamic and its server render waits on nothing but
 * its own settings; asking the calendar there would put a second query in
 * front of the first byte. So the band renders without hours, and this asks
 * the same public endpoint the app reads once the page is up. Anything but a
 * good answer is `error`, and the band then shows no hours at all rather
 * than guessing (karaoke-today.ts `loadKaraokeToday`).
 *
 * One reading per page view: the home page asks once and hands the answer to
 * both the band's chips and the karaoke door's "Bugün N boş saat". `enabled`
 * is false where the page has no karaoke facts (no band, so no request).
 */
export function useKaraokeToday(
  enabled = true,
  /** What the page's render already read (KaraokeFacts.today): no request. */
  initial?: KaraokeToday,
): KaraokeToday {
  const [today, setToday] = useState<KaraokeToday>(
    initial ?? { kind: "loading" },
  );

  useEffect(() => {
    if (!enabled || initial) return;
    const ctrl = new AbortController();
    loadKaraokeToday(fetch, () => new Date(), ctrl.signal).then(
      setToday,
      // Aborted: the page went away before the calendar answered.
      () => {},
    );
    return () => ctrl.abort();
  }, [enabled, initial]);

  return today;
}
