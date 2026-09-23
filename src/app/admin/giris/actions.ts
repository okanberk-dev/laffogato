"use server";

import { redirect } from "next/navigation";

import { logAudit } from "@/lib/admin/audit";
import { signInAdmin } from "@/lib/admin/auth";
import { landingPathFor } from "@/lib/admin/roles";

export interface LoginState {
  error?: string;
}

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
  const next = requested.startsWith("/admin") ? requested : landing;

  if (result.needs2FA) {
    redirect(`/admin/iki-asama?next=${encodeURIComponent(next)}`);
  }

  redirect(next);
}
