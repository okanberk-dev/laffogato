import { z } from "zod";

import { normalizePublishInstant, parsePublishInstant } from "./publish-window";
import { parseMoneyInput } from "@/lib/utils/format";

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

const intInput = z
  .string()
  .optional()
  .transform((s) => {
    const v = parseInt(s ?? "0", 10);
    return Number.isFinite(v) && v >= 0 ? v : 0;
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
      // on a UTC server "23:59" meant 23:59 UTC — the promo stayed valid
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
    if (Number.isNaN(v.minSubtotalMinor)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Geçerli bir alt sepet tutarı gir (ör. 250 ya da 1.250,00).",
        path: ["minSubtotal"],
      });
    }
    if (v.expiresAt && parsePublishInstant(v.expiresAt) === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Geçerli bir tarih gir.",
        path: ["expiresAt"],
      });
    }
  });
