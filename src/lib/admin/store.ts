import "server-only";

import {
  MENU as SEED_MENU,
  PRODUCTS as SEED_PRODUCTS,
  type MenuCategory as DesignMenuCategory,
  type Product as DesignProduct,
} from "@/components/laffogato/data";

import type { WeeklyHours } from "./days";

/**
 * In-memory mutable store for the admin panel.
 *
 * Why: Supabase is not yet connected (the free-tier project limit was hit).
 * This store seeds from the design's hardcoded data and lets the admin
 * panel demonstrate full CRUD locally. It DOES NOT PERSIST across server
 * restarts or across serverless invocations.
 *
 * When Supabase comes online, swap the function bodies to hit the DB —
 * the call sites in admin pages already use the async interface.
 */

export type ShopCategoryId = "beans" | "gift" | "gear" | "merch" | "pantry";

export interface AdminProductVariant {
  id: string;
  name: string;
  /** Delta on top of the parent product's priceMinor. Can be negative. */
  priceDeltaMinor: number;
  stock: number;
  sku: string;
  isActive: boolean;
}

export interface AdminProduct {
  id: string;
  name: string;
  slug: string;
  sku: string;
  tag: string;
  /** Minor units (kuruş) — e.g. 32000 = 320,00 ₺ */
  priceMinor: number;
  /** Optional "was" price for striked-out display. 0 = none. */
  compareAtPriceMinor: number;
  /** Internal cost (margin calc); not shown to customers. */
  costMinor: number;
  desc: string;
  cat: ShopCategoryId;
  /** Hue token from PhotoSurface palette (cream, caramel, matcha, ...). */
  img: string;
  /** External image URLs (gallery). The customer card uses the first one
   *  if present, otherwise falls back to the SVG hue tile. */
  images: string[];
  stock: number;
  lowStockThreshold: number;
  /** Approximate shipping weight in grams. */
  weightGrams: number;
  featured: boolean;
  isNew: boolean;
  isActive: boolean;
  seoTitle: string;
  seoDescription: string;
  variants: AdminProductVariant[];
  updatedAt: string;
}

export interface AdminCategory {
  id: string;
  slug: ShopCategoryId;
  label: string;
  icon: string;
  sortOrder: number;
}

export type AdminOrderItemStatus = "pending" | "ready" | "cancelled";

export interface AdminOrderItem {
  productName: string;
  qty: number;
  unitPriceMinor: number;
  status: AdminOrderItemStatus;
}

export type AdminOrderStatus =
  | "pending_payment"
  | "paid"
  | "preparing"
  | "shipped"
  | "completed"
  | "cancelled"
  | "refunded";

export interface AdminRefund {
  id: string;
  amountMinor: number;
  reason: string;
  createdAt: string;
}

export interface AdminOrder {
  id: string;
  orderNo: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  internalNote: string;
  status: AdminOrderStatus;
  items: AdminOrderItem[];
  subtotalMinor: number;
  /** Positive minor units; 0 when no promo. */
  discountMinor: number;
  /** Promo code applied at checkout; empty when none. */
  promoCode: string;
  shippingMinor: number;
  totalMinor: number;
  refunds: AdminRefund[];
  createdAt: string;
}

export type { DayOfWeek, OpeningHour, WeeklyHours } from "./days";
export { DAYS_OF_WEEK, DAY_LABELS } from "./days";

export interface AdminSettings {
  name: string;
  tagline: string;
  phone: string;
  email: string;
  address: string;
  /** Legacy single-line display string (kept for footer back-compat). */
  openingHours: string;
  isShopOpen: boolean;
  heroImageUrl: string;

  /** Per-day open/close used by Visit page + footer table. */
  weeklyHours: WeeklyHours;

  /** Tax (VAT) percentage applied to subtotals at checkout. */
  taxRatePct: number;

  /** Flat shipping fee in minor units; suppressed above threshold. */
  shippingFlatMinor: number;
  shippingFreeThresholdMinor: number;

  /** SEO defaults. */
  seoTitle: string;
  seoOgImageUrl: string;
  /** When false, robots noindex headers are emitted (sitemap suppressed). */
  seoIndexable: boolean;

  /** Operational notifications email. */
  notificationEmail: string;
}

function parsePrice(price: string): number {
  // "320₺" → 32000 (minor units)
  const numeric = parseFloat(price.replace(/[^\d.,-]/g, "").replace(",", "."));
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric * 100);
}

function slugifyId(prefix: string, n: number): string {
  return `${prefix}-${String(n).padStart(4, "0")}`;
}

const TR_DIACRITICS: Record<string, string> = {
  ç: "c", Ç: "c",
  ğ: "g", Ğ: "g",
  ı: "i", I: "i",
  i̇: "i", İ: "i",
  ö: "o", Ö: "o",
  ş: "s", Ş: "s",
  ü: "u", Ü: "u",
};

export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[çÇğĞıIİöÖşŞüÜ]/g, (c) => TR_DIACRITICS[c] ?? c)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function deriveSku(name: string, n: number): string {
  const prefix = name
    .replace(/[^A-Za-z0-9]+/g, "")
    .slice(0, 4)
    .toUpperCase()
    .padEnd(4, "X");
  return `${prefix}-${String(n).padStart(5, "0")}`;
}

