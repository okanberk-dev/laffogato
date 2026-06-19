export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string;
          actor: string;
          createdAt: string;
          entity: string;
          entityId: string;
          id: string;
          payload: Json;
        };
        Insert: {
          action: string;
          actor?: string;
          createdAt?: string;
          entity: string;
          entityId?: string;
          id: string;
          payload?: Json;
        };
        Update: {
          action?: string;
          actor?: string;
          createdAt?: string;
          entity?: string;
          entityId?: string;
          id?: string;
          payload?: Json;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          icon: string;
          id: string;
          label: string;
          slug: string;
          sortOrder: number;
        };
        Insert: {
          icon?: string;
          id: string;
          label?: string;
          slug: string;
          sortOrder?: number;
        };
        Update: {
          icon?: string;
          id?: string;
          label?: string;
          slug?: string;
          sortOrder?: number;
        };
        Relationships: [];
      };
      counters: {
        Row: {
          id: string;
          seq: number;
        };
        Insert: {
          id: string;
          seq?: number;
        };
        Update: {
          id?: string;
          seq?: number;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          addresses: Json;
          birthday: string;
          createdAt: string;
          email: string;
          emailVerified: boolean;
          id: string;
          isActive: boolean;
          marketingConsentAt: string;
          name: string;
          notificationPrefs: Json;
          passwordHash: string;
          phone: string;
          termsAcceptedAt: string;
          updatedAt: string;
          verifiedAt: string;
          verifyExpires: string;
          verifyToken: string;
          wishlist: Json;
        };
        Insert: {
          addresses?: Json;
          birthday?: string;
          createdAt?: string;
          email: string;
          emailVerified?: boolean;
          id: string;
          isActive?: boolean;
          marketingConsentAt?: string;
          name?: string;
          notificationPrefs?: Json;
          passwordHash?: string;
          phone?: string;
          termsAcceptedAt?: string;
          updatedAt?: string;
          verifiedAt?: string;
          verifyExpires?: string;
          verifyToken?: string;
          wishlist?: Json;
        };
        Update: {
          addresses?: Json;
          birthday?: string;
          createdAt?: string;
          email?: string;
          emailVerified?: boolean;
          id?: string;
          isActive?: boolean;
          marketingConsentAt?: string;
          name?: string;
          notificationPrefs?: Json;
          passwordHash?: string;
          phone?: string;
          termsAcceptedAt?: string;
          updatedAt?: string;
          verifiedAt?: string;
          verifyExpires?: string;
          verifyToken?: string;
          wishlist?: Json;
        };
        Relationships: [];
      };
      franchise_applications: {
        Row: {
          budget: string;
          city: string;
          createdAt: string;
          email: string;
          experience: string;
          id: string;
          message: string;
          name: string;
          package: string;
          phone: string;
          status: string;
        };
        Insert: {
          budget?: string;
          city?: string;
          createdAt?: string;
          email?: string;
          experience?: string;
          id: string;
          message?: string;
          name?: string;
          package?: string;
          phone?: string;
          status?: string;
        };
        Update: {
          budget?: string;
          city?: string;
          createdAt?: string;
          email?: string;
          experience?: string;
          id?: string;
          message?: string;
          name?: string;
          package?: string;
          phone?: string;
          status?: string;
        };
        Relationships: [];
      };
      franchise_packages: {
        Row: {
          area: string;
          createdAt: string;
          featured: boolean;
          id: string;
          ideal: string;
          includes: Json;
          invest: string;
          isActive: boolean;
          monthly: string;
          name: string;
          seats: string;
          sortOrder: number;
          updatedAt: string;
        };
        Insert: {
          area?: string;
          createdAt?: string;
          featured?: boolean;
          id: string;
          ideal?: string;
          includes?: Json;
          invest?: string;
          isActive?: boolean;
          monthly?: string;
          name?: string;
          seats?: string;
          sortOrder?: number;
          updatedAt?: string;
        };
        Update: {
          area?: string;
          createdAt?: string;
          featured?: boolean;
          id?: string;
          ideal?: string;
          includes?: Json;
          invest?: string;
          isActive?: boolean;
          monthly?: string;
          name?: string;
          seats?: string;
          sortOrder?: number;
          updatedAt?: string;
        };
        Relationships: [];
      };
      franchise_process: {
        Row: {
          body: string;
          createdAt: string;
          id: string;
          isActive: boolean;
          sortOrder: number;
          step: string;
          title: string;
          updatedAt: string;
        };
        Insert: {
          body?: string;
          createdAt?: string;
          id: string;
          isActive?: boolean;
          sortOrder?: number;
          step?: string;
          title?: string;
          updatedAt?: string;
        };
        Update: {
          body?: string;
          createdAt?: string;
          id?: string;
          isActive?: boolean;
          sortOrder?: number;
          step?: string;
          title?: string;
          updatedAt?: string;
        };
        Relationships: [];
      };
      legal_docs: {
        Row: {
          bodyMarkdown: string;
          effectiveDate: string;
          isPublished: boolean;
          slug: string;
          summary: string;
          title: string;
          updatedAt: string;
        };
        Insert: {
          bodyMarkdown?: string;
          effectiveDate?: string;
          isPublished?: boolean;
          slug: string;
          summary?: string;
          title?: string;
          updatedAt?: string;
        };
        Update: {
          bodyMarkdown?: string;
          effectiveDate?: string;
          isPublished?: boolean;
          slug?: string;
          summary?: string;
          title?: string;
          updatedAt?: string;
        };
        Relationships: [];
      };
      menu_items: {
        Row: {
          categoryKey: string;
          desc: string;
          hue: string;
          id: string;
          isActive: boolean;
          name: string;
          priceMinor: number;
          sortOrder: number;
          tags: Json;
          updatedAt: string;
        };
        Insert: {
          categoryKey: string;
          desc?: string;
          hue?: string;
          id: string;
          isActive?: boolean;
          name?: string;
          priceMinor?: number;
          sortOrder?: number;
          tags?: Json;
          updatedAt?: string;
        };
        Update: {
          categoryKey?: string;
          desc?: string;
          hue?: string;
          id?: string;
          isActive?: boolean;
          name?: string;
          priceMinor?: number;
          sortOrder?: number;
          tags?: Json;
          updatedAt?: string;
        };
        Relationships: [];
      };
      newsletter_subscribers: {
        Row: {
          createdAt: string;
          email: string;
          id: string;
          isActive: boolean;
          name: string;
          source: string;
          unsubscribedAt: string;
        };
        Insert: {
          createdAt?: string;
          email: string;
          id: string;
          isActive?: boolean;
          name?: string;
          source?: string;
          unsubscribedAt?: string;
        };
        Update: {
          createdAt?: string;
          email?: string;
          id?: string;
          isActive?: boolean;
          name?: string;
          source?: string;
          unsubscribedAt?: string;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          carrier: string;
          createdAt: string;
          customerEmail: string;
          customerName: string;
          customerPhone: string;
          discountMinor: number;
          id: string;
          internalNote: string;
          items: Json;
          orderNo: number;
          promoCode: string;
          refunds: Json;
          shippedAt: string;
          shippingAddress: string;
          shippingMinor: number;
          status: string;
          subtotalMinor: number;
          totalMinor: number;
          trackingNumber: string;
        };
        Insert: {
          carrier?: string;
          createdAt?: string;
          customerEmail?: string;
          customerName?: string;
          customerPhone?: string;
          discountMinor?: number;
          id: string;
          internalNote?: string;
          items?: Json;
          orderNo: number;
          promoCode?: string;
          refunds?: Json;
          shippedAt?: string;
          shippingAddress?: string;
          shippingMinor?: number;
          status?: string;
          subtotalMinor?: number;
          totalMinor?: number;
          trackingNumber?: string;
        };
        Update: {
          carrier?: string;
          createdAt?: string;
          customerEmail?: string;
          customerName?: string;
          customerPhone?: string;
          discountMinor?: number;
          id?: string;
          internalNote?: string;
          items?: Json;
          orderNo?: number;
          promoCode?: string;
          refunds?: Json;
          shippedAt?: string;
          shippingAddress?: string;
          shippingMinor?: number;
          status?: string;
          subtotalMinor?: number;
          totalMinor?: number;
          trackingNumber?: string;
        };
        Relationships: [];
      };
      payment_transactions: {
        Row: {
          amountMinor: number;
          createdAt: string;
          currency: string;
          id: number;
          orderId: string;
          provider: string;
          providerRef: string;
          raw: Json | null;
          status: string;
        };
        Insert: {
          amountMinor?: number;
          createdAt?: string;
          currency?: string;
          id?: never;
          orderId: string;
          provider: string;
          providerRef: string;
          raw?: Json | null;
          status: string;
        };
        Update: {
          amountMinor?: number;
          createdAt?: string;
          currency?: string;
          id?: never;
          orderId?: string;
          provider?: string;
          providerRef?: string;
          raw?: Json | null;
          status?: string;
        };
        Relationships: [];
      };
      press: {
        Row: {
          createdAt: string;
          id: string;
          isActive: boolean;
          name: string;
          quote: string;
          sortOrder: number;
          updatedAt: string;
        };
        Insert: {
          createdAt?: string;
          id: string;
          isActive?: boolean;
          name?: string;
          quote?: string;
          sortOrder?: number;
          updatedAt?: string;
        };
        Update: {
          createdAt?: string;
          id?: string;
          isActive?: boolean;
          name?: string;
          quote?: string;
          sortOrder?: number;
          updatedAt?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          cat: string;
          compareAtPriceMinor: number;
          costMinor: number;
          desc: string;
          featured: boolean;
          id: string;
          images: Json;
          img: string;
          isActive: boolean;
          isNew: boolean;
          lowStockThreshold: number;
          name: string;
          priceMinor: number;
          seoDescription: string;
          seoTitle: string;
          sku: string;
          slug: string;
          stock: number;
          tag: string;
          updatedAt: string;
          variants: Json;
          weightGrams: number;
        };
        Insert: {
          cat?: string;
          compareAtPriceMinor?: number;
          costMinor?: number;
          desc?: string;
          featured?: boolean;
          id: string;
          images?: Json;
          img?: string;
          isActive?: boolean;
          isNew?: boolean;
          lowStockThreshold?: number;
          name?: string;
          priceMinor?: number;
          seoDescription?: string;
          seoTitle?: string;
          sku?: string;
          slug: string;
          stock?: number;
          tag?: string;
          updatedAt?: string;
          variants?: Json;
          weightGrams?: number;
        };
        Update: {
          cat?: string;
          compareAtPriceMinor?: number;
          costMinor?: number;
          desc?: string;
          featured?: boolean;
          id?: string;
          images?: Json;
          img?: string;
          isActive?: boolean;
          isNew?: boolean;
          lowStockThreshold?: number;
          name?: string;
          priceMinor?: number;
          seoDescription?: string;
          seoTitle?: string;
          sku?: string;
          slug?: string;
          stock?: number;
          tag?: string;
          updatedAt?: string;
          variants?: Json;
          weightGrams?: number;
        };
        Relationships: [];
      };
      promos: {
        Row: {
          code: string;
          createdAt: string;
          expiresAt: string;
          id: string;
          isActive: boolean;
          kind: string;
          minSubtotalMinor: number;
          updatedAt: string;
          usageCount: number;
          usageLimit: number;
          value: number;
        };
        Insert: {
          code: string;
          createdAt?: string;
          expiresAt?: string;
          id: string;
          isActive?: boolean;
          kind?: string;
          minSubtotalMinor?: number;
          updatedAt?: string;
          usageCount?: number;
          usageLimit?: number;
          value?: number;
        };
        Update: {
          code?: string;
          createdAt?: string;
          expiresAt?: string;
          id?: string;
          isActive?: boolean;
          kind?: string;
          minSubtotalMinor?: number;
          updatedAt?: string;
          usageCount?: number;
          usageLimit?: number;
          value?: number;
        };
        Relationships: [];
      };
      reels: {
        Row: {
          accent: string;
          caption: string;
          createdAt: string;
          id: string;
          isActive: boolean;
          meta: string;
          sortOrder: number;
          updatedAt: string;
          videoUrl: string;
        };
        Insert: {
          accent?: string;
          caption?: string;
          createdAt?: string;
          id: string;
          isActive?: boolean;
          meta?: string;
          sortOrder?: number;
          updatedAt?: string;
          videoUrl?: string;
        };
        Update: {
          accent?: string;
          caption?: string;
          createdAt?: string;
          id?: string;
          isActive?: boolean;
          meta?: string;
          sortOrder?: number;
          updatedAt?: string;
          videoUrl?: string;
        };
        Relationships: [];
      };
      settings: {
        Row: {
          address: string;
          email: string;
          heroImageUrl: string;
          id: string;
          isShopOpen: boolean;
          name: string;
          notificationEmail: string;
          openingHours: string;
          phone: string;
          seoIndexable: boolean;
          seoOgImageUrl: string;
          seoTitle: string;
          shippingFlatMinor: number;
          shippingFreeThresholdMinor: number;
          tagline: string;
          taxRatePct: number;
          weeklyHours: Json;
        };
        Insert: {
          address?: string;
          email?: string;
          heroImageUrl?: string;
          id?: string;
          isShopOpen?: boolean;
          name?: string;
          notificationEmail?: string;
          openingHours?: string;
          phone?: string;
          seoIndexable?: boolean;
          seoOgImageUrl?: string;
          seoTitle?: string;
          shippingFlatMinor?: number;
          shippingFreeThresholdMinor?: number;
          tagline?: string;
          taxRatePct?: number;
          weeklyHours?: Json;
        };
        Update: {
          address?: string;
          email?: string;
          heroImageUrl?: string;
          id?: string;
          isShopOpen?: boolean;
          name?: string;
          notificationEmail?: string;
          openingHours?: string;
          phone?: string;
          seoIndexable?: boolean;
          seoOgImageUrl?: string;
          seoTitle?: string;
          shippingFlatMinor?: number;
          shippingFreeThresholdMinor?: number;
          tagline?: string;
          taxRatePct?: number;
          weeklyHours?: Json;
        };
        Relationships: [];
      };
      shop_hero_slides: {
        Row: {
          createdAt: string;
          ctaHref: string;
          ctaLabel: string;
          id: string;
          imageUrl: string;
          isActive: boolean;
          sortOrder: number;
          subtitle: string;
          textTheme: string;
          title: string;
          updatedAt: string;
        };
        Insert: {
          createdAt?: string;
          ctaHref?: string;
          ctaLabel?: string;
          id: string;
          imageUrl?: string;
          isActive?: boolean;
          sortOrder?: number;
          subtitle?: string;
          textTheme?: string;
          title?: string;
          updatedAt?: string;
        };
        Update: {
          createdAt?: string;
          ctaHref?: string;
          ctaLabel?: string;
          id?: string;
          imageUrl?: string;
          isActive?: boolean;
          sortOrder?: number;
          subtitle?: string;
          textTheme?: string;
          title?: string;
          updatedAt?: string;
        };
        Relationships: [];
      };
      site_content: {
        Row: {
          key: string;
          updatedAt: string;
          value: string;
        };
        Insert: {
          key: string;
          updatedAt?: string;
          value?: string;
        };
        Update: {
          key?: string;
          updatedAt?: string;
          value?: string;
        };
        Relationships: [];
      };
      stock_moves: {
        Row: {
          actor: string;
          createdAt: string;
          delta: number;
          id: string;
          note: string;
          orderId: string | null;
          productId: string;
          productName: string;
          reason: string;
          stockAfter: number;
        };
        Insert: {
          actor?: string;
          createdAt?: string;
          delta?: number;
          id: string;
          note?: string;
          orderId?: string | null;
          productId: string;
          productName?: string;
          reason?: string;
          stockAfter?: number;
        };
        Update: {
          actor?: string;
          createdAt?: string;
          delta?: number;
          id?: string;
          note?: string;
          orderId?: string | null;
          productId?: string;
          productName?: string;
          reason?: string;
          stockAfter?: number;
        };
        Relationships: [];
      };
      story_timeline: {
        Row: {
          body: string;
          createdAt: string;
          id: string;
          isActive: boolean;
          sortOrder: number;
          title: string;
          updatedAt: string;
          year: string;
        };
        Insert: {
          body?: string;
          createdAt?: string;
          id: string;
          isActive?: boolean;
          sortOrder?: number;
          title?: string;
          updatedAt?: string;
          year?: string;
        };
        Update: {
          body?: string;
          createdAt?: string;
          id?: string;
          isActive?: boolean;
          sortOrder?: number;
          title?: string;
          updatedAt?: string;
          year?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      claim_order_stock: {
        Args: { p_lines: Json; p_now: string };
        Returns: number[];
      };
      increment_promo_usage: {
        Args: { p_now: string; promo_code: string };
        Returns: undefined;
      };
      next_seq: { Args: { counter_key: string }; Returns: number };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
