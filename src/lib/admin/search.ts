import "server-only";

import { getDb, TABLES, type DbError } from "@/lib/db";
import { raiseDbError } from "@/lib/db/health";
import type { AnyOfCondition, FoldLikeValue } from "@/lib/db/sql";
import { KARAOKE_STATUS_LABELS } from "@/lib/mobile/karaoke-core";
import {
  formatReservationDate,
  formatReservationTime,
} from "@/lib/mobile/karaoke-format";

import { escapeLike } from "./order-filters";
import { orderStatusLabel } from "./order-ui";
import { canAccess, type AdminRole, type AdminSection } from "./roles";
import type { AdminOrderStatus } from "./store";
import { TR_FOLD_SQL_FROM, TR_FOLD_SQL_TO } from "./text-fold";

/**
 * The panel's one search box (P2b, decision D36): an order by number,
 * e-mail, name or phone; a member; a product; a menu item; a karaoke
 * booking by its code. Read-only, at most SEARCH_LIMIT rows a section, and
 * no index of its own: each section is one query, and a substring search
 * reads its table once.
 *
 * Every section is gated by the section the role may open, so the box
 * never shows a staff member what their own lists would not (orders carry
 * a name and an e-mail, members a phone). A role with none of them gets no
 * query at all.
 *
 * Text matches are folded the Turkish way on BOTH sides in SQL
 * (`foldLike`: ILIKE alone misses "İsmail" for "ismail", "IRMAK" for
 * "ırmak").
 */

/** Rows shown per section; one more is read to know there are more. */
export const SEARCH_LIMIT = 5;

/** A search shorter than this is not run: two letters match half the shop. */
export const SEARCH_MIN_LENGTH = 2;

/** What the box keeps of a long paste. */
const SEARCH_MAX_LENGTH = 80;

export type SearchSection =
  "orders" | "customers" | "products" | "menu" | "karaoke";

const SECTION_LABELS: Record<SearchSection, string> = {
  orders: "Siparişler",
  customers: "Müşteriler",
  products: "Ürünler",
  menu: "Menü",
  karaoke: "Karaoke",
};

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

export function parseSearch(raw: unknown): ParsedSearch | null {
  if (typeof raw !== "string") return null;
  const text = raw.trim().slice(0, SEARCH_MAX_LENGTH);
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
  /** The section's own list, searching the same text, where it has a box. */
  listHref: string | null;
}

/** Turkish fold, on the column and on the pattern alike. */
function folded(column: string, pattern: string): AnyOfCondition {
  const value: FoldLikeValue = {
    pattern,
    from: TR_FOLD_SQL_FROM,
    to: TR_FOLD_SQL_TO,
  };
  return { column, op: "foldLike", value };
}

/** A phone column compared as digits: spaces, brackets, dashes, + dropped. */
function phoneDigits(column: string, digits: string): AnyOfCondition {
  const value: FoldLikeValue = {
    pattern: `%${digits}%`,
    from: " ()+.-",
    to: "",
  };
  return { column, op: "foldLike", value };
}

function rows<T>(
  res: { data: T[] | null; error: DbError | null; status: number },
  ctx: string,
): T[] {
  if (res.error) raiseDbError(ctx, res.error, res.status);
  return res.data ?? [];
}

const READ = SEARCH_LIMIT + 1;

interface OrderRow {
  id: string;
  orderNo: number;
  customerName: string;
  customerEmail: string;
  status: AdminOrderStatus;
  fulfillment?: string;
  totalMinor: number;
  createdAt: string;
}

async function searchOrders(q: ParsedSearch): Promise<SearchHit[]> {
  const conditions: AnyOfCondition[] = [
    folded("customerName", q.pattern),
    folded("customerEmail", q.pattern),
  ];
  if (q.orderNo !== null) {
    conditions.unshift({ column: "orderNo", op: "eq", value: q.orderNo });
  }
  if (q.phone) conditions.push(phoneDigits("customerPhone", q.phone));
  const found = rows<OrderRow>(
    await getDb()
      .from(TABLES.orders)
      .select(
        "id, orderNo, customerName, customerEmail, status, fulfillment, totalMinor, createdAt",
      )
      .anyOf(conditions)
      .order("orderNo", { ascending: false })
      .limit(READ),
    "search.orders",
  );
  // The order the number names first, whatever its age.
  found.sort(
    (a, b) => Number(b.orderNo === q.orderNo) - Number(a.orderNo === q.orderNo),
  );
  return found.map((o) => ({
    href: `/admin/siparisler/${encodeURIComponent(o.id)}`,
    title: `#${o.orderNo} · ${o.customerName || o.customerEmail || "Adsız"}`,
    meta: [orderStatusLabel(o)],
    amountMinor: o.totalMinor,
    at: o.createdAt,
  }));
}

interface CustomerRow {
  email: string;
  name: string;
}

/** The address a closed account is left with (lib/mobile/me.ts). */
const CLOSED_ACCOUNT = /@anon\.local$/i;

