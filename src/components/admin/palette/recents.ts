// The palette's "Son açılanlar" in this tab's sessionStorage (admin UI v2,
// UI-6, design §4.2). The rules of what may be kept are pure, in
// lib/admin/palette-shell.ts; this file only reads, writes and watches.
// Every storage call is in try/catch: a private window, blocked site data
// or a full quota leaves the list empty, never the panel broken.

import {
  addRecent,
  parseRecents,
  RECENT_KEY_PREFIX,
  recentSection,
  recentStorageKey,
  type RecentEntry,
} from "@/lib/admin/palette-shell";

/** The slice of Storage this file uses (a fake in the tests). */
export type RecentStore = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem" | "key" | "length"
>;

function tabStore(): RecentStore | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** This account's list, newest first; empty when nothing can be read. */
export function readRecents(
  accountKey: string,
  store: RecentStore | null = tabStore(),
): RecentEntry[] {
  const key = recentStorageKey(accountKey);
  if (!key || !store) return [];
  try {
    return parseRecents(store.getItem(key));
  } catch {
    return [];
  }
}

/** Keeps a record page the operator opened, if the rules allow it. */
export function rememberRecent(
  accountKey: string,
  href: string,
  title: string | null,
  store: RecentStore | null = tabStore(),
): void {
  const key = recentStorageKey(accountKey);
  if (!key || !store || !recentSection(href)) return;
  try {
    const after = addRecent(parseRecents(store.getItem(key)), href, title);
    if (after[0]?.href !== href) return; // the title may not be kept
    store.setItem(key, JSON.stringify(after));
  } catch {
    // Not kept: the list is a convenience.
  }
}

/**
 * Removes the lists of this tab: every account's (Çıkış, before the
 * action posts), or every account's but `keep` (the panel opened under
 * another account in the same tab).
 */
export function forgetRecents(
  store: RecentStore | null = tabStore(),
  keep?: string,
): void {
  if (!store) return;
  try {
    const keepKey = keep ? recentStorageKey(keep) : null;
    const doomed: string[] = [];
    for (let i = 0; i < store.length; i += 1) {
      const k = store.key(i);
      if (k && k.startsWith(RECENT_KEY_PREFIX) && k !== keepKey) doomed.push(k);
    }
    for (const k of doomed) store.removeItem(k);
  } catch {
    // Storage refused: there was nothing it would have given back either.
  }
}

/** How long a record page may take to draw its heading. */
export const RECENT_WAIT_MS = 10_000;

type ObserverCtor = new (callback: () => void) => {
  observe(target: Node, options: MutationObserverInit): void;
  disconnect(): void;
};

/**
 * The recorder the shell runs on every pathname: on a record page of the
 * allow-list it waits for the page's first heading inside the content
 * wrapper (the loading skeleton has none) and keeps it as the label.
 * Anything else is not even looked at. Returns the stop function.
 */
export function watchRecentPage({
  pathname,
  accountKey,
  root,
  store = tabStore(),
  Observer = typeof MutationObserver === "undefined"
    ? undefined
    : MutationObserver,
  waitMs = RECENT_WAIT_MS,
}: {
  pathname: string;
  accountKey: string;
  root: () => Pick<ParentNode, "querySelector"> | null;
  store?: RecentStore | null;
  Observer?: ObserverCtor;
  waitMs?: number;
}): () => void {
  if (!recentSection(pathname) || !recentStorageKey(accountKey)) {
    return () => {};
  }
  const tryRead = (): boolean => {
    const heading = root()?.querySelector("h1");
    const title = heading?.textContent ?? null;
    if (!title || !title.trim()) return false;
    rememberRecent(accountKey, pathname, title, store);
    return true;
  };

  if (tryRead()) return () => {};
  const target = root();
  if (!Observer || !target) return () => {};
  let done = false;
  const observer = new Observer(() => {
    if (!done && tryRead()) stop();
  });
  const stop = () => {
    done = true;
    observer.disconnect();
    clearTimeout(timer);
  };
  observer.observe(target as unknown as Node, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  const timer = setTimeout(stop, waitMs);
  return stop;
}
