"use client";

import { openStatus, type OpenStatus } from "./open-status";
import { useClientValue } from "./use-client-value";

/**
 * The live "open / closed" answer for a set of opening-hours rows, on the
 * visitor's clock in the köşk's time zone (open-status.ts).
 *
 * Null on the server and through hydration - the server cannot know when the
 * page will be read - so whatever shows it renders nothing until the browser
 * has answered, and the markup it hydrates against always matches. Shared by
 * the line under the hours table on /ziyaret and the status in the home hero,
 * so the two can never disagree.
 */
export function useOpenStatus(
  rows: ReadonlyArray<readonly [string, string]> | undefined,
): OpenStatus | null {
  // useClientValue wants a primitive, so the answer travels as a string.
  const encoded = useClientValue(() => {
    const st = rows ? openStatus(rows) : null;
    return st
      ? `${st.open ? 1 : 0}|${st.at ?? ""}|${st.opensToday ? 1 : 0}`
      : "";
  }, "");
  if (!encoded) return null;
  const [open, at, today] = encoded.split("|");
  return { open: open === "1", at: at || null, opensToday: today === "1" };
}

/** "Kapanış 02:00" / "Bugün açılış 09:00" / "Sonraki açılış 09:00". */
export function openStatusDetail(st: OpenStatus): string | null {
  if (!st.at) return null;
  return st.open
    ? `Kapanış ${st.at}`
    : `${st.opensToday ? "Bugün" : "Sonraki"} açılış ${st.at}`;
}
