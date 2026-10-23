// Client-safe and server-safe: which of a record's tabs a page opens on.
// Its own file: the page (a server component) calls it, and a function
// exported from the "use client" DetailTabs could not be called there.

/** The tab a page opens on: the address's `sekme`, if it names one. */
export function pickDetailTab(
  tabs: readonly { id: string }[],
  requested: string | string[] | undefined,
  fallback?: string,
): string {
  const want = Array.isArray(requested) ? requested[0] : requested;
  if (want && tabs.some((t) => t.id === want)) return want;
  if (fallback && tabs.some((t) => t.id === fallback)) return fallback;
  return tabs[0]?.id ?? "";
}
