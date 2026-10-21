import { z } from "zod";

/**
 * `POST /staff/stamp` body (docs/API-MOBILE.md §21).
 *
 * Only the two paths that carry a member with them: the scanned QR and the
 * typed 8-character code. A typed e-mail address was never accepted here -
 * it names a member without the member being present - and since 21 Ekim
 * 2026 the panel till refuses it too (ASK-LOYALTY, `redeemCounterToken`).
 *
 * `stamps` is optional (default 1). Its range is NOT enforced here: the
 * shared `redeemCounterToken` is the single point that refuses it, with the
 * same `invalid_stamps` answer the till gives, so the two cannot drift.
 */
export const staffStampSchema = z.object({
  kind: z.enum(["token", "code"], "kind: token ya da code olmalı."),
  value: z
    .string()
    .trim()
    .min(1, "Önce bir QR okut ya da kod yaz.")
    .max(200, "Kod çok uzun."),
  stamps: z.number().int("Damga sayısı tam sayı olmalı.").optional().default(1),
});

export type StaffStampBody = z.infer<typeof staffStampSchema>;
