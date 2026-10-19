// Client-safe (no server-only): how the Bülten list reads its subscribers.
// The page fetches (listNewsletterSubscribers); the tabs, the search, the
// order and the page are decided here, so the list, its counts and the
// tests agree.

import type { NewsletterSubscriber } from "@/lib/newsletter/store";

import {
  firstParam,
  pageCount,
  type FilterField,
  type FilterValues,
  type SearchParamsInput,
  type SortState,
} from "./list-params";
import { foldTr } from "./text-fold";
import type { AdminTone } from "./tone";

export const NEWSLETTER_PATH = "/admin/bulten";

/** A subscriber's view page (the consent record in full). */
export function subscriberHref(id: string): string {
  return `${NEWSLETTER_PATH}/${encodeURIComponent(id)}`;
}

/**
 * Where a subscriber stands: on the list, asked but not confirmed from their
 * inbox yet (double opt-in), or off.
 */
export type SubscriberState = "aktif" | "onay-bekliyor" | "pasif";

export function subscriberState(
  s: Pick<NewsletterSubscriber, "isActive" | "confirmToken">,
): SubscriberState {
  if (s.isActive) return "aktif";
  return s.confirmToken ? "onay-bekliyor" : "pasif";
}

export const SUBSCRIBER_STATE_LABELS: Record<SubscriberState, string> = {
  aktif: "Aktif",
  "onay-bekliyor": "Onay bekliyor",
  pasif: "Pasif",
};

export const SUBSCRIBER_STATE_TONES: Record<SubscriberState, AdminTone> = {
  aktif: "success",
  "onay-bekliyor": "warning",
  pasif: "neutral",
};

/** Where the subscription came from, in the panel's words. */
export const NEWSLETTER_SOURCE_LABELS: Record<string, string> = {
  footer: "Site altı",
  register: "Kayıt",
  account: "Hesap",
};

export function sourceLabel(source: string): string {
  return NEWSLETTER_SOURCE_LABELS[source] ?? source;
}

export type SubscriberTab = "tumu" | SubscriberState;

export const SUBSCRIBER_TAB_PARAM = "durum";

export const SUBSCRIBER_TABS: ReadonlyArray<{
  tab: SubscriberTab;
  value: string | null;
  label: string;
}> = [
  { tab: "tumu", value: null, label: "Tümü" },
  { tab: "aktif", value: "aktif", label: "Aktif" },
  { tab: "onay-bekliyor", value: "onay-bekliyor", label: "Onay bekliyor" },
  { tab: "pasif", value: "pasif", label: "Pasif" },
];

export function parseSubscriberTab(sp: SearchParamsInput): SubscriberTab {
  const raw = firstParam(sp, SUBSCRIBER_TAB_PARAM) ?? "";
  return SUBSCRIBER_TABS.find((t) => t.value === raw)?.tab ?? "tumu";
}

export const SUBSCRIBER_FILTER_FIELDS: readonly FilterField[] = [
  {
    type: "search",
    name: "q",
    label: "Ara",
    placeholder: "E-posta ya da ad",
    maxLength: 120,
  },
  {
    type: "select",
    name: "kaynak",
    label: "Kaynak",
    options: Object.entries(NEWSLETTER_SOURCE_LABELS).map(([value, label]) => ({
      value,
      label,
    })),
  },
];

export const SUBSCRIBER_SORT_KEYS = ["tarih", "eposta"] as const;

/** Newest first, the order the list always had. */
export const SUBSCRIBER_DEFAULT_SORT: SortState = { key: "tarih", dir: "desc" };

export const SUBSCRIBER_PAGE_SIZE = 50;

/** The search box: the address or the name, any spelling of the I family. */
export function matchesSubscriberSearch(
  s: Pick<NewsletterSubscriber, "email" | "name">,
  query: string,
): boolean {
  const q = foldTr(query.trim());
  if (!q) return true;
  return foldTr(s.email).includes(q) || foldTr(s.name ?? "").includes(q);
}

function compare(
  a: NewsletterSubscriber,
  b: NewsletterSubscriber,
  sort: SortState,
): number {
  let d =
    sort.key === "eposta"
      ? a.email.localeCompare(b.email, "tr")
      : (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
  if (d === 0) d = a.id.localeCompare(b.id);
  return sort.dir === "asc" ? d : -d;
}

export interface SubscriberListResult {
  rows: NewsletterSubscriber[];
  page: number;
  /** Subscribers in the current tab with the filters applied. */
  total: number;
  /** Every tab's count, the filters applied. */
  counts: Record<SubscriberTab, number>;
}

/** One page of the Bülten list, and every tab's count. */
export function subscriberList(
  subscribers: readonly NewsletterSubscriber[],
  opts: {
    tab: SubscriberTab;
    filters: FilterValues;
    sort: SortState;
    page: number;
    pageSize?: number;
  },
): SubscriberListResult {
  const size = opts.pageSize ?? SUBSCRIBER_PAGE_SIZE;
  const counts: Record<SubscriberTab, number> = {
    tumu: 0,
    aktif: 0,
    "onay-bekliyor": 0,
    pasif: 0,
  };
  const shown: NewsletterSubscriber[] = [];
  for (const s of subscribers) {
    if (opts.filters.q && !matchesSubscriberSearch(s, opts.filters.q)) continue;
    if (opts.filters.kaynak && s.source !== opts.filters.kaynak) continue;
    const state = subscriberState(s);
    counts.tumu += 1;
    counts[state] += 1;
    if (opts.tab === "tumu" || opts.tab === state) shown.push(s);
  }
  shown.sort((a, b) => compare(a, b, opts.sort));
  const pages = pageCount(shown.length, size);
  const page = Math.min(Math.max(1, opts.page), pages);
  return {
    rows: shown.slice((page - 1) * size, page * size),
    page,
    total: shown.length,
    counts,
  };
}
