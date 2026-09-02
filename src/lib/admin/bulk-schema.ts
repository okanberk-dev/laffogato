import { z } from "zod";

const SHOP_CATEGORIES = ["beans", "gift", "gear", "merch", "pantry"] as const;
const MENU_CATEGORIES = [
  "matcha",
  "espresso",
  "ice-coffee",
  "cold",
  "hot",
  "frappe",
  "smoothie",
  "frozen",
  "ice-tea",
  "dessert",
  "snack",
  "extras",
] as const;
const ORDER_STATUSES = [
  "pending_payment",
  "paid",
  "preparing",
  "shipped",
  "completed",
  "cancelled",
  "refunded",
] as const;

const ids = z
  .string()
  .transform((s) =>
    s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 500),
  )
  .pipe(z.array(z.string().min(1)).min(1, "Hiç kayıt seçilmedi."));

export const bulkProductSchema = z
  .object({
    ids,
    op: z.enum(["delete", "activate", "deactivate", "set_category"]),
    value: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.op === "set_category") {
      if (
        !v.value ||
        !SHOP_CATEGORIES.includes(v.value as (typeof SHOP_CATEGORIES)[number])
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Geçerli bir kategori seç.",
          path: ["value"],
        });
      }
    }
  });

export const bulkMenuSchema = z
  .object({
    ids,
    op: z.enum(["delete", "activate", "deactivate", "set_category"]),
    value: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.op === "set_category") {
      if (
        !v.value ||
        !MENU_CATEGORIES.includes(v.value as (typeof MENU_CATEGORIES)[number])
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Geçerli bir kategori seç.",
          path: ["value"],
        });
      }
    }
  });

export const bulkOrderSchema = z.object({
  ids,
  op: z.literal("set_status"),
  value: z.enum(ORDER_STATUSES),
});

export type BulkProductInput = z.infer<typeof bulkProductSchema>;
export type BulkMenuInput = z.infer<typeof bulkMenuSchema>;
export type BulkOrderInput = z.infer<typeof bulkOrderSchema>;
