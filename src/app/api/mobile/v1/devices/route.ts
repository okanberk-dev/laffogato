import { z } from "zod";

import { reserveLoginAttempt } from "@/lib/admin/rate-limit";
import { requireMobileCustomer } from "@/lib/mobile/auth";
import { apiError, apiJson } from "@/lib/mobile/respond";
import { parseJsonBody, routeFailure } from "@/lib/mobile/route-helpers";
import { registerDevice, unregisterDevice } from "@/lib/push/devices";
import {
  isExpoPushToken,
  platformFromUserAgent,
} from "@/lib/push/order-push-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

const TOKEN_MESSAGE = "Bildirim jetonu geçersiz.";

/**
 * Unknown keys are dropped rather than refused: a later app may send more
 * (an app version, say) to a server that predates it, and v1 only grows.
 */
const bodySchema = z.object({
  token: z
    .string({ error: TOKEN_MESSAGE })
    .trim()
    .refine(isExpoPushToken, { error: TOKEN_MESSAGE }),
});

/** Twenty calls per five minutes per member (rate-limit.ts "push-device"). */
async function limited(email: string): Promise<Response | null> {
  const limit = await reserveLoginAttempt("push-device", "*", email);
  if (!limit.blocked) return null;
  return apiError(
    429,
    "rate_limited",
    "Çok fazla deneme. Biraz sonra tekrar dene.",
    { "Retry-After": String(limit.retryAfterSeconds) },
  );
}

/**
 * `POST /api/mobile/v1/devices` (§23): the app's Expo push token, after the
 * member allowed notifications. Links it to the signed-in member (taking it
 * over from another member who had it: the phone changed hands) and
 * refreshes it; the platform is read from the request, never from the body.
 * The phone is then told when the member's order moves
 * (src/lib/push/order-push.ts), while their "Sipariş durumu" switch is on.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireMobileCustomer(request);
    if (!auth.ok) return auth.response;
    const body = await parseJsonBody(request, bodySchema);
    if (!body.ok) return body.response;
    const refused = await limited(auth.customer.email);
    if (refused) return refused;

    await registerDevice({
      token: body.data.token,
      email: auth.customer.email,
      platform: platformFromUserAgent(request.headers.get("user-agent")),
    });
    return apiJson(
      { token: body.data.token, registered: true },
      { private: true },
    );
  } catch (err) {
    return routeFailure("api/mobile/v1/devices POST", err);
  }
}

/**
 * `DELETE /api/mobile/v1/devices?token=<token>` (§23): the app is signing
 * out, or the member is closing the account. Forgets the token if it is
 * this member's; another member's token is never touched. `removed: false`
 * is an answer, not an error: there was nothing of theirs to forget.
 */
export async function DELETE(request: Request) {
  try {
    const auth = await requireMobileCustomer(request);
    if (!auth.ok) return auth.response;
    const token = (new URL(request.url).searchParams.get("token") ?? "").trim();
    if (!isExpoPushToken(token)) {
      return apiError(400, "invalid_request", TOKEN_MESSAGE);
    }
    const refused = await limited(auth.customer.email);
    if (refused) return refused;

    const removed = await unregisterDevice(token, auth.customer.email);
    return apiJson({ removed }, { private: true });
  } catch (err) {
    return routeFailure("api/mobile/v1/devices DELETE", err);
  }
}
