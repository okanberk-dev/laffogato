/**
 * Bu dosya Supabase MCP `generate_typescript_types` ile yeniden üretilir.
 * Schema değişince tekrar oluştur — elle düzenleme.
 *
 * Çalıştırma (MCP):
 *   mcp__supabase__generate_typescript_types({ project_id: "<ref>" })
 *
 * Şu an placeholder — gerçek tipler üretilince bu dosya tamamen değişecek.
 * Placeholder, geliştirme sırasında derlemeyi engellememek için gevşek tanımlıdır.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PlaceholderRow = Record<string, any>;

interface PlaceholderTable {
  Row: PlaceholderRow;
  Insert: PlaceholderRow;
  Update: PlaceholderRow;
  Relationships: [];
}

export interface Database {
  public: {
    Tables: {
      admin_users: PlaceholderTable;
      categories: PlaceholderTable;
      products: PlaceholderTable;
      product_variants: PlaceholderTable;
      carts: PlaceholderTable;
      cart_items: PlaceholderTable;
      orders: PlaceholderTable;
      order_items: PlaceholderTable;
      payment_transactions: PlaceholderTable;
      cafe_settings: PlaceholderTable;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      admin_role: "owner" | "manager" | "staff";
      order_status:
        | "pending_payment"
        | "paid"
        | "preparing"
        | "shipped"
        | "completed"
        | "cancelled"
        | "refunded";
      payment_status: "initiated" | "succeeded" | "failed" | "refunded";
    };
    CompositeTypes: Record<string, never>;
  };
}
