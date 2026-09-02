"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { logAudit } from "@/lib/admin/audit";
import { getAdminSession } from "@/lib/admin/auth";
import {
  cancelEnrollment,
  disable2FA,
  startEnrollment,
  verifyAndEnable,
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

export async function disable2FAAction() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/giris");
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

/**
 * Wrapper used by the page to obtain a fresh enrollment draft before
 * rendering. Lives in the server actions file so the page can call it
 * without becoming a client component.
 */
export async function freshEnrollment(): Promise<EnrollmentDraft | null> {
  const session = await getAdminSession();
  if (!session) return null;
  return startEnrollment(session.email, "L'Affogato Admin");
}
