import "server-only";

import { revalidatePath } from "next/cache";

import { logAudit } from "@/lib/admin/audit";
import { parseMoneyInput } from "@/lib/utils/format";

import type { SettingsState } from "./settings-core";

// The helpers every settings action uses. Not in actions.ts: each export of
// a "use server" file is a public POST endpoint (CLAUDE.md rule 27).

/**
 * Audit row for a settings change.
 *
 * `payload` carries the before/after of the keys that actually moved: the
 * section name alone ("shipping") does not let anyone reconstruct what a
 * courier fee was yesterday, which is the whole point of Olay kaydı for
 * numbers that price live orders.
 */
export async function ok(
  section: string,
  message: string,
  payload?: Record<string, unknown>,
): Promise<SettingsState> {
  await logAudit({
    action: "update",
    entity: "settings",
    entityId: section,
    payload: payload ? { section, ...payload } : { section },
  });
  return { message };
}

export function revalidateAll() {
  revalidatePath("/admin/ayarlar");
  revalidatePath("/admin");
  revalidatePath("/");
}

/**
 * Money in kuruş, or null when the field is not a plain non-negative amount.
 *
 * It used to fall back to 0, which turned "₺75" - a perfectly natural thing to
 * type into a price box - into free courier delivery for every order that
 * evening, silently. A bad number is now an error the operator sees.
 *
 * Read by parseMoneyInput (CLAUDE.md rule 24). The comma swap plus
 * parseFloat it replaces read "1.000", which is how the panel prints the
 * karaoke hour, as 1,00 TL.
 */
export function parseMoneyMinor(raw: unknown): number | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  return parseMoneyInput(s);
}
