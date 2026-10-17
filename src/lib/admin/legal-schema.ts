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
      .max(
        LEGAL_LIMITS.bodyMarkdown,
        "İçerik en fazla 60.000 karakter olabilir.",
      )
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

/**
 * An archived text of a consent document (legal_override_history), as the
 * version history reads it. The text was shown from its `updatedAt` (a save
 * that changes nothing writes nothing, so that is when it went up) until
 * `archivedAt`.
 */
export interface ConsentArchiveRow extends ConsentOverride {
  slug: string;
  archivedAt: string;
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
  /**
   * Every archived text of the scope's documents, drafts included: both
   * checkout documents share one version, and a draft span is a span the
   * coded text was shown.
   */
  archived: readonly ConsentArchiveRow[];
}

function normText(s: string): string {
  return s.replace(/\r\n/g, "\n").trim();
}

function sameText(a: string, b: string): boolean {
  return normText(a) === normText(b);
}

type ConsentRows = Readonly<Record<string, ConsentOverride | null | undefined>>;

/** The texts a scope's customers are shown: each live body, null = coded. */
function textsKey(docs: readonly string[], rows: ConsentRows): string {
  return JSON.stringify(
    docs.map((slug) => {
      const o = rows[slug];
      return isLiveLegalOverride(o) ? normText(o.bodyMarkdown) : null;
    }),
  );
}

/**
 * Every version a scope's consents have recorded, each with the texts it
 * stood for (`textsKey`), rebuilt from the archive and the rows stored now:
 * at every moment a text of the scope went up or came down, the version
 * rule's answer and what the customers were shown.
 */
export function recordedConsentStates(
  scope: { docs: readonly string[]; base: string },
  archived: readonly ConsentArchiveRow[],
  current: ConsentRows,
): Map<string, Set<string>> {
  type Span = { from: string; to: string | null; row: ConsentOverride };
  const spans = new Map<string, Span[]>();
  // "" is before any override: every document on its coded text.
  const instants = new Set<string>([""]);
  for (const slug of scope.docs) {
    const list: Span[] = archived
      .filter((r) => r.slug === slug)
      .map((row) => ({ from: row.updatedAt, to: row.archivedAt, row }));
    const now = current[slug];
    if (now) list.push({ from: now.updatedAt, to: null, row: now });
    for (const s of list) {
      instants.add(s.from);
      if (s.to !== null) instants.add(s.to);
    }
    spans.set(slug, list);
  }
  const out = new Map<string, Set<string>>();
  for (const at of [...instants].sort()) {
    const rows: Record<string, ConsentOverride | null> = {};
    for (const slug of scope.docs) {
      rows[slug] =
        spans
          .get(slug)
          ?.find((s) => s.from <= at && (s.to === null || at < s.to))?.row ??
        null;
    }
    const version = consentVersionFrom(rows, scope.docs, scope.base);
    const texts = out.get(version) ?? new Set<string>();
    texts.add(textsKey(scope.docs, rows));
    out.set(version, texts);
  }
  return out;
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
 * - The version after the save must not be one an earlier state of the
 *   scope recorded for other texts (`recordedConsentStates`): after a
 *   reset, a restore, or a date moved back, an old label is free again in
 *   the version rule but not in the orders that recorded it. Across both
 *   checkout documents: a Mesafeli Satış text may not take the date an
 *   archived Ön Bilgilendirme text was recorded under.
 *
 * Drafts, unpublished saves and documents no consent records pass. Taking a
 * live text down (a draft save, "Varsayılana döndür") is not refused: the
 * archive keeps when each text was shown, and with both checkout documents
 * live no date can move the version past it (see docs/AUDIT.md, 6a).
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

  const next = { ...overrides, [slug]: after };
  const version = consentVersionFrom(next, scope.docs, scope.base);
  const named = recordedConsentStates(scope, archived, overrides).get(version);
  if (named && !named.has(textsKey(scope.docs, next))) {
    const shared =
      scope.docs.length > 1 ? " (iki ödeme belgesi tek sürümü paylaşır)" : "";
    return `"${version}" sürümü onaylarda daha önce başka bir metinle kaydedildi${shared}; onaylar iki metni ayırt edemez. Başka bir tarih yaz.`;
  }
  return null;
}
