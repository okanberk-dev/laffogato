import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";

import { getSupabaseAdmin, TABLES } from "@/lib/supabase/server";
import { nextSeq } from "@/lib/supabase/counters";
import { computeOrderTotals, type CheckoutConfig } from "@/lib/utils/commerce";
import {
  MENU as SEED_MENU,
  PRODUCTS as SEED_PRODUCTS,
  type MenuCategory as DesignMenuCategory,
  type Product as DesignProduct,
} from "@/components/laffogato/data";

import type { WeeklyHours } from "./days";

/**
 * Veri katmanı — Supabase (Postgres) üzerinden çalışır.
 *
 * Public API'lerin tamamı async ve mevcut admin sayfalarıyla uyumlu kalır.
 * Tablo boşsa SEED verisi otomatik yüklenir (idempotent — yalnızca
 * count === 0 ise tetiklenir; insert'ler upsert/ignoreDuplicates ile
 * yarış-güvenli). İç-içe alanlar (variants, items, refunds, ...) JSONB
 * kolonlarda tutulur; tarih alanları ISO-8601 metni olarak saklanır.
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

// ─── Supabase helpers ──────────────────────────────────────────────────────

function rows<T>(
  res: { data: T[] | null; error: PostgrestError | null },
  ctx: string,
): T[] {
  if (res.error) throw new Error(`${ctx}: ${res.error.message}`);
  return res.data ?? [];
}

function one<T>(
  res: { data: T | null; error: PostgrestError | null },
  ctx: string,
): T | null {
  if (res.error) throw new Error(`${ctx}: ${res.error.message}`);
  return res.data;
}

function check(res: { error: PostgrestError | null }, ctx: string): void {
  if (res.error) throw new Error(`${ctx}: ${res.error.message}`);
}

async function countRows(table: string): Promise<number> {
  const sb = getSupabaseAdmin();
  const { count, error, status } = await sb
    .from(table)
    .select("*", { count: "exact", head: true });
  // head:true issues a HEAD request whose error body is empty, so error.message
  // is blank — fall back to the HTTP status for a useful message.
  if (error) {
    throw new Error(`count(${table}) [${status}]: ${error.message || "request failed"}`);
  }
  return count ?? 0;
}

async function setCounter(id: string, seq: number): Promise<void> {
  const sb = getSupabaseAdmin();
  check(
    await sb.from(TABLES.counters).upsert({ id, seq }, { onConflict: "id" }),
    `setCounter(${id})`,
  );
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

// ─── Seed (idempotent — yalnızca tablo boşsa çalışır) ─────────────────────

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
    const sb = getSupabaseAdmin();
    const now = new Date().toISOString();

    if ((await countRows(TABLES.products)) === 0) {
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
        check(
          await sb
            .from(TABLES.products)
            .upsert(seeded, { onConflict: "id", ignoreDuplicates: true }),
          "seed.products",
        );
        await setCounter("prd", seeded.length);
      }
    }

    if ((await countRows(TABLES.categories)) === 0) {
      const seededCats: AdminCategory[] = [
        { id: slugifyId("cat", 1), slug: "beans",  label: "Çekirdek", icon: "◉", sortOrder: 0 },
        { id: slugifyId("cat", 2), slug: "gift",   label: "Hediye",   icon: "◈", sortOrder: 1 },
        { id: slugifyId("cat", 3), slug: "gear",   label: "Ekipman",  icon: "◇", sortOrder: 2 },
        { id: slugifyId("cat", 4), slug: "merch",  label: "Giyim",    icon: "◐", sortOrder: 3 },
        { id: slugifyId("cat", 5), slug: "pantry", label: "Kiler",    icon: "◇", sortOrder: 4 },
      ];
      check(
        await sb
          .from(TABLES.categories)
          .upsert(seededCats, { onConflict: "id", ignoreDuplicates: true }),
        "seed.categories",
      );
      await setCounter("cat", seededCats.length);
    }

    if ((await countRows(TABLES.menuItems)) === 0) {
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
        check(
          await sb
            .from(TABLES.menuItems)
            .upsert(seededMenu, { onConflict: "id", ignoreDuplicates: true }),
          "seed.menu",
        );
        await setCounter("mnu", counter);
      }
    }

    if ((await countRows(TABLES.settings)) === 0) {
      check(
        await sb
          .from(TABLES.settings)
          .upsert(
            { id: "main", ...defaultSettings() },
            { onConflict: "id", ignoreDuplicates: true },
          ),
        "seed.settings",
      );
    }

    if ((await countRows(TABLES.orders)) === 0) {
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
      check(
        await sb
          .from(TABLES.orders)
          .upsert(demoOrders, { onConflict: "id", ignoreDuplicates: true }),
        "seed.orders",
      );
      await setCounter("ord", demoOrders.length);
      await setCounter("orderNo", 10_003);
    }
  })();
  return seedPromise;
}

// ─── Products ─────────────────────────────────────────────────────────────

export async function listProducts(): Promise<AdminProduct[]> {
  await ensureSeed();
  const sb = getSupabaseAdmin();
  return rows<AdminProduct>(
    await sb.from(TABLES.products).select("*").order("updatedAt", { ascending: false }),
    "listProducts",
  );
}

export async function getProduct(id: string): Promise<AdminProduct | null> {
  await ensureSeed();
  const sb = getSupabaseAdmin();
  return one<AdminProduct>(
    await sb.from(TABLES.products).select("*").eq("id", id).maybeSingle(),
    "getProduct",
  );
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
  const sb = getSupabaseAdmin();
  // 20 deneme yeter — gerçekçi tekrar sayısı çok düşük.
  for (let i = 0; i < 20; i += 1) {
    let q = sb.from(TABLES.products).select("id").eq("slug", attempt);
    if (ignoreId) q = q.neq("id", ignoreId);
    const found = rows<{ id: string }>(await q.limit(1), "uniqueSlug");
    if (found.length === 0) return attempt;
    n += 1;
    attempt = `${base}-${n}`;
  }
  return attempt;
}

export async function createProduct(input: ProductInput): Promise<AdminProduct> {
  await ensureSeed();
  const sb = getSupabaseAdmin();
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
  check(await sb.from(TABLES.products).insert(product), "createProduct");
  return product;
}

export async function updateProduct(
  id: string,
  input: ProductInput,
): Promise<AdminProduct | null> {
  await ensureSeed();
  const sb = getSupabaseAdmin();
  const existing = await getProduct(id);
  if (!existing) return null;
  const slug = await uniqueSlug(input.slug || slugify(input.name) || existing.slug, id);
  const next: AdminProduct = {
    ...existing,
    ...input,
    slug,
    sku: input.sku || existing.sku,
    updatedAt: new Date().toISOString(),
  };
  check(await sb.from(TABLES.products).update(next).eq("id", id), "updateProduct");
  return next;
}

export async function deleteProduct(id: string): Promise<boolean> {
  await ensureSeed();
  const sb = getSupabaseAdmin();
  const deleted = rows<{ id: string }>(
    await sb.from(TABLES.products).delete().eq("id", id).select("id"),
    "deleteProduct",
  );
  return deleted.length > 0;
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
  const sb = getSupabaseAdmin();
  const now = new Date().toISOString();

  if (op.kind === "delete") {
    const res = rows<{ id: string }>(
      await sb.from(TABLES.products).delete().in("id", ids).select("id"),
      "bulkUpdateProducts.delete",
    );
    return { updated: res.length };
  }

  if (op.kind === "activate") {
    const res = rows<{ id: string }>(
      await sb
        .from(TABLES.products)
        .update({ isActive: true, updatedAt: now })
        .in("id", ids)
        .eq("isActive", false)
        .select("id"),
      "bulkUpdateProducts.activate",
    );
    return { updated: res.length };
  }

  if (op.kind === "deactivate") {
    const res = rows<{ id: string }>(
      await sb
        .from(TABLES.products)
        .update({ isActive: false, updatedAt: now })
        .in("id", ids)
        .eq("isActive", true)
        .select("id"),
      "bulkUpdateProducts.deactivate",
    );
    return { updated: res.length };
  }

  // set_category
  const res = rows<{ id: string }>(
    await sb
      .from(TABLES.products)
      .update({ cat: op.cat, updatedAt: now })
      .in("id", ids)
      .neq("cat", op.cat)
      .select("id"),
    "bulkUpdateProducts.set_category",
  );
  return { updated: res.length };
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

async function recordStockMove(
  input: Omit<AdminStockMove, "id" | "createdAt">,
): Promise<AdminStockMove> {
  const sb = getSupabaseAdmin();
  const seq = await nextSeq("mov");
  const move: AdminStockMove = {
    id: `mov-${String(seq).padStart(6, "0")}`,
    createdAt: new Date().toISOString(),
    ...input,
  };
  check(await sb.from(TABLES.stockMoves).insert(move), "recordStockMove");
  return move;
}

export async function listStockMoves(filter?: {
  productId?: string;
  reason?: StockMoveReason;
  limit?: number;
}): Promise<AdminStockMove[]> {
  await ensureSeed();
  const sb = getSupabaseAdmin();
  let q = sb.from(TABLES.stockMoves).select("*");
  if (filter?.productId) q = q.eq("productId", filter.productId);
  if (filter?.reason) q = q.eq("reason", filter.reason);
  return rows<AdminStockMove>(
    await q.order("createdAt", { ascending: false }).limit(filter?.limit ?? 500),
    "listStockMoves",
  );
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
  const sb = getSupabaseAdmin();
  const product = await getProduct(input.productId);
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
  check(
    await sb
      .from(TABLES.products)
      .update({ stock: next, updatedAt })
      .eq("id", input.productId),
    "adjustStock.update",
  );
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
    product: { ...product, stock: next, updatedAt },
  };
}

// ─── Categories ───────────────────────────────────────────────────────────

export async function listCategories(): Promise<AdminCategory[]> {
  await ensureSeed();
  const sb = getSupabaseAdmin();
  return rows<AdminCategory>(
    await sb.from(TABLES.categories).select("*").order("sortOrder", { ascending: true }),
    "listCategories",
  );
}

export async function getCategory(id: string): Promise<AdminCategory | null> {
  await ensureSeed();
  const sb = getSupabaseAdmin();
  return one<AdminCategory>(
    await sb.from(TABLES.categories).select("*").eq("id", id).maybeSingle(),
    "getCategory",
  );
}

export interface CategoryInput {
  slug: ShopCategoryId;
  label: string;
  icon: string;
  sortOrder: number;
}

export async function createCategory(input: CategoryInput): Promise<AdminCategory> {
  await ensureSeed();
  const sb = getSupabaseAdmin();
  const seq = await nextSeq("cat");
  const c: AdminCategory = { id: slugifyId("cat", seq), ...input };
  check(await sb.from(TABLES.categories).insert(c), "createCategory");
  return c;
}

export async function updateCategory(
  id: string,
  input: CategoryInput,
): Promise<AdminCategory | null> {
  await ensureSeed();
  const sb = getSupabaseAdmin();
  const existing = await getCategory(id);
  if (!existing) return null;
  const next: AdminCategory = { ...existing, ...input };
  check(await sb.from(TABLES.categories).update(next).eq("id", id), "updateCategory");
  return next;
}

export async function deleteCategory(id: string): Promise<boolean> {
  await ensureSeed();
  const sb = getSupabaseAdmin();
  const deleted = rows<{ id: string }>(
    await sb.from(TABLES.categories).delete().eq("id", id).select("id"),
    "deleteCategory",
  );
  return deleted.length > 0;
}

// ─── Orders ───────────────────────────────────────────────────────────────

export async function listOrders(): Promise<AdminOrder[]> {
  await ensureSeed();
  const sb = getSupabaseAdmin();
  return rows<AdminOrder>(
    await sb.from(TABLES.orders).select("*").order("orderNo", { ascending: false }),
    "listOrders",
  );
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
  const sb = getSupabaseAdmin();
  // ilike ile case-insensitive ön-filtre; JS'te tam (lowercase) eşleşme.
  const escaped = needle.replace(/[%_]/g, (c) => `\\${c}`);
  const candidates = rows<AdminOrder>(
    await sb
      .from(TABLES.orders)
      .select("*")
      .ilike("customerEmail", escaped)
      .order("orderNo", { ascending: false }),
    "customerOrdersByEmail",
  );
  return candidates.filter((o) => o.customerEmail?.trim().toLowerCase() === needle);
}

export async function getOrder(id: string): Promise<AdminOrder | null> {
  await ensureSeed();
  const sb = getSupabaseAdmin();
  return one<AdminOrder>(
    await sb.from(TABLES.orders).select("*").eq("id", id).maybeSingle(),
    "getOrder",
  );
}

export async function updateOrderStatus(
  id: string,
  status: AdminOrderStatus,
): Promise<AdminOrder | null> {
  await ensureSeed();
  const sb = getSupabaseAdmin();
  return one<AdminOrder>(
    await sb
      .from(TABLES.orders)
      .update({ status })
      .eq("id", id)
      .select("*")
      .maybeSingle(),
    "updateOrderStatus",
  );
}

export type BulkOrderOp = { kind: "set_status"; status: AdminOrderStatus };

export async function bulkUpdateOrders(
  ids: string[],
  op: BulkOrderOp,
): Promise<BulkResult> {
  if (ids.length === 0) return { updated: 0 };
  await ensureSeed();
  const sb = getSupabaseAdmin();
  const res = rows<{ id: string }>(
    await sb
      .from(TABLES.orders)
      .update({ status: op.status })
      .in("id", ids)
      .neq("status", op.status)
      .select("id"),
    "bulkUpdateOrders",
  );
  return { updated: res.length };
}

export interface PlaceOrderItemInput {
  /** Stable product id — preferred match key. */
  productId?: string;
  /** Product name — fallback match key for legacy carts. */
  name: string;
  /** Selected variant id, if any. */
  variantId?: string;
  qty: number;
  /** Client-sent price — IGNORED for charging; only used to detect drift. */
  priceMinor?: number;
}

