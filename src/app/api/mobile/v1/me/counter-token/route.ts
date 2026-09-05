import QRCode from "qrcode";

import { requireMobileCustomer } from "@/lib/mobile/auth";
import { issueCounterToken } from "@/lib/mobile/counter";
import { apiError, apiJson } from "@/lib/mobile/respond";
import { routeFailure } from "@/lib/mobile/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

const LABEL = "api/mobile/v1/me/counter-token POST";

const MSG = {
  unverified:
    "Kasada damga alabilmek için önce e-postanı doğrula. Doğrulama bağlantısı gelen kutunda.",
  rateLimited: "Çok sık kod istedin. Bir dakika bekle, sonra kartı yeniden aç.",
} as const;

/**
 * `POST /me/counter-token` — the QR the member shows at the till (§17).
 *
 * POST rather than GET on purpose: issuing writes a row, retires the previous
 * codes and counts against the member's rate budget, and none of that belongs
 * behind a method a browser or a proxy may replay on its own.
 *
 * The SVG is drawn here rather than in the app: `qrcode` is already a
 * dependency of this repo, and the app takes no new native module for a
 * picture the server can hand it finished.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireMobileCustomer(request);
    if (!auth.ok) return auth.response;
    // The same gate `POST /orders` has: an unconfirmed sign-up must not be
    // able to collect stamps on an address that is not theirs.
    if (!auth.customer.emailVerified) {
      return apiError(403, "email_unverified", MSG.unverified);
    }

    const result = await issueCounterToken(auth.customer.email);
    if (!result.ok) {
      return apiError(429, "rate_limited", MSG.rateLimited, {
        "Retry-After": String(result.retryAfterSeconds),
      });
    }

    const qrSvg = await QRCode.toString(result.issue.token, {
      type: "svg",
      margin: 1,
      errorCorrectionLevel: "M",
    });

    return apiJson(
      {
        code: result.issue.code,
        token: result.issue.token,
        expiresAt: result.issue.expiresAt,
        ttlSeconds: result.issue.ttlSeconds,
        qrSvg,
      },
      { status: 201, private: true },
    );
  } catch (err) {
    return routeFailure(LABEL, err);
  }
}
