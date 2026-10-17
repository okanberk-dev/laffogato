"use server";

import { redirect } from "next/navigation";

import { logAudit } from "@/lib/admin/audit";
import { signInAdmin } from "@/lib/admin/auth";
import { adminNextPath } from "@/lib/admin/next-path";
import { landingPathFor } from "@/lib/admin/roles";

export interface LoginState {
  error?: string;
}

/** The longest address SMTP carries (RFC 5321); nobody's login is longer. */
const MAX_EMAIL_LENGTH = 254;

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const requested = String(formData.get("next") ?? "");

  if (!email || !password) {
    return { error: "E-posta ve şifre gerekli." };
  }
  // Before anything is counted or written: the address becomes the rate-limit
  // key and the audit row's actor, and the page is open to anyone, so an
  // unbounded string reached both (a value past the index row limit was the
  // error screen instead of an answer).
  if (email.length > MAX_EMAIL_LENGTH || !email.includes("@")) {
    return { error: "Geçerli bir e-posta gir." };
  }

  const result = await signInAdmin(email, password);
  if (!result.ok) {
    // A throttled attempt never reached the credential check; recording it
    // would let anyone fill audit_logs by hammering a locked key.
    if (result.throttled) {
      return { error: result.error ?? "Giriş başarısız." };
    }
    await logAudit({
      action: "login_fail",
      entity: "auth",
      entityId: email.toLowerCase(),
      actor: email.toLowerCase(),
    });
    return { error: result.error ?? "Giriş başarısız." };
  }

  await logAudit({
    action: "login_success",
    entity: "auth",
    entityId: email.toLowerCase(),
    actor: email.toLowerCase(),
    payload: { needs2FA: Boolean(result.needs2FA) },
  });

  // A cashier has no dashboard: sending every role to /admin would deny them
  // there and bounce them straight back out. `landingPathFor` is where the
  // role can actually work.
  const landing = landingPathFor(result.role ?? "staff");
  const next = adminNextPath(requested) ?? landing;

  if (result.needs2FA) {
    redirect(`/admin/iki-asama?next=${encodeURIComponent(next)}`);
  }

  redirect(next);
}