const products: AdminProduct[] = SEED_PRODUCTS.map((p, i) => ({
  id: slugifyId("prd", i + 1),
  name: p.name,
  slug: slugify(p.name) || `urun-${i + 1}`,
  sku: deriveSku(p.name, i + 1),
  tag: p.tag,
  priceMinor: parsePrice(p.price),
  compareAtPriceMinor: 0,
  costMinor: 0,
  desc: p.desc,
  cat: p.cat as ShopCategoryId,
  img: p.img,
  images: [],
  stock: 25,
  lowStockThreshold: 5,
  weightGrams: 250,
  featured: Boolean(p.featured),
  isNew: Boolean(p.isNew),
  isActive: true,
  seoTitle: "",
  seoDescription: "",
  variants: [],
  updatedAt: new Date().toISOString(),
}));

const categories: AdminCategory[] = [
  { id: slugifyId("cat", 1), slug: "beans", label: "Çekirdek", icon: "◉", sortOrder: 0 },
  { id: slugifyId("cat", 2), slug: "gift", label: "Hediye", icon: "◈", sortOrder: 1 },
  { id: slugifyId("cat", 3), slug: "gear", label: "Ekipman", icon: "◇", sortOrder: 2 },
  { id: slugifyId("cat", 4), slug: "merch", label: "Giyim", icon: "◐", sortOrder: 3 },
  { id: slugifyId("cat", 5), slug: "pantry", label: "Kiler", icon: "◇", sortOrder: 4 },
];

// A handful of demo orders so the orders page isn't empty.
const orders: AdminOrder[] = [
  {
    id: slugifyId("ord", 1),
    orderNo: 10_001,
    customerName: "Ali Yılmaz",
    customerEmail: "ali@example.com",
    customerPhone: "+90 532 111 22 33",
    shippingAddress:
      "Kadıköy Mah. Bağdat Cd. No: 142 Daire 7\nKadıköy / İstanbul 34710",
    internalNote: "",
    status: "preparing",
    items: [
      {
        productName: "Sirena — Espresso Blend",
        qty: 1,
        unitPriceMinor: 32000,
        status: "pending",
      },
      {
        productName: "Edible Cups — 6 Box",
        qty: 1,
        unitPriceMinor: 24000,
        status: "ready",
      },
    ],
    subtotalMinor: 56000,
    discountMinor: 0,
    promoCode: "",
    shippingMinor: 0,
    totalMinor: 56000,
    refunds: [],
    createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
  },
  {
    id: slugifyId("ord", 2),
    orderNo: 10_002,
    customerName: "Merve Kaya",
    customerEmail: "merve@example.com",
    customerPhone: "+90 533 222 33 44",
    shippingAddress: "Etiler Mah. Nispetiye Cd. No: 38\nBeşiktaş / İstanbul 34337",
    internalNote: "Hediye paketi istendi. Kart: 'İyi ki varsın 🤍'",
    status: "paid",
    items: [
      {
        productName: "Affogato Kit — For Two",
        qty: 1,
        unitPriceMinor: 78000,
        status: "pending",
      },
    ],
    subtotalMinor: 78000,
    discountMinor: 0,
    promoCode: "",
    shippingMinor: 0,
    totalMinor: 78000,
    refunds: [],
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: slugifyId("ord", 3),
    orderNo: 10_003,
    customerName: "Deniz Aydın",
    customerEmail: "deniz@example.com",
    customerPhone: "+90 535 444 55 66",
    shippingAddress: "Cihangir Mah. Akarsu Yokuşu No: 22\nBeyoğlu / İstanbul 34433",
    internalNote: "",
    status: "completed",
    items: [
      {
        productName: "Uji Matcha — Ceremonial",
        qty: 1,
        unitPriceMinor: 42000,
        status: "ready",
      },
      {
        productName: "Bambu Chasen",
        qty: 1,
        unitPriceMinor: 32000,
        status: "ready",
      },
    ],
    subtotalMinor: 74000,
    discountMinor: 0,
    promoCode: "",
    shippingMinor: 0,
    totalMinor: 74000,
    refunds: [],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
  },
];

function defaultWeeklyHours(): WeeklyHours {
  return {
    mon: { open: "10:00", close: "23:00", closed: false },
    tue: { open: "10:00", close: "23:00", closed: false },
    wed: { open: "10:00", close: "23:00", closed: false },
    thu: { open: "10:00", close: "23:00", closed: false },
    fri: { open: "10:00", close: "24:00", closed: false },
    sat: { open: "10:00", close: "24:00", closed: false },
    sun: { open: "10:00", close: "23:00", closed: false },
  };
}

let settings: AdminSettings = {
  name: "L'Affogato",
  tagline: "Drink it. Eat the cup.",
  phone: "+90 216 459 30 60",
  email: "maltepe@laffogato.it",
  address: "Maltepe Park AVM, Cevizli, Tugay Yolu Cd. No:67, Maltepe / İstanbul",
  openingHours: "Pzt–Pş 10:00–23:00 · Cu–Ct 10:00–24:00 · Pz 10:00–23:00",
  isShopOpen: true,
  heroImageUrl: "",
  weeklyHours: defaultWeeklyHours(),
  taxRatePct: 20,
  shippingFlatMinor: 4900,
  shippingFreeThresholdMinor: 50000,
  seoTitle: "L'Affogato — Maltepe Park",
  seoOgImageUrl: "",
  seoIndexable: true,
  notificationEmail: "",
};

// ── Products ──────────────────────────────────────────────────────────────

export async function listProducts(): Promise<AdminProduct[]> {
  return [...products];
}