export interface PlaceOrderInput {
  items: PlaceOrderItemInput[];
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  shippingAddress?: string;
  promoCode?: string;
}

export type PlaceOrderResult =
  | { ok: true; order: AdminOrder; priceAdjusted: boolean }
  | { ok: false; reason: "out_of_stock"; productName: string; available: number }
  | { ok: false; reason: "empty" }
  | { ok: false; reason: "not_found"; productName: string };

/**
 * Creates an order from a cart. SECURITY: unit prices are resolved from the
 * database (base price + active variant delta), never trusted from the client.
 * Stock is validated up-front for ALL lines before any decrement (no partial
 * writes). Shipping is computed from settings; the cart total is authoritative.
 */
export async function placeOrder(
  input: PlaceOrderInput,
): Promise<PlaceOrderResult> {
  await ensureSeed();
  const sb = getSupabaseAdmin();
  const cleanItems = input.items.filter((it) => it.qty > 0 && it.qty <= 99);
  if (cleanItems.length === 0) return { ok: false, reason: "empty" };

  // Resolve each line against the DB by id (preferred) or name. Two filtered
  // reads merged by id avoids escaping issues with names in a combined .or().
  const ids = cleanItems.map((it) => it.productId).filter(Boolean) as string[];
  const names = cleanItems.map((it) => it.name);
  const [byIdDocs, byNameDocs] = await Promise.all([
    ids.length > 0
      ? rows<AdminProduct>(
          await sb.from(TABLES.products).select("*").in("id", ids),
          "placeOrder.byId",
        )
      : Promise.resolve([] as AdminProduct[]),
    names.length > 0
      ? rows<AdminProduct>(
          await sb.from(TABLES.products).select("*").in("name", names),
          "placeOrder.byName",
        )
      : Promise.resolve([] as AdminProduct[]),
  ]);
  const byId = new Map<string, AdminProduct>();
  const byName = new Map<string, AdminProduct>();
  for (const p of [...byIdDocs, ...byNameDocs]) {
    byId.set(p.id, p);
    byName.set(p.name, p);
  }

  interface ResolvedLine {
    product: AdminProduct;
    variant: AdminProductVariant | null;
    qty: number;
    unitPriceMinor: number;
    label: string;
  }
  const resolved: ResolvedLine[] = [];
  let priceAdjusted = false;

  for (const it of cleanItems) {
    const product =
      (it.productId ? byId.get(it.productId) : undefined) ?? byName.get(it.name);
    if (!product || !product.isActive) {
      return { ok: false, reason: "not_found", productName: it.name };
    }
    const variant = it.variantId
      ? product.variants.find((v) => v.id === it.variantId && v.isActive) ?? null
      : null;
    // Server-authoritative price: base + variant delta.
    const unitPriceMinor = Math.max(0, product.priceMinor + (variant?.priceDeltaMinor ?? 0));
    if (it.priceMinor !== undefined && it.priceMinor !== unitPriceMinor) {
      priceAdjusted = true;
    }
    // Stock check (variant stock when a variant is chosen, else product stock).
    const available = variant ? variant.stock : product.stock;
    if (available < it.qty) {
      return {
        ok: false,
        reason: "out_of_stock",
        productName: variant ? `${product.name} · ${variant.name}` : product.name,
        available,
      };
    }
    resolved.push({
      product,
      variant,
      qty: it.qty,
      unitPriceMinor,
      label: variant ? `${product.name} · ${variant.name}` : product.name,
    });
  }

  const now = new Date().toISOString();
  const orderSeq = await nextSeq("ord");
  const orderNo = await nextSeq("orderNo");
  const orderId = slugifyId("ord", orderSeq);

  // Decrement stock — product stock always; variant stock when applicable.
  for (const line of resolved) {
    const stockAfter = Math.max(0, line.product.stock - line.qty);
    const update: Record<string, unknown> = { stock: stockAfter, updatedAt: now };
    if (line.variant) {
      const nextVariants = line.product.variants.map((v) =>
        v.id === line.variant!.id ? { ...v, stock: Math.max(0, v.stock - line.qty) } : v,
      );
      update.variants = nextVariants;
      // Keep the in-memory copy coherent if the same product appears twice.
      line.product.variants = nextVariants as AdminProductVariant[];
    }
    line.product.stock = stockAfter;
    check(
      await sb.from(TABLES.products).update(update).eq("id", line.product.id),
      "placeOrder.decrement",
    );
    await recordStockMove({
      productId: line.product.id,
      productName: line.label,
      delta: -line.qty,
      stockAfter,
      reason: "order_placed",
      note: `Sipariş #${orderNo}`,
      orderId,
      actor: input.customerEmail ?? "customer",
    });
  }

  const items: AdminOrderItem[] = resolved.map((line) => ({
    productName: line.label,
    qty: line.qty,
    unitPriceMinor: line.unitPriceMinor,
    status: "pending",
  }));
  const subtotalMinor = items.reduce((s, it) => s + it.unitPriceMinor * it.qty, 0);

  // Promo (validated server-side against the authoritative subtotal).
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

  // Shipping + total from settings (single source of truth).
  const settings = await getSettings();
  const cfg: CheckoutConfig = {
    shippingFlatMinor: settings.shippingFlatMinor,
    shippingFreeThresholdMinor: settings.shippingFreeThresholdMinor,
    taxRatePct: settings.taxRatePct,
  };
  const totals = computeOrderTotals(subtotalMinor, discountMinor, cfg);

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
    subtotalMinor: totals.subtotalMinor,
    discountMinor: totals.discountMinor,
    promoCode,
    shippingMinor: totals.shippingMinor,
    totalMinor: totals.totalMinor,
    refunds: [],
    createdAt: new Date().toISOString(),
  };
  check(await sb.from(TABLES.orders).insert(order), "placeOrder.insert");
  return { ok: true, order, priceAdjusted };
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
  const sb = getSupabaseAdmin();
  const existing = await getOrder(id);
  if (!existing) return { ok: false, error: "Sipariş bulunamadı." };
  const map = TRANSITION_MAP[transition];
  if (!map) return { ok: false, error: "Geçersiz işlem." };
  if (!map.from.includes(existing.status)) {
    return {
      ok: false,
      error: `Bu işlem '${existing.status}' durumunda yapılamaz.`,
    };
  }
  check(
    await sb.from(TABLES.orders).update({ status: map.to }).eq("id", id),
    "transitionOrder",
  );
  return { ok: true, order: { ...existing, status: map.to } };
}

