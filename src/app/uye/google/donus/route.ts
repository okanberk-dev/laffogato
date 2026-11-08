import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

import { clientIp, reserveLoginAttempt } from "@/lib/admin/rate-limit";
import { setActiveCustomerSession } from "@/lib/customer/auth";
import {
  googleCallbackNotice,
  googleConsentHref,
  googleExchangeNotice,
  signInWithNotice,
  type GoogleNotice,
} from "@/lib/customer/google-sign-in-core";
import {
  ensureCustomerForSupabaseUser,
  googleSignInNeedsConsent,
} from "@/lib/customer/supabase-bridge";
import { isDbUnreachable } from "@/lib/db/health";
import { sameSitePath } from "@/lib/http/same-site-path";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * `GET /uye/google/donus?code=…` - where Supabase hands back a member who
 * chose a Google account (docs/AUTH-BRIDGE.md §7).
 *
 * 1. The code is exchanged for a Supabase session with the verifier this
 *    browser's start request stored (PKCE). Only this browser can spend it.
 * 2. A brand-new member stops at the consent page (`googleNeedsConsent`):
 *    the Supabase session stays in the cookies, the site's own cookie is not
 *    set, so nobody is signed in to the site until the agreement is ticked.
 * 3. Everyone else goes through the same bridge as a password sign-in
 *    (`ensureCustomerForSupabaseUser`: one membership per e-mail - a Google
 *    account with a member's address lands on that member's row, orders and
 *    stamps included), and gets the site's signed cookie.
 *
 * Every refusal ends on /uye/giris with a `?google=` line; the Supabase
 * cookies of a session the site refused are cleared (local scope: the
 * member's phone is not signed out by a failed web sign-in).
 *
 * Counted against the connection's sign-in budget before the code is sent
 * anywhere (`customer-login-ip`, shared with the password form): each
 * exchange is a call from this server to Supabase Auth, and a loop of
 * forged codes must not spend the shared auth quota every member's
 * password sign-in also runs on.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = sameSitePath(params.get("next"));
  const code = params.get("code");

  if (!code) {
    redirect(
      signInWithNotice(
        googleCallbackNotice({
          error: params.get("error"),
          errorCode: params.get("error_code"),
          errorDescription: params.get("error_description"),
        }),
        next,
      ),
    );
  }

  const target = await finish(code, next);
  redirect(target);
}

/** Where the browser goes next; never throws past a database outage. */
async function finish(code: string, next: string | null): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const refuse = async (notice: GoogleNotice): Promise<string> => {
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch (err) {
      console.error("[uye/google] sign-out after refusal failed", err);
    }
    return signInWithNotice(notice, next);
  };

  try {
    const budget = await reserveLoginAttempt(
      "customer-login-ip",
      await clientIp(),
      "*",
    );
    if (budget.blocked) return signInWithNotice("cok", next);
  } catch (err) {
    if (!isDbUnreachable(err)) throw err;
    return signInWithNotice("hata", next);
  }

  let user;
  try {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.user) {
      if (error) {
        console.error(
          `[uye/google] exchange refused: ${error.name} ${error.code ?? ""} ${error.status ?? ""}`,
        );
      }
      return signInWithNotice(
        error ? googleExchangeNotice(error) : "hata",
        next,
      );
    }
    user = data.user;
  } catch (err) {
    console.error(
      `[uye/google] exchange failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return signInWithNotice("hata", next);
  }

  if (!user.email?.trim()) return refuse("eposta");

  try {
    if (await googleSignInNeedsConsent(user)) {
      return googleConsentHref(next);
    }
    const linked = await ensureCustomerForSupabaseUser(user);
    if (!linked.ok) {
      return refuse(
        linked.reason === "account_disabled"
          ? "devredisi"
          : linked.reason === "missing_email"
            ? "eposta"
            : "hata",
      );
    }
    await setActiveCustomerSession(linked.customer.email);
  } catch (err) {
    if (!isDbUnreachable(err)) throw err;
    console.error("[uye/google] database unreachable after Google sign-in");
    return refuse("hata");
  }
  return next ?? "/uye/hesap";
}