export async function getProduct(id: string): Promise<AdminProduct | null> {
  return products.find((p) => p.id === id) ?? null;
}

export interface ProductInput {
  name: string;
  slug: string;
  sku: string;
  tag: string;
  priceMinor: number;
  compareAtPriceMinor: number;
  costMinor: number;
  desc: string;
  cat: ShopCategoryId;
  img: string;
  images: string[];
  stock: number;
  lowStockThreshold: number;
  weightGrams: number;
  featured: boolean;
  isNew: boolean;
  isActive: boolean;
  seoTitle: string;
  seoDescription: string;
  variants: AdminProductVariant[];
}

function uniqueSlug(candidate: string, ignoreId?: string): string {
  const base = candidate || "urun";
  let attempt = base;
  let n = 1;
  // Uniqueness loop — bounded by product count, so safe.
  while (
    products.some((p) => p.slug === attempt && p.id !== ignoreId)
  ) {
    n += 1;
    attempt = `${base}-${n}`;
  }
  return attempt;
}

export async function createProduct(input: ProductInput): Promise<AdminProduct> {
  const seq = products.length + 1;
  const id = slugifyId("prd", seq);
  const slug = uniqueSlug(input.slug || slugify(input.name) || `urun-${seq}`);
  const sku = input.sku || deriveSku(input.name, seq);
  const product: AdminProduct = {
    ...input,
    id,
    slug,
    sku,
    updatedAt: new Date().toISOString(),
  };
  products.push(product);
  return product;
}

export async function updateProduct(
  id: string,
  input: ProductInput,
): Promise<AdminProduct | null> {
  const idx = products.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  const slug = uniqueSlug(input.slug || slugify(input.name) || products[idx].slug, id);
  products[idx] = {
    ...products[idx],
    ...input,
    slug,
    sku: input.sku || products[idx].sku,
    updatedAt: new Date().toISOString(),
  };
  return products[idx];
}

export async function deleteProduct(id: string): Promise<boolean> {
  const idx = products.findIndex((p) => p.id === id);
  if (idx === -1) return false;
  products.splice(idx, 1);
  return true;
}

export type BulkProductOp =
  | { kind: "delete" }
  | { kind: "activate" }
  | { kind: "deactivate" }
  | { kind: "set_category"; cat: ShopCategoryId };

export interface BulkResult {
  updated: number;
}

export async function bulkUpdateProducts(
  ids: string[],
  op: BulkProductOp,
): Promise<BulkResult> {
  if (ids.length === 0) return { updated: 0 };
  const idSet = new Set(ids);
  const now = new Date().toISOString();
  let updated = 0;

  if (op.kind === "delete") {
    for (let i = products.length - 1; i >= 0; i -= 1) {
      if (idSet.has(products[i].id)) {
        products.splice(i, 1);
        updated += 1;
      }
    }
    return { updated };
  }

  for (let i = 0; i < products.length; i += 1) {
    if (!idSet.has(products[i].id)) continue;
    if (op.kind === "activate") {
      if (!products[i].isActive) {
        products[i] = { ...products[i], isActive: true, updatedAt: now };
        updated += 1;
      }
    } else if (op.kind === "deactivate") {
      if (products[i].isActive) {
        products[i] = { ...products[i], isActive: false, updatedAt: now };
        updated += 1;
      }
    } else if (op.kind === "set_category") {
      if (products[i].cat !== op.cat) {
        products[i] = { ...products[i], cat: op.cat, updatedAt: now };
        updated += 1;
      }
    }
  }
  return { updated };
}

// ── Stock movements ──────────────────────────────────────────────────────

export type StockMoveReason =
  | "order_placed"
  | "manual_adjust"
  | "refund_restock"
  | "seed";

export interface AdminStockMove {
  id: string;
  productId: string;
  productName: string;
  /** Negative for outgoing (sale), positive for incoming (restock/manual). */
  delta: number;
  /** Stock level AFTER this move was applied. */
  stockAfter: number;
  reason: StockMoveReason;
  note: string;
  /** Linked order id (for order_placed / refund_restock). */
  orderId?: string;
  /** Admin email or "system" / "customer". */
  actor: string;
  createdAt: string;
}

const stockMoves: AdminStockMove[] = [];
let stockMoveCounter = 0;

function recordStockMove(input: Omit<AdminStockMove, "id" | "createdAt">): AdminStockMove {
  stockMoveCounter += 1;
  const move: AdminStockMove = {
    id: `mov-${String(stockMoveCounter).padStart(6, "0")}`,
    createdAt: new Date().toISOString(),
    ...input,
  };
  stockMoves.unshift(move);
  if (stockMoves.length > 2000) stockMoves.length = 2000;
  return move;
}

export async function listStockMoves(filter?: {
  productId?: string;
  reason?: StockMoveReason;
  limit?: number;
}): Promise<AdminStockMove[]> {
  let out = stockMoves;
  if (filter?.productId) {
    out = out.filter((m) => m.productId === filter.productId);
  }
  if (filter?.reason) {
    out = out.filter((m) => m.reason === filter.reason);
  }
  return out.slice(0, filter?.limit ?? 500);
}

export interface AdjustStockInput {
  productId: string;
  delta: number;
  note: string;
  actor: string;
}

export type AdjustStockResult =
  | { ok: true; move: AdminStockMove; product: AdminProduct }
  | { ok: false; error: string };

