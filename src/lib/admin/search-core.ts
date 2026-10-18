// Client-safe (no server-only): the panel search's rules and shapes. The
// database half is lib/admin/search.ts; the box and the results page are
// client components and read the constants and types from here.

import { escapeLike } from "./order-filters";
import { canAccess, type AdminRole, type AdminSection } from "./roles";

/** Rows shown per section; one more is read to know there are more. */
export const SEARCH_LIMIT = 5;

/** A search shorter than this is not run: two letters match half the shop. */
export const SEARCH_MIN_LENGTH = 2;

/** What the box keeps of a long paste. */
export const SEARCH_MAX_LENGTH = 80;

/**
 * The results page. The box posts to it (a Server Action with this page as
 * its permalink), never `?q=`: what is typed is an e-mail or a phone as
 * often as an order number, and an address keeps it in the browser's
 * history, a proxy's log and the host's request log.
 */
export const ADMIN_SEARCH_PATH = "/admin/ara";

export type SearchSection =
  "orders" | "customers" | "products" | "menu" | "karaoke";

/** The role section each search section needs (roles.ts). */
const SECTION_GATE: Record<SearchSection, AdminSection> = {
  orders: "orders",
  customers: "customers",
  products: "products",
  menu: "menu",
  karaoke: "karaoke",
};

const SEARCH_ORDER: readonly SearchSection[] = [
  "orders",
  "customers",
  "karaoke",
  "products",
  "menu",
];

/** The sections this role's search covers, in the order they are shown. */
export function searchSectionsFor(role: AdminRole): SearchSection[] {
  return SEARCH_ORDER.filter((s) => canAccess(SECTION_GATE[s], role));
}

/** The box's text, read once into what each section looks for. */
export interface ParsedSearch {
  /** What the operator typed, trimmed and capped: shown back as typed. */
  text: string;
  /** `%…%` with LIKE's wildcards escaped. */
  pattern: string;
  /** "10234" or "#10234". */
  orderNo: number | null;
  /** A phone number's national digits ("0532 123 45 67" -> "5321234567"). */
  phone: string | null;
  /** "KRK-00042", "krk42" or "42" as the booking's id. */
  karaokeId: string | null;
}

/** The box's text as the search keeps it: trimmed, at most 80 characters. */
export function searchText(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().slice(0, SEARCH_MAX_LENGTH) : "";
}

export function parseSearch(raw: unknown): ParsedSearch | null {
  if (typeof raw !== "string") return null;
  const text = searchText(raw);
  if (text.length < SEARCH_MIN_LENGTH) return null;
  const order = /^#\s*(\d{1,9})$|^(\d{1,9})$/.exec(text);
  const orderNo = order ? Number(order[1] ?? order[2]) : null;
  // Seven digits at least: an order number (five) is not read as a phone.
  const digits = text.replace(/\D/g, "").replace(/^(?:90|0)/, "");
  const phone =
    /^[\d\s()+.-]+$/.test(text) && digits.length >= 7 ? digits : null;
  const code = /^(?:krk-?)?0*(\d{1,12})$/i.exec(text);
  const karaokeId = code ? `krk-${code[1].padStart(5, "0")}` : null;
  return {
    text,
    pattern: `%${escapeLike(text)}%`,
    orderNo: orderNo && orderNo > 0 ? orderNo : null,
    phone,
    karaokeId,
  };
}

export interface SearchHit {
  href: string;
  title: string;
  /** Short facts after the title: a status, a SKU, an e-mail. */
  meta: string[];
  amountMinor?: number;
  /** An ISO instant the page writes on the Istanbul clock. */
  at?: string;
}

export interface SearchGroup {
  section: SearchSection;
  label: string;
  hits: SearchHit[];
  /** More rows matched than are shown. */
  more: boolean;
  /** The section's own list. Without the text: no query in an address. */
  listHref: string;
}

/**
 * The search Server Action's answer (app/admin/ara/actions.ts), and what
 * the results page draws. `groups` is null until a search ran.
 */
export interface AdminSearchState {
  /** What was searched, as kept (searchText). */
  text: string;
  groups: SearchGroup[] | null;
  /** Something was typed, but less than SEARCH_MIN_LENGTH. */
  tooShort: boolean;
  /** The database did not answer: nothing is known, not "no results". */
  failed: boolean;
}

export const INITIAL_SEARCH_STATE: AdminSearchState = {
  text: "",
  groups: null,
  tooShort: false,
  failed: false,
};
