"use server";

import { redirect } from "next/navigation";

import { cancelPending2FA, complete2FA } from "@/lib/admin/auth";
import { adminNextPath } from "@/lib/admin/next-path";
import { landingPathFor } from "@/lib/admin/roles";

export interface TwoFAState {
  error?: string;
}

export async function verify2FAAction(
  _prev: TwoFAState,
  formData: FormData,
): Promise<TwoFAState> {
  const token = String(formData.get("token") ?? "").trim();
  const next = adminNextPath(formData.get("next"));
  if (!token) return { error: "6 haneli kodu gir." };
  const result = await complete2FA(token);
  if (!result.ok) {
    return { error: result.error ?? "Doğrulama başarısız." };
  }
  // Not "/admin" by default: a cashier has no dashboard and would be
  // bounced from it.
  redirect(next ?? landingPathFor(result.role ?? "staff"));
}

export async function cancel2FAAction() {
  await cancelPending2FA();
  redirect("/admin/giris");
}