export async function adjustStock(
  input: AdjustStockInput,
): Promise<AdjustStockResult> {
  const idx = products.findIndex((p) => p.id === input.productId);
  if (idx === -1) return { ok: false, error: "Ürün bulunamadı." };
  if (!Number.isFinite(input.delta) || input.delta === 0) {
    return { ok: false, error: "Geçerli bir değer gir (0 olamaz)." };
  }
  const next = products[idx].stock + input.delta;
  if (next < 0) {
    return {
      ok: false,
      error: `Stok eksiye düşemez (mevcut: ${products[idx].stock}).`,
    };
  }
  products[idx] = {
    ...products[idx],
    stock: next,
    updatedAt: new Date().toISOString(),
  };
  const move = recordStockMove({
    productId: products[idx].id,
    productName: products[idx].name,
    delta: input.delta,
    stockAfter: next,
    reason: "manual_adjust",
    note: input.note.trim().slice(0, 500),
    actor: input.actor,
  });
  return { ok: true, move, product: products[idx] };
}

// ── Categories ────────────────────────────────────────────────────────────

export async function listCategories(): Promise<AdminCategory[]> {
  return [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getCategory(id: string): Promise<AdminCategory | null> {
  return categories.find((c) => c.id === id) ?? null;
}

export interface CategoryInput {
  slug: ShopCategoryId;
  label: string;
  icon: string;
  sortOrder: number;
}

export async function createCategory(
  input: CategoryInput,
): Promise<AdminCategory> {
  const id = slugifyId("cat", categories.length + 1);
  const c: AdminCategory = { id, ...input };
  categories.push(c);
  return c;
}

export async function updateCategory(
  id: string,
  input: CategoryInput,
): Promise<AdminCategory | null> {
  const idx = categories.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  categories[idx] = { ...categories[idx], ...input };
  return categories[idx];
}

export async function deleteCategory(id: string): Promise<boolean> {
  const idx = categories.findIndex((c) => c.id === id);
  if (idx === -1) return false;
  categories.splice(idx, 1);
  return true;
}

// ── Orders ────────────────────────────────────────────────────────────────

export async function listOrders(): Promise<AdminOrder[]> {
  return [...orders].sort((a, b) => b.orderNo - a.orderNo);
}

export interface CustomerSummary {
  email: string;
  name: string;
  phone: string;
  orderCount: number;
  lifetimeValueMinor: number;
  refundedMinor: number;
  lastOrderAt: string;
  firstOrderAt: string;
}

/**
 * Pre-groups orders by customer email so the admin "Müşteriler" page
 * (and any future customer-self-service surface) can hit it cheaply.
 * Guest-only orders (no email collected) are filtered out.
 */
export async function listCustomers(): Promise<CustomerSummary[]> {
  const byEmail = new Map<string, CustomerSummary>();
  for (const o of orders) {
    const email = o.customerEmail?.trim().toLowerCase();
    if (!email || email === "guest@laffogato.local") continue;
    const existing = byEmail.get(email);
    const refundedHere = o.refunds.reduce((s, r) => s + r.amountMinor, 0);
    if (!existing) {
      byEmail.set(email, {
        email,
        name: o.customerName,
        phone: o.customerPhone,
        orderCount: 1,
        lifetimeValueMinor: o.totalMinor,
        refundedMinor: refundedHere,
        lastOrderAt: o.createdAt,
        firstOrderAt: o.createdAt,
      });
    } else {
      existing.orderCount += 1;
      existing.lifetimeValueMinor += o.totalMinor;
      existing.refundedMinor += refundedHere;
      if (o.createdAt > existing.lastOrderAt) {
        existing.lastOrderAt = o.createdAt;
        existing.name = o.customerName || existing.name;
        existing.phone = o.customerPhone || existing.phone;
      }
      if (o.createdAt < existing.firstOrderAt) {
        existing.firstOrderAt = o.createdAt;
      }
    }
  }
  return Array.from(byEmail.values()).sort(
    (a, b) => b.lastOrderAt.localeCompare(a.lastOrderAt),
  );
}

export async function customerOrdersByEmail(email: string): Promise<AdminOrder[]> {
  const needle = email.trim().toLowerCase();
  if (!needle) return [];
  return orders
    .filter((o) => o.customerEmail.trim().toLowerCase() === needle)
    .sort((a, b) => b.orderNo - a.orderNo);
}

export async function getOrder(id: string): Promise<AdminOrder | null> {
  return orders.find((o) => o.id === id) ?? null;
}

export async function updateOrderStatus(
  id: string,
  status: AdminOrderStatus,
): Promise<AdminOrder | null> {
  const idx = orders.findIndex((o) => o.id === id);
  if (idx === -1) return null;
  orders[idx] = { ...orders[idx], status };
  return orders[idx];
}

export type BulkOrderOp = { kind: "set_status"; status: AdminOrderStatus };

export async function bulkUpdateOrders(
  ids: string[],
  op: BulkOrderOp,
): Promise<BulkResult> {
  if (ids.length === 0) return { updated: 0 };
  const idSet = new Set(ids);
  let updated = 0;
  for (let i = 0; i < orders.length; i += 1) {
    if (!idSet.has(orders[i].id)) continue;
    if (orders[i].status !== op.status) {
      orders[i] = { ...orders[i], status: op.status };
      updated += 1;
    }
  }
  return { updated };
}

export interface PlaceOrderInput {
  items: Array<{ name: string; priceMinor: number; qty: number }>;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  shippingAddress?: string;
  promoCode?: string;
}

export type PlaceOrderResult =
  | { ok: true; order: AdminOrder }
  | { ok: false; reason: "out_of_stock"; productName: string; available: number };

/**
 * Creates a `pending_payment` order from the customer cart. Real payment
 * flow will mark it as `paid` via the webhook handler. For now we leave
 * it in pending so the admin can manually advance the status.
 *
 * Stock is validated up-front (all items checked before any mutation) and
 * then decremented atomically. The in-memory store runs in a single Node
 * process so there's no race; when this swaps to Supabase the whole thing
 * becomes a transaction.
 */
export async function placeOrder(
  input: PlaceOrderInput,
): Promise<PlaceOrderResult> {
  const cleanItems = input.items.filter(
    (it) => it.qty > 0 && it.priceMinor >= 0,
  );

  // Validate stock for every known product first so we either succeed
  // entirely or fail entirely (no partial decrement).
  for (const it of cleanItems) {
    const product = products.find((p) => p.name === it.name);
    if (product && product.stock < it.qty) {
      return {
        ok: false,
        reason: "out_of_stock",
        productName: product.name,
        available: product.stock,
      };
    }
  }

  // Decrement stock for products we recognise. Unknown product names
  // (e.g. a renamed item still in someone's cart) pass through so the
  // order isn't lost — admin can reconcile manually. We collect the
  // decrements so we can record stock moves once the order id is known.
  const decrements: Array<{ idx: number; qty: number; stockAfter: number }> = [];
  for (const it of cleanItems) {
    const idx = products.findIndex((p) => p.name === it.name);
    if (idx !== -1) {
      const stockAfter = Math.max(0, products[idx].stock - it.qty);
      products[idx] = {
        ...products[idx],
        stock: stockAfter,
        updatedAt: new Date().toISOString(),
      };
      decrements.push({ idx, qty: it.qty, stockAfter });
    }
  }

  const items: AdminOrderItem[] = cleanItems.map((it) => ({
    productName: it.name,
    qty: it.qty,
    unitPriceMinor: it.priceMinor,
    status: "pending",
  }));

  const subtotalMinor = items.reduce(
    (s, it) => s + it.unitPriceMinor * it.qty,
    0,
  );

  const nextNo = orders.length === 0
    ? 10_001
    : Math.max(...orders.map((o) => o.orderNo)) + 1;

  const orderId = slugifyId("ord", orders.length + 1);
  for (const d of decrements) {
    recordStockMove({
      productId: products[d.idx].id,
      productName: products[d.idx].name,
      delta: -d.qty,
      stockAfter: d.stockAfter,
      reason: "order_placed",
      note: `Sipariş #${nextNo}`,
      orderId,
      actor: input.customerEmail ?? "customer",
    });
  }

  // Re-validate promo server-side; never trust a client-supplied discount.
  let promoCode = "";
  let discountMinor = 0;
  if (input.promoCode && input.promoCode.trim()) {
    const promoCheck = await applyPromoCode(input.promoCode, subtotalMinor);
    if (promoCheck.ok) {
      promoCode = promoCheck.promo.code;
      discountMinor = promoCheck.discountMinor;
      await consumePromoUsage(promoCode);
    }
    // Silently ignore an invalid promo at checkout; the cart should have
    // surfaced the error already. We don't fail the order because the
    // code might have expired between the cart preview and submit.
  }

  const totalMinor = Math.max(0, subtotalMinor - discountMinor);

  const order: AdminOrder = {
    id: orderId,
    orderNo: nextNo,
    customerName: input.customerName?.trim() || "Misafir",
    customerEmail: input.customerEmail?.trim() || "guest@laffogato.local",
    customerPhone: input.customerPhone?.trim() ?? "",
    shippingAddress: input.shippingAddress?.trim() ?? "",
    internalNote: "",
    status: "pending_payment",
    items,
    subtotalMinor,
    discountMinor,
    promoCode,
    shippingMinor: 0,
    totalMinor,
    refunds: [],
    createdAt: new Date().toISOString(),
  };
  orders.push(order);
  return { ok: true, order };
}

// ── Order detail operations ──────────────────────────────────────────────

export type OrderTransition =
  | "start_preparing"
  | "mark_shipped"
  | "complete"
  | "cancel"
  | "mark_paid";

const TRANSITION_MAP: Record<OrderTransition, {
  from: AdminOrderStatus[];
  to: AdminOrderStatus;
}> = {
  mark_paid: { from: ["pending_payment"], to: "paid" },
  start_preparing: { from: ["paid", "pending_payment"], to: "preparing" },
  mark_shipped: { from: ["preparing", "paid"], to: "shipped" },
  complete: { from: ["shipped", "preparing"], to: "completed" },
  cancel: {
    from: ["pending_payment", "paid", "preparing", "shipped"],
    to: "cancelled",
  },
};

export function availableTransitions(status: AdminOrderStatus): OrderTransition[] {
  return (Object.entries(TRANSITION_MAP) as Array<[OrderTransition, typeof TRANSITION_MAP[OrderTransition]]>)
    .filter(([, { from }]) => from.includes(status))
    .map(([t]) => t);
}

export interface TransitionResult {
  ok: boolean;
  order?: AdminOrder;
  error?: string;
}

export async function transitionOrder(
  id: string,
  transition: OrderTransition,
): Promise<TransitionResult> {
  const idx = orders.findIndex((o) => o.id === id);
  if (idx === -1) return { ok: false, error: "Sipariş bulunamadı." };
  const map = TRANSITION_MAP[transition];
  if (!map) return { ok: false, error: "Geçersiz işlem." };
  if (!map.from.includes(orders[idx].status)) {
    return {
      ok: false,
      error: `Bu işlem '${orders[idx].status}' durumunda yapılamaz.`,
    };
  }
  orders[idx] = { ...orders[idx], status: map.to };
  return { ok: true, order: orders[idx] };
}

export async function setOrderInternalNote(
  id: string,
  note: string,
): Promise<AdminOrder | null> {
  const idx = orders.findIndex((o) => o.id === id);
  if (idx === -1) return null;
  orders[idx] = { ...orders[idx], internalNote: note.slice(0, 2000) };
  return orders[idx];
}

export async function setOrderItemStatus(
  orderId: string,
  itemIndex: number,
  status: AdminOrderItemStatus,
): Promise<AdminOrder | null> {
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) return null;
  if (itemIndex < 0 || itemIndex >= orders[idx].items.length) return null;
  const nextItems = orders[idx].items.map((it, i) =>
    i === itemIndex ? { ...it, status } : it,
  );
  orders[idx] = { ...orders[idx], items: nextItems };
  return orders[idx];
}

export interface RefundInput {
  amountMinor: number;
  reason: string;
}

export type RefundResult =
  | { ok: true; order: AdminOrder; refund: AdminRefund }
  | { ok: false; error: string };

export async function refundOrder(
  orderId: string,
  input: RefundInput,
): Promise<RefundResult> {
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) return { ok: false, error: "Sipariş bulunamadı." };
  const order = orders[idx];
  if (order.status === "cancelled") {
    return { ok: false, error: "İptal edilen siparişe iade yapılamaz." };
  }
  const already = order.refunds.reduce((s, r) => s + r.amountMinor, 0);
  const remaining = order.totalMinor - already;
  if (input.amountMinor <= 0) {
    return { ok: false, error: "İade tutarı pozitif olmalı." };
  }
  if (input.amountMinor > remaining) {
    return {
      ok: false,
      error: `İade tutarı kalan bakiyeyi aşıyor (kalan: ${(remaining / 100).toFixed(2)} ₺).`,
    };
  }
  const refund: AdminRefund = {
    id: `rfn-${order.refunds.length + 1}-${Date.now()}`,
    amountMinor: input.amountMinor,
    reason: input.reason.slice(0, 500),
    createdAt: new Date().toISOString(),
  };
  const nextRefunds = [...order.refunds, refund];
  const fullyRefunded =
    nextRefunds.reduce((s, r) => s + r.amountMinor, 0) >= order.totalMinor;
  orders[idx] = {
    ...order,
    refunds: nextRefunds,
    status: fullyRefunded ? "refunded" : order.status,
  };
  return { ok: true, order: orders[idx], refund };
}

