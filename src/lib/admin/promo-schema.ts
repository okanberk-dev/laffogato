import { z } from "zod";

const moneyMinor = z
  .string()
  .optional()
  .transform((s) => {
    const v = parseFloat(String(s ?? "0").replace(",", "."));
    return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) : 0;
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
      const raw = parseFloat(String(v.valueFixed ?? "0").replace(",", "."));
      value = Number.isFinite(raw) && raw >= 0 ? Math.round(raw * 100) : 0;
    }
    return {
      code: v.code,
      kind: v.kind,
      value,
      minSubtotalMinor: v.minSubtotal,
      usageLimit: v.usageLimit,
      expiresAt: v.expiresAt ?? "",
      isActive: v.isActive === "on",
    };
  })
  .superRefine((v, ctx) => {
    if (v.kind === "pct" && (v.value < 1 || v.value > 100)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Yüzde 1–100 arasında olmalı.",
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
    if (v.expiresAt && Number.isNaN(new Date(v.expiresAt).getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Geçerli bir tarih gir.",
        path: ["expiresAt"],
      });
    }
  });
