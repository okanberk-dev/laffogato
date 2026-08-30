import { requireMobileCustomer } from "@/lib/mobile/auth";
import { claimInvite, type ClaimInviteError } from "@/lib/mobile/invite";
import { inviteClaimSchema } from "@/lib/mobile/me-schema";
import { apiError, apiJson } from "@/lib/mobile/respond";
import { parseJsonBody, routeFailure } from "@/lib/mobile/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

const FAILURES: Record<
  ClaimInviteError,
  { status: number; code: string; message: string }
> = {
  invalid_code: {
    status: 404,
    code: "invite_not_found",
    message: "Bu davet kodu geçerli değil.",
  },
  own_code: {
    status: 400,
    code: "own_invite",
    message: "Kendi davet kodunu kullanamazsın.",
  },
  already_claimed: {
    status: 409,
    code: "invite_already_claimed",
    message: "Bu hesap zaten bir davet kodu kullanmış.",
  },
  has_orders: {
    status: 409,
    code: "invite_not_eligible",
    message: "Davet kodu yalnız ilk siparişten önce kullanılabilir.",
  },
};

/** `POST /invite/claim` — bind this account to an inviter's code (§5). */
export async function POST(request: Request) {
  try {
    const auth = await requireMobileCustomer(request);
    if (!auth.ok) return auth.response;
    const body = await parseJsonBody(request, inviteClaimSchema);
    if (!body.ok) return body.response;

    const result = await claimInvite(auth.customer.email, body.data.code);
    if (!result.ok) {
      const f = FAILURES[result.error];
      return apiError(f.status, f.code, f.message);
    }
    return apiJson({ ok: true as const }, { private: true });
  } catch (err) {
    return routeFailure("api/mobile/v1/invite/claim POST", err);
  }
}
