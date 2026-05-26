"use server";

import { redirect } from "next/navigation";

import { cancelPending2FA, complete2FA } from "@/lib/admin/auth";

export interface TwoFAState {
  error?: string;
}

export async function verify2FAAction(
  _prev: TwoFAState,
  formData: FormData,
): Promise<TwoFAState> {
  const token = String(formData.get("token") ?? "").trim();
  const next = String(formData.get("next") ?? "/admin");
  if (!token) return { error: "6 haneli kodu gir." };
  const result = await complete2FA(token);
  if (!result.ok) {
    return { error: result.error ?? "Doğrulama başarısız." };
  }
  redirect(next.startsWith("/admin") ? next : "/admin");
}

export async function cancel2FAAction() {
  await cancelPending2FA();
  redirect("/admin/giris");
}