async function searchCustomers(q: ParsedSearch): Promise<SearchHit[]> {
  const conditions: AnyOfCondition[] = [
    folded("name", q.pattern),
    folded("email", q.pattern),
  ];
  if (q.phone) conditions.push(phoneDigits("phone", q.phone));
  const found = rows<CustomerRow>(
    await getDb()
      .from(TABLES.customers)
      .select("email, name")
      .anyOf(conditions)
      .order("createdAt", { ascending: false })
      .limit(READ),
    "search.customers",
  );
  // A closed account keeps a placeholder address and nothing else (D13).
  return found
    .filter((c) => !CLOSED_ACCOUNT.test(c.email))
    .map((c) => ({
      href: `/admin/musteriler/${encodeURIComponent(c.email)}`,
      title: c.name || c.email,
      meta: c.name ? [c.email] : [],
    }));
}

interface ProductRow {
  id: string;
  name: string;
  sku: string;
  isActive: boolean;
  priceMinor: number;
}

async function searchProducts(q: ParsedSearch): Promise<SearchHit[]> {
  const found = rows<ProductRow>(
    await getDb()
      .from(TABLES.products)
      .select("id, name, sku, isActive, priceMinor")
      .anyOf([
        folded("name", q.pattern),
        folded("sku", q.pattern),
        folded("id", q.pattern),
      ])
      .order("name", { ascending: true })
      .limit(READ),
    "search.products",
  );
  return found.map((p) => ({
    href: `/admin/urunler/${encodeURIComponent(p.id)}/duzenle`,
    title: p.name || p.id,
    meta: [p.sku ? `SKU ${p.sku}` : "", p.isActive ? "" : "Pasif"].filter(
      Boolean,
    ),
    amountMinor: p.priceMinor,
  }));
}

interface MenuRow {
  id: string;
  name: string;
  isActive: boolean;
  priceMinor: number;
}

async function searchMenu(q: ParsedSearch): Promise<SearchHit[]> {
  const found = rows<MenuRow>(
    await getDb()
      .from(TABLES.menuItems)
      .select("id, name, isActive, priceMinor")
      .anyOf([folded("name", q.pattern), folded("id", q.pattern)])
      .order("name", { ascending: true })
      .limit(READ),
    "search.menu",
  );
  return found.map((m) => ({
    href: `/admin/menu/${encodeURIComponent(m.id)}/duzenle`,
    title: m.name || m.id,
    meta: m.isActive ? [] : ["Pasif"],
    amountMinor: m.priceMinor,
  }));
}

interface KaraokeRow {
  id: string;
  customerName: string;
  date: string;
  startHour: number;
  hours: number;
  status: keyof typeof KARAOKE_STATUS_LABELS;
}

/** By its code only: a name search is the karaoke page's own box. */
async function searchKaraoke(q: ParsedSearch): Promise<SearchHit[] | null> {
  if (!q.karaokeId) return null;
  const found = rows<KaraokeRow>(
    await getDb()
      .from(TABLES.karaokeReservations)
      .select("id, customerName, date, startHour, hours, status")
      .eq("id", q.karaokeId)
      .limit(1),
    "search.karaoke",
  );
  return found.map((r) => ({
    href: `/admin/mobil/karaoke/${encodeURIComponent(r.id)}`,
    title: `${r.id.toUpperCase()} · ${r.customerName || "Adsız"}`,
    meta: [
      `${formatReservationDate(r.date)} ${formatReservationTime(r.startHour, r.hours)}`,
      KARAOKE_STATUS_LABELS[r.status] ?? r.status,
    ],
  }));
}

const RUN: Record<
  SearchSection,
  (q: ParsedSearch) => Promise<SearchHit[] | null>
> = {
  orders: searchOrders,
  customers: searchCustomers,
  products: searchProducts,
  menu: searchMenu,
  karaoke: searchKaraoke,
};

function listHref(section: SearchSection, text: string): string | null {
  const q = encodeURIComponent(text);
  switch (section) {
    case "orders":
      return `/admin/siparisler?q=${q}`;
    case "customers":
      return `/admin/musteriler?q=${q}`;
    case "products":
      return `/admin/urunler?q=${q}`;
    case "karaoke":
      return `/admin/mobil/karaoke?q=${q}`;
    default:
      return null;
  }
}

/**
 * Every section this role may open, searched at once. A section that does
 * not apply to the text (karaoke, unless it is a booking code) is left out;
 * one that ran and found nothing is kept, with no hits.
 */
export async function searchAdmin(
  q: ParsedSearch,
  role: AdminRole,
): Promise<SearchGroup[]> {
  const sections = searchSectionsFor(role);
  const answers = await Promise.all(sections.map((s) => RUN[s](q)));
  const groups: SearchGroup[] = [];
  sections.forEach((section, i) => {
    const hits = answers[i];
    if (!hits) return;
    groups.push({
      section,
      label: SECTION_LABELS[section],
      hits: hits.slice(0, SEARCH_LIMIT),
      more: hits.length > SEARCH_LIMIT,
      listHref: listHref(section, q.text),
    });
  });
  return groups;
}
