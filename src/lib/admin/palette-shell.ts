// Client-safe (no server-only): the always-loaded half of the panel's
// palette (admin UI v2, UI-6, design §4). The shell's trigger runs these on
// every page: the ⌘K / Ctrl+K key, its label, the events the single keys
// open it and the shortcut sheet with (UI-8), the rules for what the
// "Son açılanlar" list may keep, and the few Komutlar entries (kept here
// for the list's 45 KB budget). Everything else (the entries, the Turkish
// matching, the search answer) is in palette-core.ts, which only the lazy
// palette loads and which re-exports this file.

import { piiLike } from "./pii-like";
import { canAccess, type AdminRole, type AdminSection } from "./roles";
import { singleKeysForRole } from "./shortcut-roles";

/**
 * The no-JavaScript answer of the trigger: the results page. The same path
 * as search-core's ADMIN_SEARCH_PATH (a test holds them equal); not
 * imported, because search-core brings the order filters into the shell.
 */
export const PALETTE_FALLBACK_HREF = "/admin/ara";

/**
 * Whether a keydown opens (or closes) the palette: ⌘K on a Mac, Ctrl+K
 * elsewhere, in a field too. Never with Alt: AltGr is Ctrl+Alt on Windows,
 * and on a Turkish-Q keyboard it types @, € and { . Never with Shift
 * either (Ctrl+Shift+K is Firefox's console). The key is read as typed and
 * lowered the Turkish way, so Caps Lock's "K" still counts. A key that is
 * still being composed (an IME) is not a shortcut, and neither is a key a
 * script dispatched: React Aria's Autocomplete re-sends each key the box
 * gets to its list, so one ⌘K that closed the palette arrived a second
 * time and opened it again (seen in the browser pass).
 */
export function isPaletteShortcut(e: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  isComposing?: boolean;
  isTrusted?: boolean;
}): boolean {
  if (e.isTrusted === false) return false;
  if (e.isComposing || e.altKey || e.shiftKey) return false;
  if (!e.metaKey && !e.ctrlKey) return false;
  return typeof e.key === "string" && e.key.toLocaleLowerCase("tr-TR") === "k";
}

/**
 * The palette opened by something other than its trigger: the single keys
 * (shortcuts.tsx) send this on `window`, the trigger listens. `/` without
 * a search box on the page opens it as usual; `n` without a "Yeni" link
 * opens it on Oluştur alone ("create").
 */
export const PALETTE_OPEN_EVENT = "admin:palette-open";

export type PaletteView = "all" | "create";

/** The view an open request asked for; anything else is the whole palette. */
export function paletteViewOf(detail: unknown): PaletteView {
  return detail === "create" ? "create" : "all";
}

export function openPalette(view: PaletteView): void {
  window.dispatchEvent(new CustomEvent(PALETTE_OPEN_EVENT, { detail: view }));
}

/**
 * The shortcut sheet, asked for from the palette's Komutlar ("Klavye
 * kısayolları"); the shell's shortcut layer listens and opens it.
 */
export const SHORTCUT_SHEET_EVENT = "admin:shortcut-sheet";

export function openShortcutSheet(): void {
  window.dispatchEvent(new Event(SHORTCUT_SHEET_EVENT));
}

/**
 * "May this page be left?": the palette asks before it opens a page, with a
 * cancelable event on `window`. The unsaved-changes guard
 * (components/admin/ui/unsaved-guard.ts) listens only while a guarded form
 * is mounted, asks the operator and cancels on a no. A page with no guarded
 * form has no listener: the answer is yes, and none of the guard's code was
 * loaded for it (the palette's chunk has no room for it either).
 */
export const PANEL_LEAVE_EVENT = "admin:leave";

/** Whether the page lets `href` be opened (false: the guard's answer was no). */
export function mayOpenPage(href: string): boolean {
  return window.dispatchEvent(
    new CustomEvent(PANEL_LEAVE_EVENT, { cancelable: true, detail: href }),
  );
}