export async function setOrderInternalNote(
  id: string,
  note: string,
): Promise<AdminOrder | null> {
  await ensureSeed();
  const sb = getSupabaseAdmin();
  const trimmed = note.slice(0, 2000);
  const existing = await getOrder(id);
  if (!existing) return null;
  check(
    await sb.from(TABLES.orders).update({ internalNote: trimmed }).eq("id", id),
    "setOrderInternalNote",
  );
  return { ...existing, internalNote: trimmed };
}

export async function setOrderItemStatus(
  orderId: string,
  itemIndex: number,
  status: AdminOrderItemStatus,
): Promise<AdminOrder | null> {
  await ensureSeed();
  const sb = getSupabaseAdmin();
  const existing = await getOrder(orderId);
  if (!existing) return null;
  if (itemIndex < 0 || itemIndex >= existing.items.length) return null;
  const nextItems = existing.items.map((it, i) =>
    i === itemIndex ? { ...it, status } : it,
  );
  check(
    await sb.from(TABLES.orders).update({ items: nextItems }).eq("id", orderId),
    "setOrderItemStatus",
  );
  return { ...existing, items: nextItems };
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
  const sb = getSupabaseAdmin();
  const existing = await getOrder(orderId);
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
  check(
    await sb
      .from(TABLES.orders)
      .update({ refunds: nextRefunds, status })
      .eq("id", orderId),
    "refundOrder",
  );
  return {
    ok: true,
    order: { ...existing, refunds: nextRefunds, status },
    refund,
  };
}

