import {
  DEFAULT_KARAOKE_CANCEL_POLICY,
  samePolicy,
  type KaraokeCancelPolicy,
} from "@/lib/mobile/karaoke-time";

import { CHECKOUT_CONSENT_DOCS, LEGAL_UPDATED } from "./meta";

/**
 * Which revision a checkout consent records (`legalConsent.version`).
 *
 * An order stores the version of the Ön Bilgilendirme Formu and the Mesafeli
 * Satış Sözleşmesi the customer confirmed, because that record is what a
 * chargeback review or a consumer dispute reads. The coded documents carry
 * `LEGAL_UPDATED`. But /hukuk/<slug> shows a published panel override instead
 * of the coded text (and the app shows the same, `src/lib/mobile/legal.ts`),
 * so when an override is live on either checkout document the customer
 * agreed to THAT text, and recording `LEGAL_UPDATED` would name a revision
 * they never saw (API-13, 23 Eyl 2026).
 *
 * The rule: the later of `LEGAL_UPDATED` and each live checkout override's
 * effective date. The panel's "Yürürlük tarihi" is free text ("Örn: 26 Mayıs
 * 2026"); when it is blank or not in that shape, the Istanbul day the override
 * was saved stands in, since that is when its text started being shown. An
 * override dated earlier than `LEGAL_UPDATED` does not move the version back.
 *
 * Pure, no I/O: the checkout paths call `checkoutConsentVersion()` in
 * `./store`, which reads the overrides and lands here.
 */

/** The fields of a panel override this rule reads (`LegalDocOverride`). */
export interface ConsentOverride {
  isPublished: boolean;
  bodyMarkdown: string;
  effectiveDate: string;
  updatedAt: string;
}

const MONTHS = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
] as const;

const MONTH_KEYS = MONTHS.map((m) => m.toLocaleLowerCase("tr-TR"));

// Türkiye has kept UTC+3 all year since 2016; no DST table needed.
const ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000;

/**
 * "5 Eylül 2026" -> 20260905, or null when the label is not a real day in
 * that shape. The month is matched without regard to case.
 */
export function legalDayNumber(label: string): number | null {
  const m = /^(\d{1,2})\s+(\S+)\s+(\d{4})$/.exec(label.trim());
  if (!m) return null;
  const month = MONTH_KEYS.indexOf(m[2].toLocaleLowerCase("tr-TR"));
  const day = Number(m[1]);
  const year = Number(m[3]);
  if (month === -1 || day < 1) return null;
  // Day 31 of a 30-day month is a typo, not a date.
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  if (day > last) return null;
  return year * 10_000 + (month + 1) * 100 + day;
}

/** An ISO instant as the Istanbul calendar day, "5 Eylül 2026"; null if unreadable. */
export function istanbulDayLabel(iso: string): string | null {
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return null;
  const local = new Date(at + ISTANBUL_OFFSET_MS);
  return `${local.getUTCDate()} ${MONTHS[local.getUTCMonth()]} ${local.getUTCFullYear()}`;
}

/** An override replaces the coded text only when published with a body. */
export function isLiveLegalOverride<T extends ConsentOverride>(
  o: T | null | undefined,
): o is T {
  return !!o && o.isPublished && o.bodyMarkdown.trim() !== "";
}

/**
 * The day a live override's text counts from, as a label; null if unknown.
 * The version an order records when this override is the latest one; the
 * panel checks a new effective date with it (lib/admin/legal-schema.ts).
 */
export function overrideLabel(o: ConsentOverride): string | null {
  const typed = o.effectiveDate.trim();
  if (legalDayNumber(typed) !== null) return typed;
  return istanbulDayLabel(o.updatedAt);
}

/**
 * The version a checkout consent records, given the overrides by slug. Only
 * the consented documents count; drafts and empty overrides are ignored, as
 * on the public page.
 *
 * `docs` and `base` default to the order checkout's documents and revision;
 * the karaoke booking passes its own (`KARAOKE_CONSENT_DOCS`,
 * `KARAOKE_LEGAL_UPDATED`) through the same rule.
 */
export function consentVersionFrom(
  overrides: Readonly<Record<string, ConsentOverride | null | undefined>>,
  docs: readonly string[] = CHECKOUT_CONSENT_DOCS,
  base: string = LEGAL_UPDATED,
): string {
  let version = base;
  let latest = legalDayNumber(base) ?? 0;
  for (const slug of docs) {
    const o = overrides[slug];
    if (!isLiveLegalOverride(o)) continue;
    const label = overrideLabel(o);
    const day = label === null ? null : legalDayNumber(label);
    if (label !== null && day !== null && day > latest) {
      latest = day;
      version = label;
    }
  }
  return version;
}

/**
 * The karaoke document's version once its cancellation rule is rendered from
 * the panel's policy (P2a, 18 Eki 2026; `karaokeRoomDocFor`): `base` (the
 * coded revision, or a later live override), moved to the Istanbul day the
 * policy last changed when the policy in force is not the default. The
 * default renders the coded text word for word, so it keeps the coded
 * label; another policy is another text, dated by its save.
 */
export function karaokePolicyVersion(
  base: string,
  policy: KaraokeCancelPolicy,
  policyChangedAt: string | undefined,
): string {
  if (samePolicy(policy, DEFAULT_KARAOKE_CANCEL_POLICY)) return base;
  const label = istanbulDayLabel(policyChangedAt ?? "");
  const day = label === null ? null : legalDayNumber(label);
  if (label === null || day === null) return base;
  return day > (legalDayNumber(base) ?? 0) ? label : base;
}
