import { z } from "zod";

import {
  isMenuAllergen,
  MENU_ALLERGENS_FIELD,
  MENU_ALLERGENS_NONE,
  MENU_ALLERGENS_SHOWN_FIELD,
  NUTS_ALLERGEN,
  normalizeMenuAllergens,
  type MenuAllergen,
} from "@/lib/menu/allergens";

/**
 * The menu item form's allergen boxes (18 Oct 2026, TGK Etiketleme Yön.
 * m.15/5, src/lib/menu/allergens.ts), checked on the server.
 *
 * Three answers, kept apart on purpose, because "nothing ticked" must never
 * be published as "contains none":
 * - no box ticked: not entered yet (null);
 * - "Hiçbirini içermez" alone: entered, none of the fourteen ([]);
 * - groups ticked: those groups.
 * A form without the hidden marker (opened before the boxes existed) keeps
 * the stored value (undefined). Errors land under `allergens`.
 */

export const MENU_ALLERGEN_CONFLICT_ERROR =
  "“Hiçbirini içermez” ile bir alerjen birlikte seçili: birini kaldır.";
export const MENU_ALLERGEN_UNKNOWN_ERROR =
  "Listede olmayan bir alerjen geldi; sayfayı yenileyip yeniden seç.";
export const MENU_ALLERGEN_NUTS_ERROR =
  "Etiketlerde kuruyemiş (nuts) var: alerjenlerde “Sert kabuklu meyveler”i de işaretle ya da etiketi kaldır.";

const menuAllergensSchema = z.object({
  allergens: z
    .object({ shown: z.boolean(), values: z.array(z.string()) })
    .transform((raw, ctx): MenuAllergen[] | null | undefined => {
      if (!raw.shown) return undefined;
      const none = raw.values.includes(MENU_ALLERGENS_NONE);
      const keys = raw.values.filter((v) => v !== MENU_ALLERGENS_NONE);
      if (!keys.every(isMenuAllergen)) {
        ctx.addIssue({ code: "custom", message: MENU_ALLERGEN_UNKNOWN_ERROR });
        return z.NEVER;
      }
      if (none && keys.length > 0) {
        ctx.addIssue({ code: "custom", message: MENU_ALLERGEN_CONFLICT_ERROR });
        return z.NEVER;
      }
      if (none) return [];
      return keys.length === 0 ? null : normalizeMenuAllergens(keys);
    }),
});

export type MenuAllergensRead =
  | { ok: true; allergens: MenuAllergen[] | null | undefined }
  | {
      ok: false;
      issues: ReadonlyArray<{
        path: ReadonlyArray<PropertyKey>;
        message: string;
      }>;
    };

/** The posted boxes as the value to store; undefined keeps the stored one. */
export function readMenuAllergens(formData: FormData): MenuAllergensRead {
  const parsed = menuAllergensSchema.safeParse({
    allergens: {
      shown: formData.get(MENU_ALLERGENS_SHOWN_FIELD) !== null,
      values: formData.getAll(MENU_ALLERGENS_FIELD).map(String),
    },
  });
  if (!parsed.success) return { ok: false, issues: parsed.error.issues };
  return { ok: true, allergens: parsed.data.allergens };
}

/**
 * The tags a save stores next to entered allergens. The shipped app reads
 * only the `nuts` tag (lafmobil rule 4: an allergen is never withheld), so a
 * tree nut ticked here adds it; a `nuts` tag next to an entered list without
 * tree nuts is two answers to one question, and the save asks which.
 */
export function tagsWithAllergens(
  tags: readonly string[],
  allergens: MenuAllergen[] | null | undefined,
): { ok: true; tags: string[] } | { ok: false; error: string } {
  if (!Array.isArray(allergens)) return { ok: true, tags: [...tags] };
  const nuts = allergens.includes(NUTS_ALLERGEN);
  if (nuts && !tags.includes("nuts")) {
    return { ok: true, tags: [...tags, "nuts"] };
  }
  if (!nuts && tags.includes("nuts")) {
    return { ok: false, error: MENU_ALLERGEN_NUTS_ERROR };
  }
  return { ok: true, tags: [...tags] };
}
