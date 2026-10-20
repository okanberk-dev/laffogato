// Client-safe (no server-only): the rules of the panel's ⌘K palette (admin
// UI v2, UI-6, design §4). What it lists for a role, how it matches
// Turkish, how it ranks, and how it reads the record search's answer.
// Pure: palette.tsx (loaded on open) draws it, the tests run it. The
// always-loaded half (the key, the recents rules) is palette-shell.ts,
// re-exported here.

import { canAccess, type AdminRole, type AdminSection } from "./roles";
import type { SearchHit, SearchSection } from "./search-core";
import { singleKeysForRole } from "./shortcut-core";
import { foldTr } from "./text-fold";

export * from "./palette-shell";

/** A record search starts at this many characters (search-core's floor). */
export const PALETTE_SEARCH_MIN = 2;

/** How long the box waits after the last key before it asks the server. */
export const PALETTE_SEARCH_DEBOUNCE_MS = 200;

/** The record search behind the palette (app/admin/ara/sonuc/route.ts). */
export const PALETTE_SEARCH_ROUTE = "/admin/ara/sonuc";

// ── Matching ──────────────────────────────────────────────────────────────

/** After foldTr: the letters an operator often types without their marks. */
const LOOSE: Record<string, string> = {
  ç: "c",
  ş: "s",
  ğ: "g",
  ö: "o",
  ü: "u",
  â: "a",
  î: "i",
  û: "u",
};

/**
 * The palette's fold, on both sides: foldTr (Turkish lower case, İ I ı i
 * meet) and then the loose ASCII letters, so "siparis" finds "Siparişler"
 * and "musteri" finds "Müşteriler". Apostrophes go too ("fal" finds
 * "fA'L bildirimleri"). Only for the panel's own names: the record search
 * keeps the marks (search.ts folds in SQL).
 */