// ── Settings ──────────────────────────────────────────────────────────────

export async function getSettings(): Promise<AdminSettings> {
  return { ...settings };
}

export async function updateSettings(
  input: Partial<AdminSettings>,
): Promise<AdminSettings> {
  settings = { ...settings, ...input };
  return { ...settings };
}

// ── Dashboard stats ───────────────────────────────────────────────────────

export interface DashboardStats {
  productCount: number;
  activeProductCount: number;
  outOfStockCount: number;
  categoryCount: number;
  orderCount: number;
  pendingOrderCount: number;
  revenueMinor: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const completedOrPaidOrPreparing = orders.filter((o) =>
    ["paid", "preparing", "shipped", "completed"].includes(o.status),
  );
  return {
    productCount: products.length,
    activeProductCount: products.filter((p) => p.isActive).length,
    outOfStockCount: products.filter((p) => p.stock === 0).length,
    categoryCount: categories.length,
    orderCount: orders.length,
    pendingOrderCount: orders.filter(
      (o) => o.status === "pending_payment" || o.status === "paid" || o.status === "preparing",
    ).length,
    revenueMinor: completedOrPaidOrPreparing.reduce(
      (s, o) => s + o.totalMinor,
      0,
    ),
  };
}

export { SEED_MENU as CAFE_MENU };

