import "server-only";

import type { User } from "@supabase/supabase-js";
import type { NextResponse } from "next/server";

import type { PublicCustomer } from "@/lib/customer/store";

import { ensureCustomerForSupabaseUser } from "@/lib/customer/supabase-bridge";
import { isDbUnreachable } from "@/lib/db/health";
import { getSupabaseAnonClient } from "@/lib/supabase/anon";

import { classifyAuthError, parseBearerToken } from "./auth-core";
import { apiError } from "./respond";

export type MobileAuthResult =
  | {
      ok: true;
      customer: PublicCustomer;
      user: User;
      supabaseUserId: string;
    }
  | { ok: false; response: NextResponse };

const MSG = {
  missing: "Giriş yapman gerekiyor.",
  invalid: "Oturumun geçersiz ya da süresi dolmuş. Yeniden giriş yap.",
  disabled: "Hesabın devre dışı bırakılmış. Lütfen bizimle iletişime geç.",
  unconfirmed:
    "Bu e-posta zaten üye. Önce e-postandaki doğrulama bağlantısına tıkla.",
  authDown:
    "Kimlik servisine şu an ulaşılamıyor. Kısa süre içinde tekrar dene.",
  dbDown:
    "Hesap servisimize şu an ulaşamıyoruz. Kısa süre içinde tekrar dener misin?",
} as const;

/**
 * Authenticates a mobile API request (docs/API-MOBILE.md §0).
 *
 * `Authorization: Bearer <Supabase access JWT>` → Supabase says who the token
 * belongs to → that e-mail's `customers` row (created on first contact). The
 * token is verified by Supabase itself on every call rather than decoded
 * locally: no signing key is needed here, and a revoked user is refused at
 * once rather than until the token expires.
 *
 * Route handlers branch on `ok` and return `response` as-is on failure:
 *   401 `unauthorized`      — no / malformed / invalid / expired token
 *   403 `account_disabled`  — an admin deactivated the member
 *   403 `email_unverified`  — the address belongs to an existing member and
 *                             Supabase has not confirmed it yet
 *   503 `auth_unavailable`  — Supabase could not be reached
 *   503 `unavailable`       — this database could not be reached
 * A query the database *rejected* is a bug and is thrown, not masked.
 */
export async function requireMobileCustomer(
  request: Request,
): Promise<MobileAuthResult> {
  const token = parseBearerToken(request.headers.get("authorization"));
  if (!token) {
    return {
      ok: false,
      response: apiError(401, "unauthorized", MSG.missing, {
        "WWW-Authenticate": "Bearer",
      }),
    };
  }

  let user: User | null = null;
  try {
    const { data, error } = await getSupabaseAnonClient().auth.getUser(token);
    if (error) {
      if (classifyAuthError(error) === "unavailable") {
        console.error(`[mobile-auth] supabase unreachable: ${error.message}`);
        return {
          ok: false,
          response: apiError(503, "auth_unavailable", MSG.authDown),
        };
      }
      return {
        ok: false,
        response: apiError(401, "unauthorized", MSG.invalid),
      };
    }
    user = data.user;
  } catch (err) {
    console.error(
      `[mobile-auth] getUser threw: ${err instanceof Error ? err.message : String(err)}`,
    );
    return {
      ok: false,
      response: apiError(503, "auth_unavailable", MSG.authDown),
    };
  }
  if (!user) {
    return { ok: false, response: apiError(401, "unauthorized", MSG.invalid) };
  }

  try {
    const linked = await ensureCustomerForSupabaseUser(user);
    if (!linked.ok) {
      if (linked.reason === "account_disabled") {
        return {
          ok: false,
          response: apiError(403, "account_disabled", MSG.disabled),
        };
      }
      if (linked.reason === "email_unconfirmed") {
        return {
          ok: false,
          response: apiError(403, "email_unverified", MSG.unconfirmed),
        };
      }
      // A Supabase user with no e-mail (phone-only) cannot be a member here.
      return {
        ok: false,
        response: apiError(401, "unauthorized", MSG.invalid),
      };
    }
    return {
      ok: true,
      customer: linked.customer,
      user,
      supabaseUserId: user.id,
    };
  } catch (err) {
    if (isDbUnreachable(err)) {
      return { ok: false, response: apiError(503, "unavailable", MSG.dbDown) };
    }
    throw err;
  }
}
