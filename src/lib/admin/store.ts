import "server-only";

import { COLLECTIONS } from "@/lib/mongodb/collections";
import { getDb } from "@/lib/mongodb/client";
import { nextSeq } from "@/lib/mongodb/counters";
import {
  MENU as SEED_MENU,
  PRODUCTS as SEED_PRODUCTS,
  type MenuCategory as DesignMenuCategory,
  type Product as DesignProduct,
} from "@/components/laffogato/data";

import type { WeeklyHours } from "./days";

/**
 * Veri katmanı — MongoDB Atlas üzerinden çalışır.
 *
 * Public API'lerin tamamı async ve mevcut admin sayfalarıyla uyumlu kalır.
 * Koleksiyon boşsa SEED verisi otomatik yüklenir (idempotent — yalnızca
 * count === 0 ise tetiklenir).
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

// ─── ID + slug helpers ────────────────────────────────────────────────────

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

// ─── Seed (idempotent — yalnızca koleksiyon boşsa çalışır) ────────────────

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

function defaultSettings(): AdminSettings {
  return {
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
}

let seedPromise: Promise<void> | null = null;

async function ensureSeed(): Promise<void> {
  if (seedPromise) return seedPromise;
  seedPromise = (async () => {
    const db = await getDb();
    const now = new Date().toISOString();

    const productsCount = await db.collection(COLLECTIONS.products).countDocuments({});
    if (productsCount === 0) {
      const seeded: AdminProduct[] = SEED_PRODUCTS.map((p, i) => ({
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
        updatedAt: now,
      }));
      if (seeded.length > 0) {
        await db.collection(COLLECTIONS.products).insertMany(seeded);
        await db.collection(COLLECTIONS.counters).updateOne(
          { _id: "prd" } as never,
          { $set: { seq: seeded.length } },
          { upsert: true },
        );
      }
    }

    const catCount = await db.collection(COLLECTIONS.categories).countDocuments({});
    if (catCount === 0) {
      const seededCats: AdminCategory[] = [
        { id: slugifyId("cat", 1), slug: "beans",  label: "Çekirdek",    icon: "◉", sortOrder: 0 },
        { id: slugifyId("cat", 2), slug: "gift",   label: "Hediye",      icon: "◈", sortOrder: 1 },
        { id: slugifyId("cat", 3), slug: "gear",   label: "Ekipman",     icon: "◇", sortOrder: 2 },
        { id: slugifyId("cat", 4), slug: "merch",  label: "Giyim",       icon: "◐", sortOrder: 3 },
        { id: slugifyId("cat", 5), slug: "pantry", label: "Kiler",       icon: "◇", sortOrder: 4 },
      ];
      await db.collection(COLLECTIONS.categories).insertMany(seededCats);
      await db.collection(COLLECTIONS.counters).updateOne(
        { _id: "cat" } as never,
        { $set: { seq: seededCats.length } },
        { upsert: true },
      );
    }

    const menuCount = await db.collection(COLLECTIONS.menuItems).countDocuments({});
    if (menuCount === 0) {
      let counter = 0;
      const seededMenu: AdminMenuItem[] = MENU_CATEGORY_KEYS.flatMap((key) =>
        SEED_MENU[key].items.map((it, idx) => {
          counter += 1;
          return {
            id: slugifyId("mnu", counter),
            categoryKey: key,
            name: it.name,
            desc: it.desc,
            priceMinor: parsePrice(it.price),
            hue: it.hue,
            tags: it.tags ? [...it.tags] : [],
            isActive: true,
            sortOrder: idx,
            updatedAt: now,
          };
        }),
      );
      if (seededMenu.length > 0) {
        await db.collection(COLLECTIONS.menuItems).insertMany(seededMenu);
        await db.collection(COLLECTIONS.counters).updateOne(
          { _id: "mnu" } as never,
          { $set: { seq: counter } },
          { upsert: true },
        );
      }
    }

    const settingsCount = await db.collection(COLLECTIONS.settings).countDocuments({});
    if (settingsCount === 0) {
      await db.collection(COLLECTIONS.settings).insertOne({
        _id: "main" as never,
        ...defaultSettings(),
      });
    }

    const ordersCount = await db.collection(COLLECTIONS.orders).countDocuments({});
    if (ordersCount === 0) {
      const demoOrders: AdminOrder[] = [
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
            { productName: "Sirena — Espresso Blend", qty: 1, unitPriceMinor: 32000, status: "pending" },
            { productName: "Edible Cups — 6 Box",     qty: 1, unitPriceMinor: 24000, status: "ready"   },
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
            { productName: "Affogato Kit — For Two", qty: 1, unitPriceMinor: 78000, status: "pending" },
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
            { productName: "Uji Matcha — Ceremonial", qty: 1, unitPriceMinor: 42000, status: "ready" },
            { productName: "Bambu Chasen",             qty: 1, unitPriceMinor: 32000, status: "ready" },
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
      await db.collection(COLLECTIONS.orders).insertMany(demoOrders);
      await db.collection(COLLECTIONS.counters).updateOne(
        { _id: "ord" } as never,
        { $set: { seq: demoOrders.length } },
        { upsert: true },
      );
      await db.collection(COLLECTIONS.counters).updateOne(
        { _id: "orderNo" } as never,
        { $set: { seq: 10_003 } },
        { upsert: true },
      );
    }
  })();
  return seedPromise;
}

// Mongo dokümanlarındaki `_id` alanını client'a sızdırmamak için strip eden helper.
function strip<T>(doc: T | null | undefined): T | null {
  if (!doc) return null;
  const { _id, ...rest } = doc as Record<string, unknown> & { _id?: unknown };
  void _id;
  return rest as T;
}

function stripMany<T>(docs: T[]): T[] {
  return docs.map((d) => strip(d) as T);
}

// ─── Products ─────────────────────────────────────────────────────────────

export async function listProducts(): Promise<AdminProduct[]> {
  await ensureSeed();
  const db = await getDb();
  const docs = await db
    .collection<AdminProduct>(COLLECTIONS.products)
    .find({})
    .sort({ updatedAt: -1 })
    .toArray();
  return stripMany(docs);
}

export async function getProduct(id: string): Promise<AdminProduct | null> {
  await ensureSeed();
  const db = await getDb();
  const doc = await db.collection<AdminProduct>(COLLECTIONS.products).findOne({ id });
  return strip(doc);
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

async function uniqueSlug(candidate: string, ignoreId?: string): Promise<string> {
  const base = candidate || "urun";
  let attempt = base;
  let n = 1;
  const db = await getDb();
  // 20 deneme yeter — gerçekçi tekrar sayısı çok düşük.
  for (let i = 0; i < 20; i += 1) {
    const conflict = await db
      .collection<AdminProduct>(COLLECTIONS.products)
      .findOne({ slug: attempt, ...(ignoreId ? { id: { $ne: ignoreId } } : {}) });
    if (!conflict) return attempt;
    n += 1;
    attempt = `${base}-${n}`;
  }
  return attempt;
}

export async function createProduct(input: ProductInput): Promise<AdminProduct> {
  await ensureSeed();
  const db = await getDb();
  const seq = await nextSeq("prd");
  const id = slugifyId("prd", seq);
  const slug = await uniqueSlug(input.slug || slugify(input.name) || `urun-${seq}`);
  const sku = input.sku || deriveSku(input.name, seq);
  const product: AdminProduct = {
    ...input,
    id,
    slug,
    sku,
    updatedAt: new Date().toISOString(),
  };
  await db.collection<AdminProduct>(COLLECTIONS.products).insertOne(product);
  return product;
}

export async function updateProduct(
  id: string,
  input: ProductInput,
): Promise<AdminProduct | null> {
  await ensureSeed();
  const db = await getDb();
  const existing = await db
    .collection<AdminProduct>(COLLECTIONS.products)
    .findOne({ id });
  if (!existing) return null;
  const slug = await uniqueSlug(input.slug || slugify(input.name) || existing.slug, id);
  const next: AdminProduct = {
    ...existing,
    ...input,
    slug,
    sku: input.sku || existing.sku,
    updatedAt: new Date().toISOString(),
  };
  await db
    .collection<AdminProduct>(COLLECTIONS.products)
    .updateOne({ id }, { $set: next });
  return strip(next as unknown as AdminProduct);
}

export async function deleteProduct(id: string): Promise<boolean> {
  await ensureSeed();
  const db = await getDb();
  const res = await db.collection(COLLECTIONS.products).deleteOne({ id });
  return res.deletedCount > 0;
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
  await ensureSeed();
  const db = await getDb();
  const filter = { id: { $in: ids } };
  const now = new Date().toISOString();

  if (op.kind === "delete") {
    const res = await db.collection(COLLECTIONS.products).deleteMany(filter);
    return { updated: res.deletedCount };
  }

  if (op.kind === "activate") {
    const res = await db
      .collection(COLLECTIONS.products)
      .updateMany({ ...filter, isActive: false }, { $set: { isActive: true, updatedAt: now } });
    return { updated: res.modifiedCount };
  }

  if (op.kind === "deactivate") {
    const res = await db
      .collection(COLLECTIONS.products)
      .updateMany({ ...filter, isActive: true }, { $set: { isActive: false, updatedAt: now } });
    return { updated: res.modifiedCount };
  }

  // set_category
  const res = await db
    .collection(COLLECTIONS.products)
    .updateMany(
      { ...filter, cat: { $ne: op.cat } },
      { $set: { cat: op.cat, updatedAt: now } },
    );
  return { updated: res.modifiedCount };
}

// ─── Stock movements ──────────────────────────────────────────────────────

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

async function recordStockMove(input: Omit<AdminStockMove, "id" | "createdAt">): Promise<AdminStockMove> {
  const db = await getDb();
  const seq = await nextSeq("mov");
  const move: AdminStockMove = {
    id: `mov-${String(seq).padStart(6, "0")}`,
    createdAt: new Date().toISOString(),
    ...input,
  };
  await db.collection<AdminStockMove>(COLLECTIONS.stockMoves).insertOne(move);
  return move;
}

export async function listStockMoves(filter?: {
  productId?: string;
  reason?: StockMoveReason;
  limit?: number;
}): Promise<AdminStockMove[]> {
  await ensureSeed();
  const db = await getDb();
  const query: Record<string, unknown> = {};
  if (filter?.productId) query.productId = filter.productId;
  if (filter?.reason) query.reason = filter.reason;
  const docs = await db
    .collection<AdminStockMove>(COLLECTIONS.stockMoves)
    .find(query)
    .sort({ createdAt: -1 })
    .limit(filter?.limit ?? 500)
    .toArray();
  return stripMany(docs);
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
  await ensureSeed();
  const db = await getDb();
  const product = await db
    .collection<AdminProduct>(COLLECTIONS.products)
    .findOne({ id: input.productId });
  if (!product) return { ok: false, error: "Ürün bulunamadı." };
  if (!Number.isFinite(input.delta) || input.delta === 0) {
    return { ok: false, error: "Geçerli bir değer gir (0 olamaz)." };
  }
  const next = product.stock + input.delta;
  if (next < 0) {
    return {
      ok: false,
      error: `Stok eksiye düşemez (mevcut: ${product.stock}).`,
    };
  }
  const updatedAt = new Date().toISOString();
  await db
    .collection(COLLECTIONS.products)
    .updateOne({ id: input.productId }, { $set: { stock: next, updatedAt } });
  const move = await recordStockMove({
    productId: product.id,
    productName: product.name,
    delta: input.delta,
    stockAfter: next,
    reason: "manual_adjust",
    note: input.note.trim().slice(0, 500),
    actor: input.actor,
  });
  return {
    ok: true,
    move,
    product: strip({ ...product, stock: next, updatedAt }) as AdminProduct,
  };
}

// ─── Categories ───────────────────────────────────────────────────────────

export async function listCategories(): Promise<AdminCategory[]> {
  await ensureSeed();
  const db = await getDb();
  const docs = await db
    .collection<AdminCategory>(COLLECTIONS.categories)
    .find({})
    .sort({ sortOrder: 1 })
    .toArray();
  return stripMany(docs);
}

export async function getCategory(id: string): Promise<AdminCategory | null> {
  await ensureSeed();
  const db = await getDb();
  const doc = await db.collection<AdminCategory>(COLLECTIONS.categories).findOne({ id });
  return strip(doc);
}

export interface CategoryInput {
  slug: ShopCategoryId;
  label: string;
  icon: string;
  sortOrder: number;
}

export async function createCategory(input: CategoryInput): Promise<AdminCategory> {
  await ensureSeed();
  const db = await getDb();
  const seq = await nextSeq("cat");
  const c: AdminCategory = { id: slugifyId("cat", seq), ...input };
  await db.collection<AdminCategory>(COLLECTIONS.categories).insertOne(c);
  return c;
}

export async function updateCategory(
  id: string,
  input: CategoryInput,
): Promise<AdminCategory | null> {
  await ensureSeed();
  const db = await getDb();
  const existing = await db
    .collection<AdminCategory>(COLLECTIONS.categories)
    .findOne({ id });
  if (!existing) return null;
  const next: AdminCategory = { ...existing, ...input };
  await db.collection(COLLECTIONS.categories).updateOne({ id }, { $set: next });
  return strip(next);
}

export async function deleteCategory(id: string): Promise<boolean> {
  await ensureSeed();
  const db = await getDb();
  const res = await db.collection(COLLECTIONS.categories).deleteOne({ id });
  return res.deletedCount > 0;
}

// ─── Orders ───────────────────────────────────────────────────────────────

export async function listOrders(): Promise<AdminOrder[]> {
  await ensureSeed();
  const db = await getDb();
  const docs = await db
    .collection<AdminOrder>(COLLECTIONS.orders)
    .find({})
    .sort({ orderNo: -1 })
    .toArray();
  return stripMany(docs);
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

export async function listCustomers(): Promise<CustomerSummary[]> {
  const orders = await listOrders();
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
  await ensureSeed();
  const db = await getDb();
  // Email her zaman lowercase sakla → case-insensitive match için regex değil exact.
  const docs = await db
    .collection<AdminOrder>(COLLECTIONS.orders)
    .find({
      customerEmail: { $regex: `^${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
    })
    .sort({ orderNo: -1 })
    .toArray();
  return stripMany(docs);
}

export async function getOrder(id: string): Promise<AdminOrder | null> {
  await ensureSeed();
  const db = await getDb();
  const doc = await db.collection<AdminOrder>(COLLECTIONS.orders).findOne({ id });
  return strip(doc);
}

export async function updateOrderStatus(
  id: string,
  status: AdminOrderStatus,
): Promise<AdminOrder | null> {
  await ensureSeed();
  const db = await getDb();
  const res = await db
    .collection<AdminOrder>(COLLECTIONS.orders)
    .findOneAndUpdate({ id }, { $set: { status } }, { returnDocument: "after" });
  return strip((res as unknown as AdminOrder | { value: AdminOrder } | null) as AdminOrder | null);
}

export type BulkOrderOp = { kind: "set_status"; status: AdminOrderStatus };

export async function bulkUpdateOrders(
  ids: string[],
  op: BulkOrderOp,
): Promise<BulkResult> {
  if (ids.length === 0) return { updated: 0 };
  await ensureSeed();
  const db = await getDb();
  const res = await db
    .collection(COLLECTIONS.orders)
    .updateMany(
      { id: { $in: ids }, status: { $ne: op.status } },
      { $set: { status: op.status } },
    );
  return { updated: res.modifiedCount };
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

export async function placeOrder(
  input: PlaceOrderInput,
): Promise<PlaceOrderResult> {
  await ensureSeed();
  const db = await getDb();
  const cleanItems = input.items.filter(
    (it) => it.qty > 0 && it.priceMinor >= 0,
  );

  // Up-front stock check
  const knownNames = Array.from(new Set(cleanItems.map((it) => it.name)));
  const productDocs = await db
    .collection<AdminProduct>(COLLECTIONS.products)
    .find({ name: { $in: knownNames } })
    .toArray();
  const byName = new Map(productDocs.map((p) => [p.name, p]));
  for (const it of cleanItems) {
    const product = byName.get(it.name);
    if (product && product.stock < it.qty) {
      return {
        ok: false,
        reason: "out_of_stock",
        productName: product.name,
        available: product.stock,
      };
    }
  }

  // Decrement stock
  const decrements: Array<{ id: string; name: string; qty: number; stockAfter: number }> = [];
  const now = new Date().toISOString();
  for (const it of cleanItems) {
    const p = byName.get(it.name);
    if (!p) continue;
    const stockAfter = Math.max(0, p.stock - it.qty);
    await db
      .collection(COLLECTIONS.products)
      .updateOne({ id: p.id }, { $set: { stock: stockAfter, updatedAt: now } });
    decrements.push({ id: p.id, name: p.name, qty: it.qty, stockAfter });
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

  const orderSeq = await nextSeq("ord");
  const orderNo = await nextSeq("orderNo");
  const orderId = slugifyId("ord", orderSeq);

  for (const d of decrements) {
    await recordStockMove({
      productId: d.id,
      productName: d.name,
      delta: -d.qty,
      stockAfter: d.stockAfter,
      reason: "order_placed",
      note: `Sipariş #${orderNo}`,
      orderId,
      actor: input.customerEmail ?? "customer",
    });
  }

  let promoCode = "";
  let discountMinor = 0;
  if (input.promoCode && input.promoCode.trim()) {
    const promoCheck = await applyPromoCode(input.promoCode, subtotalMinor);
    if (promoCheck.ok) {
      promoCode = promoCheck.promo.code;
      discountMinor = promoCheck.discountMinor;
      await consumePromoUsage(promoCode);
    }
  }

  const totalMinor = Math.max(0, subtotalMinor - discountMinor);

  const order: AdminOrder = {
    id: orderId,
    orderNo,
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
  await db.collection<AdminOrder>(COLLECTIONS.orders).insertOne(order);
  return { ok: true, order };
}

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
  await ensureSeed();
  const db = await getDb();
  const existing = await db
    .collection<AdminOrder>(COLLECTIONS.orders)
    .findOne({ id });
  if (!existing) return { ok: false, error: "Sipariş bulunamadı." };
  const map = TRANSITION_MAP[transition];
  if (!map) return { ok: false, error: "Geçersiz işlem." };
  if (!map.from.includes(existing.status)) {
    return {
      ok: false,
      error: `Bu işlem '${existing.status}' durumunda yapılamaz.`,
    };
  }
  await db.collection(COLLECTIONS.orders).updateOne({ id }, { $set: { status: map.to } });
  return { ok: true, order: strip({ ...existing, status: map.to }) as AdminOrder };
}

export async function setOrderInternalNote(
  id: string,
  note: string,
): Promise<AdminOrder | null> {
  await ensureSeed();
  const db = await getDb();
  const trimmed = note.slice(0, 2000);
  const existing = await db
    .collection<AdminOrder>(COLLECTIONS.orders)
    .findOne({ id });
  if (!existing) return null;
  await db.collection(COLLECTIONS.orders).updateOne({ id }, { $set: { internalNote: trimmed } });
  return strip({ ...existing, internalNote: trimmed }) as AdminOrder;
}

export async function setOrderItemStatus(
  orderId: string,
  itemIndex: number,
  status: AdminOrderItemStatus,
): Promise<AdminOrder | null> {
  await ensureSeed();
  const db = await getDb();
  const existing = await db
    .collection<AdminOrder>(COLLECTIONS.orders)
    .findOne({ id: orderId });
  if (!existing) return null;
  if (itemIndex < 0 || itemIndex >= existing.items.length) return null;
  const nextItems = existing.items.map((it, i) =>
    i === itemIndex ? { ...it, status } : it,
  );
  await db.collection(COLLECTIONS.orders).updateOne({ id: orderId }, { $set: { items: nextItems } });
  return strip({ ...existing, items: nextItems }) as AdminOrder;
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
  await ensureSeed();
  const db = await getDb();
  const existing = await db
    .collection<AdminOrder>(COLLECTIONS.orders)
    .findOne({ id: orderId });
  if (!existing) return { ok: false, error: "Sipariş bulunamadı." };
  if (existing.status === "cancelled") {
    return { ok: false, error: "İptal edilen siparişe iade yapılamaz." };
  }
  const already = existing.refunds.reduce((s, r) => s + r.amountMinor, 0);
  const remaining = existing.totalMinor - already;
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
    id: `rfn-${existing.refunds.length + 1}-${Date.now()}`,
    amountMinor: input.amountMinor,
    reason: input.reason.slice(0, 500),
    createdAt: new Date().toISOString(),
  };
  const nextRefunds = [...existing.refunds, refund];
  const fullyRefunded =
    nextRefunds.reduce((s, r) => s + r.amountMinor, 0) >= existing.totalMinor;
  const status = fullyRefunded ? "refunded" : existing.status;
  await db
    .collection(COLLECTIONS.orders)
    .updateOne({ id: orderId }, { $set: { refunds: nextRefunds, status } });
  return {
    ok: true,
    order: strip({ ...existing, refunds: nextRefunds, status }) as AdminOrder,
    refund,
  };
}

// ─── Settings ─────────────────────────────────────────────────────────────

export async function getSettings(): Promise<AdminSettings> {
  await ensureSeed();
  const db = await getDb();
  const doc = await db.collection(COLLECTIONS.settings).findOne({ _id: "main" as never });
  if (!doc) return defaultSettings();
  const { _id, ...rest } = doc as Record<string, unknown> & { _id?: unknown };
  void _id;
  return rest as unknown as AdminSettings;
}

export async function updateSettings(
  input: Partial<AdminSettings>,
): Promise<AdminSettings> {
  await ensureSeed();
  const db = await getDb();
  await db
    .collection(COLLECTIONS.settings)
    .updateOne({ _id: "main" as never }, { $set: input }, { upsert: true });
  return getSettings();
}

// ─── Dashboard stats ──────────────────────────────────────────────────────

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
  await ensureSeed();
  const db = await getDb();
  const productsColl = db.collection<AdminProduct>(COLLECTIONS.products);
  const ordersColl = db.collection<AdminOrder>(COLLECTIONS.orders);

  const [productCount, activeProductCount, outOfStockCount, categoryCount, orderCount, pendingOrderCount, revenueAgg] =
    await Promise.all([
      productsColl.countDocuments({}),
      productsColl.countDocuments({ isActive: true }),
      productsColl.countDocuments({ stock: 0 }),
      db.collection(COLLECTIONS.categories).countDocuments({}),
      ordersColl.countDocuments({}),
      ordersColl.countDocuments({
        status: { $in: ["pending_payment", "paid", "preparing"] },
      }),
      ordersColl
        .aggregate<{ _id: null; total: number }>([
          { $match: { status: { $in: ["paid", "preparing", "shipped", "completed"] } } },
          { $group: { _id: null, total: { $sum: "$totalMinor" } } },
        ])
        .toArray(),
    ]);

  return {
    productCount,
    activeProductCount,
    outOfStockCount,
    categoryCount,
    orderCount,
    pendingOrderCount,
    revenueMinor: revenueAgg[0]?.total ?? 0,
  };
}

export { SEED_MENU as CAFE_MENU };

// ─── Public read for customer site ────────────────────────────────────────

export async function listShopProducts(): Promise<DesignProduct[]> {
  const all = await listProducts();
  return all
    .filter((p) => p.isActive)
    .map((p) => ({
      id: p.id,
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

// ─── Cafe menu items ──────────────────────────────────────────────────────

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

export async function listMenuItems(): Promise<AdminMenuItem[]> {
  await ensureSeed();
  const db = await getDb();
  const docs = await db
    .collection<AdminMenuItem>(COLLECTIONS.menuItems)
    .find({})
    .toArray();
  const ordered = docs.sort((a, b) => {
    const aIdx = MENU_CATEGORY_KEYS.indexOf(a.categoryKey);
    const bIdx = MENU_CATEGORY_KEYS.indexOf(b.categoryKey);
    if (aIdx !== bIdx) return aIdx - bIdx;
    return a.sortOrder - b.sortOrder;
  });
  return stripMany(ordered);
}

export async function getMenuItem(id: string): Promise<AdminMenuItem | null> {
  await ensureSeed();
  const db = await getDb();
  const doc = await db.collection<AdminMenuItem>(COLLECTIONS.menuItems).findOne({ id });
  return strip(doc);
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
  await ensureSeed();
  const db = await getDb();
  const seq = await nextSeq("mnu");
  const item: AdminMenuItem = {
    id: slugifyId("mnu", seq),
    ...input,
    updatedAt: new Date().toISOString(),
  };
  await db.collection<AdminMenuItem>(COLLECTIONS.menuItems).insertOne(item);
  return item;
}

export async function updateMenuItem(
  id: string,
  input: MenuItemInput,
): Promise<AdminMenuItem | null> {
  await ensureSeed();
  const db = await getDb();
  const existing = await db
    .collection<AdminMenuItem>(COLLECTIONS.menuItems)
    .findOne({ id });
  if (!existing) return null;
  const next: AdminMenuItem = {
    ...existing,
    ...input,
    updatedAt: new Date().toISOString(),
  };
  await db.collection(COLLECTIONS.menuItems).updateOne({ id }, { $set: next });
  return strip(next);
}

export async function deleteMenuItem(id: string): Promise<boolean> {
  await ensureSeed();
  const db = await getDb();
  const res = await db.collection(COLLECTIONS.menuItems).deleteOne({ id });
  return res.deletedCount > 0;
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
  await ensureSeed();
  const db = await getDb();
  const filter = { id: { $in: ids } };
  const now = new Date().toISOString();

  if (op.kind === "delete") {
    const res = await db.collection(COLLECTIONS.menuItems).deleteMany(filter);
    return { updated: res.deletedCount };
  }

  if (op.kind === "activate") {
    const res = await db
      .collection(COLLECTIONS.menuItems)
      .updateMany({ ...filter, isActive: false }, { $set: { isActive: true, updatedAt: now } });
    return { updated: res.modifiedCount };
  }

  if (op.kind === "deactivate") {
    const res = await db
      .collection(COLLECTIONS.menuItems)
      .updateMany({ ...filter, isActive: true }, { $set: { isActive: false, updatedAt: now } });
    return { updated: res.modifiedCount };
  }

  const res = await db
    .collection(COLLECTIONS.menuItems)
    .updateMany(
      { ...filter, categoryKey: { $ne: op.categoryKey } },
      { $set: { categoryKey: op.categoryKey, updatedAt: now } },
    );
  return { updated: res.modifiedCount };
}

export async function listMenuForCustomer(): Promise<
  Record<string, DesignMenuCategory>
> {
  const all = await listMenuItems();
  const out: Record<string, DesignMenuCategory> = {};
  for (const key of MENU_CATEGORY_KEYS) {
    const meta = SEED_MENU[key];
    const activeItems = all
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

// ─── Promo codes ──────────────────────────────────────────────────────────

export type PromoDiscountKind = "pct" | "fixed";

export interface AdminPromo {
  id: string;
  code: string;
  kind: PromoDiscountKind;
  value: number;
  minSubtotalMinor: number;
  usageLimit: number;
  usageCount: number;
  expiresAt: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function listPromos(): Promise<AdminPromo[]> {
  await ensureSeed();
  const db = await getDb();
  const docs = await db
    .collection<AdminPromo>(COLLECTIONS.promos)
    .find({})
    .sort({ createdAt: -1 })
    .toArray();
  return stripMany(docs);
}

export async function getPromo(id: string): Promise<AdminPromo | null> {
  await ensureSeed();
  const db = await getDb();
  const doc = await db.collection<AdminPromo>(COLLECTIONS.promos).findOne({ id });
  return strip(doc);
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
  await ensureSeed();
  const code = normalizeCode(input.code);
  if (!code) return { ok: false, error: "Kod boş olamaz." };
  const db = await getDb();
  const conflict = await db.collection(COLLECTIONS.promos).findOne({ code });
  if (conflict) return { ok: false, error: "Bu kod zaten kullanılıyor." };
  const seq = await nextSeq("prm");
  const now = new Date().toISOString();
  const promo: AdminPromo = {
    id: `prm-${String(seq).padStart(4, "0")}`,
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
  await db.collection<AdminPromo>(COLLECTIONS.promos).insertOne(promo);
  return { ok: true, promo };
}

export async function updatePromo(
  id: string,
  input: PromoInput,
): Promise<PromoMutationResult> {
  await ensureSeed();
  const db = await getDb();
  const existing = await db.collection<AdminPromo>(COLLECTIONS.promos).findOne({ id });
  if (!existing) return { ok: false, error: "Kod bulunamadı." };
  const code = normalizeCode(input.code);
  if (!code) return { ok: false, error: "Kod boş olamaz." };
  const conflict = await db
    .collection(COLLECTIONS.promos)
    .findOne({ code, id: { $ne: id } });
  if (conflict) return { ok: false, error: "Başka bir kod aynı koda sahip." };
  const next: AdminPromo = {
    ...existing,
    code,
    kind: input.kind,
    value: input.value,
    minSubtotalMinor: input.minSubtotalMinor,
    usageLimit: input.usageLimit,
    expiresAt: input.expiresAt,
    isActive: input.isActive,
    updatedAt: new Date().toISOString(),
  };
  await db.collection(COLLECTIONS.promos).updateOne({ id }, { $set: next });
  return { ok: true, promo: strip(next) as AdminPromo };
}

export async function deletePromo(id: string): Promise<boolean> {
  await ensureSeed();
  const db = await getDb();
  const res = await db.collection(COLLECTIONS.promos).deleteOne({ id });
  return res.deletedCount > 0;
}

export type PromoApplyResult =
  | { ok: true; promo: AdminPromo; discountMinor: number }
  | { ok: false; error: string };

export async function applyPromoCode(
  code: string,
  subtotalMinor: number,
): Promise<PromoApplyResult> {
  await ensureSeed();
  const needle = normalizeCode(code);
  if (!needle) return { ok: false, error: "Kod gir." };
  const db = await getDb();
  const promo = await db.collection<AdminPromo>(COLLECTIONS.promos).findOne({ code: needle });
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
  return { ok: true, promo: strip(promo) as AdminPromo, discountMinor };
}

export async function consumePromoUsage(code: string): Promise<void> {
  await ensureSeed();
  const needle = normalizeCode(code);
  const db = await getDb();
  await db.collection(COLLECTIONS.promos).updateOne(
    { code: needle },
    { $inc: { usageCount: 1 }, $set: { updatedAt: new Date().toISOString() } },
  );
}

// ─── Analytics aggregations ───────────────────────────────────────────────

export type BucketGranularity = "day" | "week" | "month";

export interface RevenueBucket {
  bucket: string;
  label: string;
  revenueMinor: number;
  orderCount: number;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x;
}

function isoWeek(d: Date): { year: number; week: number } {
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  target.setDate(target.getDate() + 3 - ((target.getDay() + 6) % 7));
  const week1 = new Date(target.getFullYear(), 0, 4);
  const diff = (target.getTime() - week1.getTime()) / (24 * 60 * 60 * 1000);
  const week = 1 + Math.round((diff - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return { year: target.getFullYear(), week };
}

function bucketKey(d: Date, g: BucketGranularity): string {
  if (g === "day") {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }
  if (g === "week") {
    const { year, week } = isoWeek(d);
    return `${year}-W${pad2(week)}`;
  }
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function bucketLabel(d: Date, g: BucketGranularity): string {
  if (g === "day") {
    return `${pad2(d.getDate())} ${MONTH_SHORT[d.getMonth()]}`;
  }
  if (g === "week") {
    const start = startOfWeek(d);
    return `${pad2(start.getDate())} ${MONTH_SHORT[start.getMonth()]}`;
  }
  return `${MONTH_SHORT[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}

const MONTH_SHORT = [
  "Oca", "Şub", "Mar", "Nis", "May", "Haz",
  "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara",
];

export async function revenueBuckets(
  granularity: BucketGranularity,
  count: number,
): Promise<RevenueBucket[]> {
  const orders = await listOrders();
  const now = new Date();
  const buckets: RevenueBucket[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    if (granularity === "day") d.setDate(d.getDate() - i);
    else if (granularity === "week") d.setDate(d.getDate() - i * 7);
    else d.setMonth(d.getMonth() - i);
    buckets.push({
      bucket: bucketKey(d, granularity),
      label: bucketLabel(d, granularity),
      revenueMinor: 0,
      orderCount: 0,
    });
  }
  const byKey = new Map(buckets.map((b) => [b.bucket, b]));

  for (const o of orders) {
    if (o.status === "cancelled") continue;
    const k = bucketKey(new Date(o.createdAt), granularity);
    const slot = byKey.get(k);
    if (slot) {
      slot.revenueMinor += o.totalMinor;
      slot.orderCount += 1;
    }
  }
  return buckets;
}

export interface TopProductRow {
  productName: string;
  qty: number;
  revenueMinor: number;
}

export async function topProducts(limit = 5): Promise<TopProductRow[]> {
  const orders = await listOrders();
  const tally = new Map<string, TopProductRow>();
  for (const o of orders) {
    if (o.status === "cancelled") continue;
    for (const it of o.items) {
      if (it.status === "cancelled") continue;
      const row = tally.get(it.productName);
      if (row) {
        row.qty += it.qty;
        row.revenueMinor += it.unitPriceMinor * it.qty;
      } else {
        tally.set(it.productName, {
          productName: it.productName,
          qty: it.qty,
          revenueMinor: it.unitPriceMinor * it.qty,
        });
      }
    }
  }
  return Array.from(tally.values())
    .sort((a, b) => b.revenueMinor - a.revenueMinor)
    .slice(0, limit);
}

export interface AnalyticsHeadline {
  totalRevenueMinor: number;
  totalOrders: number;
  averageOrderMinor: number;
  refundedMinor: number;
  conversionRatePct: number | null;
}

export async function analyticsHeadline(): Promise<AnalyticsHeadline> {
  const orders = await listOrders();
  const valid = orders.filter((o) => o.status !== "cancelled");
  const totalRevenueMinor = valid.reduce((s, o) => s + o.totalMinor, 0);
  const totalOrders = valid.length;
  const refundedMinor = orders.reduce(
    (s, o) => s + o.refunds.reduce((r, x) => r + x.amountMinor, 0),
    0,
  );
  return {
    totalRevenueMinor,
    totalOrders,
    averageOrderMinor: totalOrders > 0 ? Math.round(totalRevenueMinor / totalOrders) : 0,
    refundedMinor,
    conversionRatePct: null,
  };
}

// ─── Shop hero slides ─────────────────────────────────────────────────────

export interface AdminShopHeroSlide {
  id: string;
  /** H1 başlık (italik serif olarak render edilir, son kelime script vurgu alabilir). */
  title: string;
  /** Başlığın altındaki küçük yazı; eyebrow tarzı veya küçük açıklama. */
  subtitle: string;
  /** Arkadaki görsel URL'si (full-width). Boşsa altın gradient fallback render edilir. */
  imageUrl: string;
  /** CTA buton yazısı — boşsa buton render edilmez. */
  ctaLabel: string;
  /** CTA hedef URL — full URL veya yerel "/odeme" gibi. */
  ctaHref: string;
  /** Metin teması: arka plan koyu görsel ise "light", aydınlık ise "dark". */
  textTheme: "light" | "dark";
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const SEED_SHOP_HERO_SLIDES: AdminShopHeroSlide[] = [
  {
    id: "shero-001",
    title: "Eve servis · İtalyan ritüeli",
    subtitle: "Bütün mağaza ürünleri 500₺ üzeri ücretsiz kargo, İstanbul içi aynı gün.",
    imageUrl: "",
    ctaLabel: "Mağazaya gir",
    ctaHref: "#products",
    textTheme: "light",
    sortOrder: 0,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "shero-002",
    title: "Yenilebilir kup koleksiyonu",
    subtitle: "1994 patentli waffle kup — 6'lı ve 12'li hediye kutuları.",
    imageUrl: "",
    ctaLabel: "Edible Cups",
    ctaHref: "#products",
    textTheme: "light",
    sortOrder: 1,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

let shopHeroSeedPromise: Promise<void> | null = null;
async function ensureShopHeroSeed(): Promise<void> {
  if (shopHeroSeedPromise) return shopHeroSeedPromise;
  shopHeroSeedPromise = (async () => {
    const db = await getDb();
    const count = await db.collection(COLLECTIONS.shopHeroSlides).countDocuments({});
    if (count === 0) {
      await db
        .collection<AdminShopHeroSlide>(COLLECTIONS.shopHeroSlides)
        .insertMany(SEED_SHOP_HERO_SLIDES.map((s) => ({ ...s })));
    }
  })();
  return shopHeroSeedPromise;
}

export async function listShopHeroSlides(): Promise<AdminShopHeroSlide[]> {
  await ensureShopHeroSeed();
  const db = await getDb();
  const docs = await db
    .collection<AdminShopHeroSlide>(COLLECTIONS.shopHeroSlides)
    .find({})
    .sort({ sortOrder: 1, createdAt: 1 })
    .toArray();
  return stripMany(docs);
}

export async function listActiveShopHeroSlides(): Promise<AdminShopHeroSlide[]> {
  const all = await listShopHeroSlides();
  return all.filter((s) => s.isActive);
}

export async function getShopHeroSlide(id: string): Promise<AdminShopHeroSlide | null> {
  await ensureShopHeroSeed();
  const db = await getDb();
  const doc = await db
    .collection<AdminShopHeroSlide>(COLLECTIONS.shopHeroSlides)
    .findOne({ id });
  return strip(doc);
}

export interface ShopHeroSlideInput {
  title: string;
  subtitle: string;
  imageUrl: string;
  ctaLabel: string;
  ctaHref: string;
  textTheme: "light" | "dark";
  sortOrder: number;
  isActive: boolean;
}

function normalizeSlide(input: ShopHeroSlideInput): ShopHeroSlideInput {
  return {
    title: input.title.trim().slice(0, 120),
    subtitle: input.subtitle.trim().slice(0, 300),
    /* 4 MB clamp — yeterli data URL'i ve normal CDN URL'lerini kapsar.
       Hero görseli için 1920px JPEG @ 0.85 kalite tipik olarak ~600-1500KB
       base64 boyutuna ulaşır; sabit 500 char limiti URL'i kesip görseli
       bozardı. */
    imageUrl: input.imageUrl.trim().slice(0, 4 * 1024 * 1024),
    ctaLabel: input.ctaLabel.trim().slice(0, 40),
    ctaHref: input.ctaHref.trim().slice(0, 200),
    textTheme: input.textTheme === "dark" ? "dark" : "light",
    sortOrder: Number.isFinite(input.sortOrder) ? Math.max(0, Math.floor(input.sortOrder)) : 0,
    isActive: !!input.isActive,
  };
}

export async function createShopHeroSlide(
  input: ShopHeroSlideInput,
): Promise<AdminShopHeroSlide> {
  await ensureShopHeroSeed();
  const db = await getDb();
  const now = new Date().toISOString();
  const slide: AdminShopHeroSlide = {
    id: `shero-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...normalizeSlide(input),
    createdAt: now,
    updatedAt: now,
  };
  await db.collection<AdminShopHeroSlide>(COLLECTIONS.shopHeroSlides).insertOne(slide);
  return slide;
}

export async function updateShopHeroSlide(
  id: string,
  input: ShopHeroSlideInput,
): Promise<AdminShopHeroSlide | null> {
  await ensureShopHeroSeed();
  const db = await getDb();
  const update = { ...normalizeSlide(input), updatedAt: new Date().toISOString() };
  await db
    .collection<AdminShopHeroSlide>(COLLECTIONS.shopHeroSlides)
    .updateOne({ id }, { $set: update });
  return getShopHeroSlide(id);
}

export async function deleteShopHeroSlide(id: string): Promise<void> {
  await ensureShopHeroSeed();
  const db = await getDb();
  await db.collection<AdminShopHeroSlide>(COLLECTIONS.shopHeroSlides).deleteOne({ id });
}
