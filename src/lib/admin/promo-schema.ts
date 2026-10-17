import { z } from "zod";

import { normalizePublishInstant, parsePublishInstant } from "./publish-window";
import {
  CATALOG_MONEY_MAX_MINOR,
  MONEY_TOO_LARGE_ERROR,
  parseMoneyInput,
} from "@/lib/utils/format";

/**
 * The largest fixed discount a public code may give, 2.000 TL in kuruş: the
 * same fat-finger guard as a hand-granted coupon (musteriler/actions.ts).
 * There was none, and "5000" typed for "50" made every basket up to
 * 5.000 TL free for anyone holding the code.
 */
export const PROMO_FIXED_MAX_MINOR = 200_000;

/**
 * The largest usage limit. The column is an `integer`: a longer number died
 * on Postgres 22003 and took the form with it.
 */
export const PROMO_USAGE_LIMIT_MAX = 1_000_000;

// parseMoneyInput, not parseFloat(replace(",", ".")): that read "1.250,00" as
// 1.25. Blank is 0; unreadable text is NaN, refused below.
const moneyMinor = z
  .string()
  .optional()
  .transform((s) => {
    const text = String(s ?? "").trim();
    if (!text) return 0;
    return parseMoneyInput(text) ?? Number.NaN;
  });

// Blank is 0 (unlimited); anything but a whole number is NaN, refused below.
// It used to read "-5" or "abc" as 0, an unlimited code.
const intInput = z
  .string()
  .optional()
  .transform((s) => {
    const text = String(s ?? "").trim();
    if (!text) return 0;
    return /^\d+$/.test(text) ? Number(text) : Number.NaN;
  });

export const promoFormSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2, "Kod en az 2 karakter olmalı.")
      .max(40, "Kod en fazla 40 karakter olabilir."),
    kind: z.enum(["pct", "fixed"]).default("pct"),
    valuePct: z.string().optional(),
    valueFixed: z.string().optional(),
    minSubtotal: moneyMinor,
    usageLimit: intInput,
    expiresAt: z.string().optional().default(""),
    isActive: z.string().optional(),
  })
  .transform((v) => {
    let value = 0;
    if (v.kind === "pct") {
      const raw = parseFloat(String(v.valuePct ?? "0").replace(",", "."));
      value = Number.isFinite(raw) ? Math.round(raw) : 0;
    } else {
      value = parseMoneyInput(String(v.valueFixed ?? "")) ?? 0;
    }
    return {
      code: v.code,
      kind: v.kind,
      value,
      minSubtotalMinor: v.minSubtotal,
      usageLimit: v.usageLimit,
      // Stored as a UTC instant. The datetime-local value has no offset, and
      // on a UTC server "23:59" meant 23:59 UTC - the promo stayed valid
      // three hours past the Istanbul time the admin typed.
      expiresAt: v.expiresAt?.trim()
        ? normalizePublishInstant(v.expiresAt)
        : "",
      isActive: v.isActive === "on",
    };
  })
  .superRefine((v, ctx) => {
    if (v.kind === "pct" && (v.value < 1 || v.value > 100)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Yüzde 1-100 arasında olmalı.",
        path: ["valuePct"],
      });
    }
    if (v.kind === "fixed" && v.value <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Sabit tutar pozitif olmalı.",
        path: ["valueFixed"],
      });
    }
    if (v.kind === "fixed" && v.value > PROMO_FIXED_MAX_MINOR) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Sabit indirim en fazla 2.000 TL olabilir.",
        path: ["valueFixed"],
      });
    }
    if (Number.isNaN(v.minSubtotalMinor)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Geçerli bir alt sepet tutarı gir (ör. 250 ya da 1.250,00).",
        path: ["minSubtotal"],
      });
    } else if (v.minSubtotalMinor > CATALOG_MONEY_MAX_MINOR) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: MONEY_TOO_LARGE_ERROR,
        path: ["minSubtotal"],
      });
    }
    if (Number.isNaN(v.usageLimit)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Kullanım limiti 0 ya da pozitif bir tam sayı olmalı.",
        path: ["usageLimit"],
      });
    } else if (v.usageLimit > PROMO_USAGE_LIMIT_MAX) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Kullanım limiti en fazla 1.000.000 olabilir.",
        path: ["usageLimit"],
      });
    }
    const expiresAt = v.expiresAt ? parsePublishInstant(v.expiresAt) : null;
    if (v.expiresAt && expiresAt === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Geçerli bir tarih gir.",
        path: ["expiresAt"],
      });
    } else if (expiresAt !== null && expiresAt <= Date.now()) {
      // A past date made a code that was dead on save while the list said
      // "kaydedildi"; on an expired code it kept it dead after an edit meant
      // to bring it back.
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Bu tarih geçmişte kaldı. İleri bir tarih seç ya da süresiz için boş bırak.",
        path: ["expiresAt"],
      });
    }
  });
