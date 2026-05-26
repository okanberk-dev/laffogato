/**
 * MongoDB collection adları. Tek bir yerde tutulur ki tablo isimleri
 * dağılmasın.
 */

export const COLLECTIONS = {
  products: "products",
  categories: "categories",
  orders: "orders",
  menuItems: "menu_items",
  promos: "promos",
  stockMoves: "stock_moves",
  settings: "settings",
  auditLogs: "audit_logs",
  customers: "customers",
  counters: "counters",
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];
