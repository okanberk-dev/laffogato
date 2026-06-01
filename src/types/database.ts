export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor: string
          createdAt: string
          entity: string
          entityId: string
          id: string
          payload: Json
        }
        Insert: {
          action: string
          actor?: string
          createdAt?: string
          entity: string
          entityId?: string
          id: string
          payload?: Json
        }
        Update: {
          action?: string
          actor?: string
          createdAt?: string
          entity?: string
          entityId?: string
          id?: string
          payload?: Json
        }
        Relationships: []
      }
      categories: {
        Row: {
          icon: string
          id: string
          label: string
          slug: string
          sortOrder: number
        }
        Insert: {
          icon?: string
          id: string
          label?: string
          slug: string
          sortOrder?: number
        }
        Update: {
          icon?: string
          id?: string
          label?: string
          slug?: string
          sortOrder?: number
        }
        Relationships: []
      }
      counters: {
        Row: {
          id: string
          seq: number
        }
        Insert: {
          id: string
          seq?: number
        }
        Update: {
          id?: string
          seq?: number
        }
        Relationships: []
      }
      customers: {
        Row: {
          addresses: Json
          birthday: string
          createdAt: string
          email: string
          id: string
          name: string
          notificationPrefs: Json
          passwordHash: string
          phone: string
          updatedAt: string
          wishlist: Json
        }
        Insert: {
          addresses?: Json
          birthday?: string
          createdAt?: string
          email: string
          id: string
          name?: string
          notificationPrefs?: Json
          passwordHash?: string
          phone?: string
          updatedAt?: string
          wishlist?: Json
        }
        Update: {
          addresses?: Json
          birthday?: string
          createdAt?: string
          email?: string
          id?: string
          name?: string
          notificationPrefs?: Json
          passwordHash?: string
          phone?: string
          updatedAt?: string
          wishlist?: Json
        }
        Relationships: []
      }
      menu_items: {
        Row: {
          categoryKey: string
          desc: string
          hue: string
          id: string
          isActive: boolean
          name: string
          priceMinor: number
          sortOrder: number
          tags: Json
          updatedAt: string
        }
        Insert: {
          categoryKey: string
          desc?: string
          hue?: string
          id: string
          isActive?: boolean
          name?: string
          priceMinor?: number
          sortOrder?: number
          tags?: Json
          updatedAt?: string
        }
        Update: {
          categoryKey?: string
          desc?: string
          hue?: string
          id?: string
          isActive?: boolean
          name?: string
          priceMinor?: number
          sortOrder?: number
          tags?: Json
          updatedAt?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          createdAt: string
          customerEmail: string
          customerName: string
          customerPhone: string
          discountMinor: number
          id: string
          internalNote: string
          items: Json
          orderNo: number
          promoCode: string
          refunds: Json
          shippingAddress: string
          shippingMinor: number
          status: string
          subtotalMinor: number
          totalMinor: number
        }
        Insert: {
          createdAt?: string
          customerEmail?: string
          customerName?: string
          customerPhone?: string
          discountMinor?: number
          id: string
          internalNote?: string
          items?: Json
          orderNo: number
          promoCode?: string
          refunds?: Json
          shippingAddress?: string
          shippingMinor?: number
          status?: string
          subtotalMinor?: number
          totalMinor?: number
        }
        Update: {
          createdAt?: string
          customerEmail?: string
          customerName?: string
          customerPhone?: string
          discountMinor?: number
          id?: string
          internalNote?: string
          items?: Json
          orderNo?: number
          promoCode?: string
          refunds?: Json
          shippingAddress?: string
          shippingMinor?: number
          status?: string
          subtotalMinor?: number
          totalMinor?: number
        }
        Relationships: []
      }
      payment_transactions: {
        Row: {
          amountMinor: number
          createdAt: string
          currency: string
          id: number
          orderId: string
          provider: string
          providerRef: string
          raw: Json | null
          status: string
        }
        Insert: {
          amountMinor?: number
          createdAt?: string
          currency?: string
          id?: never
          orderId: string
          provider: string
          providerRef: string
          raw?: Json | null
          status: string
        }
        Update: {
          amountMinor?: number
          createdAt?: string
          currency?: string
          id?: never
          orderId?: string
          provider?: string
          providerRef?: string
          raw?: Json | null
          status?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          cat: string
          compareAtPriceMinor: number
          costMinor: number
          desc: string
          featured: boolean
          id: string
          images: Json
          img: string
          isActive: boolean
          isNew: boolean
          lowStockThreshold: number
          name: string
          priceMinor: number
          seoDescription: string
          seoTitle: string
          sku: string
          slug: string
          stock: number
          tag: string
          updatedAt: string
          variants: Json
          weightGrams: number
        }
        Insert: {
          cat?: string
          compareAtPriceMinor?: number
          costMinor?: number
          desc?: string
          featured?: boolean
          id: string
          images?: Json
          img?: string
          isActive?: boolean
          isNew?: boolean
          lowStockThreshold?: number
          name?: string
          priceMinor?: number
          seoDescription?: string
          seoTitle?: string
          sku?: string
          slug: string
          stock?: number
          tag?: string
          updatedAt?: string
          variants?: Json
          weightGrams?: number
        }
        Update: {
          cat?: string
          compareAtPriceMinor?: number
          costMinor?: number
          desc?: string
          featured?: boolean
          id?: string
          images?: Json
          img?: string
          isActive?: boolean
          isNew?: boolean
          lowStockThreshold?: number
          name?: string
          priceMinor?: number
          seoDescription?: string
          seoTitle?: string
          sku?: string
          slug?: string
          stock?: number
          tag?: string
          updatedAt?: string
          variants?: Json
          weightGrams?: number
        }
        Relationships: []
      }
      promos: {
        Row: {
          code: string
          createdAt: string
          expiresAt: string
          id: string
          isActive: boolean
          kind: string
          minSubtotalMinor: number
          updatedAt: string
          usageCount: number
          usageLimit: number
          value: number
        }
        Insert: {
          code: string
          createdAt?: string
          expiresAt?: string
          id: string
          isActive?: boolean
          kind?: string
          minSubtotalMinor?: number
          updatedAt?: string
          usageCount?: number
          usageLimit?: number
          value?: number
        }
        Update: {
          code?: string
          createdAt?: string
          expiresAt?: string
          id?: string
          isActive?: boolean
          kind?: string
          minSubtotalMinor?: number
          updatedAt?: string
          usageCount?: number
          usageLimit?: number
          value?: number
        }
        Relationships: []
      }
      settings: {
        Row: {
          address: string
          email: string
          heroImageUrl: string
          id: string
          isShopOpen: boolean
          name: string
          notificationEmail: string
          openingHours: string
          phone: string
          seoIndexable: boolean
          seoOgImageUrl: string
          seoTitle: string
          shippingFlatMinor: number
          shippingFreeThresholdMinor: number
          tagline: string
          taxRatePct: number
          weeklyHours: Json
        }
        Insert: {
          address?: string
          email?: string
          heroImageUrl?: string
          id?: string
          isShopOpen?: boolean
          name?: string
          notificationEmail?: string
          openingHours?: string
          phone?: string
          seoIndexable?: boolean
          seoOgImageUrl?: string
          seoTitle?: string
          shippingFlatMinor?: number
          shippingFreeThresholdMinor?: number
          tagline?: string
          taxRatePct?: number
          weeklyHours?: Json
        }
        Update: {
          address?: string
          email?: string
          heroImageUrl?: string
          id?: string
          isShopOpen?: boolean
          name?: string
          notificationEmail?: string
          openingHours?: string
          phone?: string
          seoIndexable?: boolean
          seoOgImageUrl?: string
          seoTitle?: string
          shippingFlatMinor?: number
          shippingFreeThresholdMinor?: number
          tagline?: string
          taxRatePct?: number
          weeklyHours?: Json
        }
        Relationships: []
      }
      shop_hero_slides: {
        Row: {
          createdAt: string
          ctaHref: string
          ctaLabel: string
          id: string
          imageUrl: string
          isActive: boolean
          sortOrder: number
          subtitle: string
          textTheme: string
          title: string
          updatedAt: string
        }
        Insert: {
          createdAt?: string
          ctaHref?: string
          ctaLabel?: string
          id: string
          imageUrl?: string
          isActive?: boolean
          sortOrder?: number
          subtitle?: string
          textTheme?: string
          title?: string
          updatedAt?: string
        }
        Update: {
          createdAt?: string
          ctaHref?: string
          ctaLabel?: string
          id?: string
          imageUrl?: string
          isActive?: boolean
          sortOrder?: number
          subtitle?: string
          textTheme?: string
          title?: string
          updatedAt?: string
        }
        Relationships: []
      }
      stock_moves: {
        Row: {
          actor: string
          createdAt: string
          delta: number
          id: string
          note: string
          orderId: string | null
          productId: string
          productName: string
          reason: string
          stockAfter: number
        }
        Insert: {
          actor?: string
          createdAt?: string
          delta?: number
          id: string
          note?: string
          orderId?: string | null
          productId: string
          productName?: string
          reason?: string
          stockAfter?: number
        }
        Update: {
          actor?: string
          createdAt?: string
          delta?: number
          id?: string
          note?: string
          orderId?: string | null
          productId?: string
          productName?: string
          reason?: string
          stockAfter?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      next_seq: { Args: { counter_key: string }; Returns: number }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
