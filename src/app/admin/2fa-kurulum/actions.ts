"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { logAudit } from "@/lib/admin/audit";
import { getAdminSession } from "@/lib/admin/auth";
import {
  clearLoginLimit,
  clientIp,
  reserveLoginAttempt,
} from "@/lib/admin/rate-limit";
import {
  cancelEnrollment,
  disable2FA,
  verifyAndEnable,
  verifyToken,
  type EnrollmentDraft,
} from "@/lib/admin/twofa";

export interface EnrollState {
  error?: string;
  draft?: EnrollmentDraft;
  enabled?: boolean;
}

export async function verifyEnrollAction(
  _prev: EnrollState,
  formData: FormData,
): Promise<EnrollState> {
  const session = await getAdminSession();
  if (!session) return { error: "Oturum yok." };
  const token = String(formData.get("token") ?? "").trim();
  if (!/^\d{6}$/.test(token)) return { error: "6 haneli kodu gir." };
  const ok = await verifyAndEnable(session.email, token);
  if (!ok)
    return { error: "Kod doğrulanmadı. Saatin senkron olduğundan emin ol." };
  await logAudit({
    action: "2fa_enable",
    entity: "2fa",
    entityId: session.email,
  });
  revalidatePath("/admin/2fa-kurulum");
  revalidatePath("/admin/ayarlar");
  return { enabled: true };
}

/**
 * Turning the second factor off takes the second factor. It used to take only
 * the session, so a stolen cookie was enough to strip 2FA from the account and
 * keep it for good. The code is spent (replay-guarded) and counted against the
 * same budgets as the sign-in step.
 */
export async function disable2FAAction(formData: FormData) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/giris");
  const token = String(formData.get("token") ?? "").trim();
  const ip = await clientIp();
  // Both budgets the sign-in step uses. The per-address one alone let a
  // stolen cookie guess six digits from as many addresses as it could rotate
  // through; the account key adds the guesses up wherever they come from.
  const perAddress = await reserveLoginAttempt("admin-2fa", ip, session.email);
  const limit = perAddress.blocked
    ? perAddress
    : await reserveLoginAttempt("admin-2fa-account", "*", session.email);
  if (limit.blocked) redirect("/admin/2fa-kurulum?hata=kilit");
  if (!/^\d{6}$/.test(token) || !(await verifyToken(session.email, token))) {
    redirect("/admin/2fa-kurulum?hata=kod");
  }
  await clearLoginLimit("admin-2fa", ip, session.email);
  await clearLoginLimit("admin-2fa-account", "*", session.email);
  await disable2FA(session.email);
  await logAudit({
    action: "2fa_disable",
    entity: "2fa",
    entityId: session.email,
  });
  revalidatePath("/admin/2fa-kurulum");
  revalidatePath("/admin/ayarlar");
}

export async function cancelEnrollAction() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/giris");
  await cancelEnrollment(session.email);
  revalidatePath("/admin/2fa-kurulum");
}
