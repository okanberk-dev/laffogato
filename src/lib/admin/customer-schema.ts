import { z } from "zod";

/**
 * Admin edit of a member account. E-mail (the unique key) and the password are
 * intentionally NOT editable here. Checkboxes arrive as "on" / absent.
 */
export const customerEditSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Ad en az 2 karakter olmalı.")
      .max(100, "Ad en fazla 100 karakter olabilir."),
    phone: z
      .string()
      .trim()
      .max(30, "Telefon çok uzun.")
      .optional()
      .default(""),
    birthday: z.string().trim().max(10).optional().default(""),
    notifyOrderUpdates: z.string().optional(),
    notifyMarketing: z.string().optional(),
    notifyNewsletter: z.string().optional(),
  })
  .transform((v) => ({
    name: v.name,
    phone: v.phone ?? "",
    birthday: v.birthday ?? "",
    notificationPrefs: {
      orderUpdates: v.notifyOrderUpdates === "on",
      marketing: v.notifyMarketing === "on",
      newsletter: v.notifyNewsletter === "on",
    },
  }));
