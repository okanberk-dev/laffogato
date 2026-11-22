// Panel form validation for /admin/masalar. Pure (no "server-only") so the
// tests parse the same schemas the actions do.

import { z } from "zod";

import { BRANCH_ID_PATTERN } from "@/lib/panel/branches";

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

/**
 * Where the table stands (src/lib/panel/branches.ts): an id the
 * deployment knows. The action checks it against `siteBranches`.
 */
const branch = z
  .string({ error: "Şube geçersiz." })
  .trim()
  .regex(BRANCH_ID_PATTERN, { error: "Şube geçersiz." });

export const createCafeTableSchema = z.object({ name, branch });

export const updateCafeTableSchema = z.object({
  id: cafeTableIdSchema,
  name,
  branch,
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
