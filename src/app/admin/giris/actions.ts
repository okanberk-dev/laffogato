"use server";

import { redirect } from "next/navigation";

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
    return { error: result.error ?? "Giriş başarısız." };
  }

  redirect(next.startsWith("/admin") ? next : "/admin");
}