/** The key as the trigger prints it: Apple keyboards say ⌘. */
export function paletteShortcutLabel(apple: boolean): string {
  return apple ? "⌘K" : "Ctrl K";
}

/**
 * Whether this browser runs on an Apple keyboard platform. Read after
 * mount only (the server cannot know), so the label never mismatches.
 */
export function isApplePlatform(nav: {
  platform?: string;
  userAgent?: string;
  userAgentData?: { platform?: string };
}): boolean {
  const platform = nav.userAgentData?.platform ?? nav.platform ?? "";
  if (platform) return /mac|iphone|ipad|ipod/i.test(platform);
  return /mac os x|iphone|ipad/i.test(nav.userAgent ?? "");
}

// ── Son açılanlar ─────────────────────────────────────────────────────────

/** sessionStorage, per signed-in account: `laf_admin_recent_v1:<key>`. */
export const RECENT_KEY_PREFIX = "laf_admin_recent_v1:";
export const RECENT_MAX = 8;
export const RECENT_LABEL_MAX = 60;

/** The account key the layout computes: 16 hex of an HMAC, never an e-mail. */
export function validAccountKey(key: unknown): key is string {
  return typeof key === "string" && /^[0-9a-f]{16}$/.test(key);
}

export function recentStorageKey(accountKey: string): string | null {
  return validAccountKey(accountKey)
    ? `${RECENT_KEY_PREFIX}${accountKey}`
    : null;
}

/**
 * A record id as these lists write it ("ord-...", "krk-00042", "prd-0001",
 * a promo code): letters, digits and a few marks. A percent-encoded
 * segment, an "@" or a space is never one, so nothing typed or personal
 * rides in through an odd address.
 */
const ID = "[A-Za-z0-9][A-Za-z0-9_.~-]{0,79}";

/**
 * The record pages the list may keep, and the section each needs. An
 * allow-list: everything else is never written. Customers
 * (`/admin/musteriler/<e-posta>`: the address is in the URL), panel users,
 * newsletter subscribers and the audit log are not on it.
 */
const RECENT_PLACES: ReadonlyArray<{ re: RegExp; section: AdminSection }> = [
  [`/admin/siparisler/(?!yeni$)${ID}`, "orders"],
  [`/admin/mobil/karaoke/${ID}`, "karaoke"],
  [`/admin/urunler/(?!yeni$|ice-aktar$)${ID}`, "products"],
  [`/admin/menu/(?!yeni$)${ID}`, "menu"],
  [`/admin/kategoriler/${ID}/duzenle`, "categories"],
  [`/admin/anasayfa-hero/(?!yeni$)${ID}`, "content"],
  [`/admin/magaza-hero/(?!yeni$)${ID}`, "shopHero"],
  [`/admin/mobil/slaytlar/(?!yeni$)${ID}`, "mobileApp"],
  [`/admin/promosyon/(?!yeni$)${ID}`, "promos"],
  [`/admin/bulten/kampanya/(?!yeni$)${ID}`, "newsletter"],
  [`/admin/masalar/(?!yeni$|yazdir$)${ID}`, "tables"],
  [`/admin/mobil/gonderiler/(?!yeni$)${ID}`, "mobileApp"],
  [`/admin/mobil/duyurular/(?!yeni$)${ID}`, "mobileApp"],
].map(([path, section]) => ({
  re: new RegExp(`^${path}$`),
  section: section as AdminSection,
}));

/** The section a record page needs, or null when the list may not keep it. */
export function recentSection(pathname: string): AdminSection | null {
  if (typeof pathname !== "string") return null;
  for (const place of RECENT_PLACES) {
    if (place.re.test(pathname)) return place.section;
  }
  return null;
}

/**
 * The panel's own titles for a page that is not the record: the 404 and
 * the error screen draw their h1 at a record's address.
 */
