// Client-safe (no server-only), pure: the panel's single-key shortcuts
// (admin UI v2, UI-8, design §4.4, decision D7). Which key does what, for
// whom, on which page, and when a key is left alone. The shell's listener
// (components/admin/shortcuts.tsx) reads the page and hands the facts in;
// tests/admin-shortcuts.test.ts runs every rule here, in node. ⌘K / Ctrl K
// is the palette's own key (palette-shell.ts) and works everywhere.

import { canAccess, type AdminRole, type AdminSection } from "./roles";

/** How long `g` waits for its second key. */
export const G_SEQUENCE_MS = 1500;

/** `g` and a second key: the page it opens and the section that page asks for. */
export interface GoShortcut {
  /** The second key, as typed and lowered the Turkish way. */
  readonly key: string;
  readonly href: string;
  /** The nav label (one name per thing). */
  readonly label: string;
  readonly section: AdminSection;
}

/**
 * `g` then a letter. Each letter starts the page's name (Kasa is `d`, for
 * "damga"). Nothing is bound to `i` or `ı`: they are two keys on a
 * Turkish-Q keyboard, and Caps Lock's "I" lowers the Turkish way to "ı",
 * so neither would mean the same on every keyboard.
 */
export const GO_SHORTCUTS: readonly GoShortcut[] = [
  { key: "b", href: "/admin", label: "Genel bakış", section: "dashboard" },
  {
    key: "s",
    href: "/admin/siparisler",
    label: "Siparişler",
    section: "orders",
  },
  {
    key: "k",
    href: "/admin/mobil/karaoke",
    label: "Karaoke",
    section: "karaoke",
  },
  { key: "d", href: "/admin/kasa", label: "Kasa", section: "till" },
  { key: "m", href: "/admin/menu", label: "Kafe menüsü", section: "menu" },
  { key: "u", href: "/admin/urunler", label: "Ürünler", section: "products" },
  { key: "r", href: "/admin/raporlar", label: "Raporlar", section: "reports" },
];

/**
 * The second key of a `g` sequence may come with or without its marks:
 * `g ü` is `g u`, `g ş` is `g s`. Only the second key: the ğ key next to P
 * never starts a sequence.
 */
const SECOND_KEY: ReadonlyMap<string, string> = new Map([
  ["ü", "u"],
  ["ç", "c"],
  ["ş", "s"],
  ["ö", "o"],
  ["ğ", "g"],
]);

/** A key that is only a modifier: pressed between `g` and its letter, it waits. */
const MODIFIER_KEYS = new Set([
  "shift",
  "control",
  "alt",
  "altgraph",
  "meta",
  "capslock",
  "os",
  "fn",
]);

/** The key as typed (`event.key`), lowered the Turkish way: Caps Lock's "N" is n. */
export function typedKey(key: unknown): string {
  return typeof key === "string" ? key.toLocaleLowerCase("tr-TR") : "";
}

/**
 * The roles with single keys. Not the cashier: one page, the Kasa, where
 * typed and scanned codes arrive. A role added later gets none until it is
 * named here.
 */
export function singleKeysForRole(
  role: AdminRole | null | undefined,
): role is AdminRole {
  return role === "owner" || role === "manager" || role === "staff";
}

/** The Kasa: a scanner types its codes as keys, often outside any field. */
export function isTillPath(pathname: string): boolean {
  return pathname === "/admin/kasa" || pathname.startsWith("/admin/kasa/");
}

/** Whether single keys work for this role on this page with this switch. */
export function singleKeysActive({
  role,
  pathname,
  enabled,
}: {
  role: AdminRole | null | undefined;
  pathname: string;
  enabled: boolean;
}): boolean {
  return enabled && singleKeysForRole(role) && !isTillPath(pathname);
}

/** The `g` pages this role may open, in the sheet's order. */
export function goShortcutsFor(
  role: AdminRole | null | undefined,
): GoShortcut[] {
  if (!singleKeysForRole(role)) return [];
  return GO_SHORTCUTS.filter((g) => canAccess(g.section, role));
}

/** The page `g` and this second key open for the role, or null. */
export function goTarget(
  key: string,
  role: AdminRole | null | undefined,
): GoShortcut | null {
  const k = SECOND_KEY.get(key) ?? key;
  return goShortcutsFor(role).find((g) => g.key === k) ?? null;
}

/**
 * Whether the element takes typing: a field, a dropdown (it types ahead
 * too) or contenteditable. A key there is the operator's text.
 */
