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
/**
 * The statuses the bulk tool accepts - the keys of `BULK_ORDER_TRANSITIONS`.
 *
 * `pending_payment` has no transition leading back to it, and `paid`/`refunded`
 * move money: both need a ledger row the bulk tool does not write, so they are
 * done one order at a time. Kept as a literal list because this module is the
 * request boundary and must not import from the server-only store.
 */
const ORDER_STATUSES = [
  "preparing",
  "shipped",
  "completed",
  "cancelled",
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

/**
 * The order list's bulk tool. Every message is Turkish: with nothing picked
 * the operator used to read Zod's English "Invalid option: expected one of
 * ...". A cancel also carries its reason; the typed count (`confirm`) is
 * checked by the action against the ids actually sent.
 */
export const bulkOrderSchema = z.object({
  ids,
  op: z.literal("set_status", { error: "Geçersiz istek." }),
  value: z.enum(ORDER_STATUSES, { error: "Bir işlem seç." }),
  reason: z
    .string()
    .trim()
    .max(500, "Neden en fazla 500 karakter olabilir.")
    .optional()
    .default(""),
  confirm: z.string().trim().optional().default(""),
});