// ─── Settings ─────────────────────────────────────────────────────────────

export async function getSettings(): Promise<AdminSettings> {
  await ensureSeed();
  const sb = getSupabaseAdmin();
  const doc = one<Record<string, unknown>>(
    await sb.from(TABLES.settings).select("*").eq("id", "main").maybeSingle(),
    "getSettings",
  );
  if (!doc) return defaultSettings();
  const { id: _id, ...rest } = doc;
  void _id;
  return rest as unknown as AdminSettings;
}

export async function updateSettings(
  input: Partial<AdminSettings>,
): Promise<AdminSettings> {
  await ensureSeed();
  const sb = getSupabaseAdmin();
  check(
    await sb
      .from(TABLES.settings)
      .upsert({ id: "main", ...input }, { onConflict: "id" }),
    "updateSettings",
  );
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
  const sb = getSupabaseAdmin();

  const [
    productCount,
    activeProductCount,
    outOfStockCount,
    categoryCount,
    orderCount,
    pendingOrderCount,
    revenueRows,
  ] = await Promise.all([
    countRows(TABLES.products),
    sb
      .from(TABLES.products)
      .select("*", { count: "exact", head: true })
      .eq("isActive", true)
      .then((r) => {
        if (r.error) throw new Error(`getDashboardStats.active: ${r.error.message}`);
        return r.count ?? 0;
      }),
    sb
      .from(TABLES.products)
      .select("*", { count: "exact", head: true })
      .eq("stock", 0)
      .then((r) => {
        if (r.error) throw new Error(`getDashboardStats.oos: ${r.error.message}`);
        return r.count ?? 0;
      }),
    countRows(TABLES.categories),
    countRows(TABLES.orders),
    sb
      .from(TABLES.orders)
      .select("*", { count: "exact", head: true })
      .in("status", ["pending_payment", "paid", "preparing"])
      .then((r) => {
        if (r.error) throw new Error(`getDashboardStats.pending: ${r.error.message}`);
        return r.count ?? 0;
      }),
    sb
      .from(TABLES.orders)
      .select("totalMinor")
      .in("status", ["paid", "preparing", "shipped", "completed"])
      .then((r) => {
        if (r.error) throw new Error(`getDashboardStats.revenue: ${r.error.message}`);
        return (r.data ?? []) as Array<{ totalMinor: number }>;
      }),
  ]);

  const revenueMinor = revenueRows.reduce((s, o) => s + (o.totalMinor ?? 0), 0);

  return {
    productCount,
    activeProductCount,
    outOfStockCount,
    categoryCount,
    orderCount,
    pendingOrderCount,
    revenueMinor,
  };
}