export function typingTarget(
  el: { tagName?: string; isContentEditable?: boolean } | null | undefined,
): boolean {
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = typeof el.tagName === "string" ? el.tagName.toUpperCase() : "";
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/** A keydown, as much of it as the rules read. */
export interface ShortcutKey {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  /** AltGr where the system reports it apart: getModifierState("AltGraph"). */
  altGraph?: boolean;
  isComposing?: boolean;
  repeat?: boolean;
  defaultPrevented?: boolean;
  isTrusted?: boolean;
}

/** What the listener read on the page when the key came. */
export interface ShortcutFacts {
  role: AdminRole | null | undefined;
  pathname: string;
  /** The user menu's "Tek tuş kısayolları" (per browser, on by default). */
  enabled: boolean;
  /** Focus is in a field that takes typing (typingTarget). */
  typing: boolean;
  /** Some <dialog> is open: the palette, a modal, the drawer, the sheet. */
  dialogOpen: boolean;
  /** The key's time in ms (event.timeStamp), for the `g` window. */
  now: number;
}

/** Why a key is left alone. */
export type ShortcutSkip =
  | "synthetic"
  | "off"
  | "taken"
  | "composing"
  | "modifier"
  | "typing"
  | "dialog";

/**
 * Why this key is not a shortcut, or null when it may be one:
 * - a key a script sent (React Aria re-sends the palette's keys);
 * - single keys are off: the switch, the cashier, the Kasa;
 * - a control on the page already handled it;
 * - an IME is composing (or the key is its "Process" placeholder);
 * - with ⌘, Ctrl or Alt, AltGr included (Ctrl+Alt on Windows types @, €
 *   and { on Turkish-Q). Shift is allowed: "?" needs it, and so does "/"
 *   on Turkish-Q (Shift+7), where `event.key` already says which;
 * - focus is in a field;
 * - a dialog is open.
 */
export function shortcutSkip(
  e: ShortcutKey,
  f: Omit<ShortcutFacts, "now">,
): ShortcutSkip | null {
  if (e.isTrusted === false) return "synthetic";
  if (!singleKeysActive(f)) return "off";
  if (e.defaultPrevented) return "taken";
  if (e.isComposing || e.key === "Process") return "composing";
  if (e.metaKey || e.ctrlKey || e.altKey || e.altGraph) return "modifier";
  if (f.typing) return "typing";
  if (f.dialogOpen) return "dialog";
  return null;
}

export type ShortcutCommand =
  /** `/`: the list's lead search box, or the palette when there is none. */
  | { kind: "search" }
  /** `n`: the page's primary link, or the palette's Oluştur. */
  | { kind: "new" }
  /** `?`: the shortcut sheet. */
  | { kind: "sheet" }
  /** `g` and a letter: a page. */
  | { kind: "go"; href: string };

/** The listener's memory between keys: when `g` was pressed. */
export interface ShortcutState {
  readonly gAt: number | null;
}

export const SHORTCUT_IDLE: ShortcutState = { gAt: null };

export interface ShortcutStep {
  state: ShortcutState;
  command: ShortcutCommand | null;
  /** The key was the panel's: its default (Firefox's quick find on "/") is prevented. */
  handled: boolean;
}

const COMMANDS: ReadonlyMap<string, ShortcutCommand> = new Map([
  ["/", { kind: "search" }],
  ["n", { kind: "new" }],
  ["?", { kind: "sheet" }],
]);

/**
 * One keydown through the rules. After `g`, a letter that names a page the
 * role may open goes there if it comes within 1.5 s; any other key (a page
 * the role may not open, a late letter) is read on its own, so `g` then
 * `/` still searches. A skipped key forgets a waiting `g`; a held key's
 * repeats and a lone modifier change nothing.
 */
export function readShortcut(
  state: ShortcutState,
  e: ShortcutKey,
  f: ShortcutFacts,
): ShortcutStep {
  if (shortcutSkip(e, f)) {
    return { state: SHORTCUT_IDLE, command: null, handled: false };
  }
  const key = typedKey(e.key);
  if (e.repeat || MODIFIER_KEYS.has(key)) {
    return { state, command: null, handled: false };
  }
  if (
    state.gAt !== null &&
    f.now >= state.gAt &&
    f.now - state.gAt <= G_SEQUENCE_MS
  ) {
    const target = goTarget(key, f.role);
    if (target) {
      return {
        state: SHORTCUT_IDLE,
        command: { kind: "go", href: target.href },
        handled: true,
      };
    }
  }
  if (key === "g") {
    return { state: { gAt: f.now }, command: null, handled: true };
  }
  const command = COMMANDS.get(key) ?? null;
  return { state: SHORTCUT_IDLE, command, handled: command !== null };
}

/** The palette's own keys, as its trigger announces them. */
export const PALETTE_KEYSHORTCUTS = "Meta+K Control+K";

/**
 * `aria-keyshortcuts` for the page's controls while single keys work
 * (null: none). Written by the shell's listener, not drawn by the server:
 * a key that is off (the switch, the cashier, the Kasa, no JavaScript)
 * must not be announced. `/` sits on the list's search box, or on the
 * palette's trigger when the page has none; `n` on the page's primary link.
 */
export function shortcutHints(
  active: boolean,
  page: { hasSearch: boolean },
): { search: string | null; newLink: string | null; trigger: string } {
  return {
    search: active ? "/" : null,
    newLink: active ? "n" : null,
    trigger:
      active && !page.hasSearch
        ? `${PALETTE_KEYSHORTCUTS} /`
        : PALETTE_KEYSHORTCUTS,
  };
}
