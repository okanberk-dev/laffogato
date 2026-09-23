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
 * Error correction level, and why it is not the library default.
 *
 * The payload is 26 base32 characters (`src/lib/mobile/counter.ts`), which QR
 * encodes in alphanumeric mode - cheap enough that level **Q** still fits in
 * a version-2, 25x25 grid. The old 43-character base64url token needed 33x33
 * at level M, so this is more recoverable data in a coarser grid: 25% of the
 * code can be lost to glare, a fingerprint or a scratched screen protector
 * and it still reads, and every module is physically larger while it does.
 */
const QR_ERROR_CORRECTION = "Q" as const;

/**
 * The quiet zone, in modules.
 *
 * ISO/IEC 18004 asks for four. This was `1`, which is the kind of thing that
 * works on the desk it was tested on and fails against a dark counter or a
 * member's dark-mode wallpaper - the scanner needs blank paper around the
 * finder patterns to lock onto them at all.
 */
const QR_QUIET_ZONE = 4;

/**
 * Draws the code, and tells the app how many modules wide it is.
 *
 * `qrcode` already writes `shape-rendering="crispEdges"` on the root, which
 * is the other half of the sharpness story - the SVG is drawn at 33 units and
 * scaled to ~300 device pixels, so without it every module edge lands on a
 * fractional pixel and is antialiased into a grey ramp that a scanner
 * thresholds the wrong way at exactly the boundaries that carry the data.
 * We rely on it rather than injecting a second copy; the contract test in
 * `tests/counter-qr.test.ts` fails if a future release drops it.
 */
async function renderCounterQr(
  token: string,
): Promise<{ svg: string; modules: number }> {
  const svg = await QRCode.toString(token, {
    type: "svg",
    margin: QR_QUIET_ZONE,
    errorCorrectionLevel: QR_ERROR_CORRECTION,
  });
  // The count comes from the same encode, not from a second guess at it.
  const modules = QRCode.create(token, {
    errorCorrectionLevel: QR_ERROR_CORRECTION,
  }).modules.size;
  return { svg, modules };
}

/**
 * `POST /me/counter-token` - the QR the member shows at the till (§17).
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

    const qr = await renderCounterQr(result.issue.token);

    return apiJson(
      {
        code: result.issue.code,
        token: result.issue.token,
        expiresAt: result.issue.expiresAt,
        ttlSeconds: result.issue.ttlSeconds,
        qrSvg: qr.svg,
        // Additive (docs/API-MOBILE.md §17): an older build ignores both and
        // keeps drawing the SVG at whatever size it chose.
        qrModules: qr.modules,
        qrQuietZone: QR_QUIET_ZONE,
      },
      { status: 201, private: true },
    );
  } catch (err) {
    return routeFailure(LABEL, err);
  }
}
