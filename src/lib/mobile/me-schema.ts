// Zod schemas for the `/me` family of endpoints (docs/API-MOBILE.md §4, §5).
// Client-safe: no "server-only", no DB.

import { z } from "zod";

import { lineOptionsSchema } from "./customization";

const trimmed = (max: number, label: string) =>
  z.string().trim().max(max, `${label} en fazla ${max} karakter olabilir.`);

export const notificationPrefsPatchSchema = z
  .object({
    orderUpdates: z.boolean().optional(),
    marketing: z.boolean().optional(),
    newsletter: z.boolean().optional(),
  })
  .strict();

export const usualSchema = z
  .object({
    menuItemId: z.string().trim().min(1, "Menü kalemi gerekli."),
    size: z.enum(["M", "L", "single"], {
      error: "Boy M, L ya da single olmalı.",
    }),
    // The same shape an order line is validated with: a "usual" that the
    // checkout would reject must not be storable in the first place.
    options: lineOptionsSchema.prefault({}),
  })
  .strict();

const BIRTHDAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export const mePatchSchema = z
  .object({
    name: trimmed(100, "Ad").min(2, "Ad en az 2 karakter olmalı.").optional(),
    phone: trimmed(30, "Telefon").optional(),
    birthday: z
      .string()
      .trim()
      .refine((v) => v === "" || BIRTHDAY_RE.test(v), {
        message: "Doğum günü YYYY-AA-GG biçiminde olmalı.",
      })
      .optional(),
    notificationPrefs: notificationPrefsPatchSchema.optional(),
    usual: usualSchema.nullable().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, {
    message: "Güncellenecek bir alan gönder.",
  });

export type MePatchInput = z.infer<typeof mePatchSchema>;

export const addressInputSchema = z
  .object({
    title: trimmed(40, "Adres başlığı").default(""),
    fullName: trimmed(100, "Ad soyad").min(2, "Alıcı adı zorunlu."),
    phone: trimmed(30, "Telefon").min(7, "Geçerli bir telefon gir."),
    city: trimmed(80, "Şehir").min(2, "Şehir zorunlu."),
    district: trimmed(80, "İlçe").default(""),
    neighbourhood: trimmed(80, "Mahalle").default(""),
    line: trimmed(200, "Adres satırı").min(5, "Adres satırı zorunlu."),
    note: trimmed(200, "Adres notu").default(""),
    isDefault: z.boolean().optional(),
  })
  .strict();

export type AddressInputBody = z.infer<typeof addressInputSchema>;

export const inviteClaimSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3, "Davet kodu gerekli.")
      .max(20, "Davet kodu çok uzun."),
  })
  .strict();
