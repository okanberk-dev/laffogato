import "server-only";

import { getPublicSettings } from "@/lib/admin/store";
import { effectiveKaraokeCancelPolicy } from "@/lib/mobile/karaoke-time";

import { karaokePolicyVersion } from "./consent-version";
import { karaokeRoomDocFor } from "./content-karaoke";
import { findLegalDoc, hydrateLegalDoc, type LegalDoc } from "./documents";
import { KARAOKE_LEGAL_UPDATED } from "./meta";

/** `karaoke-odasi-rezervasyon` (`KARAOKE_CONSENT_DOCS`). */
const KARAOKE_ROOM_SLUG = "karaoke-odasi-rezervasyon";

/**
 * The karaoke terms as a booking made NOW agrees to them (P2a, karar D11):
 * the coded document with §7, §9 and §10 written for the panel's
 * cancellation policy (Ayarlar > Karaoke), dated by the day that policy was
 * saved when it is not the default. Under the default the coded text, word
 * for word, and its coded date.
 *
 * Presentation: read through `getPublicSettings`, so a database that cannot
 * be reached shows the coded document - the default rule, which is also what
 * a booking is made under while settings cannot be read (createReservation
 * reads them through `getSettings`, which throws instead). A published panel
 * override replaces this text as it replaces every coded document; keeping
 * an override in step with the policy is the editor's job.
 */
export async function karaokeLegalDocNow(): Promise<LegalDoc> {
  const settings = await getPublicSettings();
  const policy = effectiveKaraokeCancelPolicy(settings);
  return hydrateLegalDoc(
    karaokeRoomDocFor(
      policy,
      karaokePolicyVersion(
        KARAOKE_LEGAL_UPDATED,
        policy,
        settings.karaokeCancelPolicyAt,
      ),
    ),
  );
}

/** A coded document by slug, the karaoke one as of now. */
export async function liveLegalDoc(
  slug: string,
): Promise<LegalDoc | undefined> {
  const doc = findLegalDoc(slug);
  if (!doc || doc.slug !== KARAOKE_ROOM_SLUG) return doc;
  return karaokeLegalDocNow();
}
