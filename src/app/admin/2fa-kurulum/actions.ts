"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { safeAudit } from "@/lib/admin/audit";
import { getAdminSession } from "@/lib/admin/auth";
import { setAdminFlash } from "@/lib/admin/flash";
import {
  clearLoginLimit,
  clientIp,
  reserveLoginAttempt,
} from "@/lib/admin/rate-limit";
import { landingPathFor } from "@/lib/admin/roles";
import {
  cancelEnrollment,
  disable2FA,
  verifyAndEnable,
  verifyToken,
} from "@/lib/admin/twofa";

const SETUP_PATH = "/admin/2fa-kurulum";

export interface EnrollState {
  error?: string;
}

/**
 * Turning the second factor on. The answer is a toast on the page the role
 * lands on: the setup page re-rendered into its "aktif" view under the form,
 * so the form's own success line (and its link to /admin, which bounced a
 * cashier) was never seen.
 */
export async function verifyEnrollAction(
  _prev: EnrollState,
  formData: FormData,
): Promise<EnrollState> {
  const session = await getAdminSession();
  if (!session) return { error: "Oturum yok." };
  const token = String(formData.get("token") ?? "").trim();
  if (!/^\d{6}$/.test(token)) return { error: "6 haneli kodu gir." };
  const ok = await verifyAndEnable(session.email, token);
  if (!ok) {
    // The page keeps its QR for 15 minutes (twofa.ts DRAFT_REUSE_MS); after
    // that a reload shows a new one, which a phone scanned earlier lacks.
    return {
      error:
        "Kod doğrulanmadı. Kodu yeniden gir; yine olmazsa sayfayı yenileyip QR kodu yeniden tarat. Telefonunun saati otomatik ayarda olmalı.",
    };
  }
  // 2FA is on whatever happens to the row: the row records it, it is not
  // a condition of it.
  await safeAudit({
    action: "2fa_enable",
    entity: "2fa",
    entityId: session.email,
  });
  revalidatePath(SETUP_PATH);
  revalidatePath("/admin/ayarlar");
  await setAdminFlash(
    "İki adımlı doğrulama açıldı. Sonraki girişte şifreden sonra 6 haneli kod istenir.",
  );
  redirect(landingPathFor(session.role));
}

/**
 * Turning the second factor off takes the second factor. It used to take only
 * the session, so a stolen cookie was enough to strip 2FA from the account and
 * keep it for good. The code is spent (replay-guarded) and counted against the
 * same budgets as the sign-in step.
 *
 * Every answer is a flash: a refusal used to ride in the URL (`?hata=kod`)
 * and came back on every reload, and a success said nothing at all - the
 * page just switched to a fresh QR.
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
  if (limit.blocked) {
    await setAdminFlash(
      "Çok fazla hatalı kod. Bir süre sonra tekrar dene.",
      "danger",
    );
    redirect(SETUP_PATH);
  }
  if (!/^\d{6}$/.test(token) || !(await verifyToken(session.email, token))) {
    await setAdminFlash(
      "Kod doğrulanmadı. Doğrulama uygulamandaki güncel 6 haneli kodu gir.",
      "danger",
    );
    redirect(SETUP_PATH);
  }
  await clearLoginLimit("admin-2fa", ip, session.email);
  await clearLoginLimit("admin-2fa-account", "*", session.email);
  await disable2FA(session.email);
  await safeAudit({
    action: "2fa_disable",
    entity: "2fa",
    entityId: session.email,
  });
  revalidatePath(SETUP_PATH);
  revalidatePath("/admin/ayarlar");
  // Off the setup page: staying there rendered a new QR, and with it a
  // draft nobody asked for.
  await setAdminFlash("İki adımlı doğrulama kapatıldı.", "warning");
  redirect(landingPathFor(session.role));
}

/**
 * "Vazgeç" drops the draft and leaves. It used to only revalidate, so the
 * page rendered straight back with a new QR: it did not cancel anything.
 */
export async function cancelEnrollAction() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/giris");
  await cancelEnrollment(session.email);
  revalidatePath(SETUP_PATH);
  await setAdminFlash(
    "Kurulum iptal edildi; iki adımlı doğrulama kapalı.",
    "info",
  );
  redirect(landingPathFor(session.role));
}
