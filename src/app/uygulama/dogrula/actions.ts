"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  EMAIL_LINK_COOKIE,
  EMAIL_LINK_PATH,
  parseEmailLink,
} from "@/lib/customer/email-link";
import { getSupabaseAnonClient } from "@/lib/supabase/anon";

/**
 * The button on /uygulama/dogrula: confirms the address the sign-up mail was
 * sent to (operator, 5 Kas 2026: "e-posta doğrulama ... direkt uygulamadan
 * doğrulansın"; on an iPhone with the app the same link opens the app).
 *
 * A POST, never the page view: mail security scanners open every link in a
 * message, and a token spent by a robot would greet the member with
 * "geçersiz" (the newsletter's lesson, CLAUDE.md "Bülten onayı ... düğmedir").
 *
 * Confirms only. The stateless anon client keeps no session, so nobody is
 * signed in on this browser by it: the member signs in as usual, in the app
 * or here. Public by nature (every export of a "use server" file is a POST
 * endpoint, rule 27): it takes nothing but the token from the form, the
 * token is unguessable, and Supabase rate-limits its own verify.
 */
export async function confirmEmailLinkAction(formData: FormData) {
  const link = parseEmailLink(
    String(formData.get("token_hash") ?? ""),
    String(formData.get("type") ?? ""),
  );
  await forgetLink();
  if (!link) redirect(`${EMAIL_LINK_PATH}?sonuc=gecersiz`);

  let outcome: "tamam" | "gecersiz" | "hata" = "hata";
  try {
    const { error } = await getSupabaseAnonClient().auth.verifyOtp({
      token_hash: link.tokenHash,
      type: link.type,
    });
    if (!error) outcome = "tamam";
    else if (error.status !== undefined && error.status < 500) {
      // Expired, already used or unknown: the member asks for a new mail.
      outcome = "gecersiz";
    } else {
      console.error("[uygulama/dogrula] verify failed", error.message);
    }
  } catch (err) {
    console.error("[uygulama/dogrula] verify failed", err);
  }
  redirect(`${EMAIL_LINK_PATH}?sonuc=${outcome}`);
}

/** The parked token is spent or refused once the button is pressed. Not exported (rule 27). */
async function forgetLink(): Promise<void> {
  try {
    (await cookies()).delete({
      name: EMAIL_LINK_COOKIE,
      path: EMAIL_LINK_PATH,
    });
  } catch {
    // Outside a request (a test calling the action directly): nothing parked.
  }
}
