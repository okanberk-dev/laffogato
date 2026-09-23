import "server-only";

import { createHash } from "node:crypto";

import type { User } from "@supabase/supabase-js";
import type { NextResponse } from "next/server";

import type { PublicCustomer } from "@/lib/customer/store";

import { ensureCustomerForSupabaseUser } from "@/lib/customer/supabase-bridge";
import { isDbUnreachable } from "@/lib/db/health";
import { getSupabaseAnonClient } from "@/lib/supabase/anon";

import {
  classifyAuthError,
  parseBearerToken,
  tokenExpiryMs,
} from "./auth-core";
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
 *   401 `unauthorized`      - no / malformed / invalid / expired token
 *   403 `account_disabled`  - an admin deactivated the member
 *   403 `email_unverified`  - the address belongs to an existing member and
 *                             Supabase has not confirmed it yet
 *   503 `auth_unavailable`  - Supabase could not be reached
 *   503 `unavailable`       - this database could not be reached
 * A query the database *rejected* is a bug and is thrown, not masked.
 */
/**
 * Supabase's answer for a token, remembered for a minute.
 *
 * Every mobile call used to cost a network round-trip to Supabase Auth, so a
 * client polling the app's screens (or a script with one valid token) burned
 * the project's shared auth quota and slowed every member down. The cache is
 * keyed on a hash of the token - never the token itself, so a heap dump does
 * not hand out sessions - and holds only successes.
 *
 * PER INSTANCE, and this deployment is serverless: the map lives in one warm
 * lambda, so there is no shared cache to invalidate, and a member's requests
 * land on whichever instance answers. Practically that means every instance
 * pays for the first sight of a token and remembers it separately, the hit
 * rate follows how warm the fleet is, and nothing here can be flushed from
 * outside the process - which is why nothing security-critical is allowed to
 * depend on it:
 *   - an entry never outlives the token's own `exp`, so a session that has
 *     since been signed out and expired cannot be replayed out of the cache;
 *   - the `customers` row is re-read on every request below, so a closed or
 *     deactivated account is refused immediately, cache hit or not.
 * What is left is a lag of at most a minute (and at most until `exp`) for a
 * sign-out that revokes a token BEFORE it expires - the same window the app
 * already has, since it drops the token itself on sign-out.
 */
const USER_CACHE_TTL_MS = 60_000;
const USER_CACHE_MAX = 1000;
const userCache = new Map<string, { user: User; expiresAt: number }>();

function tokenKey(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function cachedUser(key: string, now: number): User | null {
  const hit = userCache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= now) {
    userCache.delete(key);
    return null;
  }
  return hit.user;
}

function rememberUser(
  key: string,
  user: User,
  now: number,
  expiryMs: number | null,
): void {
  // The token's own death is a hard ceiling on the entry: an access token that
  // expires in ten seconds must not be honoured for a minute.
  const expiresAt =
    expiryMs === null
      ? now + USER_CACHE_TTL_MS
      : Math.min(now + USER_CACHE_TTL_MS, expiryMs);
  if (expiresAt <= now) return;
  // Insertion-ordered: dropping the front evicts the oldest entry.
  if (userCache.size >= USER_CACHE_MAX) {
    const oldest = userCache.keys().next().value;
    if (oldest !== undefined) userCache.delete(oldest);
  }
  userCache.set(key, { user, expiresAt });
}

/** Test seam: forget every cached token. */
export function resetMobileAuthCache(): void {
  userCache.clear();
}

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

  const key = tokenKey(token);
  const now = Date.now();
  let user: User | null = cachedUser(key, now);
  if (user) {
    return finishLink(user);
  }

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
  rememberUser(key, user, now, tokenExpiryMs(token));

  return finishLink(user);
}

/** The `customers` half: read on every request, cache or not. */
async function finishLink(user: User): Promise<MobileAuthResult> {
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