// ── Public read for customer site ─────────────────────────────────────────

/**
 * Returns active products in the design's `Product` shape so the SPA
 * (Shop + Home teaser) can render them without any TS gymnastics.
 * Inactive products are filtered out automatically.
 */
export async function listShopProducts(): Promise<DesignProduct[]> {
  return products
    .filter((p) => p.isActive)
    .map((p) => ({
      name: p.name,
      tag: p.tag,
      price: `${Math.round(p.priceMinor / 100)}₺`,
      compareAtPrice:
        p.compareAtPriceMinor > p.priceMinor
          ? `${Math.round(p.compareAtPriceMinor / 100)}₺`
          : undefined,
      desc: p.desc,
      cat: p.cat,
      img: p.img,
      featured: p.featured || undefined,
      isNew: p.isNew || undefined,
    }));
}

// ── Cafe menu items (affogato / matcha / espresso / cold / gelato) ────────

export type MenuCategoryKey =
  | "affogato"
  | "matcha"
  | "espresso"
  | "cold"
  | "gelato";

export const MENU_CATEGORY_KEYS: MenuCategoryKey[] = [
  "affogato",
  "matcha",
  "espresso",
  "cold",
  "gelato",
];

export interface AdminMenuItem {
  id: string;
  categoryKey: MenuCategoryKey;
  name: string;
  desc: string;
  /** Minor units (kuruş) — e.g. 13000 = 130,00 ₺ */
  priceMinor: number;
  /** Hue token from PhotoSurface palette (used by MenuPlate). */
  hue: string;
  /** Free-form tags: "signature", "new", "iced", "nuts", "IGP", … */
  tags: string[];
  isActive: boolean;
  sortOrder: number;
  updatedAt: string;
}

