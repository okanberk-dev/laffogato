import "server-only";

import { getDb, TABLES, type DbError } from "@/lib/db";
import { raiseDbError } from "@/lib/db/health";
import type { AnyOfCondition, FoldLikeValue } from "@/lib/db/sql";
import { KARAOKE_STATUS_LABELS } from "@/lib/mobile/karaoke-core";
import {
  formatReservationDate,
  formatReservationTime,
} from "@/lib/mobile/karaoke-format";

import { orderStatusLabel } from "./order-ui";
import type { AdminRole } from "./roles";
import {
  SEARCH_LIMIT,
  searchSectionsFor,
  type ParsedSearch,
  type SearchGroup,
  type SearchHit,
  type SearchSection,
} from "./search-core";
import type { AdminOrderStatus } from "./store";
import { TR_FOLD_SQL_FROM, TR_FOLD_SQL_TO } from "./text-fold";

// The pure half (constants, the box's parsing, the role gate, the shapes)
// is client-safe in search-core.ts; re-exported for the server callers.
export {
  SEARCH_LIMIT,
  SEARCH_MIN_LENGTH,
  parseSearch,
  searchSectionsFor,
  type ParsedSearch,
  type SearchGroup,
  type SearchHit,
  type SearchSection,
} from "./search-core";

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

const SECTION_LABELS: Record<SearchSection, string> = {
  orders: "Siparişler",
  customers: "Müşteriler",
  products: "Ürünler",
  menu: "Menü",
  karaoke: "Karaoke",
};

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

/**
 * The section's own list, for "more than five". Never with the text in
 * the address (`?q=`): see ADMIN_SEARCH_PATH.
 */
const LIST_HREF: Record<SearchSection, string> = {
  orders: "/admin/siparisler",
  customers: "/admin/musteriler",
  products: "/admin/urunler",
  menu: "/admin/menu",
  karaoke: "/admin/mobil/karaoke",
};

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
      listHref: LIST_HREF[section],
    });
  });
  return groups;
}