export { SEED_MENU as CAFE_MENU };

// ─── Public read for customer site ────────────────────────────────────────

function toDesignProduct(p: AdminProduct): DesignProduct {
  return {
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
    // Rich fields for the PDP + cart.
    slug: p.slug,
    sku: p.sku,
    images: p.images.length > 0 ? [...p.images] : undefined,
    stock: p.stock,
    lowStockThreshold: p.lowStockThreshold,
    weightGrams: p.weightGrams,
    priceMinor: p.priceMinor,
    compareAtPriceMinor: p.compareAtPriceMinor > p.priceMinor ? p.compareAtPriceMinor : undefined,
    variants: p.variants
      .filter((v) => v.isActive)
      .map((v) => ({
        id: v.id,
        name: v.name,
        priceDelta: v.priceDeltaMinor / 100,
        stock: v.stock,
        isActive: v.isActive,
      })),
  };
}

export async function listShopProducts(): Promise<DesignProduct[]> {
  const all = await listProducts();
  return all.filter((p) => p.isActive).map(toDesignProduct);
}

/** Single active product by slug — for the PDP (/magaza/urun/<slug>). */
export async function getShopProductBySlug(
  slug: string,
): Promise<DesignProduct | null> {
  await ensureSeed();
  const sb = getSupabaseAdmin();
  const doc = one<AdminProduct>(
    await sb
      .from(TABLES.products)
      .select("*")
      .eq("slug", slug)
      .eq("isActive", true)
      .maybeSingle(),
    "getShopProductBySlug",
  );
  if (!doc) return null;
  return toDesignProduct(doc);
}