const NOT_A_RECORD = new Set([
  "Bu sayfa ya da kayıt bulunamadı.",
  "Bu ekran yüklenemedi.",
]);

/**
 * A clock time ("20:00", "9:30"), with what comes before it. No phone is
 * written with a colon, and a karaoke booking's heading carries two
 * ("19 Ekim 2026, 20:00 - 22:00"): once the marks go, the year and both
 * times read as twelve digits in a row.
 */
const CLOCK = /(^|[^\p{Nd}])\p{Nd}{1,2}:\p{Nd}{2}(?!\p{Nd})/gu;

/**
 * Whether a title names a person by contact: piiLike (an "@", or seven
 * digits once a phone's usual separators go), and, stricter because this
 * text is kept, seven digits once every mark that is not a letter goes
 * ("0532/123/45/67", "0532_123_45_67", Arabic-Indic digits). Clock times
 * are taken out first. A date written as digits is refused too; that only
 * costs a convenience.
 */
export function personalTitle(text: string): boolean {
  if (piiLike(text)) return true;
  const bare = text
    .normalize("NFKC")
    .replace(CLOCK, "$1 ")
    .replace(/[^\p{L}\p{Nd}]/gu, "");
  return /\p{Nd}{7,}/u.test(bare);
}

/**
 * The list's label for a record page: its first heading, on one line, at
 * most 60 characters. Null when there is none, when it is an error
 * screen's, or when it looks personal.
 */
export function recentLabel(text: string | null | undefined): string | null {
  const line = (text ?? "").replace(/\s+/g, " ").trim();
  if (!line || NOT_A_RECORD.has(line) || personalTitle(line)) return null;
  return line.length > RECENT_LABEL_MAX
    ? `${line.slice(0, RECENT_LABEL_MAX - 1).trimEnd()}…`
    : line;
}

export interface RecentEntry {
  href: string;
  label: string;
}

/** An entry the list may hold, as kept (label trimmed), or null. */
function cleanEntry(value: unknown): RecentEntry | null {
  if (typeof value !== "object" || value === null) return null;
  const { href, label } = value as { href?: unknown; label?: unknown };
  if (typeof href !== "string" || typeof label !== "string") return null;
  if (!recentSection(href)) return null;
  const kept = recentLabel(label);
  return kept ? { href, label: kept } : null;
}

/**
 * The stored list, read back through the same rules it was written with:
 * a hand-edited or older entry outside them is dropped, not shown.
 */
export function parseRecents(raw: string | null): RecentEntry[] {
  if (!raw) return [];
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(value)) return [];
  const out: RecentEntry[] = [];
  for (const item of value) {
    const entry = cleanEntry(item);
    if (entry && !out.some((e) => e.href === entry.href)) out.push(entry);
    if (out.length === RECENT_MAX) break;
  }
  return out;
}

/**
 * The list after opening `href` titled `title`: newest first, one entry
 * per page, at most eight. Unchanged when the page or its title may not be
 * kept.
 */
export function addRecent(
  list: readonly RecentEntry[],
  href: string,
  title: string | null | undefined,
): RecentEntry[] {
  const entry = cleanEntry({ href, label: title ?? "" });
  if (!entry) return [...list];
  return [entry, ...list.filter((e) => e.href !== href)].slice(0, RECENT_MAX);
}

/**
 * What the palette shows of the list for this role, now: each entry's
 * section is asked again (a role can change under a session; the list is
 * per account, not per role), and the page the operator is on is left out.
 */
export function visibleRecents(
  list: readonly RecentEntry[],
  role: AdminRole | null | undefined,
  currentPath?: string,
): RecentEntry[] {
  if (!role) return [];
  return list.filter((e) => {
    const section = recentSection(e.href);
    return (
      section !== null &&
      canAccess(section, role) &&
      recentLabel(e.label) !== null &&
      e.href !== currentPath
    );
  });
}

// ── Komutlar ──────────────────────────────────────────────────────────────

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
