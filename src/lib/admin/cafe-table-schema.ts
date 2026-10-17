// Panel form validation for /admin/masalar. Pure (no "server-only") so the
// tests parse the same schemas the actions do.

import { z } from "zod";

import { TABLE_NAME_MAX } from "./cafe-tables-core";

const name = z
  .string({ error: "Masa adı gerekli." })
  .trim()
  .min(1, { error: "Masa adı gerekli." })
  .max(TABLE_NAME_MAX, {
    error: `Masa adı en fazla ${TABLE_NAME_MAX} karakter olabilir.`,
  });

export const cafeTableIdSchema = z
  .string({ error: "Masa geçersiz." })
  .trim()
  .regex(/^tbl-\d{4,}$/, { error: "Masa geçersiz." });

export const createCafeTableSchema = z.object({ name });

export const updateCafeTableSchema = z.object({
  id: cafeTableIdSchema,
  name,
  sortOrder: z.coerce
    .number({ error: "Sıra bir sayı olmalı." })
    .int({ error: "Sıra tam sayı olmalı." })
    .min(0, { error: "Sıra 0 ile 9999 arasında olmalı." })
    .max(9999, { error: "Sıra 0 ile 9999 arasında olmalı." }),
});

export const setCafeTableActiveSchema = z.object({
  id: cafeTableIdSchema,
  isActive: z.enum(["true", "false"], { error: "Durum geçersiz." }),
});
