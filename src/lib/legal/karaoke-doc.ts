import "server-only";

import { getPublicSettings } from "@/lib/admin/store";
import { effectiveKaraokeCancelPolicy } from "@/lib/mobile/karaoke-time";

import { karaokePolicyVersion } from "./consent-version";
import { KARAOKE_ROOM_DOC } from "./content-karaoke";
import { findLegalDoc, hydrateLegalDoc, type LegalDoc } from "./documents";
import { KARAOKE_LEGAL_UPDATED } from "./meta";

/** `karaoke-odasi-rezervasyon` (`KARAOKE_CONSENT_DOCS`). */
const KARAOKE_ROOM_SLUG = "karaoke-odasi-rezervasyon";

/**
 * The karaoke terms as a booking made NOW agrees to them (P2a, karar D11):
 * the coded document, dated by the day the panel's cancellation policy was
 * saved when it is not the default (the version a booking's consent records,
 * `karaokePolicyVersion`). Since ASK-OTH-3-CFG (19 Eki 2026) the text names
 * no hours or percent: it points at the booking's own summary, so the words
 * are the same under every policy and only the date can move.
 *
 * Presentation: read through `getPublicSettings`, so a database that cannot
 * be reached shows the coded document with its coded date. A published panel
 * override replaces this text as it replaces every coded document.
 */
export async function karaokeLegalDocNow(): Promise<LegalDoc> {
  return karaokeLegalDocFor(await getPublicSettings());
}

/** The settings the karaoke terms' date is worked out from. */
export type KaraokeDocSettings = Parameters<
  typeof effectiveKaraokeCancelPolicy
>[0] & { karaokeCancelPolicyAt?: string };

/**
 * `karaokeLegalDocNow` for settings already read: a booking hashes the text
 * it records (`legalConsent.textHashes`) from the same read that decides its
 * policy and version (karaoke.ts `createReservation`).
 */
export function karaokeLegalDocFor(settings: KaraokeDocSettings): LegalDoc {
  const policy = effectiveKaraokeCancelPolicy(settings);
  const updatedAt = karaokePolicyVersion(
    KARAOKE_LEGAL_UPDATED,
    policy,
    settings.karaokeCancelPolicyAt,
  );
  return hydrateLegalDoc({ ...KARAOKE_ROOM_DOC, updatedAt });
}

/** A coded document by slug, the karaoke one as of now. */
export async function liveLegalDoc(
  slug: string,
): Promise<LegalDoc | undefined> {
  const doc = findLegalDoc(slug);
  if (!doc || doc.slug !== KARAOKE_ROOM_SLUG) return doc;
  return karaokeLegalDocNow();
}