/** Up to `limit` other active products sharing the category (for cross-sell). */
export async function listRelatedShopProducts(
  cat: ShopCategoryId,
  excludeId: string,
  limit = 4,
): Promise<DesignProduct[]> {
  await ensureSeed();
  const sb = getSupabaseAdmin();
  const docs = rows<AdminProduct>(
    await sb
      .from(TABLES.products)
      .select("*")
      .eq("cat", cat)
      .eq("isActive", true)
      .neq("id", excludeId)
      .limit(limit),
    "listRelatedShopProducts",
  );
  return docs.map(toDesignProduct);
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
  const sb = getSupabaseAdmin();
  const docs = rows<AdminMenuItem>(
    await sb.from(TABLES.menuItems).select("*"),
    "listMenuItems",
  );
  return docs.sort((a, b) => {
    const aIdx = MENU_CATEGORY_KEYS.indexOf(a.categoryKey);
    const bIdx = MENU_CATEGORY_KEYS.indexOf(b.categoryKey);
    if (aIdx !== bIdx) return aIdx - bIdx;
    return a.sortOrder - b.sortOrder;
  });
}

export async function getMenuItem(id: string): Promise<AdminMenuItem | null> {
  await ensureSeed();
  const sb = getSupabaseAdmin();
  return one<AdminMenuItem>(
    await sb.from(TABLES.menuItems).select("*").eq("id", id).maybeSingle(),
    "getMenuItem",
  );
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
  const sb = getSupabaseAdmin();
  const seq = await nextSeq("mnu");
  const item: AdminMenuItem = {
    id: slugifyId("mnu", seq),
    ...input,
    updatedAt: new Date().toISOString(),
  };
  check(await sb.from(TABLES.menuItems).insert(item), "createMenuItem");
  return item;
}