let menuItemCounter = 0;
const menuItems: AdminMenuItem[] = MENU_CATEGORY_KEYS.flatMap((key) =>
  SEED_MENU[key].items.map((it, idx) => {
    menuItemCounter += 1;
    return {
      id: slugifyId("mnu", menuItemCounter),
      categoryKey: key,
      name: it.name,
      desc: it.desc,
      priceMinor: parsePrice(it.price),
      hue: it.hue,
      tags: it.tags ? [...it.tags] : [],
      isActive: true,
      sortOrder: idx,
      updatedAt: new Date().toISOString(),
    };
  }),
);

export async function listMenuItems(): Promise<AdminMenuItem[]> {
  return [...menuItems].sort((a, b) => {
    const aIdx = MENU_CATEGORY_KEYS.indexOf(a.categoryKey);
    const bIdx = MENU_CATEGORY_KEYS.indexOf(b.categoryKey);
    if (aIdx !== bIdx) return aIdx - bIdx;
    return a.sortOrder - b.sortOrder;
  });
}

export async function getMenuItem(id: string): Promise<AdminMenuItem | null> {
  return menuItems.find((it) => it.id === id) ?? null;
}

export interface MenuItemInput {
  categoryKey: MenuCategoryKey;
  name: string;
  desc: string;
  priceMinor: number;
  hue: string;
  tags: string[];
  isActive: boolean;
  sortOrder: number;
}

export async function createMenuItem(input: MenuItemInput): Promise<AdminMenuItem> {
  menuItemCounter += 1;
  const item: AdminMenuItem = {
    id: slugifyId("mnu", menuItemCounter),
    ...input,
    updatedAt: new Date().toISOString(),
  };
  menuItems.push(item);
  return item;
}

export async function updateMenuItem(
  id: string,
  input: MenuItemInput,
): Promise<AdminMenuItem | null> {
  const idx = menuItems.findIndex((it) => it.id === id);
  if (idx === -1) return null;
  menuItems[idx] = {
    ...menuItems[idx],
    ...input,
    updatedAt: new Date().toISOString(),
  };
  return menuItems[idx];
}

export async function deleteMenuItem(id: string): Promise<boolean> {
  const idx = menuItems.findIndex((it) => it.id === id);
  if (idx === -1) return false;
  menuItems.splice(idx, 1);
  return true;
}

export type BulkMenuOp =
  | { kind: "delete" }
  | { kind: "activate" }
  | { kind: "deactivate" }
  | { kind: "set_category"; categoryKey: MenuCategoryKey };

export async function bulkUpdateMenuItems(
  ids: string[],
  op: BulkMenuOp,
): Promise<BulkResult> {
  if (ids.length === 0) return { updated: 0 };
  const idSet = new Set(ids);
  const now = new Date().toISOString();
  let updated = 0;

  if (op.kind === "delete") {
    for (let i = menuItems.length - 1; i >= 0; i -= 1) {
      if (idSet.has(menuItems[i].id)) {
        menuItems.splice(i, 1);
        updated += 1;
      }
    }
    return { updated };
  }

  for (let i = 0; i < menuItems.length; i += 1) {
    if (!idSet.has(menuItems[i].id)) continue;
    if (op.kind === "activate") {
      if (!menuItems[i].isActive) {
        menuItems[i] = { ...menuItems[i], isActive: true, updatedAt: now };
        updated += 1;
      }
    } else if (op.kind === "deactivate") {
      if (menuItems[i].isActive) {
        menuItems[i] = { ...menuItems[i], isActive: false, updatedAt: now };
        updated += 1;
      }
    } else if (op.kind === "set_category") {
      if (menuItems[i].categoryKey !== op.categoryKey) {
        menuItems[i] = {
          ...menuItems[i],
          categoryKey: op.categoryKey,
          updatedAt: now,
        };
        updated += 1;
      }
    }
  }
  return { updated };
}

/**
 * Returns the cafe menu in the design's MENU shape, with category meta
 * (title, sub, italian, note) preserved from SEED_MENU and items pulled
 * live from the admin store. Inactive items are filtered out.
 */
export async function listMenuForCustomer(): Promise<
  Record<string, DesignMenuCategory>
