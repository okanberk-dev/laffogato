"use server";

import { redirect } from "next/navigation";

import { logAudit } from "@/lib/admin/audit";
import { signInAdmin } from "@/lib/admin/auth";

export interface LoginState {
  error?: string;
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/admin");

  if (!email || !password) {
    return { error: "E-posta ve şifre gerekli." };
  }

  const result = await signInAdmin(email, password);
  if (!result.ok) {
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

  if (result.needs2FA) {
    const target = `/admin/iki-asama?next=${encodeURIComponent(
      next.startsWith("/admin") ? next : "/admin",
    )}`;
    redirect(target);
  }

  redirect(next.startsWith("/admin") ? next : "/admin");
}
