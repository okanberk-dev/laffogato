import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

import {
  googleReturnUrl,
  signInWithNotice,
} from "@/lib/customer/google-sign-in-core";
import { sameSitePath } from "@/lib/http/same-site-path";
import { SITE } from "@/lib/seo/site";
import { getSiteSettings } from "@/lib/seo/site-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * `GET /uye/google` - "Google ile devam et" (docs/AUTH-BRIDGE.md §7).
 *
 * Asks Supabase for Google's address and sends the browser there. The
 * cookie-backed client runs the PKCE flow: the code verifier is written to
 * this response's cookies, and only this browser can spend the code Google
 * sends back (`/uye/google/donus`), so a code copied into another browser
 * signs nobody in. Nothing else happens here: no network call (the address
 * is built locally), no database write.
 *
 * A GET reached by a plain link, never a form: `form-action 'self'` would
 * block the hop to Supabase after a form submission (`googleStartHref`).
 *
 * Closed while the panel switch is off (Mobil → Ayarlar → Giriş yöntemleri):
 * a stale page or a typed address gets the sign-in page's "kapalı" line
 * rather than a Supabase error about a provider nobody configured.
 */
export async function GET(request: NextRequest) {
  const next = sameSitePath(request.nextUrl.searchParams.get("next"));
  const settings = await getSiteSettings();
  if (!settings.mobileApp.signIn.google) {
    redirect(signInWithNotice("kapali", next));
  }

  let url = "";
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: googleReturnUrl(SITE.url, next),
        // The account chooser every time: a shared computer's last Google
        // account must not be signed in without the member picking it.
        queryParams: { prompt: "select_account" },
        // Server side there is no window to move; the address comes back.
        skipBrowserRedirect: true,
      },
    });
    if (error) {
      console.error(`[uye/google] start refused: ${error.message}`);
    } else {
      url = data.url ?? "";
    }
  } catch (err) {
    console.error(
      `[uye/google] start failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  // Outside the try: `redirect` throws by design.
  if (!url) redirect(signInWithNotice("hata", next));
  redirect(url);
}
