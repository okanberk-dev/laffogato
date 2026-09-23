import { z } from "zod";

import { requireMobileCustomer } from "@/lib/mobile/auth";
import { grantFalConsent, hasFalConsent, revokeFalConsent } from "@/lib/mobile/fal";
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
 */
export async function GET(request: Request) {
  try {
    const auth = await requireMobileCustomer(request);
    if (!auth.ok) return auth.response;
    return apiJson(
      {
        enabled: falAiEnabled(process.env),
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
 */
export async function POST(request: Request) {
  try {
    const auth = await requireMobileCustomer(request);
    if (!auth.ok) return auth.response;
    const body = await parseJsonBody(request, GRANT);
    if (!body.ok) return body.response;
    if (body.data.version !== FAL_CONSENT_VERSION) {
      return apiError(409, "consent_outdated", "Onay metni güncellendi; lütfen yeni metni okuyup yeniden onayla.");
    }
    await grantFalConsent(auth.customer.email);
    return apiJson({ granted: true, version: FAL_CONSENT_VERSION }, { private: true });
  } catch (err) {
    return routeFailure("api/mobile/v1/fal/consent POST", err);
  }
}

/** `DELETE /fal/consent` - the member withdraws R12; fA'L reads on the device again. */
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
