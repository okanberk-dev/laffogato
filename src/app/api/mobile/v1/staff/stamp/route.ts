import { logAudit } from "@/lib/admin/audit";
import {
  checkLoginLimit,
  clientIpFrom,
  recordLoginFailure,
} from "@/lib/admin/rate-limit";
import { isActiveBarista } from "@/lib/admin/staff-members";
import { requireMobileCustomer } from "@/lib/mobile/auth";
import {
  redeemCounterToken,
  type CounterRedeemError,
} from "@/lib/mobile/counter";
import { apiError, apiJson } from "@/lib/mobile/respond";
import { parseJsonBody, routeFailure } from "@/lib/mobile/route-helpers";
import { staffStampSchema } from "@/lib/mobile/staff-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

const LABEL = "api/mobile/v1/staff/stamp POST";

const MSG = {
  unverified:
    "Kasa yapabilmek için önce e-postanı doğrula. Doğrulama bağlantısı gelen kutunda.",
  notStaff: "Bu hesabın kasa yetkisi yok. Yetkiyi panelden yönetici verir.",
  rateLimited: (s: number) =>
    `Çok fazla bulunamayan kod okuttun. ${s} saniye sonra tekrar dene.`,
  // The till's wording says "ya da e-posta ile ara"; the app has no e-mail
  // path, so it points the barista at the one thing they can do.
  notFound: "Kod bulunamadı. Üyeden kartını yeniden açmasını iste.",
} as const;

/**
 * The till's refusals, as HTTP. The codes are the ones §17 already lists for
 * the panel till; `self_stamp` is the one new code (with `not_staff`).
 * `invalid_email` cannot occur - the body has no e-mail path - but the map is
 * total so a new refusal in `redeemCounterToken` is a type error here.
 */
const STATUS: Record<CounterRedeemError, number> = {
  invalid_stamps: 400,
  invalid_email: 400,
  not_found: 404,
  expired: 409,
  already_used: 409,
  self_stamp: 403,
};

/**
 * `POST /staff/stamp` - a barista stamps a member's QR from the app
 * (docs/API-MOBILE.md §21).
 *
 * The barista is an ordinary member account the panel has marked
 * (`staff_members`, /admin/kullanicilar). Everything after that check is the
 * panel till's own `redeemCounterToken`, so the two-minute token, one stamp
 * run per token, the 1-5 range and the ledger rows hold exactly as they do at
 * /admin/kasa; the only addition is that the barista's own code is refused
 * before it is burned.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireMobileCustomer(request);
    if (!auth.ok) return auth.response;
    const barista = auth.customer;
    // A grant is keyed by address; an unconfirmed sign-up must not be able to
    // borrow a barista's address and the till along with it.
    if (!barista.emailVerified) {
      return apiError(403, "email_unverified", MSG.unverified);
    }
    // Before the body is read: a member without the till learns nothing
    // about the code they sent.
    if (!(await isActiveBarista(barista.email))) {
      return apiError(403, "not_staff", MSG.notStaff);
    }

    const body = await parseJsonBody(request, staffStampSchema);
    if (!body.ok) return body.response;

    const ip = clientIpFrom(request.headers);
    const limit = await checkLoginLimit("staff-stamp", ip, barista.email);
    if (limit.blocked) {
      return apiError(
        429,
        "rate_limited",
        MSG.rateLimited(limit.retryAfterSeconds),
        { "Retry-After": String(limit.retryAfterSeconds) },
      );
    }

    const { kind, value, stamps } = body.data;
    const result = await redeemCounterToken({
      kind,
      value,
      stamps,
      actor: barista.email,
      note: "Uygulama",
      refuseOwner: barista.email,
    });
    if (!result.ok) {
      // Stamps may have landed before the failure: answered as the throw it
      // used to be (500, or 503 with the database down), so the app sees
      // exactly what it saw before the till learned to say "verilmiş olabilir".
      if (result.error === "partial") throw result.cause;
      // Only a code that matched nothing is what guessing looks like.
      if (result.error === "not_found") {
        await recordLoginFailure("staff-stamp", ip, barista.email);
      }
      return apiError(
        STATUS[result.error],
        result.error,
        result.error === "not_found" ? MSG.notFound : result.message,
      );
    }

    const { redemption } = result;
    // The stamps are already written: a failed audit row must not turn them
    // into a 500 the barista retries into "already used".
    try {
      await logAudit({
        action: "update",
        entity: "counter_token",
        entityId: redemption.code,
        payload: { kind, stamps: redemption.stampsGiven, via: "app" },
        actor: barista.email,
      });
    } catch (err) {
      console.error(`[${LABEL}] audit failed`, err);
    }

    return apiJson(
      {
        name: redemption.name,
        memberLabel: redemption.memberLabel,
        code: redemption.code,
        stampsGiven: redemption.stampsGiven,
        stamps: redemption.loyalty.stamps,
        stampTarget: redemption.loyalty.stampTarget,
        rewardsReady: redemption.loyalty.rewardsReady,
      },
      { private: true },
    );
  } catch (err) {
    return routeFailure(LABEL, err);
  }
}