export function foldLoose(value: string): string {
  return foldTr(value.normalize("NFC"))
    .replace(/[çşğöüâîû]/g, (c) => LOOSE[c] ?? c)
    .replace(/['’`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const words = (folded: string) => folded.split(/[\s·/,.()-]+/).filter(Boolean);

/** A static entry: a page to go to, a page to create on, or a command. */
export interface PaletteEntry {
  /** Unique in the list: also the ListBox key. */
  id: string;
  label: string;
  /** Where it sits: the nav item a tab belongs to, or the group. */
  hint?: string;
  href?: string;
  /** For a command that is not a page (a local preference). */
  command?: PaletteCommand;
  keywords: readonly string[];
}

export type PaletteCommand = "toggleSound" | "shortcutSheet";

/**
 * How well `entry` answers the folded query: 0 the label starts with it,
 * 1 a word of the label does, 2 a keyword or the hint (or a word of one)
 * does, 3 any of them contains it. Null: no match. An empty query matches
 * everything equally.
 */
export function matchTier(entry: PaletteEntry, query: string): number | null {
  const q = foldLoose(query);
  if (!q) return 0;
  const label = foldLoose(entry.label);
  if (label.startsWith(q)) return 0;
  if (words(label).some((w) => w.startsWith(q))) return 1;
  const others = [...entry.keywords, entry.hint ?? ""]
    .map(foldLoose)
    .filter(Boolean);
  if (
    others.some((k) => k.startsWith(q) || words(k).some((w) => w.startsWith(q)))
  )
    return 2;
  if (label.includes(q) || others.some((k) => k.includes(q))) return 3;
  return null;
}

const collator = new Intl.Collator("tr");

/**
 * The entries that answer `query`, best first; ties in Turkish alphabetical
 * order. With an empty query the list is returned as given (the nav's own
 * order).
 */
export function rankEntries<T extends PaletteEntry>(
  entries: readonly T[],
  query: string,
): T[] {
  if (!foldLoose(query)) return [...entries];
  return entries
    .map((entry) => ({ entry, tier: matchTier(entry, query) }))
    .filter((x): x is { entry: T; tier: number } => x.tier !== null)
    .sort(
      (a, b) =>
        a.tier - b.tier || collator.compare(a.entry.label, b.entry.label),
    )
    .map((x) => x.entry);
}

// ── Git ───────────────────────────────────────────────────────────────────

/** A nav group as the shell holds it (admin/layout.tsx, after visibleNav). */
export interface PaletteNavGroup {
  title: string;
  items: ReadonlyArray<{
    href: string;
    label: string;
    section: string;
    keywords?: readonly string[];
    tabs?: ReadonlyArray<{ href: string; label: string; section?: string }>;
  }>;
}

/**
 * Old names and synonyms for pages the nav item's own keywords do not
 * reach: a tab ("mağaza hero" is the Mağaza tab of Slaytlar), and the
 * karaoke line, which the layout keeps bare (a test greps it).
 */
const EXTRA_KEYWORDS: Readonly<Record<string, readonly string[]>> = {
  "/admin/siparisler": ["iade", "kargo", "masa siparişi"],
  "/admin/mobil/karaoke": ["rezervasyon", "karaoke odası"],
  "/admin/magaza-hero": ["Mağaza Hero"],
  "/admin/mobil/slaytlar": ["Mobil Slaytlar"],
  "/admin/mobil/ayarlar": ["Uygulama ayarları"],
};

/**
 * The Gün sonu sheet: a page of its own under Raporlar, in neither the nav
 * nor its tabs. The same entry as day-close-core's DAY_CLOSE_ENTRY (a test
 * holds them equal), not imported: day-close-core brings the order filters
 * into this chunk, and the palette's budget is 45 KB.
 */
export const DAY_CLOSE_GO: {
  readonly href: string;
  readonly label: string;
  readonly section: AdminSection;
  readonly keywords: readonly string[];
} = {
  href: "/admin/raporlar/gun-sonu",
  label: "Gün sonu",
  section: "reports",
  keywords: ["gün sonu", "kapanış", "günlük özet", "bugün", "yazdır"],
};

const isSection = (s: string | undefined): s is AdminSection =>
  typeof s === "string" && s.length > 0;

function mayOpen(section: string | undefined, role: AdminRole): boolean {
  if (!isSection(section)) return false;
  try {
    return canAccess(section, role);
  } catch {
    // A section roles.ts does not know: never shown.
    return false;
  }
}

/**
 * "Git": every item and every permitted tab of the role's nav, with the
 * old names. The nav comes in already filtered (visibleNav); each entry is
 * asked again here all the same, so a palette can never list a page the
 * role's own menu would not. A tab with its item's address is the item.
 * The Gün sonu sheet joins them: it is a page of its own, under Raporlar.
 */
export function goEntries(
  groups: readonly PaletteNavGroup[],
  role: AdminRole | null | undefined,
): PaletteEntry[] {
  if (!role) return [];
  const out: PaletteEntry[] = [];
  const seen = new Set<string>();
  const push = (entry: PaletteEntry) => {
    if (!entry.href || seen.has(entry.href)) return;
    seen.add(entry.href);
    out.push(entry);
  };
  for (const group of groups) {
    for (const item of group.items) {
      if (!mayOpen(item.section, role)) continue;
      push({
        id: `go:${item.href}`,
        label: item.label,
        hint: group.title,
        href: item.href,
        keywords: [
          ...(item.keywords ?? []),
          ...(EXTRA_KEYWORDS[item.href] ?? []),
        ],
      });
      for (const tab of item.tabs ?? []) {
        if (tab.href === item.href) continue;
        if (!mayOpen(tab.section ?? item.section, role)) continue;
        push({
          id: `go:${tab.href}`,
          label: tab.label,
          hint: item.label,
          href: tab.href,
          keywords: [...(EXTRA_KEYWORDS[tab.href] ?? [])],
        });
      }
    }
  }
  if (mayOpen(DAY_CLOSE_GO.section, role)) {
    push({
      id: `go:${DAY_CLOSE_GO.href}`,
      label: DAY_CLOSE_GO.label,
      hint: "Raporlar",
      href: DAY_CLOSE_GO.href,
      keywords: DAY_CLOSE_GO.keywords,
    });
  }
  return out;
}

// ── Oluştur ───────────────────────────────────────────────────────────────

/**
 * The pages that start a new record, each gated by the section its page's
 * requireRole asks for (tests/admin-palette-core.test.ts reads the pages).
 */
export const CREATE_ENTRIES: ReadonlyArray<{
  href: string;
  label: string;
  section: AdminSection;
  keywords: readonly string[];
}> = [
  {
    href: "/admin/siparisler/yeni",
    label: "Yeni sipariş",
    section: "orders",
    keywords: ["manuel sipariş", "telefon siparişi"],
  },
  {
    href: "/admin/urunler/yeni",
    label: "Yeni ürün",
    section: "products",
    keywords: ["mağaza"],
  },
  {
    href: "/admin/urunler/ice-aktar",
    label: "Ürünleri CSV ile içe aktar",
    section: "products",
    keywords: ["csv", "içe aktar", "excel"],
  },
  {
    href: "/admin/menu/yeni",
    label: "Yeni menü ürünü",
    section: "menu",
    keywords: ["kafe menüsü", "içecek"],
  },
  {
    href: "/admin/kategoriler/yeni",
    label: "Yeni kategori",
    section: "categories",
    keywords: [],
  },
  {
    href: "/admin/promosyon/yeni",
    label: "Yeni promosyon",
    section: "promos",
    keywords: ["kupon", "indirim kodu"],
  },
  {
    href: "/admin/bulten/kampanya/yeni",
    label: "Yeni kampanya",
    section: "newsletter",
    keywords: ["Kampanya e-postası", "bülten"],
  },
  {
    href: "/admin/anasayfa-hero/yeni",
    label: "Yeni anasayfa slaytı",
    section: "content",
    keywords: ["hero"],
  },
  {
    href: "/admin/magaza-hero/yeni",
    label: "Yeni mağaza slaytı",
    section: "shopHero",
    keywords: ["Mağaza Hero", "vitrin"],
  },
  {
    href: "/admin/mobil/slaytlar/yeni",
    label: "Yeni uygulama slaytı",
    section: "mobileApp",
    keywords: ["Mobil Slaytlar"],
  },
  {
    href: "/admin/mobil/duyurular/yeni",
    label: "Yeni duyuru",
    section: "mobileApp",
    keywords: [],
  },
  {
    href: "/admin/mobil/gonderiler/yeni",
    label: "Yeni gönderi",
    section: "mobileApp",
    keywords: ["post"],
  },
  {
    href: "/admin/masalar/yeni",
    label: "Yeni masa",
    section: "tables",
    keywords: ["qr"],
  },
  {
    href: "/admin/masalar/yazdir",
    label: "Masa kartlarını yazdır",
    section: "tables",
    keywords: ["qr", "masa kartı"],
  },
];

/** "Oluştur" for the role: Personel gets Yeni sipariş, a cashier nothing. */
export function createEntries(
  role: AdminRole | null | undefined,
): PaletteEntry[] {
  if (!role) return [];
  return CREATE_ENTRIES.filter((e) => canAccess(e.section, role)).map((e) => ({
    id: `new:${e.href}`,
    label: e.label,
    href: e.href,
    keywords: e.keywords,
  }));
}

// ── Komutlar ──────────────────────────────────────────────────────────────

/**
 * "Komutlar": navigation and this browser's own preferences, never a
 * change to the shop (no Çıkış, no order step: the palette is read-only).
 * "Klavye kısayolları" opens the shortcut sheet (UI-8) for the roles with
 * single keys. The order sound is the panel's one sound switch
 * (sound-pref.ts), for the roles that hear it.
 */
export function commandEntries(
  role: AdminRole | null | undefined,
  { soundOn }: { soundOn: boolean },
): PaletteEntry[] {
  if (!role) return [];
  const out: PaletteEntry[] = [
    {
      id: "cmd:2fa",
      label: "Güvenlik / 2FA",
      href: "/admin/2fa-kurulum",
      keywords: ["iki aşamalı doğrulama", "doğrulama kodu"],
    },
  ];
  if (singleKeysForRole(role)) {
    out.push({
      id: "cmd:shortcuts",
      label: "Klavye kısayolları",
      command: "shortcutSheet",
      keywords: ["kısayol", "tuş"],
    });
  }
  if (canAccess("orders", role)) {
    out.push({
      id: "cmd:sound",
      label: soundOn ? "Sipariş sesini kapat" : "Sipariş sesini aç",
      command: "toggleSound",
      keywords: ["ses", "zil", "sessiz"],
    });
  }
  return out;
}

// ── Kayıtlar: the record search's answer ─────────────────────────────────

/**
 * Each search section's own list, for the "Listede ara" row when the
 * route took the link away (the text looked like a person). The same
 * paths as search.ts LIST_HREF, never with the text.
 */
export const SEARCH_LIST_PATHS: Readonly<Record<SearchSection, string>> = {
  orders: "/admin/siparisler",
  customers: "/admin/musteriler",
  products: "/admin/urunler",
  menu: "/admin/menu",
  karaoke: "/admin/mobil/karaoke",
};

export interface PaletteHitGroup {
  section: SearchSection;
  label: string;
  hits: SearchHit[];
  more: boolean;
  listHref: string | null;
}

/** A panel path the router may open: on this site, under /admin. */
const panelPath = (href: unknown): href is string =>
  typeof href === "string" &&
  href.startsWith("/admin") &&
  !href.startsWith("//") &&
  !/[\\\s]/.test(href);

const isSearchSection = (s: unknown): s is SearchSection =>
  typeof s === "string" &&
  Object.prototype.hasOwnProperty.call(SEARCH_LIST_PATHS, s);

/**
 * The route's `{ groups }`, kept to what the palette draws: groups with a
 * known section, hits whose link stays in the panel. The hits are not
 * matched again here: the server found them (a phone number's hit has a
 * name as its title).
 */
export function parseSearchAnswer(body: unknown): PaletteHitGroup[] | null {
  if (typeof body !== "object" || body === null) return null;
  const groups = (body as { groups?: unknown }).groups;
  if (!Array.isArray(groups)) return null;
  const out: PaletteHitGroup[] = [];
  for (const g of groups) {
    if (typeof g !== "object" || g === null) continue;
    const { section, label, hits, more, listHref } = g as Record<
      string,
      unknown
    >;
    if (!isSearchSection(section) || typeof label !== "string") continue;
    const kept: SearchHit[] = [];
    for (const h of Array.isArray(hits) ? hits : []) {
      if (typeof h !== "object" || h === null) continue;
      const hit = h as Partial<SearchHit>;
      if (!panelPath(hit.href) || typeof hit.title !== "string") continue;
      kept.push({
        href: hit.href,
        title: hit.title,
        meta: Array.isArray(hit.meta)
          ? hit.meta.filter((m): m is string => typeof m === "string")
          : [],
        ...(typeof hit.amountMinor === "number"
          ? { amountMinor: hit.amountMinor }
          : {}),
        ...(typeof hit.at === "string" ? { at: hit.at } : {}),
      });
    }
    out.push({
      section,
      label,
      hits: kept,
      more: more === true,
      listHref: panelPath(listHref) ? listHref : null,
    });
  }
  return out;
}

/**
 * The row under a group with more than five hits: "Listede ara", the
 * section's list without the text. The route's link is that bare list too
 * (search.ts LIST_HREF; the lists keep their search in a cookie since
 * #181), and it is null when the text looked like an e-mail or a phone.
 * So the row never promises the hits in the list. Never the text in an
 * address, and no "Tüm sonuçlar" row that would put it there.
 */
export function listRow(
  group: Pick<PaletteHitGroup, "section" | "more" | "listHref">,
): { href: string; label: string } | null {
  return group.more
    ? {
        href: group.listHref ?? SEARCH_LIST_PATHS[group.section],
        label: "Listede ara",
      }
    : null;
}

export type SearchOutcome = "ok" | "expired" | "unavailable";

/**
 * What a response of the route means. 401, or the proxy's redirect to the
 * sign-in page (`redirect: "manual"` turns it into an opaque redirect):
 * the session is over. 200: an answer. Anything else, a 503 included: the
 * search does not work right now (never "no results").
 */
export function searchOutcome(res: {
  type?: string;
  status: number;
}): SearchOutcome {
  if (res.type === "opaqueredirect" || res.status === 401) return "expired";
  return res.status === 200 ? "ok" : "unavailable";
}

/** The sign-in page that brings the operator back to this page. */
export function signInHref(pathname: string): string {
  const back = panelPath(pathname) ? pathname : "/admin";
  return `/admin/giris?next=${encodeURIComponent(back)}`;
}

/** The live region's line for what the list shows. */
export function resultCountText(n: number): string {
  return n === 0 ? "Sonuç yok." : `${n} sonuç.`;
}
