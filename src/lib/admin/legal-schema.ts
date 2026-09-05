import { z } from "zod";

export const legalDocSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(2, "Başlık en az 2 karakter olmalı.")
      .max(200, "Başlık çok uzun."),
    summary: z
      .string()
      .trim()
      .max(600, "Özet çok uzun.")
      .optional()
      .default(""),
    effectiveDate: z.string().trim().max(60).optional().default(""),
    bodyMarkdown: z
      .string()
      .max(60_000, "İçerik çok uzun.")
      .optional()
      .default(""),
    isPublished: z.string().optional(),
  })
  .transform((v) => ({
    title: v.title,
    summary: v.summary ?? "",
    effectiveDate: v.effectiveDate ?? "",
    bodyMarkdown: v.bodyMarkdown ?? "",
    isPublished: v.isPublished === "on",
  }))
  .superRefine((v, ctx) => {
    if (v.isPublished && v.bodyMarkdown.trim().length < 20) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Yayınlamak için içerik (Markdown) doldurulmalı.",
        path: ["bodyMarkdown"],
      });
    }
  });
