import "server-only";

import { findLegalDoc, LEGAL_DOCS, type LegalDoc } from "./documents";
import {
  karaokeLegalDocFor,
  karaokeLegalDocNow,
  type KaraokeDocSettings,
} from "./karaoke-doc";
import { KARAOKE_CONSENT_DOCS } from "./meta";
import {
  legalVersionOf,
  shownVersionDoc,
  type ConsentTextHashes,
  type LegalVersion,
  type ShownOverride,
} from "./version-core";
import { recordLegalVersions } from "./versions";

/**
 * The documents as shown, hashed and stored: the half of the durable copy
 * that needs the 1.5 MB contract registry (./documents.ts). It is reached
 * only through a dynamic import from ./store.ts, the panel and the cron, so
 * a public page that reads ./store.ts for an override does not load the
 * registry for it.
 */

const KARAOKE_SLUG: string = KARAOKE_CONSENT_DOCS[0];

/**
 * The coded document of `slug` as a page shows it now; the karaoke terms
 * dated by the cancellation policy in `karaoke` (the booking's own read),
 * or by the settings as they are now when none is given.
 */
export async function codedLegalDoc(
  slug: string,
  karaoke?: KaraokeDocSettings,
): Promise<LegalDoc | undefined> {
  if (slug !== KARAOKE_SLUG) return findLegalDoc(slug);
  return karaoke ? karaokeLegalDocFor(karaoke) : karaokeLegalDocNow();
}

/**
 * The text each of `slugs` shows with the override read for it (same
 * index), as versions. A slug with no coded document has nothing to show
 * and is left out.
 */
export async function shownVersions(
  slugs: readonly string[],
  overrides: readonly (ShownOverride | null | undefined)[],
  karaoke?: KaraokeDocSettings,
): Promise<LegalVersion[]> {
  const out: LegalVersion[] = [];
  for (let i = 0; i < slugs.length; i++) {
    const doc = await codedLegalDoc(slugs[i], karaoke);
    if (doc) out.push(legalVersionOf(shownVersionDoc(doc, overrides[i])));
  }
  return out;
}

/** "relation ... does not exist" and the like, never a body or an address. */
function short(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).slice(0, 160);
}

/**
 * `legalConsent.textHashes` for a consent given now: the hash of each
 * document's shown text. Each text is stored (once per hash) on the way;
 * a failure there is logged and costs the consent nothing - the hash is
 * the record, and the text is stored again by the next consent, by the
 * confirmation mail when it is sent, by the panel and by the daily cron.
 */
export async function consentTexts(
  slugs: readonly string[],
  overrides: readonly (ShownOverride | null | undefined)[],
  karaoke?: KaraokeDocSettings,
): Promise<ConsentTextHashes> {
  const versions = await shownVersions(slugs, overrides, karaoke);
  try {
    await recordLegalVersions(versions);
  } catch (err) {
    console.error(
      `[legal-versions] consent texts not stored (${versions.map((v) => v.hash.slice(0, 16)).join(", ")}): ${short(err)}`,
    );
  }
  const hashes: ConsentTextHashes = {};
  for (const v of versions) hashes[v.slug] = v.hash;
  return hashes;
}

/**
 * Every document as /hukuk/<slug> shows it now (the published override, or
 * the coded text; the karaoke terms under today's policy), for the daily
 * cron: a coded text nobody consents to (KVKK, the İşlem Rehberi) is stored
 * within a day of the deploy that changed it.
 */
export async function allShownVersions(
  overrides: Readonly<Record<string, ShownOverride | null | undefined>>,
): Promise<LegalVersion[]> {
  const slugs = LEGAL_DOCS.map((d) => d.slug);
  return shownVersions(
    slugs,
    slugs.map((slug) => overrides[slug] ?? null),
  );
}
