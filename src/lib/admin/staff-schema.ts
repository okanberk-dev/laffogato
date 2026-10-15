import { z } from "zod";

/**
 * The one field the barista forms on /admin/kullanicilar send: the member's
 * address. Lower-cased here so the grant, the revoke and the audit row all
 * name the same key the `customers` table does.
 */
export const staffEmailSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "E-posta çok uzun.")
    .pipe(z.email("Geçerli bir e-posta gir.")),
});
