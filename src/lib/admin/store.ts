import "server-only";

import {
  MENU as SEED_MENU,
  PRODUCTS as SEED_PRODUCTS,
  type MenuCategory as DesignMenuCategory,
  type Product as DesignProduct,
} from "@/components/laffogato/data";

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

export interface AdminProduct {
  id: string;
  name: string;
  tag: string;
  /** Minor units (kuruş) — e.g. 32000 = 320,00 ₺ */
  priceMinor: number;
  desc: string;
  cat: ShopCategoryId;
  /** Hue token from PhotoSurface palette (cream, caramel, matcha, ...). */
  img: string;
  stock: number;
  featured: boolean;
  isNew: boolean;
  isActive: boolean;
  updatedAt: string;
}

export interface AdminCategory {
  id: string;
  slug: ShopCategoryId;
  label: string;
  icon: string;
  sortOrder: number;
}

export interface AdminOrderItem {
  productName: string;
  qty: number;
  unitPriceMinor: number;
}

export type AdminOrderStatus =
  | "pending_payment"
  | "paid"
  | "preparing"
  | "shipped"
  | "completed"
  | "cancelled"
  | "refunded";

export interface AdminOrder {
  id: string;
  orderNo: number;
  customerName: string;
  customerEmail: string;
  status: AdminOrderStatus;
  items: AdminOrderItem[];
  subtotalMinor: number;
  shippingMinor: number;
  totalMinor: number;
  createdAt: string;
}

export interface AdminSettings {
  name: string;
  tagline: string;
  phone: string;
  email: string;
  address: string;
  openingHours: string;
  isShopOpen: boolean;
  heroImageUrl: string;
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

const products: AdminProduct[] = SEED_PRODUCTS.map((p, i) => ({
  id: slugifyId("prd", i + 1),
  name: p.name,
  tag: p.tag,
  priceMinor: parsePrice(p.price),
  desc: p.desc,
  cat: p.cat as ShopCategoryId,
  img: p.img,
  stock: 25,
  featured: Boolean(p.featured),
  isNew: Boolean(p.isNew),
  isActive: true,
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
    status: "preparing",
    items: [
      { productName: "Sirena — Espresso Blend", qty: 1, unitPriceMinor: 32000 },
      { productName: "Edible Cups — 6 Box", qty: 1, unitPriceMinor: 24000 },
    ],
    subtotalMinor: 56000,
    shippingMinor: 0,
    totalMinor: 56000,
    createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
  },
  {
    id: slugifyId("ord", 2),
    orderNo: 10_002,
    customerName: "Merve Kaya",
    customerEmail: "merve@example.com",
    status: "paid",
    items: [{ productName: "Affogato Kit — For Two", qty: 1, unitPriceMinor: 78000 }],
    subtotalMinor: 78000,
    shippingMinor: 0,
    totalMinor: 78000,
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: slugifyId("ord", 3),
    orderNo: 10_003,
    customerName: "Deniz Aydın",
    customerEmail: "deniz@example.com",
    status: "completed",
    items: [
      { productName: "Uji Matcha — Ceremonial", qty: 1, unitPriceMinor: 42000 },
      { productName: "Bambu Chasen", qty: 1, unitPriceMinor: 32000 },
    ],
    subtotalMinor: 74000,
    shippingMinor: 0,
    totalMinor: 74000,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
  },
];

let settings: AdminSettings = {
  name: "L'Affogato",
  tagline: "Drink it. Eat the cup.",
  phone: "+90 216 459 30 60",
  email: "maltepe@laffogato.it",
  address: "Maltepe Park AVM, Cevizli, Tugay Yolu Cd. No:67, Maltepe / İstanbul",
  openingHours: "Pzt–Pş 10:00–23:00 · Cu–Ct 10:00–24:00 · Pz 10:00–23:00",
  isShopOpen: true,
  heroImageUrl: "",
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
  tag: string;
  priceMinor: number;
  desc: string;
  cat: ShopCategoryId;
  img: string;
  stock: number;
  featured: boolean;
  isNew: boolean;
  isActive: boolean;
}

export async function createProduct(input: ProductInput): Promise<AdminProduct> {
  const id = slugifyId("prd", products.length + 1);
  const product: AdminProduct = {
    id,
    ...input,
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
  products[idx] = {
    ...products[idx],
    ...input,
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

export interface PlaceOrderInput {
  items: Array<{ name: string; priceMinor: number; qty: number }>;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
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
  // order isn't lost — admin can reconcile manually.
  for (const it of cleanItems) {
    const idx = products.findIndex((p) => p.name === it.name);
    if (idx !== -1) {
      products[idx] = {
        ...products[idx],
        stock: Math.max(0, products[idx].stock - it.qty),
        updatedAt: new Date().toISOString(),
      };
    }
  }

  const items: AdminOrderItem[] = cleanItems.map((it) => ({
    productName: it.name,
    qty: it.qty,
    unitPriceMinor: it.priceMinor,
  }));

  const subtotalMinor = items.reduce(
    (s, it) => s + it.unitPriceMinor * it.qty,
    0,
  );

  const nextNo = orders.length === 0
    ? 10_001
    : Math.max(...orders.map((o) => o.orderNo)) + 1;

  const order: AdminOrder = {
    id: slugifyId("ord", orders.length + 1),
    orderNo: nextNo,
    customerName: input.customerName?.trim() || "Misafir",
    customerEmail: input.customerEmail?.trim() || "guest@laffogato.local",
    status: "pending_payment",
    items,
    subtotalMinor,
    shippingMinor: 0,
    totalMinor: subtotalMinor,
    createdAt: new Date().toISOString(),
  };
  orders.push(order);
  return { ok: true, order };
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