export async function updateMenuItem(
  id: string,
  input: MenuItemInput,
): Promise<AdminMenuItem | null> {
  await ensureSeed();
  const sb = getSupabaseAdmin();
  const existing = await getMenuItem(id);
  if (!existing) return null;
  const next: AdminMenuItem = {
    ...existing,
    ...input,
    updatedAt: new Date().toISOString(),
  };
  check(await sb.from(TABLES.menuItems).update(next).eq("id", id), "updateMenuItem");
  return next;
}

export async function deleteMenuItem(id: string): Promise<boolean> {
  await ensureSeed();
  const sb = getSupabaseAdmin();
  const deleted = rows<{ id: string }>(
    await sb.from(TABLES.menuItems).delete().eq("id", id).select("id"),
    "deleteMenuItem",
  );
  return deleted.length > 0;
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
  const sb = getSupabaseAdmin();
  const now = new Date().toISOString();

  if (op.kind === "delete") {
    const res = rows<{ id: string }>(
      await sb.from(TABLES.menuItems).delete().in("id", ids).select("id"),
      "bulkUpdateMenuItems.delete",
    );
    return { updated: res.length };
  }

  if (op.kind === "activate") {
    const res = rows<{ id: string }>(
      await sb
        .from(TABLES.menuItems)
        .update({ isActive: true, updatedAt: now })
        .in("id", ids)
        .eq("isActive", false)
        .select("id"),
      "bulkUpdateMenuItems.activate",
    );
    return { updated: res.length };
  }

  if (op.kind === "deactivate") {
    const res = rows<{ id: string }>(
      await sb
        .from(TABLES.menuItems)
        .update({ isActive: false, updatedAt: now })
        .in("id", ids)
        .eq("isActive", true)
        .select("id"),
      "bulkUpdateMenuItems.deactivate",
    );
    return { updated: res.length };
  }

  const res = rows<{ id: string }>(
    await sb
      .from(TABLES.menuItems)
      .update({ categoryKey: op.categoryKey, updatedAt: now })
      .in("id", ids)
      .neq("categoryKey", op.categoryKey)
      .select("id"),
    "bulkUpdateMenuItems.set_category",
  );
  return { updated: res.length };
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
  const sb = getSupabaseAdmin();
  return rows<AdminPromo>(
    await sb.from(TABLES.promos).select("*").order("createdAt", { ascending: false }),
    "listPromos",
  );
}

export async function getPromo(id: string): Promise<AdminPromo | null> {
  await ensureSeed();
  const sb = getSupabaseAdmin();
  return one<AdminPromo>(
    await sb.from(TABLES.promos).select("*").eq("id", id).maybeSingle(),
    "getPromo",
  );
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
  const sb = getSupabaseAdmin();
  const conflict = one<{ id: string }>(
    await sb.from(TABLES.promos).select("id").eq("code", code).maybeSingle(),
    "createPromo.conflict",
  );
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
  check(await sb.from(TABLES.promos).insert(promo), "createPromo.insert");
  return { ok: true, promo };
}

