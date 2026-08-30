import type { NextRequest } from "next/server";

import {
  optionalMobileCustomer,
  readJsonBody,
  routeFailure,
} from "@/lib/mobile/http";
import { previewPromoRateLimited } from "@/lib/mobile/orders";
import {
  firstIssueMessage,
  promoPreviewBodySchema,
} from "@/lib/mobile/order-schema";
import { apiError, apiJson } from "@/lib/mobile/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * `POST /api/mobile/v1/promo/preview` — is this code good for this subtotal
 * (docs/API-MOBILE.md §5)? Nothing is consumed; checkout re-validates. Rate
 * limited per IP (`promo-preview`), because an unlimited yes/no oracle is a
 * code enumerator.
 */
export async function POST(request: NextRequest) {
  try {
    const who = await optionalMobileCustomer(request);
    if (!who.ok) return who.response;

    const body = await readJsonBody(request);
    if (!body.ok) return body.response;
    const parsed = promoPreviewBodySchema.safeParse(body.value);
    if (!parsed.success) {
      return apiError(400, "invalid_body", firstIssueMessage(parsed.error));
    }

    const result = await previewPromoRateLimited(
      parsed.data.code,
      parsed.data.subtotalMinor,
      who.customer,
      parsed.data.kind,
    );
    if (result.limited) {
      return apiError(
        429,
        "rate_limited",
        `Çok fazla deneme. ${result.retryAfterSeconds} saniye sonra tekrar dene.`,
        { "Retry-After": String(result.retryAfterSeconds) },
      );
    }
    const preview = result.preview;
    return apiJson(
      preview.ok
        ? {
            ok: true as const,
            code: preview.code,
            discountMinor: preview.discountMinor,
          }
        : { ok: false as const, message: preview.message },
    );
  } catch (err) {
    return routeFailure(err, "api/mobile/v1/promo/preview");
  }
}