> {
  const out: Record<string, DesignMenuCategory> = {};
  for (const key of MENU_CATEGORY_KEYS) {
    const meta = SEED_MENU[key];
    const activeItems = menuItems
      .filter((it) => it.categoryKey === key && it.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((it) => ({
        name: it.name,
        desc: it.desc,
        price: `${Math.round(it.priceMinor / 100)}₺`,
        ...(it.tags.length > 0 ? { tags: [...it.tags] } : {}),
        hue: it.hue,
      }));
    out[key] = {
      title: meta.title,
      sub: meta.sub,
      italian: meta.italian,
      note: meta.note,
      items: activeItems,
    };
  }
  return out;
}

export const MENU_CATEGORY_LABELS: Record<MenuCategoryKey, string> = {
  affogato: SEED_MENU.affogato.title,
  matcha: SEED_MENU.matcha.title,
  espresso: SEED_MENU.espresso.title,
  cold: SEED_MENU.cold.title,
  gelato: SEED_MENU.gelato.title,
};


// ── Promo codes ──────────────────────────────────────────────────────────

export type PromoDiscountKind = "pct" | "fixed";

export interface AdminPromo {
  id: string;
  code: string;
  kind: PromoDiscountKind;
  /** Percentage 1–100 when kind="pct", minor units (kuruş) when kind="fixed". */
  value: number;
  /** Minor units. 0 = no minimum. */
  minSubtotalMinor: number;
  /** 0 = unlimited. */
  usageLimit: number;
  usageCount: number;
  expiresAt: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const promos: AdminPromo[] = [];
let promoCounter = 0;

export async function listPromos(): Promise<AdminPromo[]> {
  return [...promos].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getPromo(id: string): Promise<AdminPromo | null> {
  return promos.find((p) => p.id === id) ?? null;
}

export interface PromoInput {
  code: string;
  kind: PromoDiscountKind;
  value: number;
  minSubtotalMinor: number;
  usageLimit: number;
  expiresAt: string;
  isActive: boolean;
}

function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export type PromoMutationResult =
  | { ok: true; promo: AdminPromo }
  | { ok: false; error: string };

export async function createPromo(input: PromoInput): Promise<PromoMutationResult> {
  const code = normalizeCode(input.code);
  if (!code) return { ok: false, error: "Kod boş olamaz." };
  if (promos.some((p) => p.code === code)) {
    return { ok: false, error: "Bu kod zaten kullanılıyor." };
  }
  promoCounter += 1;
  const now = new Date().toISOString();
  const promo: AdminPromo = {
    id: `prm-${String(promoCounter).padStart(4, "0")}`,
    code,
    kind: input.kind,
    value: input.value,
    minSubtotalMinor: input.minSubtotalMinor,
    usageLimit: input.usageLimit,
    usageCount: 0,
    expiresAt: input.expiresAt,
    isActive: input.isActive,
    createdAt: now,
    updatedAt: now,
  };
  promos.push(promo);
  return { ok: true, promo };
}

export async function updatePromo(
  id: string,
  input: PromoInput,
): Promise<PromoMutationResult> {
  const idx = promos.findIndex((p) => p.id === id);
  if (idx === -1) return { ok: false, error: "Kod bulunamadı." };
  const code = normalizeCode(input.code);
  if (!code) return { ok: false, error: "Kod boş olamaz." };
  if (promos.some((p) => p.code === code && p.id !== id)) {
    return { ok: false, error: "Başka bir kod aynı koda sahip." };
  }
  promos[idx] = {
    ...promos[idx],
    code,
    kind: input.kind,
    value: input.value,
    minSubtotalMinor: input.minSubtotalMinor,
    usageLimit: input.usageLimit,
    expiresAt: input.expiresAt,
    isActive: input.isActive,
    updatedAt: new Date().toISOString(),
  };
  return { ok: true, promo: promos[idx] };
}

export async function deletePromo(id: string): Promise<boolean> {
  const idx = promos.findIndex((p) => p.id === id);
  if (idx === -1) return false;
  promos.splice(idx, 1);
  return true;
}

export type PromoApplyResult =
  | { ok: true; promo: AdminPromo; discountMinor: number }
  | { ok: false; error: string };

/**
 * Pure function (no mutation) — checks if a code is valid for the given
 * subtotal and returns the discount in minor units. The caller is the
 * one that ultimately records usage via consumePromoUsage() once the
 * order is actually placed; this two-step keeps the cart UI honest
 * about the price preview without committing the limit.
 */
export async function applyPromoCode(
  code: string,
  subtotalMinor: number,
): Promise<PromoApplyResult> {
  const needle = normalizeCode(code);
  if (!needle) return { ok: false, error: "Kod gir." };
  const promo = promos.find((p) => p.code === needle);
  if (!promo) return { ok: false, error: "Geçersiz kod." };
  if (!promo.isActive) return { ok: false, error: "Bu kod kapalı." };
  if (promo.expiresAt && new Date(promo.expiresAt).getTime() < Date.now()) {
    return { ok: false, error: "Kodun süresi doldu." };
  }
  if (promo.usageLimit > 0 && promo.usageCount >= promo.usageLimit) {
    return { ok: false, error: "Kod kullanım limiti doldu." };
  }
  if (subtotalMinor < promo.minSubtotalMinor) {
    return {
      ok: false,
      error: `Bu koda uygulanabilmek için en az ${(promo.minSubtotalMinor / 100).toFixed(2)} ₺ alışveriş gerek.`,
    };
  }
  let discountMinor =
    promo.kind === "pct"
      ? Math.floor((subtotalMinor * promo.value) / 100)
      : Math.min(promo.value, subtotalMinor);
  if (discountMinor < 0) discountMinor = 0;
  if (discountMinor > subtotalMinor) discountMinor = subtotalMinor;
  return { ok: true, promo, discountMinor };
}

export async function consumePromoUsage(code: string): Promise<void> {
  const needle = normalizeCode(code);
  const idx = promos.findIndex((p) => p.code === needle);
  if (idx === -1) return;
  promos[idx] = {
    ...promos[idx],
    usageCount: promos[idx].usageCount + 1,
    updatedAt: new Date().toISOString(),
  };
}