export async function updatePromo(
  id: string,
  input: PromoInput,
): Promise<PromoMutationResult> {
  await ensureSeed();
  const sb = getSupabaseAdmin();
  const existing = await getPromo(id);
  if (!existing) return { ok: false, error: "Kod bulunamadı." };
  const code = normalizeCode(input.code);
  if (!code) return { ok: false, error: "Kod boş olamaz." };
  const conflict = one<{ id: string }>(
    await sb
      .from(TABLES.promos)
      .select("id")
      .eq("code", code)
      .neq("id", id)
      .maybeSingle(),
    "updatePromo.conflict",
  );
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
  check(await sb.from(TABLES.promos).update(next).eq("id", id), "updatePromo.update");
  return { ok: true, promo: next };
}

export async function deletePromo(id: string): Promise<boolean> {
  await ensureSeed();
  const sb = getSupabaseAdmin();
  const deleted = rows<{ id: string }>(
    await sb.from(TABLES.promos).delete().eq("id", id).select("id"),
    "deletePromo",
  );
  return deleted.length > 0;
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
  const sb = getSupabaseAdmin();
  const promo = one<AdminPromo>(
    await sb.from(TABLES.promos).select("*").eq("code", needle).maybeSingle(),
    "applyPromoCode",
  );
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
  await ensureSeed();
  const needle = normalizeCode(code);
  const sb = getSupabaseAdmin();
  const promo = one<AdminPromo>(
    await sb.from(TABLES.promos).select("usageCount").eq("code", needle).maybeSingle(),
    "consumePromoUsage.fetch",
  );
  if (!promo) return;
  check(
    await sb
      .from(TABLES.promos)
      .update({ usageCount: promo.usageCount + 1, updatedAt: new Date().toISOString() })
      .eq("code", needle),
    "consumePromoUsage.update",
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
    const sb = getSupabaseAdmin();
    if ((await countRows(TABLES.shopHeroSlides)) === 0) {
      check(
        await sb
          .from(TABLES.shopHeroSlides)
          .upsert(
            SEED_SHOP_HERO_SLIDES.map((s) => ({ ...s })),
            { onConflict: "id", ignoreDuplicates: true },
          ),
        "seed.shopHeroSlides",
      );
    }
  })();
  return shopHeroSeedPromise;
}

export async function listShopHeroSlides(): Promise<AdminShopHeroSlide[]> {
  await ensureShopHeroSeed();
  const sb = getSupabaseAdmin();
  return rows<AdminShopHeroSlide>(
    await sb
      .from(TABLES.shopHeroSlides)
      .select("*")
      .order("sortOrder", { ascending: true })
      .order("createdAt", { ascending: true }),
    "listShopHeroSlides",
  );
}

export async function listActiveShopHeroSlides(): Promise<AdminShopHeroSlide[]> {
  const all = await listShopHeroSlides();
  return all.filter((s) => s.isActive);
}

export async function getShopHeroSlide(id: string): Promise<AdminShopHeroSlide | null> {
  await ensureShopHeroSeed();
  const sb = getSupabaseAdmin();
  return one<AdminShopHeroSlide>(
    await sb.from(TABLES.shopHeroSlides).select("*").eq("id", id).maybeSingle(),
    "getShopHeroSlide",
  );
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
  const sb = getSupabaseAdmin();
  const now = new Date().toISOString();
  const slide: AdminShopHeroSlide = {
    id: `shero-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...normalizeSlide(input),
    createdAt: now,
    updatedAt: now,
  };
  check(await sb.from(TABLES.shopHeroSlides).insert(slide), "createShopHeroSlide");
  return slide;
}

export async function updateShopHeroSlide(
  id: string,
  input: ShopHeroSlideInput,
): Promise<AdminShopHeroSlide | null> {
  await ensureShopHeroSeed();
  const sb = getSupabaseAdmin();
  const update = { ...normalizeSlide(input), updatedAt: new Date().toISOString() };
  check(
    await sb.from(TABLES.shopHeroSlides).update(update).eq("id", id),
    "updateShopHeroSlide",
  );
  return getShopHeroSlide(id);
}

export async function deleteShopHeroSlide(id: string): Promise<void> {
  await ensureShopHeroSeed();
  const sb = getSupabaseAdmin();
  check(
    await sb.from(TABLES.shopHeroSlides).delete().eq("id", id),
    "deleteShopHeroSlide",
  );
}
