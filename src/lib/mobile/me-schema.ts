// Zod schemas for the `/me` family of endpoints (docs/API-MOBILE.md §4, §5).
// Client-safe: no "server-only", no DB.

import { z } from "zod";

import { lineOptionsSchema } from "./customization";
import { normalizeTrPhone } from "./karaoke-core";

const trimmed = (max: number, label: string) =>
  z.string().trim().max(max, `${label} en fazla ${max} karakter olabilir.`);

/**
 * A phone field as the app sends it, normalised BEFORE it is validated
 * (W1-04): a Turkish mobile in any spelling ("0532 123 45 67",
 * "+90 (532) 123-45-67", "5321234567") is stored as "+905321234567" - the
 * form the karaoke booking, the POS and an SMS read - so one member's number
 * is not three different strings. Anything that is not a Turkish mobile (a
 * landline, a foreign number, a half-typed value an older build lets
 * through) is kept as typed and checked exactly as before: no format an old
 * app version sends is newly refused.
 */
export function normalizePhoneInput(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  return normalizeTrPhone(raw) || raw.trim();
}

/** `schema` applied to the normalised phone. */
export function phoneField<T extends z.ZodType>(schema: T) {
  return z.preprocess(normalizePhoneInput, schema);
}

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

/**
 * A birthday the calendar actually has. The shape alone let `1990-13-45`
 * through, and the birthday job - which looks for this month and this day -
 * then never found the member: no greeting, no coupon, and no error anywhere
 * to say why. `Date.UTC` rolls an impossible day over into the next month, so
 * a date that does not read back as itself was never a date.
 */
export function isCalendarDate(v: string): boolean {
  if (!BIRTHDAY_RE.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  const at = new Date(Date.UTC(y, m - 1, d));
  return (
    at.getUTCFullYear() === y &&
    at.getUTCMonth() === m - 1 &&
    at.getUTCDate() === d
  );
}

export const mePatchSchema = z
  .object({
    name: trimmed(100, "Ad").min(2, "Ad en az 2 karakter olmalı.").optional(),
    phone: phoneField(trimmed(30, "Telefon")).optional(),
    birthday: z
      .string()
      .trim()
      .refine((v) => v === "" || isCalendarDate(v), {
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

export const addressInputSchema = z
  .object({
    title: trimmed(40, "Adres başlığı").default(""),
    fullName: trimmed(100, "Ad soyad").min(2, "Alıcı adı zorunlu."),
    phone: phoneField(
      trimmed(30, "Telefon").min(7, "Geçerli bir telefon gir."),
    ),
    city: trimmed(80, "Şehir").min(2, "Şehir zorunlu."),
    district: trimmed(80, "İlçe").default(""),
    neighbourhood: trimmed(80, "Mahalle").default(""),
    line: trimmed(200, "Adres satırı").min(5, "Adres satırı zorunlu."),
    note: trimmed(200, "Adres notu").default(""),
    isDefault: z.boolean().optional(),
  })
  .strict();

export const inviteClaimSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3, "Davet kodu gerekli.")
      .max(20, "Davet kodu çok uzun."),
  })
  .strict();
