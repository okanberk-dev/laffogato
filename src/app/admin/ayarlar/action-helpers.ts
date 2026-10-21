import "server-only";

import { revalidatePath } from "next/cache";

import { safeAudit, type AuditAction } from "@/lib/admin/audit";
import { CATALOG_MONEY_MAX_MINOR, parseMoneyInput } from "@/lib/utils/format";

import {
  CONFIRMED_FIELD,
  type SettingsConfirm,
  type SettingsState,
} from "./settings-core";

// The helpers every settings action uses. Not in actions.ts: each export of
// a "use server" file is a public POST endpoint (CLAUDE.md rule 27).

/**
 * Audit row for a settings change, then the answer.
 *
 * `payload` carries the before/after of the keys that actually moved: the
 * section name alone ("shipping") does not let anyone reconstruct what a
 * courier fee was yesterday, which is the whole point of Olay kaydı for
 * numbers that price live orders.
 *
 * safeAudit, not logAudit: the row is written after the change landed, and
 * a failed insert used to throw the operator onto the error page for a save
 * that had gone through (they retried it).
 */
export async function ok(
  section: string,
  message: string,
  payload?: Record<string, unknown>,
  action: AuditAction = "update",
): Promise<SettingsState> {
  await safeAudit({
    action,
    entity: "settings",
    entityId: section,
    payload: payload ? { section, ...payload } : { section },
  });
  return { message };
}

/** The answer to a save that would change nothing: nothing written, no row. */
export const NO_CHANGE: SettingsState = {
  message: "Değişiklik yok; kayıtlı ayarlar aynı kaldı.",
};

/** A refusal tied to the field it is about. */
export function refuse(error: string, field?: string): SettingsState {
  return field ? { error, fieldErrors: { [field]: error } } : { error };
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

/**
 * A money field: kuruş, or the reason it was refused. The ceiling is the
 * catalog's (1.000.000 TL): these columns are `integer`, and "25.000.000"
 * typed with a slipped key died on Postgres 22003 and showed the panel's
 * error page instead of a sentence.
 */
export function readMoney(
  raw: unknown,
): { ok: true; minor: number } | { ok: false; tooLarge: boolean } {
  const minor = parseMoneyMinor(raw);
  if (minor === null) return { ok: false, tooLarge: false };
  if (minor > CATALOG_MONEY_MAX_MINOR) return { ok: false, tooLarge: true };
  return { ok: true, minor };
}

/** A whole number written as digits only ("8"; not "8.5", "8 kişi", "-1"). */
export function readWholeNumber(raw: unknown): number | null {
  const text = String(raw ?? "").trim();
  if (!/^\d{1,6}$/.test(text)) return null;
  return Number(text);
}

/**
 * JSON with every object's keys sorted: two values that differ only in key
 * order (jsonb hands `weeklyHours` back sorted, the form builds it Monday
 * first) compare equal.
 */
function canonical(value: unknown): string {
  return JSON.stringify(value ?? null, (_key, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).sort(([a], [b]) =>
            a < b ? -1 : a > b ? 1 : 0,
          ),
        )
      : v,
  );
}

/**
 * The keys whose value moved, as `{ before, after }` holding only those
 * keys; null when nothing moved, so a save that changes nothing writes no
 * row (Olay kaydı showed "Güncelleme · Ayar" for every press of Kaydet).
 * An object (the KDV rates, the hours) counts as moved when any part of it
 * did.
 */
export function changedKeys<T extends object>(
  before: T,
  after: Partial<T>,
): { before: Partial<T>; after: Partial<T> } | null {
  const b: Partial<T> = {};
  const a: Partial<T> = {};
  let moved = false;
  for (const key of Object.keys(after) as (keyof T)[]) {
    const next = after[key];
    const prev = before[key];
    if (canonical(prev) === canonical(next)) continue;
    b[key] = prev;
    a[key] = next;
    moved = true;
  }
  return moved ? { before: b, after: a } : null;
}

/** One consequence the operator has to accept before a save is written. */
export interface ConfirmAsk {
  key: string;
  line: string;
}

/**
 * The confirm answer for the asks the form has not confirmed yet, or null
 * when every one of them was (the save may go ahead). A hand-made POST can
 * send the keys itself: this is a guard against a slip, not a permission.
 */
export function askToConfirm(
  formData: FormData,
  asks: readonly ConfirmAsk[],
  dialog: Pick<SettingsConfirm, "title" | "submitLabel">,
): SettingsState | null {
  const confirmed = new Set(
    formData.getAll(CONFIRMED_FIELD).map((v) => String(v)),
  );
  const open = asks.filter((a) => !confirmed.has(a.key));
  if (open.length === 0) return null;
  return {
    confirm: {
      keys: asks.map((a) => a.key),
      title: dialog.title,
      lines: asks.map((a) => a.line),
      submitLabel: dialog.submitLabel,
    },
  };
}

/** The shape every settings action checks an address against. */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
