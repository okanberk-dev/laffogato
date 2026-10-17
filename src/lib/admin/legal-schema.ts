import { z } from "zod";

import {
  consentVersionFrom,
  isLiveLegalOverride,
  istanbulDayLabel,
  legalDayNumber,
  overrideLabel,
  type ConsentOverride,
} from "@/lib/legal/consent-version";
import {
  CHECKOUT_CONSENT_DOCS,
  KARAOKE_CONSENT_DOCS,
  KARAOKE_LEGAL_UPDATED,
  LEGAL_UPDATED,
} from "@/lib/legal/meta";

/** The editor's limits; the form's maxLength attributes read them too. */
export const LEGAL_LIMITS = {
  title: 200,
  summary: 600,
  effectiveDate: 60,
  bodyMarkdown: 60_000,
} as const;

export const EFFECTIVE_DATE_FORMAT_ERROR = "Tarihi 26 Mayıs 2026 gibi yaz.";

export const legalDocSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(2, "Başlık en az 2 karakter olmalı.")
      .max(LEGAL_LIMITS.title, "Başlık en fazla 200 karakter olabilir."),
    summary: z
      .string()
      .trim()
      .max(LEGAL_LIMITS.summary, "Özet en fazla 600 karakter olabilir.")
      .optional()
      .default(""),
    // "D Ay YYYY" or blank: the checkout's consent version only reads that
    // shape (consent-version.ts legalDayNumber), so "26.05.2026" used to be
    // shown on the page while orders recorded the save day instead.
    effectiveDate: z
      .string()
      .trim()
      .max(LEGAL_LIMITS.effectiveDate, EFFECTIVE_DATE_FORMAT_ERROR)
      .refine(
        (v) => v === "" || legalDayNumber(v) !== null,
        EFFECTIVE_DATE_FORMAT_ERROR,
      )
      .optional()
      .default(""),
    bodyMarkdown: z
      .string()
      .max(LEGAL_LIMITS.bodyMarkdown, "İçerik en fazla 60.000 karakter olabilir.")
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
        code: "custom",
        message: "Yayınlamak için içerik (Markdown) doldurulmalı.",
        path: ["bodyMarkdown"],
      });
    }
  });

/**
 * The documents whose version a consent records, with the coded revision
 * under them: the two checkout documents (`legalConsent.version` on an
 * order) and the karaoke contract (on a paid booking). Null for every other
 * document: nothing records which revision of the KVKK text a visitor saw.
 */
export function consentScope(
  slug: string,
): { docs: readonly string[]; base: string } | null {
  if ((CHECKOUT_CONSENT_DOCS as readonly string[]).includes(slug)) {
    return { docs: CHECKOUT_CONSENT_DOCS, base: LEGAL_UPDATED };
  }
  if ((KARAOKE_CONSENT_DOCS as readonly string[]).includes(slug)) {
    return { docs: KARAOKE_CONSENT_DOCS, base: KARAOKE_LEGAL_UPDATED };
  }
  return null;
}

/** The version a consent on `slug` records now; null when none does. */
export function recordedConsentVersion(
  slug: string,
  overrides: Readonly<Record<string, ConsentOverride | null | undefined>>,
): string | null {
  const scope = consentScope(slug);
  return scope ? consentVersionFrom(overrides, scope.docs, scope.base) : null;
}

/**
 * The effective date a save stores. What was typed stays; a text that goes
 * live with none gets the Istanbul day of the save. Left blank, the public
 * page showed the coded document's date while orders recorded the save day
 * (consent-version.ts falls back to it), and each later re-save moved that
 * recorded day again with the text unchanged. A draft keeps its blank.
 */
export function resolveEffectiveDate(
  typed: string,
  goesLive: boolean,
  nowIso: string,
): string {
  const date = typed.trim();
  if (date || !goesLive) return date;
  return istanbulDayLabel(nowIso) ?? "";
}

/** One save of an override, for `consentSaveRefusal`. */
export interface ConsentSaveCheck {
  slug: string;
  /** The override stored now, or null. */
  before: ConsentOverride | null;
  /** What the save will store (effective date already resolved). */
  after: ConsentOverride;
  /** Every override stored now, by slug (the rule picks the live ones). */
  overrides: Readonly<Record<string, ConsentOverride | null | undefined>>;
  /** The document's earlier published texts (the archive). */
  archived: readonly ConsentOverride[];
}

function sameText(a: string, b: string): boolean {
  const norm = (s: string) => s.replace(/\r\n/g, "\n").trim();
  return norm(a) === norm(b);
}

/**
 * Why a save of a consent document would make the recorded version name the
 * wrong text, or null when it is fine (admin audit CON-M01, decision D25).
 *
 * An order records a version label, not the text, and a chargeback or a
 * consumer dispute reads that label to find what the customer accepted. So a
 * label must name one text:
 *
 * - When the live text changes (a new override goes live, or the body of the
 *   live one changes), its date must be later than the version recorded
 *   now. The version is the latest live date across the scope's documents
 *   (both checkout documents share one), so an equal or earlier date would
 *   leave orders recording the label they recorded for the old text: the
 *   editor prefilled the coded date and that is what happened.
 * - A live override always needs a date later than the coded revision;
 *   otherwise consentVersionFrom ignores it and orders record the coded
 *   text's label while the customer is shown this one.
 * - A date already used by an earlier published text of the document with a
 *   different body is refused: after a reset, the old label is free again in
 *   the version rule but not in the orders that recorded it.
 *
 * Drafts, unpublished saves and documents no consent records pass.
 */
export function consentSaveRefusal({
  slug,
  before,
  after,
  overrides,
  archived,
}: ConsentSaveCheck): string | null {
  const scope = consentScope(slug);
  if (!scope || !isLiveLegalOverride(after)) return null;
  const label = overrideLabel(after);
  const day = label === null ? null : legalDayNumber(label);
  if (label === null || day === null) return EFFECTIVE_DATE_FORMAT_ERROR;

  const changed =
    !isLiveLegalOverride(before) ||
    !sameText(before.bodyMarkdown, after.bodyMarkdown);
  if (changed) {
    const current = consentVersionFrom(overrides, scope.docs, scope.base);
    if (day <= (legalDayNumber(current) ?? 0)) {
      return `Metin değişti: yürürlük tarihini güncelle. Onaylar şu an "${current}" sürümünü kaydediyor; yeni metnin tarihi bundan sonra olmalı.`;
    }
  } else if (day <= (legalDayNumber(scope.base) ?? 0)) {
    return `Yürürlük tarihi sitedeki hazır metnin tarihinden (${scope.base}) sonra olmalı; yoksa onaylar bu metni hazır metinle aynı sürümle kaydeder.`;
  }

  for (const old of archived) {
    if (!isLiveLegalOverride(old) || sameText(old.bodyMarkdown, after.bodyMarkdown)) {
      continue;
    }
    const oldLabel = overrideLabel(old);
    if (oldLabel !== null && legalDayNumber(oldLabel) === day) {
      return `"${label}" bu belgenin önceki bir metninde kullanıldı; onaylar iki metni ayırt edemez. Başka bir tarih yaz.`;
    }
  }
  return null;
}
