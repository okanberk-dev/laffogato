import { z } from "zod";

import { requireMobileCustomer } from "@/lib/mobile/auth";
import { hasFalConsent, revokeFalConsent } from "@/lib/mobile/fal";
import { FAL_CONSENT_VERSION, falAiEnabled } from "@/lib/mobile/fal-core";
import { apiError, apiJson } from "@/lib/mobile/respond";
import { parseJsonBody, routeFailure } from "@/lib/mobile/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

/** Where the consent text is published: Açık Rıza Metni, section 15/A (R12). */
const CONSENT_DOC = "acik-riza-metni";

const GRANT = z.object({ version: z.string().min(1).max(40) });

/**
 * `GET /fal/consent` - whether the AI reading is on, and whether this member
 * has agreed to the current R12 text (docs/API-MOBILE.md §20).
 *
 * Since 27 Oct 2026 `enabled` is always false: fA'L and its AI reading left
 * the app after App Review's 4.3(b) refusal (lafmobil karar 330), and
 * `falAiEnabled` no longer reads the environment. `granted` is false for
 * every member the retirement migration reached (it stamped `revokedAt`).
 */
export async function GET(request: Request) {
  try {
    const auth = await requireMobileCustomer(request);
    if (!auth.ok) return auth.response;
    return apiJson(
      {
        enabled: falAiEnabled(),
        version: FAL_CONSENT_VERSION,
        granted: await hasFalConsent(auth.customer.email),
        doc: CONSENT_DOC,
      },
      { private: true },
    );
  } catch (err) {
    return routeFailure("api/mobile/v1/fal/consent GET", err);
  }
}

/**
 * `POST /fal/consent` `{ version }` - the member agrees to the R12 text. A
 * version other than the current one is refused (409 `consent_outdated`): the
 * member must have been shown the words that are actually in force.
 *
 * Since the 27 Oct 2026 retirement there is no text in force to agree to:
 * R12 left the Açık Rıza Metni, and Veri Saklama says no new consent is
 * taken. So every version is an old one and every grant is refused with
 * the 409 §20 already documents; nothing is written (a migration closed
 * the stored rows, and an upsert here would have reopened them). No build
 * after lafmobil karar 330 calls this, and older builds asked only while
 * GET said `enabled: true`, which it never says again.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireMobileCustomer(request);
    if (!auth.ok) return auth.response;
    const body = await parseJsonBody(request, GRANT);
    if (!body.ok) return body.response;
    return apiError(409, "consent_outdated", "Bu özellik uygulamadan kaldırıldı; onay alınmıyor.");
  } catch (err) {
    return routeFailure("api/mobile/v1/fal/consent POST", err);
  }
}

/** `DELETE /fal/consent` - the member withdraws R12: the row stays, `revokedAt` is stamped. */
export async function DELETE(request: Request) {
  try {
    const auth = await requireMobileCustomer(request);
    if (!auth.ok) return auth.response;
    await revokeFalConsent(auth.customer.email);
    return apiJson({ granted: false }, { private: true });
  } catch (err) {
    return routeFailure("api/mobile/v1/fal/consent DELETE", err);
  }
}
